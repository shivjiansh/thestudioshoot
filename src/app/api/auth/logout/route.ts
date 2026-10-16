import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { fail, rid } from "@/lib/http/errors";
import { assertSameOrigin } from "@/lib/http/security";
export async function POST(request: Request) {
  const requestId = rid(request);
  try {
    assertSameOrigin(request);
    (await cookies()).delete(SESSION_COOKIE);
    return NextResponse.json({ ok: true, requestId });
  } catch (error) { return fail(error, requestId); }
}
