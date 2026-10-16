import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { renderPng } from "@/lib/images/watermark";
import { currentUser } from "@/lib/auth/session";
import { storage, db } from "@/lib/firebase/admin";
import { getPlan } from "@/config/plans";
import { assertSameOrigin } from "@/lib/http/security";
import { HttpError, fail, rid } from "@/lib/http/errors";

export const runtime = "nodejs";

function currentUtcMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function maxDimensionForPlan(planId: string) {
  const resolution = getPlan(planId).maxResolution;
  return resolution === "4K" ? 3840 : resolution === "2K" ? 2048 : 1024;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = rid(request);
  try {
    assertSameOrigin(request);
    const user = await currentUser();
    if (!user) throw new HttpError("UNAUTHENTICATED", "Sign in to export images.", 401);

    const { id: assetId } = await context.params;
    if (!/^(?:[a-f0-9-]{36}|api_[a-f0-9]{64})$/i.test(assetId)) throw new HttpError("INVALID_ASSET_ID", "Invalid asset identifier.", 400);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    if (idempotencyKey.length < 8 || idempotencyKey.length > 128) throw new HttpError("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.", 400);

    const assetSnap = await db.collection("generatedAssets").doc(assetId).get();
    if (!assetSnap.exists || assetSnap.data()?.uid !== user.uid) throw new HttpError("ASSET_NOT_FOUND", "Image not found.", 404);
    const asset = assetSnap.data()!;
    const storagePath = String(asset.storagePath ?? "");
    if (!storagePath.startsWith(`users/${user.uid}/generated/`) || storagePath.includes("..")) {
      throw new HttpError("ASSET_PATH_INVALID", "Stored image path is invalid.", 500);
    }

    const profileRef = db.collection("users").doc(user.uid);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) throw new HttpError("ACCOUNT_NOT_FOUND", "User profile was not found.", 404);
    const profile = profileSnap.data()!;
    // A stale paid plan must not retain unwatermarked export privileges after subscription expiry.
    const storedPlanId = String(profile.planId ?? "free");
    const effectivePlanId = storedPlanId !== "free" && profile.subscriptionStatus !== "active" ? "free" : getPlan(storedPlanId).id;
    const plan = getPlan(effectivePlanId);

    const [downloaded] = await storage.bucket().file(storagePath).download();
    let { output } = await renderPng(downloaded, plan.watermark, "TheStudioShot  •  FREE PLAN", maxDimensionForPlan(effectivePlanId));

    const eventId = createHash("sha256").update(`${user.uid}:${assetId}:${idempotencyKey}`).digest("hex");
    const eventRef = db.collection("exportEvents").doc(eventId);
    const watermarked = await db.runTransaction(async (transaction) => {
      const [currentProfileSnap, existingExport] = await Promise.all([transaction.get(profileRef), transaction.get(eventRef)]);
      if (!currentProfileSnap.exists) throw new HttpError("ACCOUNT_NOT_FOUND", "User profile was not found.", 404);
      const currentProfile = currentProfileSnap.data()!;
      const latestStoredPlanId = String(currentProfile.planId ?? "free");
      const latestEffectivePlanId = latestStoredPlanId !== "free" && currentProfile.subscriptionStatus !== "active" ? "free" : getPlan(latestStoredPlanId).id;
      const currentPlan = getPlan(latestEffectivePlanId);
      if (existingExport.exists) return { watermark: currentPlan.watermark, maxDimension: maxDimensionForPlan(latestEffectivePlanId) }; // Idempotent retry: no second deduction.
      let remaining = Number(currentProfile.exportsRemaining ?? currentPlan.exportsPerMonth);
      const periodKey = currentUtcMonthKey();
      if (latestEffectivePlanId === "free") {
        remaining = Math.min(remaining, currentPlan.exportsPerMonth);
        if (currentProfile.exportsPeriodKey !== periodKey) remaining = currentPlan.exportsPerMonth;
      }
      if (!Number.isSafeInteger(remaining) || remaining <= 0) throw new HttpError("EXPORT_LIMIT_REACHED", "You have used all exports for this usage period. Review your plan to continue.", 402);
      transaction.set(profileRef, {
        planId: latestEffectivePlanId,
        exportsRemaining: remaining - 1,
        ...(latestEffectivePlanId === "free" ? { exportsPeriodKey: periodKey } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.create(eventRef, {
        uid: user.uid, assetId, planId: latestEffectivePlanId, watermarked: currentPlan.watermark,
        idempotencyHash: createHash("sha256").update(idempotencyKey).digest("hex"),
        createdAt: FieldValue.serverTimestamp(), requestId,
      });
      return { watermark: currentPlan.watermark, maxDimension: maxDimensionForPlan(latestEffectivePlanId) };
    });
    // Re-render against the exact entitlement state used by the counter transaction.
    if (watermarked.watermark !== plan.watermark || watermarked.maxDimension !== maxDimensionForPlan(effectivePlanId)) {
      output = (await renderPng(downloaded, watermarked.watermark, "TheStudioShot  •  FREE PLAN", watermarked.maxDimension)).output;
    }

    return new Response(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="thestudioshot-${assetId}.png"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Export-Watermarked": watermarked.watermark ? "true" : "false",
        "X-Export-Max-Dimension": String(watermarked.maxDimension),
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    const response = fail(error, requestId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
