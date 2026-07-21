import { createFileRoute } from "@tanstack/react-router";
import { AGENT_TOOLS } from "@/lib/mcp/agent-tools";

export const Route = createFileRoute("/api/mcp/tools")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({
            tools: AGENT_TOOLS.map((t) => ({
              name: t.name,
              description: t.description,
              family: t.family,
              inputSchema: t.inputSchema,
            })),
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    },
  },
});
