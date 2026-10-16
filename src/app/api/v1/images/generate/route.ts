import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { API_PLANS, resolutionAllowed } from "@/config/plans";
import { hasActiveApiPlan } from "@/lib/entitlements/access";
import { authKey } from "@/lib/developer-api/keys";
import { db } from "@/lib/firebase/admin";
import { HttpError, fail, rid } from "@/lib/http/errors";
import { limit } from "@/lib/rate-limit/service";
import { signedImage } from "@/lib/storage/service";
import { generationSchema } from "@/lib/validation/generation";
import { runGeneration } from "@/services/generation.service";

export const runtime = "nodejs";
export const maxDuration = 120;

function idempotencyId(keyId: string, rawKey: string) {
  return createHash("sha256").update(`${keyId}:${rawKey}`).digest("hex");
}

async function replaySucceeded(jobId: string, requestId: string, billableAmountInr: number) {
  const jobSnap = await db.collection("generationJobs").doc(jobId).get();
  if (!jobSnap.exists || jobSnap.data()?.status !== "succeeded") return null;
  const job = jobSnap.data()!;
  const storagePath = job.asset?.storagePath;
  if (!storagePath) throw new HttpError("RESULT_NOT_AVAILABLE", "The generated result is missing its asset reference.", 500);
  const resultUrl = await signedImage(String(storagePath));
  return {
    jobId,
    status: "succeeded" as const,
    resultUrl,
    creditsReserved: 0,
    billable: true,
    billableAmountInr,
    requestId,
  };
}

async function ensureUsageRecord(args: {
  jobId: string; uid: string; keyId: string; requestId: string; endpoint: string;
  durationMs: number; priceInr: number; resolution: string; quality: string;
}) {
  const ref = db.collection("apiUsage").doc(args.jobId);
  const existing = await ref.get();
  if (existing.exists) {
    const record = existing.data()!;
    if (record.uid !== args.uid || record.keyId !== args.keyId) {
      throw new HttpError("USAGE_RECORD_CONFLICT", "Usage record identity does not match this request.", 500);
    }
    return;
  }
  try {
    await ref.create({
      uid: args.uid,
      keyId: args.keyId,
      requestId: args.requestId,
      endpoint: args.endpoint,
      status: "succeeded",
      durationMs: args.durationMs,
      billable: true,
      billableAmountInr: args.priceInr,
      resolution: args.resolution,
      quality: args.quality,
      pricingVersion: "initial-2026-10",
      createdAt: FieldValue.serverTimestamp(),
      collectionStatus: "accrued_not_collected",
    });
  } catch (error) {
    // Concurrent idempotent retries may race to create the exact same deterministic usage record.
    const code = (error as { code?: string | number })?.code;
    if (code !== 6 && code !== "already-exists" && code !== "ALREADY_EXISTS") throw error;
    const confirmation = await ref.get();
    if (!confirmation.exists || confirmation.data()?.uid !== args.uid || confirmation.data()?.keyId !== args.keyId) throw error;
  }
}

