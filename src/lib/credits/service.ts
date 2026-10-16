import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { getPlan, resolutionAllowed, type Resolution } from "@/config/plans";
import { HttpError } from "@/lib/http/errors";
import { isActiveSubscription } from "@/lib/entitlements/access";

export type GeneratedAssetRecord = {
  storagePath: string;
  model: string;
  prompt: string;
  mode: string;
  quality: string;
  source: "studio" | "developer_api";
  resolution: string;
};

export async function reserve(uid: string, jobId: string, credits: number, planId: string, resolution: Resolution) {
  const userRef = db.collection("users").doc(uid);
  const jobRef = db.collection("generationJobs").doc(jobId);
  const ledgerRef = db.collection("creditLedger").doc(`${jobId}_reserve`);
  await db.runTransaction(async (tx) => {
    const [userSnap, jobSnap, ledgerSnap] = await Promise.all([tx.get(userRef), tx.get(jobRef), tx.get(ledgerRef)]);
    if (ledgerSnap.exists || jobSnap.exists) throw new HttpError("DUPLICATE_JOB", "This generation was already submitted.", 409);
    const user = userSnap.data() ?? {};
    const plan = getPlan(planId);
    if (!plan.aiGeneration) throw new HttpError("PLAN_BLOCKED", "AI generation is disabled on Free. Choose a paid plan.", 403);
    if (!resolutionAllowed(resolution, plan.maxResolution)) throw new HttpError("RESOLUTION_LIMIT", `Your ${plan.name} plan supports up to ${plan.maxResolution} output.`, 403);
    if (!isActiveSubscription(user.subscriptionStatus)) {
      throw new HttpError("SUBSCRIPTION_INACTIVE", "Your paid subscription is not active.", 403);
    }
    const balance = Number(user.aiCreditsRemaining ?? 0);
    if (!Number.isSafeInteger(credits) || credits <= 0) throw new HttpError("INVALID_CREDIT_COST", "Generation credit cost is invalid.", 500);
    if (!Number.isSafeInteger(balance) || balance < credits) throw new HttpError("INSUFFICIENT_CREDITS", "Not enough AI credits.", 402);
    tx.set(userRef, { aiCreditsRemaining: balance - credits, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.create(jobRef, { uid, jobId, status: "processing", planId, creditsReserved: credits, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.create(ledgerRef, { uid, jobId, type: "reservation", amount: -credits, reason: "generation_started", createdAt: FieldValue.serverTimestamp() });
  });
}

/** Commit the successful job and its asset in one transaction, or refund a failed reservation once. */
export async function finalize(uid: string, jobId: string, status: "succeeded" | "failed", asset?: GeneratedAssetRecord) {
  const jobRef = db.collection("generationJobs").doc(jobId);
  const userRef = db.collection("users").doc(uid);
  const assetRef = db.collection("generatedAssets").doc(jobId);
  const refundRef = db.collection("creditLedger").doc(`${jobId}_refund`);
  const consumeRef = db.collection("creditLedger").doc(`${jobId}_consume`);

  await db.runTransaction(async (tx) => {
    const [jobSnap, refundSnap, consumeSnap, assetSnap] = await Promise.all([
      tx.get(jobRef), tx.get(refundRef), tx.get(consumeRef), tx.get(assetRef),
    ]);
    if (!jobSnap.exists || jobSnap.data()?.uid !== uid) throw new HttpError("JOB_NOT_FOUND", "Job not found.", 404);
    const job = jobSnap.data()!;
    if (["succeeded", "failed"].includes(String(job.status))) return;

    if (status === "succeeded" && !asset) throw new HttpError("ASSET_REQUIRED", "A successful job must include asset metadata.", 500);
    tx.update(jobRef, {
      status,
      asset: status === "succeeded" && asset ? { storagePath: asset.storagePath, model: asset.model } : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (status === "succeeded" && asset) {
      tx.set(assetRef, {
        uid, jobId, storagePath: asset.storagePath, prompt: asset.prompt, mode: asset.mode,
        quality: asset.quality, resolution: asset.resolution, model: asset.model, status: "saved", source: asset.source,
        createdAt: assetSnap.exists ? assetSnap.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      }, { merge: true });
      if (!consumeSnap.exists) tx.create(consumeRef, { uid, jobId, type: "consumption", amount: 0, reason: "reservation_finalized", createdAt: FieldValue.serverTimestamp() });
    } else if (status === "failed" && !refundSnap.exists) {
      tx.set(userRef, { aiCreditsRemaining: FieldValue.increment(Number(job.creditsReserved ?? 0)), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.create(refundRef, { uid, jobId, type: "refund", amount: Number(job.creditsReserved ?? 0), reason: "generation_failed", createdAt: FieldValue.serverTimestamp() });
    }
  });
}

/** Finalize jobs that are billed through a separate Developer API subscription/call meter. */
export async function finalizeUnbilled(uid: string, jobId: string, status: "succeeded" | "failed", asset?: GeneratedAssetRecord) {
  const jobRef = db.collection("generationJobs").doc(jobId);
  const assetRef = db.collection("generatedAssets").doc(jobId);
  await db.runTransaction(async (tx) => {
    const [jobSnap, assetSnap] = await Promise.all([tx.get(jobRef), tx.get(assetRef)]);
    if (!jobSnap.exists || jobSnap.data()?.uid !== uid) throw new HttpError("JOB_NOT_FOUND", "Job not found.", 404);
    const job = jobSnap.data()!;
    if (["succeeded", "failed"].includes(String(job.status))) return;
    if (status === "succeeded" && !asset) throw new HttpError("ASSET_REQUIRED", "A successful job must include asset metadata.", 500);
    tx.update(jobRef, {
      status,
      asset: status === "succeeded" && asset ? { storagePath: asset.storagePath, model: asset.model } : null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (status === "succeeded" && asset) {
      tx.set(assetRef, {
        uid, jobId, storagePath: asset.storagePath, prompt: asset.prompt, mode: asset.mode,
        quality: asset.quality, resolution: asset.resolution, model: asset.model, status: "saved", source: asset.source,
        createdAt: assetSnap.exists ? assetSnap.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
}
