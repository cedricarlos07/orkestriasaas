/**
 * Security response headers. Caddy applies these to every response at the edge
 * (see scripts/_patch_caddy_security.py); these helpers cover API responses
 * built in-process so the guarantees hold even if the proxy config drifts.
 */

const CSP = [
  "default-src 'self'",
  // TanStack Start ships inline hydration scripts; Stripe.js must stay allowed.
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(self)",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy": CSP,
};

/** Headers for API/JSON responses: no CSP needed, but never cache or sniff. */
export const API_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

/** Adds security headers to an existing response without discarding its body. */
export function withSecurityHeaders(response: Response, extra?: Record<string, string>): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries({ ...API_SECURITY_HEADERS, ...extra })) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
