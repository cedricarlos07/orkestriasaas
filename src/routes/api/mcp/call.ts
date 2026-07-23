import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, authenticateApiKey } from "@/lib/mcp/api-keys";
import { invokeAgentTool } from "@/lib/mcp/agent-tools";
import { classifyTool, enforceQuotas, QuotaError, recordUsage } from "@/lib/quotas/enforce";

/**
 * REST convenience endpoint used by the orkestria-mcp stdio package:
 * POST { tool: string, arguments: object } with Authorization: Bearer ork_...
 */
export const Route = createFileRoute("/api/mcp/call")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const ctx = await authenticateApiKey(request.headers.get("authorization"));
          const body = (await request.json()) as { tool?: string; arguments?: Record<string, unknown> };
          if (!body.tool) {
            return new Response(JSON.stringify({ error: "tool requis" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          const kind = classifyTool(body.tool);
          const gate = await enforceQuotas({ orgId: ctx.organizationId, kind, tool: body.tool });
          const result = await invokeAgentTool(ctx, body.tool, body.arguments ?? {});
          await recordUsage({
            orgId: ctx.organizationId,
            kind: kind === "write" ? "write" : "mcp_call",
            meta: { tool: body.tool, via: "api/mcp/call" },
          });
          return new Response(JSON.stringify({ ok: true, result }), {
            headers: { "Content-Type": "application/json", ...gate.headers },
          });
        } catch (e) {
          if (e instanceof QuotaError) {
            return new Response(
              JSON.stringify({ ok: false, error: e.message, code: e.code }),
              {
                status: e.status,
                headers: {
                  "Content-Type": "application/json",
                  ...(e.retryAfterSec ? { "Retry-After": String(e.retryAfterSec) } : {}),
                },
              },
            );
          }
          const status = e instanceof ApiAuthError ? e.status : 500;
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Erreur interne" }),
            { status, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
