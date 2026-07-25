import { auth } from "@/lib/auth";
import { createFileRoute } from "@tanstack/react-router";
import { API_SECURITY_HEADERS } from "@/lib/security/headers";
import { clientIpFromHeaders, consume, RATE_LIMITS } from "@/lib/security/rate-limit";

/**
 * Per-IP brute-force limits on the sensitive auth paths. better-auth has its own
 * in-memory limiter, but it resets on every deploy and is not shared between
 * workers — these buckets are Postgres-backed.
 */
const GUARDED: { match: RegExp; action: string; limit: number; windowSec: number }[] = [
  { match: /sign-in/, action: "auth_signin", ...RATE_LIMITS.authSignIn },
  { match: /verify-email|email-otp\/verify|two-factor/, action: "auth_otp_verify", ...RATE_LIMITS.authOtpVerify },
  { match: /sign-up/, action: "auth_signup", ...RATE_LIMITS.authSignUp },
  {
    match: /forget-password|reset-password|send-verification-otp|send-verification-email/,
    action: "auth_pwreset",
    ...RATE_LIMITS.authPasswordReset,
  },
];

async function guard(request: Request): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const rule = GUARDED.find((g) => g.match.test(path));
  if (!rule) return null;

  const ip = clientIpFromHeaders(request.headers);
  const res = await consume(`ip:${ip}:${rule.action}`, rule.limit, rule.windowSec);
  if (res.ok) return null;

  console.warn(`[security] auth rate limit hit ip=${ip} path=${path}`);
  return new Response(
    JSON.stringify({
      code: "RATE_LIMITED",
      message: `Trop de tentatives. Réessayez dans ${res.retryAfterSec} secondes.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(res.retryAfterSec),
        ...API_SECURITY_HEADERS,
      },
    },
  );
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      // Never rewrap auth responses — that would collapse multiple Set-Cookie
      // headers. Security headers are applied at the edge by Caddy.
      GET: async ({ request }: { request: Request }) => auth.handler(request),
      POST: async ({ request }: { request: Request }) => {
        const blocked = await guard(request);
        if (blocked) return blocked;
        return auth.handler(request);
      },
    },
  },
});
