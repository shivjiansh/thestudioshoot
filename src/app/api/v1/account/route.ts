import { NextResponse } from "next/server";
import { API_PLANS } from "@/config/plans";
import { authKey } from "@/lib/developer-api/keys";
import { db } from "@/lib/firebase/admin";
import { HttpError, fail, rid } from "@/lib/http/errors";
import { hasActiveApiPlan } from "@/lib/entitlements/access";

export async function GET(request: Request) {
  const requestId = rid(request);
  try {
    const key = await authKey(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
    if (!key) throw new HttpError("INVALID_API_KEY", "A valid API key is required.", 401);
    const snap = await db.collection("users").doc(key.uid).get();
    const data = snap.data() ?? {};
    const planId = String(data.apiPlanId ?? "");
    if (!hasActiveApiPlan(planId, data.apiSubscriptionStatus)) {
      throw new HttpError("API_PLAN_REQUIRED", "An active Developer API subscription is required.", 403);
    }
    const plan = API_PLANS[planId as keyof typeof API_PLANS];
    return NextResponse.json({
      account: {
        apiPlan: plan.id,
        apiSubscriptionStatus: data.apiSubscriptionStatus,
        requestsPerMinute: plan.requestsPerMinute,
        maxResolution: plan.maxResolution,
        pricePerSuccessfulCallInr: plan.pricePerCallInr,
        collectionStatus: "metered_not_collected_automatically",
      },
      requestId,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
