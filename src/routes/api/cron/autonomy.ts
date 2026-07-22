import { createFileRoute } from "@tanstack/react-router";
import { runAutonomyTickForAllOrgs } from "@/lib/mcp/autonomy";

/**
 * Scheduled autonomy tick for all orgs with autonomyEnabled.
 * Auth: Authorization: Bearer $CRON_SECRET (or ?secret=)
 * Hook from OpenShip / crontab / external scheduler.
 */
export const Route = createFileRoute("/api/cron/autonomy")({
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
  if (bearer !== expected && urlSecret !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const forceDryRun = new URL(request.url).searchParams.get("dry_run") === "1";
  try {
    const result = await runAutonomyTickForAllOrgs({ forceDryRun });
    return new Response(JSON.stringify({ ok: true, ...result, forceDryRun }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Erreur cron" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
