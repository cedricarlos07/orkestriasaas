import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const dedicated = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  const fallback = process.env.BETTER_AUTH_SECRET?.trim();

  // Fail closed in production: reusing the auth secret to encrypt platform
  // tokens breaks key separation, so a missing dedicated key is a hard error.
  if (process.env.NODE_ENV === "production" && !dedicated) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY requis en production (pas de fallback sur BETTER_AUTH_SECRET).",
    );
  }
  const secret = dedicated || fallback;
  if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY or BETTER_AUTH_SECRET required");
  if (dedicated && dedicated.length < 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY trop court (32 caractères minimum).");
  }
  // scrypt is intentionally slow — derive once per process.
  cachedKey = scryptSync(secret, "orkestria-tokens", 32);
  return cachedKey;
}

export type TokenPayload = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
  accountId?: string;
  accountName?: string;
};

export function encryptTokens(payload: TokenPayload): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const json = JSON.stringify(payload);
  const enc = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptTokens(blob: string): TokenPayload {
  const key = getKey();
  const buf = Buffer.from(blob, "base64url");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(json) as TokenPayload;
}
