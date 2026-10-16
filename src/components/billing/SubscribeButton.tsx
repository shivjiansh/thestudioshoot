"use client";
import { useState } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";

type BillingPlanId = "pro" | "max" | "ultra" | "api-starter" | "api-scale";
export function SubscribeButton({
  planId,
  label = "Continue to checkout",
  className = "button dark",
}: {
  planId: BillingPlanId;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = (await response.json().catch(() => null)) as {
        shortUrl?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok)
        throw new Error(
          data?.error?.message ??
            `Could not start checkout (${response.status}).`,
        );
      if (!data?.shortUrl || !data.shortUrl.startsWith("https://"))
        throw new Error("Razorpay did not return a valid hosted checkout URL.");
      window.location.assign(data.shortUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout failed.");
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className={className}
        onClick={checkout}
        disabled={busy}
      >
        {busy ? (
          <>
            <LoaderCircle size={14} className="spin" /> Starting checkout…
          </>
        ) : (
          <>
            {label} <ArrowUpRight size={14} />
          </>
        )}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
