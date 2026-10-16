import { NextRequest, NextResponse } from "next/server";

// UX-only pathname forwarding. Authorization is always enforced by the server layout/API.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-studioshot-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/studio", "/gallery/:path*", "/history/:path*",
    "/billing", "/settings", "/developer/:path*", "/admin",
  ],
};
