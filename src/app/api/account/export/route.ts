import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
import { HttpError, fail, rid } from "@/lib/http/errors";

export const runtime = "nodejs";
const LIMIT = 5000;

type JsonRecord = Record<string, unknown>;

function iso(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return null;
  try { return maybe.toDate().toISOString(); } catch { return null; }
}

function pick(source: JsonRecord, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => {
    const value = source[key];
    return [key, iso(value) ?? value];
  }));
}

async function readOwnedCollection(collection: string, uid: string, safeFields: string[]) {
  const snapshot = await db.collection(collection).where("uid", "==", uid).limit(LIMIT + 1).get();
  return {
    truncated: snapshot.size > LIMIT,
    records: snapshot.docs.slice(0, LIMIT).map((doc) => ({ id: doc.id, ...pick(doc.data(), safeFields) })),
  };
}

export async function GET(request: Request) {
  const requestId = rid(request);
  try {
    const user = await currentUser();
    if (!user) throw new HttpError("UNAUTHENTICATED", "Sign in to export your account data.", 401);
    const profileSnap = await db.collection("users").doc(user.uid).get();
    const profile = profileSnap.data() ?? {};

    const [subscriptions, creditLedger, jobs, assets, exports, keys, usage, billing, idempotency] = await Promise.all([
      readOwnedCollection("subscriptions", user.uid, ["planId", "billingType", "provider", "status", "verified", "createdAt", "updatedAt", "cancelAtCycleEnd", "cancellationRequestedAt"]),
      readOwnedCollection("creditLedger", user.uid, ["jobId", "type", "amount", "reason", "periodIdentity", "subscriptionId", "createdAt"]),
      readOwnedCollection("generationJobs", user.uid, ["status", "planId", "prompt", "mode", "quality", "aspectRatio", "resolution", "source", "creditsReserved", "requestId", "createdAt", "updatedAt"]),
      readOwnedCollection("generatedAssets", user.uid, ["jobId", "prompt", "mode", "quality", "resolution", "model", "status", "source", "createdAt"]),
      readOwnedCollection("exportEvents", user.uid, ["assetId", "planId", "watermarked", "createdAt"]),
      readOwnedCollection("apiKeys", user.uid, ["label", "prefix", "status", "createdAt", "lastUsedAt", "revokedAt"]),
      readOwnedCollection("apiUsage", user.uid, ["keyId", "endpoint", "status", "durationMs", "billable", "billableAmountInr", "collectionStatus", "pricingVersion", "createdAt"]),
      readOwnedCollection("apiBilling", user.uid, ["amountInr", "currency", "periodStart", "periodEnd", "status", "providerReference", "createdAt", "updatedAt"]),
      readOwnedCollection("idempotencyKeys", user.uid, ["jobId", "status", "endpoint", "planId", "pricePerCallInr", "createdAt", "completedAt"]),
    ]);

    // Deliberately omit API key hashes and saved idempotency response payloads/signed URLs.
    const body = {
      exportedAt: new Date().toISOString(),
      account: pick(profile, ["uid", "email", "name", "picture", "role", "planId", "subscriptionStatus", "apiPlanId", "apiSubscriptionStatus", "aiCreditsRemaining", "exportsRemaining", "exportsPeriodKey", "createdAt", "updatedAt"]),
      collections: { subscriptions, creditLedger, generationJobs: jobs, generatedAssets: assets, exportEvents: exports, apiKeys: keys, apiUsage: usage, apiBilling: billing, idempotencyKeys: idempotency },
      limits: { perCollectionLimit: LIMIT, truncated: { subscriptions: subscriptions.truncated, creditLedger: creditLedger.truncated, generationJobs: jobs.truncated, generatedAssets: assets.truncated, exportEvents: exports.truncated, apiKeys: keys.truncated, apiUsage: usage.truncated, apiBilling: billing.truncated, idempotencyKeys: idempotency.truncated } },
      note: "Image file bytes are not included in this JSON export. API key secrets are never stored or exported. Billing provider event records may be retained separately for security, accounting, or legal purposes.",
    };
    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="thestudioshot-account-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    const response = fail(error, requestId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
