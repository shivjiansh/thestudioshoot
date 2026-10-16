import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "@/lib/http/errors";

type EditorSourceClaims = {
  uid: string;
  assetId: string;
  watermarked: boolean;
  expiresAt: number;
};

function signingSecret() {
  const encodedAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (encodedAccount) {
    try {
      const serviceAccount = JSON.parse(encodedAccount) as { private_key?: string };
      if (serviceAccount.private_key) return serviceAccount.private_key;
    } catch {
      throw new HttpError("EDITOR_TOKEN_CONFIG_INVALID", "Firebase service account configuration is invalid.", 500);
    }
  }
  if (process.env.FIREBASE_PRIVATE_KEY) return process.env.FIREBASE_PRIVATE_KEY;
  throw new HttpError("EDITOR_TOKEN_CONFIG_MISSING", "Editor signing requires FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_JSON.", 500);
}

function signature(encodedClaims: string) {
  return createHmac("sha256", signingSecret()).update(encodedClaims).digest("base64url");
}

export function createEditorSourceToken(claims: EditorSourceClaims) {
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${encodedClaims}.${signature(encodedClaims)}`;
}

export function verifyEditorSourceToken(token: string, uid: string, assetId: string) {
  const [encodedClaims, suppliedSignature, extra] = token.split(".");
  if (!encodedClaims || !suppliedSignature || extra) throw new HttpError("EDITOR_SESSION_INVALID", "Editor session is invalid. Reload the editor and try again.", 401);
  const expected = Buffer.from(signature(encodedClaims));
  const received = Buffer.from(suppliedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new HttpError("EDITOR_SESSION_INVALID", "Editor session is invalid. Reload the editor and try again.", 401);
  }
  let claims: EditorSourceClaims;
  try {
    claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as EditorSourceClaims;
  } catch {
    throw new HttpError("EDITOR_SESSION_INVALID", "Editor session is invalid. Reload the editor and try again.", 401);
  }
  if (claims.uid !== uid || claims.assetId !== assetId || !Number.isFinite(claims.expiresAt) || claims.expiresAt < Date.now()) {
    throw new HttpError("EDITOR_SESSION_EXPIRED", "Your editor session expired. Reload the editor and try again.", 401);
  }
  return claims;
}
