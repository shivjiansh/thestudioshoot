import { currentUser } from "@/lib/auth/session";
import { db, storage } from "@/lib/firebase/admin";
import { HttpError, fail, rid } from "@/lib/http/errors";
import { renderPng } from "@/lib/images/watermark";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = rid(request);
  try {
    const user = await currentUser();
    if (!user) throw new HttpError("UNAUTHENTICATED", "Sign in to view this image.", 401);
    const { id: assetId } = await context.params;
    const assetSnap = await db.collection("generatedAssets").doc(assetId).get();
    if (!assetSnap.exists || assetSnap.data()?.uid !== user.uid) throw new HttpError("ASSET_NOT_FOUND", "Image not found.", 404);
    const storagePath = String(assetSnap.data()?.storagePath ?? "");
    if (!storagePath.startsWith(`users/${user.uid}/generated/`) || storagePath.includes("..")) {
      throw new HttpError("ASSET_PATH_INVALID", "Stored image path is invalid.", 500);
    }
    const [bytes] = await storage.bucket().file(storagePath).download();
    // Always watermark and downscale browser previews. Unwatermarked originals only leave via the export flow.
    const { output } = await renderPng(bytes, true, "THESTUDIOSHOT PREVIEW", 1200);
    return new Response(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    const response = fail(error, requestId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
