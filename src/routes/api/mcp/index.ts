import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, authenticateApiKey } from "@/lib/mcp/api-keys";
import { AGENT_TOOLS, invokeAgentTool } from "@/lib/mcp/agent-tools";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "orkestria-mcp", version: "1.0.0" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleRpc(request: Request, message: Record<string, unknown>): Promise<unknown | null> {
  const id = message.id;
  const method = message.method as string;

  // Notifications have no id and expect no response.
  if (id === undefined && method?.startsWith("notifications/")) return null;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "Orkestria MCP — ad control for agents. Writes are policy-gated: dry_run by default, use mode=live with a write-scoped key. Start with validate_setup.",
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, {
        tools: AGENT_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
    case "tools/call": {
      const ctx = await authenticateApiKey(request.headers.get("authorization"));
      const params = (message.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      if (!params.name) return rpcError(id, -32602, "params.name requis");
      try {
        const result = await invokeAgentTool(ctx, params.name, params.arguments ?? {});
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        });
      } catch (e) {
        return rpcResult(id, {
          content: [{ type: "text", text: e instanceof Error ? e.message : "Erreur d'exécution" }],
          isError: true,
        });
      }
    }
    default:
      return rpcError(id, -32601, `Méthode non supportée : ${method}`);
  }
}

export const Route = createFileRoute("/api/mcp/")({
  server: {
    handlers: {
      GET: async () =>
        json({
          ok: true,
          server: SERVER_INFO,
          transport: "streamable-http",
          tools: AGENT_TOOLS.length,
          docs: "/docs",
        }),
      POST: async ({ request }: { request: Request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(rpcError(null, -32700, "JSON invalide"), 400);
        }
        try {
          if (Array.isArray(body)) {
            const responses = (
              await Promise.all(body.map((m) => handleRpc(request, m as Record<string, unknown>)))
            ).filter((r) => r !== null);
            return json(responses);
          }
          const response = await handleRpc(request, body as Record<string, unknown>);
          if (response === null) return new Response(null, { status: 202 });
          return json(response);
        } catch (e) {
          if (e instanceof ApiAuthError) {
            return json(rpcError((body as { id?: unknown })?.id ?? null, -32001, e.message), e.status);
          }
          return json(
            rpcError((body as { id?: unknown })?.id ?? null, -32603, e instanceof Error ? e.message : "Erreur interne"),
            500,
          );
        }
      },
    },
  },
});
