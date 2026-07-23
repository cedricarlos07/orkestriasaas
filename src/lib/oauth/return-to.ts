const COOKIE = "oauth_return_to";
const MAX_AGE = 900;

/** Only allow same-origin relative paths (no protocol-relative //evil.com). */
export function sanitizeReturnTo(raw: string | null | undefined, fallback = "/app/connections"): string {
  if (!raw) return fallback;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return fallback;
  if (value.length > 512) return fallback;
  return value;
}

export function returnToSetCookie(returnTo: string): string {
  const safe = sanitizeReturnTo(returnTo);
  return `${COOKIE}=${encodeURIComponent(safe)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function returnToClearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readReturnToCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;)\s*oauth_return_to=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
