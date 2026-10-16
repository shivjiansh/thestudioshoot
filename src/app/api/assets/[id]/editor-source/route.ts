import { currentUser } from "@/lib/auth/session";
import { db, storage } from "@/lib/firebase/admin";
import { createEditorSourceToken } from "@/lib/images/editor-token";
import { renderPng } from "@/lib/images/watermark";
import { HttpError, fail, rid } from "@/lib/http/errors";
import { getPlan } from "@/config/plans";
import fs from 'fs';
import path from 'path';

export const runtime = "nodejs";

function maxDimensionForPlan(planId: string) {
  const resolution = getPlan(planId).maxResolution;
  return resolution === "4K" ? 3840 : resolution === "2K" ? 2048 : 1024;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = rid(request);
  try {
    const user = await currentUser();
    if (!user) throw new HttpError("UNAUTHENTICATED", "Sign in to edit this image.", 401);

    const { id: assetId } = await context.params;
    if (!/^(?:[a-f0-9-]{36}|api_[a-f0-9]{64})$/i.test(assetId)) {
      throw new HttpError("INVALID_ASSET_ID", "Invalid asset identifier.", 400);
    }
    const [assetSnap, profileSnap] = await Promise.all([
      db.collection("generatedAssets").doc(assetId).get(),
      db.collection("users").doc(user.uid).get(),
    ]);
    // if (!assetSnap.exists || assetSnap.data()?.uid !== user.uid) throw new HttpError("ASSET_NOT_FOUND", "Image not found.", 404);
    // if (!profileSnap.exists) throw new HttpError("ACCOUNT_NOT_FOUND", "User profile was not found.", 404);

    const storagePath = String(assetSnap.data()?.storagePath ?? "");
    // if (!storagePath.startsWith(`users/${user.uid}/generated/`) || storagePath.includes("..")) {
    //   throw new HttpError("ASSET_PATH_INVALID", "Stored image path is invalid.", 500);
    // }
    const profile = profileSnap.data()!;
    const storedPlanId = String(profile.planId ?? "free");
    const planId = storedPlanId !== "free" && profile.subscriptionStatus !== "active" ? "free" : getPlan(storedPlanId).id;
    const plan = getPlan(planId);
    // const [downloaded] = await storage.bucket().file(storagePath).download();
    const downloaded = fs.readFileSync(
      path.join(
        process.cwd(),
        "public",
        "img.png"
      ))

    const { output } = await renderPng(downloaded, true, "TheStudioShot  •  FREE PLAN", maxDimensionForPlan(planId));
    const token = createEditorSourceToken({
      uid: user.uid,
      assetId,
      watermarked: true,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    return new Response(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": "inline; filename=studio-editor-source.png",
        "X-Editor-Source-Token": token,
        "X-Request-Id": requestId,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const response = fail(error, requestId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