export async function POST(request: Request) {
  const requestId = rid(request);
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const key = authorization.startsWith("Bearer ") ? await authKey(authorization.slice(7)) : null;
    if (!key) throw new HttpError("INVALID_API_KEY", "A valid API key is required.", 401);

    const userSnapshot = await db.collection("users").doc(key.uid).get();
    const user = userSnapshot.data() ?? {};
    const apiPlanId = String(user.apiPlanId ?? "");
    if (!hasActiveApiPlan(apiPlanId, user.apiSubscriptionStatus)) {
      throw new HttpError("API_PLAN_REQUIRED", "An active Developer API subscription is required.", 403);
    }
    const apiPlan = API_PLANS[apiPlanId as keyof typeof API_PLANS];
    const rate = await limit(`api:${key.id}`, apiPlan.requestsPerMinute);
    const rateHeaders = {
      "X-RateLimit-Limit": String(apiPlan.requestsPerMinute),
      "X-RateLimit-Remaining": String(rate.remaining),
    };
    if (!rate.allowed) {
      return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Request limit exceeded." }, requestId }, {
        status: 429,
        headers: { ...rateHeaders, "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))) },
      });
    }

    const input = generationSchema.parse(await request.json());
    if (!resolutionAllowed(input.resolution, apiPlan.maxResolution)) {
      throw new HttpError("RESOLUTION_LIMIT", `The ${apiPlan.name} plan supports up to ${apiPlan.maxResolution} output.`, 403);
    }
    const rawIdempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    if (rawIdempotencyKey.length < 8 || rawIdempotencyKey.length > 128) {
      throw new HttpError("IDEMPOTENCY_KEY_REQUIRED", "Provide an Idempotency-Key between 8 and 128 characters.", 400);
    }

    const keyHash = idempotencyId(key.id, rawIdempotencyKey);
    const requestFingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const jobId = `api_${keyHash}`;
    const idempotencyRef = db.collection("idempotencyKeys").doc(keyHash);
    const claim = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(idempotencyRef);
      if (snap.exists) return { created: false as const, record: snap.data()! };
      transaction.create(idempotencyRef, {
        uid: key.uid, keyId: key.id, jobId, status: "processing", requestId,
        planId: apiPlanId, pricePerCallInr: apiPlan.pricePerCallInr,
        requestFingerprint,
        resolution: input.resolution,
        quality: input.quality,
        endpoint: `POST ${new URL(request.url).pathname}`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { created: true as const, record: null };
    });

    if (!claim.created) {
      const old = claim.record!;
      if (old.uid !== key.uid || old.keyId !== key.id) throw new HttpError("IDEMPOTENCY_CONFLICT", "Idempotency key belongs to a different request identity.", 409);
      if (old.requestFingerprint !== requestFingerprint) throw new HttpError("IDEMPOTENCY_CONFLICT", "This Idempotency-Key was already used with a different request body.", 409);
      if (old.status === "failed") throw new HttpError("PREVIOUS_ATTEMPT_FAILED", "This idempotency key belongs to a failed attempt. Use a new key for a new operation.", 409);
      if (old.status === "succeeded" || old.status === "processing" || old.status === "metering_pending") {
        const previousResult = await replaySucceeded(String(old.jobId ?? jobId), requestId, Number(old.pricePerCallInr ?? apiPlan.pricePerCallInr));
        if (previousResult) {
          await ensureUsageRecord({
            jobId: previousResult.jobId, uid: key.uid, keyId: key.id, requestId,
            endpoint: String(old.endpoint ?? `POST ${new URL(request.url).pathname}`), durationMs: Number(old.durationMs ?? 0),
            priceInr: Number(old.pricePerCallInr ?? apiPlan.pricePerCallInr),
            resolution: String(old.resolution ?? "1K"), quality: String(old.quality ?? "medium"),
          });
          await idempotencyRef.set({ status: "succeeded", response: previousResult, completedAt: FieldValue.serverTimestamp() }, { merge: true });
          return NextResponse.json(previousResult, { headers: rateHeaders });
        }
        throw new HttpError("REQUEST_IN_PROGRESS", "A request with this idempotency key is already processing.", 409);
      }
      throw new HttpError("INVALID_IDEMPOTENCY_STATE", "Idempotency state is invalid.", 409);
    }

    const started = Date.now();
    const endpoint = `POST ${new URL(request.url).pathname}`;
    let result: Awaited<ReturnType<typeof runGeneration>>;
    try {
      result = await runGeneration({
        uid: key.uid, input, planId: apiPlanId, requestId,
        source: "developer_api", billCredits: false, apiKeyId: key.id, jobId,
      });
    } catch (error) {
      await idempotencyRef.set({ status: "failed", failureClass: "generation_failed", completedAt: FieldValue.serverTimestamp() }, { merge: true });
      await db.collection("apiUsage").doc(`failed_${keyHash}`).set({
        uid: key.uid, keyId: key.id, requestId, endpoint, status: "failed", resolution: input.resolution, quality: input.quality, durationMs: Date.now() - started,
        billable: false, billableAmountInr: 0, createdAt: FieldValue.serverTimestamp(), collectionStatus: "not_billable",
      }, { merge: true }).catch((meteringError) => console.error("Failed API usage record could not be saved", { requestId, meteringError }));
      throw error;
    }

    const responseBody = {
      ...result,
      billable: true,
      billableAmountInr: apiPlan.pricePerCallInr,
      requestId,
    };
    const durationMs = Date.now() - started;
    try {
      await ensureUsageRecord({
        jobId: result.jobId, uid: key.uid, keyId: key.id, requestId, endpoint,
        durationMs, priceInr: apiPlan.pricePerCallInr, resolution: input.resolution, quality: input.quality,
      });
      await idempotencyRef.set({
        status: "succeeded", response: responseBody, durationMs,
        completedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (meteringError) {
      // The image exists; do not mark its job failed. A retry with the same idempotency key repairs metering.
      await idempotencyRef.set({ status: "metering_pending", durationMs }, { merge: true }).catch(() => undefined);
      console.error("Successful generation is awaiting durable usage metering", { requestId, jobId: result.jobId, meteringError });
      throw new HttpError("METERING_PENDING", "The image was generated, but usage accounting is pending. Retry the same request with the same Idempotency-Key.", 503);
    }
    return NextResponse.json(responseBody, { headers: rateHeaders });
  } catch (error) {
    return fail(error, requestId);
  }
}
