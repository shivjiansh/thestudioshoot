import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { razorpay } from "@/lib/billing/razorpay";
import { db } from "@/lib/firebase/admin";
import { HttpError, fail, rid } from "@/lib/http/errors";
import { assertSameOrigin } from "@/lib/http/security";

const schema = z.object({ planId: z.enum(["pro", "max", "ultra", "api-starter", "api-scale"]) });
const plans: Record<string, { providerPlanId?: string; billingType: "consumer" | "api"; planId: string }> = {
  pro: { providerPlanId: process.env.RAZORPAY_PLAN_PRO, billingType: "consumer", planId: "pro" },
  max: { providerPlanId: process.env.RAZORPAY_PLAN_MAX, billingType: "consumer", planId: "max" },
  ultra: { providerPlanId: process.env.RAZORPAY_PLAN_ULTRA, billingType: "consumer", planId: "ultra" },
  "api-starter": { providerPlanId: process.env.RAZORPAY_PLAN_API_STARTER, billingType: "api", planId: "starter" },
  "api-scale": { providerPlanId: process.env.RAZORPAY_PLAN_API_SCALE, billingType: "api", planId: "scale" },
};

export async function POST(request: Request) {
  const requestId = rid(request);
  try {
    const user = await currentUser();
    if (!user) throw new HttpError("UNAUTHENTICATED", "Sign in before checkout.", 401);
    assertSameOrigin(request);
    const { planId } = schema.parse(await request.json());
    const selected = plans[planId];
    if (!selected?.providerPlanId) throw new HttpError("PLAN_NOT_CONFIGURED", `Razorpay plan ID for ${planId} is missing.`, 503);
    const subscription = await razorpay().subscriptions.create({
      plan_id: selected.providerPlanId,
      total_count: 120,
      quantity: 1,
      customer_notify: 1,
      notes: { uid: user.uid, planId: selected.planId, billingType: selected.billingType },
    });
    await db.collection("subscriptions").doc(String(subscription.id)).create({
      uid: user.uid,
      planId: selected.planId,
      billingType: selected.billingType,
      provider: "razorpay",
      providerSubscriptionId: subscription.id,
      status: subscription.status,
      verified: false,
      createdAt: new Date(),
    });
    if (!subscription.short_url) throw new HttpError("CHECKOUT_URL_MISSING", "Razorpay did not return a hosted subscription URL.", 502);
    return NextResponse.json({ subscriptionId: subscription.id, shortUrl: subscription.short_url, keyId: process.env.RAZORPAY_KEY_ID, requestId });
  } catch (error) { return fail(error, requestId); }
}
