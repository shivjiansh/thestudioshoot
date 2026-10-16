"use client";
import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

export function ExportButton({ assetId, filename = "thestudioshot-image.png", className = "button dark full" }: { assetId: string; filename?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}/export`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? `Export failed (${response.status}).`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <button type="button" className={className} onClick={download} disabled={busy}>
      {busy ? <><LoaderCircle size={15} className="spin" /> Preparing export…</> : <><Download size={15} /> Export image</>}
    </button>
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}
