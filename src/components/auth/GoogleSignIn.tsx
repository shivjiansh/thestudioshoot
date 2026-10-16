"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export function GoogleSignIn({ callbackUrl = "/studio" }: { callbackUrl?: string }) {
  const { signInWithGoogle, isLoading } = useAuth();
  const [localError, setLocalError] = useState("");
  const router = useRouter();

  async function signIn() {
    setLocalError("");
    const requested = new URLSearchParams(window.location.search).get("callbackUrl") ?? callbackUrl;
    const result = await signInWithGoogle(requested);
    if (result.success) {
      router.replace(result.callbackUrl);
      router.refresh();
    } else {
      setLocalError(result.error);
    }
  }

  return <div><button className="button dark full" type="button" onClick={signIn} disabled={isLoading}>{isLoading ? "Signing in…" : "Continue with Google"}</button>{localError && <p role="alert" className="error">{localError}</p>}</div>;
}
