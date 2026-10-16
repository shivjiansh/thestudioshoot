import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { webhookSignature } from "@/lib/billing/razorpay";
import { db } from "@/lib/firebase/admin";

export const runtime = "nodejs";
type Entity = Record<string, unknown> & { notes?: Record<string, unknown> };
type WebhookBody = { id?: string; event?: string; payload?: Record<string, { entity?: Entity }> };
const consumerGrants: Record<string, { credits: number; exports: number }> = {
  pro: { credits: 8000, exports: 1000 },
  max: { credits: 25000, exports: 3000 },
  ultra: { credits: 75000, exports: 10000 },
};
const inactiveStatuses = new Set(["cancelled", "expired", "halted", "paused", "completed"]);

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  try {
    if (!signature || !webhookSignature(rawBody, signature)) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    const body = JSON.parse(rawBody) as WebhookBody;
    const eventId = request.headers.get("x-razorpay-event-id") || body.id;
    if (!eventId || !body.event) return NextResponse.json({ error: "Missing webhook event identity" }, { status: 400 });

    const eventRef = db.collection("billingEvents").doc(eventId);
    const previousEvent = await eventRef.get();
    if (previousEvent.exists && previousEvent.data()?.processed === true) return NextResponse.json({ ok: true, deduplicated: true });
    await eventRef.set({ event: body.event, receivedAt: FieldValue.serverTimestamp(), processed: false, attempts: FieldValue.increment(1) }, { merge: true });

    const subscriptionEntity = body.payload?.subscription?.entity;
    const subscriptionId = String(subscriptionEntity?.id ?? "");
    if (subscriptionId) {
      const subscriptionRef = db.collection("subscriptions").doc(subscriptionId);
      const subscriptionSnap = await subscriptionRef.get();
      if (!subscriptionSnap.exists) {
        // Provider events can arrive before the checkout route persists the provider subscription ID.
        // If this appears to be one of our app-created subscriptions, leave the event unprocessed
        // and return a retryable response rather than losing activation permanently.
        const notes = subscriptionEntity?.notes ?? {};
        if (notes.uid && notes.planId) {
          return NextResponse.json({ error: "Subscription registration is not yet visible; retry this event." }, { status: 503 });
        }
      } else {
        const record = subscriptionSnap.data()!;
        const entityStatus = String(subscriptionEntity?.status ?? "");
        const event = body.event;
        const statusFromEvent: Record<string, string> = {
          "subscription.activated": "active", "subscription.charged": "active", "subscription.resumed": "active",
          "subscription.cancelled": "cancelled", "subscription.paused": "paused", "subscription.halted": "halted",
          "subscription.completed": "completed",
        };
        const status = statusFromEvent[event] || entityStatus || "unknown";
        await subscriptionRef.set({ status, updatedAt: FieldValue.serverTimestamp(), lastEventId: eventId }, { merge: true });
        const userRef = db.collection("users").doc(String(record.uid));
        const planId = String(record.planId);
        const billingType = String(record.billingType ?? (planId.startsWith("api-") ? "api" : "consumer"));
        const isActiveEvent = ["subscription.activated", "subscription.charged", "subscription.resumed"].includes(event) && status === "active";

        if (billingType === "api") {
          if (isActiveEvent && ["starter", "scale"].includes(planId)) {
            await userRef.set({ apiPlanId: planId, apiSubscriptionStatus: status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          } else if (inactiveStatuses.has(status)) {
            await userRef.set({ apiPlanId: null, apiSubscriptionStatus: status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }
        } else {
          const grant = consumerGrants[planId];
          const shouldGrantForPeriod = ["subscription.activated", "subscription.charged"].includes(event) && grant;
          if (isActiveEvent && grant) {
            if (shouldGrantForPeriod) {
              const periodIdentity = String(subscriptionEntity?.paid_count ?? subscriptionEntity?.current_start ?? subscriptionEntity?.start_at ?? "initial").replace(/[^a-zA-Z0-9_-]/g, "");
              const grantRef = db.collection("creditLedger").doc(`subscription_${subscriptionId}_${periodIdentity}`);
              await db.runTransaction(async (tx) => {
                const [existingGrant] = await Promise.all([tx.get(grantRef)]);
                if (existingGrant.exists) return;
                tx.set(userRef, { planId, subscriptionStatus: status, aiCreditsRemaining: grant.credits, exportsRemaining: grant.exports, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
                tx.create(grantRef, { uid: record.uid, subscriptionId, periodIdentity, type: "subscription_grant", amount: grant.credits, createdAt: FieldValue.serverTimestamp() });
              });
            } else {
              await userRef.set({ planId, subscriptionStatus: status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            }
          } else if (inactiveStatuses.has(status)) {
            await userRef.set({ planId: "free", subscriptionStatus: status, aiCreditsRemaining: 0, exportsRemaining: 100, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }
        }
      }
    }
    await eventRef.set({ processed: true, processedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Razorpay webhook processing failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
