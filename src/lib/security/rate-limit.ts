import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema/index";

export class RateLimitError extends Error {
  status = 429;
  retryAfterSec: number;
  constructor(message: string, retryAfterSec: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

export type LimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * Atomic fixed-window counter in Postgres. Durable across restarts and shared
 * between workers — the in-process buckets in `quotas/enforce` only cover
 * per-plan quotas on a single process.
 */
export async function consume(
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<LimitResult> {
  if (limit < 0) return { ok: true, remaining: -1, retryAfterSec: 0 };

  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - (nowSec % windowSec);
  const resetAt = windowStart + windowSec;
  const expiresAt = new Date(resetAt * 1000);

  try {
    // Bare returning() — the db union type (neon-http | postgres-js) rejects
    // the projected overload.
    const rows = await db
      .insert(rateLimits)
      .values({ bucket, windowStart, count: 1, expiresAt })
      .onConflictDoUpdate({
        target: [rateLimits.bucket, rateLimits.windowStart],
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning();

    const used = rows[0]?.count ?? 1;
    if (used > limit) {
      return { ok: false, remaining: 0, retryAfterSec: Math.max(1, resetAt - nowSec) };
    }
    return { ok: true, remaining: Math.max(0, limit - used), retryAfterSec: 0 };
  } catch (e) {
    // Fail open on limiter infrastructure errors — never lock users out of the
    // product because the counter table is unavailable.
    console.error("[rate-limit] consume failed, failing open:", e);
    return { ok: true, remaining: -1, retryAfterSec: 0 };
  }
}

/** Extract the real client IP. Caddy sets X-Real-IP; the XFF chain is spoofable. */
export function clientIpFromHeaders(headers: Record<string, string | undefined> | Headers): string {
  const get = (name: string): string | undefined =>
    headers instanceof Headers
      ? (headers.get(name) ?? undefined)
      : (headers[name] ?? headers[name.toLowerCase()]);

  const real = get("x-real-ip")?.trim();
  if (real) return real;
  // Only the left-most XFF entry is meaningful, and only behind a trusted proxy.
  const fwd = get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd;
  return "unknown";
}

export type IpLimitOpts = {
  ip: string;
  action: string;
  limit: number;
  windowSec: number;
  message?: string;
};

/** Throws RateLimitError (429) when the IP exceeded the window. */
export async function enforceIpLimit(opts: IpLimitOpts): Promise<void> {
  const res = await consume(`ip:${opts.ip}:${opts.action}`, opts.limit, opts.windowSec);
  if (!res.ok) {
    throw new RateLimitError(
      opts.message ??
        `Trop de requêtes. Réessayez dans ${res.retryAfterSec}s.`,
      res.retryAfterSec,
    );
  }
}

/** Per-API-key limit so one leaked key cannot burn the whole org quota. */
export async function enforceApiKeyLimit(
  keyId: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const res = await consume(`key:${keyId}:mcp`, limit, windowSec);
  if (!res.ok) {
    throw new RateLimitError(
      `Limite de la clé API atteinte. Réessayez dans ${res.retryAfterSec}s.`,
      res.retryAfterSec,
    );
  }
}

/** Best-effort cleanup of expired windows. Safe to call periodically. */
export async function pruneRateLimits(): Promise<void> {
  try {
    await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date()));
  } catch (e) {
    console.warn("[rate-limit] prune failed", e);
  }
}

export const RATE_LIMITS = {
  /** Sign-in / OTP verification: brute-force protection per IP. */
  authSignIn: { limit: 10, windowSec: 300 },
  authOtpVerify: { limit: 8, windowSec: 600 },
  authSignUp: { limit: 5, windowSec: 3600 },
  authPasswordReset: { limit: 5, windowSec: 3600 },
  /** Unauthenticated MCP discovery (initialize / tools/list / SSE). */
  mcpAnon: { limit: 60, windowSec: 60 },
  /** Per API key MCP calls. */
  mcpPerKey: { limit: 240, windowSec: 60 },
  /** Public contact form. */
  contact: { limit: 5, windowSec: 3600 },
} as const;
