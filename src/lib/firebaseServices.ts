"use client";

export async function createServerSession(idToken: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ idToken }),
  });
  const body = await response.json().catch(() => null) as { error?: { message?: string }; requestId?: string; ok?: boolean } | null;
  if (!response.ok) {
    const message = body?.error?.message ?? `Session creation failed (HTTP ${response.status}).`;
    throw new Error(`${message}${body?.requestId ? ` (Request ID: ${body.requestId})` : ""}`);
  }
  return body;
}

export async function fetchServerSession() {
  const response = await fetch("/api/auth/session", { method: "GET", credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Unable to check the current session.");
  return response.json() as Promise<{ user: { uid: string; email: string | null; name: string | null; picture?: string | null } | null }>;
}

export async function clearServerSession() {
  const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  if (!response.ok) throw new Error("Unable to clear the server session.");
}
