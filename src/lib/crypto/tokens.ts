import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY or BETTER_AUTH_SECRET required");
  return scryptSync(secret, "orkestria-tokens", 32);
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
