import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { adminAuth, db } from "@/lib/firebase/admin";
import { SESSION_COOKIE, currentUser } from "@/lib/auth/session";
import { fail, rid, HttpError } from "@/lib/http/errors";
import { assertSameOrigin } from "@/lib/http/security";

const schema = z.object({ idToken: z.string().min(50).max(10_000) });
const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000;


export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ user: null }, { status: 200 });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const requestId = rid(request);
  try {
    assertSameOrigin(request);
    const { idToken } = schema.parse(await request.json());
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const authTime = Number(decoded.auth_time ?? 0);
    if (!authTime || Math.floor(Date.now() / 1000) - authTime > 5 * 60) {
      throw new HttpError("RECENT_SIGN_IN_REQUIRED", "Please sign in again before creating a session.", 401);
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_TTL_MS });

    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    const previous = userSnap.data() ?? {};
    // Privileged roles are created by scripts/bootstrap-admin.mjs, never by browser input.
    await userRef.set({
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
      picture: decoded.picture ?? null,
      role: previous.role === "admin" ? "admin" : "user",
      planId: previous.planId ?? "free",
      subscriptionStatus: previous.subscriptionStatus ?? "free",
      aiCreditsRemaining: Number(previous.aiCreditsRemaining ?? 0),
      exportsRemaining: Number(previous.exportsRemaining ?? 100),
      updatedAt: new Date(),
      createdAt: previous.createdAt ?? new Date(),
    }, { merge: true });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });

    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    return fail(error, requestId);
  }
}
