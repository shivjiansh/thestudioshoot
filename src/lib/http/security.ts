import "server-only";
import { HttpError } from "@/lib/http/errors";

/**
 * Require a browser Origin for cookie-authenticated mutations and validate it against the
 * configured canonical origin. API-key routes authenticate independently and don't call this.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new HttpError("INVALID_ORIGIN", "Origin header is required for this request.", 403);
  const expectedOrigin = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : new URL(request.url).origin;
  let receivedOrigin: string;
  try { receivedOrigin = new URL(origin).origin; }
  catch { throw new HttpError("INVALID_ORIGIN", "Request origin is invalid.", 403); }
  if (receivedOrigin !== expectedOrigin) {
    throw new HttpError("INVALID_ORIGIN", "Request origin is not allowed.", 403);
  }
}
