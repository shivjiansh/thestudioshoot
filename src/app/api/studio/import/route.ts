import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
import { getPlan } from "@/config/plans";
import { assertSameOrigin } from "@/lib/http/security";
import { saveImage, deleteImage } from "@/lib/storage/service";
import { HttpError, fail, rid } from "@/lib/http/errors";
import { z } from "zod";

export const runtime = "nodejs";
const schema = z.object({ imageDataUrl: z.string().min(1).max(4_000_000) });
const FORMAT_BY_MIME: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
const MAX_DECODED_BYTES = 3 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

export async function POST(request: Request) {
  const requestId = rid(request);
  let uploadedPath: string | undefined;
  try {
    assertSameOrigin(request);
    const user = await currentUser();
    if (!user) throw new HttpError("UNAUTHENTICATED", "Sign in to save a product image.", 401);
    const { imageDataUrl } = schema.parse(await request.json());
    const match = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new HttpError("INVALID_IMAGE", "Image must be a JPEG, PNG, or WebP data URL.", 400);
    const mime = match[1];
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > MAX_DECODED_BYTES) throw new HttpError("IMAGE_TOO_LARGE", "Compressed image must be 3 MB or smaller.", 413);

    const metadata = await sharp(bytes, { failOn: "error", limitInputPixels: MAX_PIXELS }).metadata();
    if (metadata.format !== FORMAT_BY_MIME[mime]) throw new HttpError("MIME_MISMATCH", "Declared image type does not match its actual contents.", 400);
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) throw new HttpError("IMAGE_DIMENSIONS_INVALID", "Image dimensions exceed the supported limit.", 400);

    // Normalize imported files to PNG before writing to private storage.
    const normalized = await sharp(bytes, { failOn: "error", limitInputPixels: MAX_PIXELS }).rotate().png().toBuffer();
    const assetId = randomUUID();
    const savedPath = await saveImage(user.uid, assetId, `data:image/png;base64,${normalized.toString("base64")}`);
    uploadedPath = savedPath;
    const assetRef = db.collection("generatedAssets").doc(assetId);
    const profileRef = db.collection("users").doc(user.uid);

    await db.runTransaction(async (tx) => {
      const profileSnap = await tx.get(profileRef);
      if (!profileSnap.exists) throw new HttpError("ACCOUNT_NOT_FOUND", "Account profile was not found.", 404);
      const profile = profileSnap.data()!;
      const storedPlanId = String(profile.planId ?? "free");
      const planId = storedPlanId !== "free" && profile.subscriptionStatus !== "active" ? "free" : getPlan(storedPlanId).id;
      const importLimit = getPlan(planId).maxImportedAssets;
      const currentCount = Number(profile.importedAssetCount ?? 0);
      if (!Number.isSafeInteger(currentCount) || currentCount < 0) throw new HttpError("ACCOUNT_USAGE_INVALID", "Account usage data is invalid.", 500);
      if (currentCount >= importLimit) throw new HttpError("IMPORT_LIMIT_REACHED", `Your ${getPlan(planId).name} plan allows up to ${importLimit.toLocaleString("en-IN")} imported assets.`, 402);
      tx.create(assetRef, {
        uid: user.uid,
        jobId: assetId,
        storagePath: savedPath,
        prompt: "Imported source product photo",
        mode: "import",
        quality: "original",
        model: "user-upload",
        status: "saved",
        source: "imported",
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(profileRef, { importedAssetCount: currentCount + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });

    return NextResponse.json({ assetId, previewUrl: `/api/assets/${assetId}/preview`, source: "imported", requestId }, { status: 201 });
  } catch (error) {
    if (uploadedPath) await deleteImage(uploadedPath).catch((cleanupError) => console.error("Failed to clean up rejected upload", { requestId, cleanupError }));
    return fail(error, requestId);
  }
}
