import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { env, need } from "@/lib/env";

function getAdminApp(): App {
  const existing = getApps().find((app) => app.name === "[DEFAULT]");
  if (existing) return existing;

  const serviceAccountJson = env.firebaseServiceAccount;
  if (serviceAccountJson) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(serviceAccountJson) as Record<string, unknown>;
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON.");
    }
    const projectId = String(parsed.project_id ?? parsed.projectId ?? env.firebaseProjectId ?? "");
    const clientEmail = String(parsed.client_email ?? parsed.clientEmail ?? "");
    const privateKey = String(parsed.private_key ?? parsed.privateKey ?? "").replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase service account JSON must include project_id, client_email, and private_key.");
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  const privateKey = need(env.firebasePrivateKey, "FIREBASE_PRIVATE_KEY");
  return initializeApp({
    credential: cert({
      projectId: need(env.firebaseProjectId, "FIREBASE_PROJECT_ID"),
      clientEmail: need(env.firebaseClientEmail, "FIREBASE_CLIENT_EMAIL"),
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
    projectId: env.firebaseProjectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

// Lazy proxies prevent public routes and `next build` from requiring Firebase
// credentials at module-import time. The service is initialized on first use.
function lazyService<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const target = factory();
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(_target, property, value) {
      const target = factory();
      return Reflect.set(target, property, value, target);
    },
  });
}

export const adminAuth = lazyService(() => getAuth(getAdminApp()));
export const db = lazyService(() => getFirestore(getAdminApp()));
export const storage = lazyService(() => getStorage(getAdminApp()));
