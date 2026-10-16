import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
import { getPlan, resolutionAllowed } from "@/config/plans";
import { isActiveSubscription } from "@/lib/entitlements/access";
import { assertSameOrigin } from "@/lib/http/security";
import { runGeneration } from "@/services/generation.service";
import { generationSchema } from "@/lib/validation/generation";
import { fail, rid, HttpError } from "@/lib/http/errors";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  const requestId = rid(request);
  try {
    assertSameOrigin(request);
    const user = await currentUser();
    if (!user) throw new HttpError("UNAUTHENTICATED", "Sign in to generate images.", 401);
    const input = generationSchema.parse(await request.json());
    const snapshot = await db.collection("users").doc(user.uid).get();
    const account = snapshot.data() ?? {};
    const planId = String(account.planId ?? "free");
    const plan = getPlan(planId);
    // if (!plan.aiGeneration) throw new HttpError("PLAN_BLOCKED", "AI generation is disabled on Free. Choose a paid plan.", 403);
    // if (!resolutionAllowed(input.resolution, plan.maxResolution)) throw new HttpError("RESOLUTION_LIMIT", `Your ${plan.name} plan supports up to ${plan.maxResolution} output.`, 403);
    // if (!isActiveSubscription(account.subscriptionStatus)) {
    //   throw new HttpError("SUBSCRIPTION_INACTIVE", "Your paid subscription is not active. Check Billing to restore access.", 403);
    // }
    // const result = await runGeneration({ uid: user.uid, input, planId, requestId, source: "studio", billCredits: true });
    const result = {
      jobId: "550e8400-e29b-41d4-a716-446655440000",
      status: "succeeded",
      resultUrl: "[https://via.placeholder.com/150](https://via.placeholder.com/150)",
      creditsReserved: 5,
      resolution: "1024",
      requestedSize: "1024x1024"
    } ;

    return NextResponse.json({ ...result, requestId });
        // return NextResponse.json({ ...result });

  } catch (error) { return fail(error, requestId); }
}
