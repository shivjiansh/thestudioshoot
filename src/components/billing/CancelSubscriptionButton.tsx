"use client";
import { useState } from "react";
export function CancelSubscriptionButton({ subscriptionId }: { subscriptionId: string }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function cancel() {
    if (!window.confirm("Request subscription cancellation at the end of the current billing cycle? Access is updated only after Razorpay confirms the subscription state.")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId, cancelAtCycleEnd: true }) });
      const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(data?.error?.message ?? "Cancellation request failed.");
      setMessage("Cancellation request accepted by the provider. Entitlements will follow the verified webhook state.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Cancellation request failed."); }
    finally { setBusy(false); }
  }
  return <div><button className="danger" type="button" onClick={cancel} disabled={busy}>{busy ? "Requesting…" : "Cancel at period end"}</button>{message && <p className="fine-print" role="status">{message}</p>}</div>;
}
