import { createFileRoute } from "@tanstack/react-router";
import { AGENT_TOOLS } from "@/lib/mcp/agent-tools";
import { API_SECURITY_HEADERS } from "@/lib/security/headers";
import { clientIpFromHeaders, consume, RATE_LIMITS } from "@/lib/security/rate-limit";

/** Public tool catalog — no secrets, but throttled so it can't be used to hammer the app. */
export const Route = createFileRoute("/api/mcp/tools")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const ip = clientIpFromHeaders(request.headers);
        const res = await consume(
          `ip:${ip}:mcp_anon`,
          RATE_LIMITS.mcpAnon.limit,
          RATE_LIMITS.mcpAnon.windowSec,
        );
        if (!res.ok) {
          return new Response(JSON.stringify({ error: "Trop de requêtes." }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(res.retryAfterSec),
              ...API_SECURITY_HEADERS,
            },
          });
        }
        return new Response(
          JSON.stringify({
            tools: AGENT_TOOLS.map((t) => ({
              name: t.name,
              description: t.description,
              family: t.family,
              inputSchema: t.inputSchema,
            })),
          }),
          { headers: { "Content-Type": "application/json", ...API_SECURITY_HEADERS } },
        );
      },
    },
  },
});
