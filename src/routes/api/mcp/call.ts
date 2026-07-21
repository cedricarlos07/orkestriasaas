import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, authenticateApiKey } from "@/lib/mcp/api-keys";
import { invokeAgentTool } from "@/lib/mcp/agent-tools";

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
          const result = await invokeAgentTool(ctx, body.tool, body.arguments ?? {});
          return new Response(JSON.stringify({ ok: true, result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
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
