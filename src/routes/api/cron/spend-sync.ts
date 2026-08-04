import { createFileRoute } from "@tanstack/react-router";
import { syncAllOrgsAdSpend } from "@/lib/billing/spend-sync";

/**
 * Daily Meta/Google spend → spend_tracking.
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export const Route = createFileRoute("/api/cron/spend-sync")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handle(request),
      POST: async ({ request }: { request: Request }) => handle(request),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response(JSON.stringify({ ok: false, error: "CRON_SECRET non configuré" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const urlSecret = new URL(request.url).searchParams.get("secret") ?? "";
  const allowQuerySecret = process.env.NODE_ENV !== "production";
  if (bearer !== expected && !(allowQuerySecret && urlSecret === expected)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const day = new URL(request.url).searchParams.get("day") ?? undefined;
  try {
    const result = await syncAllOrgsAdSpend(day || undefined);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Erreur cron" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
