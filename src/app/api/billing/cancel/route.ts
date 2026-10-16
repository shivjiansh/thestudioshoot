import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
import { HttpError, fail, rid } from "@/lib/http/errors";
import { assertSameOrigin } from "@/lib/http/security";

const schema = z.object({ subscriptionId: z.string().min(5).max(100), cancelAtCycleEnd: z.boolean().default(true) });
export async function POST(request: Request) {
  const requestId = rid(request);
  try {
    const user = await currentUser();
    if (!user) throw new HttpError("UNAUTHENTICATED", "Sign in to manage subscriptions.", 401);
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    const subscriptionRef = db.collection("subscriptions").doc(input.subscriptionId);
    const snapshot = await subscriptionRef.get();
    if (!snapshot.exists || snapshot.data()?.uid !== user.uid) throw new HttpError("SUBSCRIPTION_NOT_FOUND", "Subscription not found.", 404);
    const record = snapshot.data()!;
    if (record.provider !== "razorpay") throw new HttpError("UNSUPPORTED_PROVIDER", "This subscription provider cannot be cancelled here.", 400);
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new HttpError("BILLING_NOT_CONFIGURED", "Razorpay server credentials are missing.", 503);

    const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(input.subscriptionId)}/cancel`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cancel_at_cycle_end: input.cancelAtCycleEnd ? 1 : 0 }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => null) as { status?: string; error?: { description?: string; reason?: string } } | null;
    if (!response.ok) throw new HttpError("PROVIDER_CANCELLATION_FAILED", result?.error?.description ?? "Razorpay could not cancel this subscription.", response.status >= 400 && response.status < 500 ? 400 : 502);
    await subscriptionRef.set({ cancellationRequestedAt: new Date(), cancelAtCycleEnd: input.cancelAtCycleEnd, cancellationProviderStatus: result?.status ?? "requested", updatedAt: new Date() }, { merge: true });
    // Entitlements are deliberately not changed here. The verified provider webhook controls access.
    return NextResponse.json({ ok: true, status: result?.status ?? "requested", requestId });
  } catch (error) { return fail(error, requestId); }
}
