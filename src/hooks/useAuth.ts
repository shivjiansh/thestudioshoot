"use client";

import { useCallback, useEffect } from "react";
import { inMemoryPersistence, setPersistence, signInWithPopup, signOut } from "firebase/auth";
import { firebaseClient } from "@/lib/firebase/client";
import { clearServerSession, createServerSession, fetchServerSession } from "@/lib/firebaseServices";
import { useAuthStore } from "@/stores/authStore";

function safeInternalPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/studio";
  return path;
}

export function useAuth() {
  const { user, initialized, busy, error, setUser, setInitialized, setBusy, setError } = useAuthStore();

  const refreshSession = useCallback(async () => {
    try {
      const session = await fetchServerSession();
      setUser(session.user);
    } catch {
      setUser(null);
    } finally {
      setInitialized(true);
    }
  }, [setInitialized, setUser]);

  useEffect(() => { if (!initialized) void refreshSession(); }, [initialized, refreshSession]);

  const signInWithGoogle = useCallback(async (callbackUrl = "/studio") => {
    setBusy(true); setError("");
    let auth: ReturnType<typeof firebaseClient>["auth"] | undefined;
    try {
      const client = firebaseClient(); auth = client.auth;
      await setPersistence(client.auth, inMemoryPersistence);
      const result = await signInWithPopup(client.auth, client.provider);
      const idToken = await result.user.getIdToken(true);
      await createServerSession(idToken);
      // Cookie sessions are the authority; clear client Firebase state afterwards.
      await signOut(client.auth);
      await refreshSession();
      return { success: true as const, callbackUrl: safeInternalPath(callbackUrl) };
    } catch (cause) {
      if (auth) await signOut(auth).catch(() => undefined);
      const message = cause instanceof Error ? cause.message : "Google sign-in failed.";
      setError(message);
      return { success: false as const, error: message };
    } finally { setBusy(false); }
  }, [refreshSession, setBusy, setError]);

  const logout = useCallback(async () => {
    setBusy(true); setError("");
    try {
      await clearServerSession();
      setUser(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Sign out failed.";
      setError(message); throw cause;
    } finally { setBusy(false); }
  }, [setBusy, setError, setUser]);

  return { user, initialized, isLoading: busy, error, signInWithGoogle, logout, refreshSession };
}
