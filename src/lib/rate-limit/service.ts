import "server-only";
import { HttpError } from "@/lib/http/errors";
const local = new Map<string, { count: number; reset: number }>();
export async function limit(key: string, max: number, windowMs = 60_000) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const bucket = Math.floor(Date.now() / windowMs);
    const redisKey = `tss:${key}:${bucket}`;
    const response = await fetch(`${url}/pipeline`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", redisKey], ["PEXPIRE", redisKey, windowMs]]), cache: "no-store",
    });
    if (!response.ok) throw new HttpError("RATE_LIMITER_UNAVAILABLE", "Shared rate limiter is unavailable.", 503);
    const data = await response.json() as Array<{ result?: number; error?: string }>;
    if (data.some((entry) => entry.error)) throw new HttpError("RATE_LIMITER_UNAVAILABLE", "Shared rate limiter failed.", 503);
    const count = Number(data[0]?.result ?? 0);
    return { allowed: count <= max, remaining: Math.max(0, max - count), limit: max, resetAt: (bucket + 1) * windowMs };
  }
  if (process.env.NODE_ENV === "production") throw new HttpError("RATE_LIMITER_NOT_CONFIGURED", "A distributed rate limiter must be configured in production.", 503);
  const now = Date.now();
  const old = local.get(key);
  const value = !old || old.reset <= now ? { count: 1, reset: now + windowMs } : { ...old, count: old.count + 1 };
  local.set(key, value);
  return { allowed: value.count <= max, remaining: Math.max(0, max - value.count), limit: max, resetAt: value.reset };
}
