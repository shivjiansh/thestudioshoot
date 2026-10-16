import { NextResponse } from "next/server";
import { z } from "zod";
import { POST as generatePost } from "../generate/route";
import { generationSchema } from "@/lib/validation/generation";
import { fail, rid } from "@/lib/http/errors";
const editSchema = generationSchema.extend({ mode: z.enum(["studio", "lifestyle", "background", "catalog", "social"]).optional().default("background"), imageDataUrl: z.string().min(1).max(4_000_000) });
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  const requestId = rid(request);
  try {
    const parsed = editSchema.parse(await request.json());
    const body = { ...parsed, mode: parsed.mode ?? "background" };
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    return generatePost(new Request(request.url, { method: "POST", headers, body: JSON.stringify(body) }));
  } catch (error) {
    return fail(error, requestId);
  }
}
