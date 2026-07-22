import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, authenticateApiKey } from "@/lib/mcp/api-keys";
import { AGENT_TOOLS, invokeAgentTool } from "@/lib/mcp/agent-tools";
import { randomUUID } from "node:crypto";

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "orkestria-mcp", version: "1.2.0" };

type Session = { id: string; createdAt: number };
const sessions = new Map<string, Session>();

function json(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function wantsSse(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/event-stream");
}

function sseEncode(data: unknown): string {
  return `event: message\ndata: ${JSON.stringify(data)}\n\n`;
}

async function handleRpc(request: Request, message: Record<string, unknown>): Promise<unknown | null> {
  const id = message.id;
  const method = message.method as string;

  if (id === undefined && method?.startsWith("notifications/")) return null;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "Orkestria MCP — ad control for agents (Synter-style safety). Auth: Authorization Bearer ork_…. 1) Call validate_setup or list_capabilities (production vs experimental). 2) Measure with get_performance / detect_anomalies. 3) Propose changes. 4) Writes: execute or any write tool with dry_run=true (default), review the diff, then re-call with dry_run=false. Prefer production platforms (google_ads, meta_ads) for spend. Never skip dry-run on live accounts.",
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

function ensureSession(request: Request): { sessionId: string; isNew: boolean } {
  const existing = request.headers.get("mcp-session-id");
  if (existing && sessions.has(existing)) return { sessionId: existing, isNew: false };
  const id = randomUUID();
  sessions.set(id, { id, createdAt: Date.now() });
  return { sessionId: id, isNew: true };
}

export const Route = createFileRoute("/api/mcp/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // Streamable HTTP: GET opens SSE stream when Accept includes text/event-stream
        if (wantsSse(request)) {
          const { sessionId } = ensureSession(request);
          const stream = new ReadableStream({
            start(controller) {
              const enc = new TextEncoder();
              controller.enqueue(enc.encode(`: orkestria-mcp connected\n\n`));
              const ping = setInterval(() => {
                try {
                  controller.enqueue(enc.encode(`: ping ${Date.now()}\n\n`));
                } catch {
                  clearInterval(ping);
                }
              }, 25000);
              // Keep stream open; clients may POST on same session
              (request.signal as AbortSignal | undefined)?.addEventListener?.("abort", () => {
                clearInterval(ping);
                try {
                  controller.close();
                } catch {
                  /* ignore */
                }
              });
            },
          });
          return new Response(stream, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
              "Mcp-Session-Id": sessionId,
            },
          });
        }

        return json({
          ok: true,
          server: SERVER_INFO,
          transport: "streamable-http",
          fallback: "json-rpc-http",
          protocolVersion: PROTOCOL_VERSION,
          endpoint: "https://orkestria.top/api/mcp",
          auth: "Authorization: Bearer ork_…",
          tools: AGENT_TOOLS.length,
          docs: "https://orkestria.top/docs",
        });
      },
      POST: async ({ request }: { request: Request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(rpcError(null, -32700, "JSON invalide"), 400);
        }

        const { sessionId } = ensureSession(request);
        const sessionHeaders = { "Mcp-Session-Id": sessionId };

        try {
          const messages = Array.isArray(body) ? body : [body];
          const responses: unknown[] = [];
          for (const m of messages) {
            const response = await handleRpc(request, m as Record<string, unknown>);
            if (response !== null) responses.push(response);
          }

          // Streamable HTTP: if client accepts SSE, return SSE-framed JSON-RPC responses
          if (wantsSse(request)) {
            const payload = responses.length === 1 ? responses[0] : responses;
            const stream = new ReadableStream({
              start(controller) {
                const enc = new TextEncoder();
                if (Array.isArray(payload)) {
                  for (const item of payload) controller.enqueue(enc.encode(sseEncode(item)));
                } else if (payload !== undefined) {
                  controller.enqueue(enc.encode(sseEncode(payload)));
                }
                controller.close();
              },
            });
            return new Response(stream, {
              status: 200,
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Mcp-Session-Id": sessionId,
              },
            });
          }

          // JSON-RPC HTTP fallback (application/json)
          if (responses.length === 0) return new Response(null, { status: 202, headers: sessionHeaders });
          if (Array.isArray(body)) return json(responses, 200, sessionHeaders);
          return json(responses[0], 200, sessionHeaders);
        } catch (e) {
          if (e instanceof ApiAuthError) {
            return json(rpcError((body as { id?: unknown })?.id ?? null, -32001, e.message), e.status, sessionHeaders);
          }
          return json(
            rpcError((body as { id?: unknown })?.id ?? null, -32603, e instanceof Error ? e.message : "Erreur interne"),
            500,
            sessionHeaders,
          );
        }
      },
      DELETE: async ({ request }: { request: Request }) => {
        const id = request.headers.get("mcp-session-id");
        if (id) sessions.delete(id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
