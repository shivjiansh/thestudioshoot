import { createHash } from "node:crypto";
import sharp from "sharp";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
import { verifyEditorSourceToken } from "@/lib/images/editor-token";
import { watermarkSvg } from "@/lib/images/watermark";
import { getPlan } from "@/config/plans";
import { assertSameOrigin } from "@/lib/http/security";
import { HttpError, fail, rid } from "@/lib/http/errors";

export const runtime = "nodejs";
const exportFormatSchema = z.enum(["jpeg", "webp", "pdf"]);
const MAX_DECODED_BYTES = 4 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

function currentUtcMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function maxDimensionForPlan(planId: string) {
  const resolution = getPlan(planId).maxResolution;
  return resolution === "4K" ? 3840 : resolution === "2K" ? 2048 : 1024;
}

function makePdfFromJpeg(jpeg: Buffer, imageWidth: number, imageHeight: number) {
  const pageWidth = Number((imageWidth * 0.75).toFixed(3));
  const pageHeight = Number((imageHeight * 0.75).toFixed(3));
  const objects: Buffer[] = [];
  objects.push(Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n", "ascii"));
  objects.push(Buffer.from("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n", "ascii"));
  objects.push(Buffer.from(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`, "ascii"));
  objects.push(Buffer.concat([
    Buffer.from(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, "ascii"),
    jpeg,
    Buffer.from("\nendstream\nendobj\n", "ascii"),
  ]));
  const content = Buffer.from(`q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`, "ascii");
  objects.push(Buffer.concat([Buffer.from(`5 0 obj\n<< /Length ${content.length} >>\nstream\n`, "ascii"), content, Buffer.from("endstream\nendobj\n", "ascii")]));

  const header = Buffer.from("%PDF-1.4\n%StudioShot\n", "ascii");
  const parts: Buffer[] = [header];
  const offsets: number[] = [0];
  let length = header.length;
  for (const object of objects) {
    offsets.push(length);
    parts.push(object);
    length += object.length;
  }
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++) xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  const trailer = Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, "ascii");
  parts.push(trailer);
  return Buffer.concat(parts);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = rid(request);
  try {
    assertSameOrigin(request);
    const user = await currentUser();
    if (!user) throw new HttpError("UNAUTHENTICATED", "Sign in to export this image.", 401);
    const { id: assetId } = await context.params;
    if (!/^(?:[a-f0-9-]{36}|api_[a-f0-9]{64})$/i.test(assetId)) throw new HttpError("INVALID_ASSET_ID", "Invalid asset identifier.", 400);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    if (idempotencyKey.length < 8 || idempotencyKey.length > 128) throw new HttpError("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.", 400);

    const format = exportFormatSchema.parse(request.headers.get("X-Export-Format"));
    const sourceToken = request.headers.get("X-Editor-Source-Token") ?? "";
    const claims = verifyEditorSourceToken(sourceToken, user.uid, assetId);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("image/jpeg")) {
      throw new HttpError("INVALID_IMAGE", "The edited image must be uploaded as JPEG data.", 400);
    }
    const imageBytes = Buffer.from(await request.arrayBuffer());
    if (!imageBytes.length || imageBytes.length > MAX_DECODED_BYTES) throw new HttpError("IMAGE_TOO_LARGE", "The edited image is too large to export. Apply a crop or reduce the image detail and try again.", 413);
    const metadata = await sharp(imageBytes, { failOn: "error", limitInputPixels: MAX_PIXELS }).metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS || !["jpeg", "png"].includes(metadata.format ?? "")) {
      throw new HttpError("IMAGE_INVALID", "The edited image could not be validated.", 400);
    }

    const profileRef = db.collection("users").doc(user.uid);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) throw new HttpError("ACCOUNT_NOT_FOUND", "User profile was not found.", 404);
    const profile = profileSnap.data()!;
    const storedPlanId = String(profile.planId ?? "free");
    const effectivePlanId = storedPlanId !== "free" && profile.subscriptionStatus !== "active" ? "free" : getPlan(storedPlanId).id;
    const initialPlan = getPlan(effectivePlanId);
    const initialDimension = maxDimensionForPlan(effectivePlanId);

    async function renderOutput(watermark: boolean, maxDimension: number) {
      let pipeline = sharp(imageBytes, { failOn: "error", limitInputPixels: MAX_PIXELS }).rotate()
        .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true });
      if (watermark && !claims.watermarked) {
        const resized = await pipeline.png().toBuffer();
        const resizedMetadata = await sharp(resized).metadata();
        if (!resizedMetadata.width || !resizedMetadata.height) throw new HttpError("IMAGE_INVALID", "Could not inspect the edited image.", 400);
        pipeline = sharp(resized).composite([{ input: watermarkSvg(resizedMetadata.width, resizedMetadata.height), left: 0, top: 0 }]);
      }
      const output = format === "webp" ? await pipeline.webp({ quality: 92 }).toBuffer() : await pipeline.jpeg({ quality: 94, mozjpeg: true }).toBuffer();
      const outputMetadata = await sharp(output).metadata();
      if (!outputMetadata.width || !outputMetadata.height) throw new HttpError("IMAGE_INVALID", "Could not inspect the final export.", 500);
      return { output, width: outputMetadata.width, height: outputMetadata.height };
    }

    // Validate/render before charging the export counter; re-render if the plan changes in the transaction.
    let rendered = await renderOutput(initialPlan.watermark, initialDimension);
    const eventId = createHash("sha256").update(`${user.uid}:${assetId}:${idempotencyKey}`).digest("hex");
    const eventRef = db.collection("exportEvents").doc(eventId);
    const finalPlan = await db.runTransaction(async (transaction) => {
      const [currentProfileSnap, existingExport] = await Promise.all([transaction.get(profileRef), transaction.get(eventRef)]);
      if (!currentProfileSnap.exists) throw new HttpError("ACCOUNT_NOT_FOUND", "User profile was not found.", 404);
      const currentProfile = currentProfileSnap.data()!;
      const stored = String(currentProfile.planId ?? "free");
      const planId = stored !== "free" && currentProfile.subscriptionStatus !== "active" ? "free" : getPlan(stored).id;
      const plan = getPlan(planId);
      if (existingExport.exists) return { planId, watermark: plan.watermark, maxDimension: maxDimensionForPlan(planId) };
      let remaining = Number(currentProfile.exportsRemaining ?? plan.exportsPerMonth);
      const periodKey = currentUtcMonthKey();
      if (planId === "free") {
        remaining = Math.min(remaining, plan.exportsPerMonth);
        if (currentProfile.exportsPeriodKey !== periodKey) remaining = plan.exportsPerMonth;
      }
      if (!Number.isSafeInteger(remaining) || remaining <= 0) throw new HttpError("EXPORT_LIMIT_REACHED", "You have used all exports for this usage period. Review your plan to continue.", 402);
      transaction.set(profileRef, {
        planId,
        exportsRemaining: remaining - 1,
        ...(planId === "free" ? { exportsPeriodKey: periodKey } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.create(eventRef, {
        uid: user.uid,
        assetId,
        planId,
        format,
        editorExport: true,
        watermarked: plan.watermark,
        idempotencyHash: createHash("sha256").update(idempotencyKey).digest("hex"),
        createdAt: FieldValue.serverTimestamp(),
        requestId,
      });
      return { planId, watermark: plan.watermark, maxDimension: maxDimensionForPlan(planId) };
    });

    if (finalPlan.watermark !== initialPlan.watermark || finalPlan.maxDimension !== initialDimension) {
      rendered = await renderOutput(finalPlan.watermark, finalPlan.maxDimension);
    }

    const body = format === "pdf" ? makePdfFromJpeg(rendered.output, rendered.width, rendered.height) : rendered.output;
    const mime = format === "pdf" ? "application/pdf" : format === "webp" ? "image/webp" : "image/jpeg";
    const extension = format === "jpeg" ? "jpg" : format;
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename=thestudioshot-${assetId}.${extension}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Export-Watermarked": String(finalPlan.watermark),
        "X-Export-Max-Dimension": String(finalPlan.maxDimension),
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
