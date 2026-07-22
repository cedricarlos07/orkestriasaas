export type McpJsonRpcOptions = {
  url: string;
  tool: string;
  params?: Record<string, unknown>;
  /** Server-side bearer (useproxy, etc.) */
  bearer?: string;
  timeoutMs?: number;
};

export type McpJsonRpcResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
  latencyMs: number;
};

function unwrapToolResult(raw: unknown): unknown {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if ("structuredContent" in r && r.structuredContent !== undefined) return r.structuredContent;
    if ("content" in r && Array.isArray(r.content)) {
      const texts = (r.content as { type?: string; text?: string }[])
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text!);
      if (texts.length === 1) {
        try {
          return JSON.parse(texts[0]!);
        } catch {
          return texts[0];
        }
      }
      if (texts.length) return texts.join("\n");
    }
  }
  return raw;
}

export async function callMcpTool(opts: McpJsonRpcOptions): Promise<McpJsonRpcResult> {
  const start = Date.now();
  const auth = opts.bearer?.trim();
  if (!auth) {
    return { ok: false, error: "Bearer token manquant pour l'appel MCP upstream", latencyMs: 0 };
  }

  try {
    const res = await fetch(opts.url.replace(/\/$/, ""), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: opts.tool, arguments: opts.params ?? {} },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
    });
    if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as {
      error?: { message?: string };
      result?: unknown;
    };
    if (body.error) throw new Error(body.error.message ?? "MCP tool call failed");
    return {
      ok: true,
      data: unwrapToolResult(body.result),
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "MCP call failed",
      latencyMs: Date.now() - start,
    };
  }
}

export async function probeMcpEndpoint(url: string, bearer?: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  if (!bearer?.trim()) return { ok: false, latencyMs: 0, error: "missing bearer" };
  const res = await callMcpTool({ url, tool: "health_check", bearer, timeoutMs: 10_000 });
  if (res.ok) return { ok: true, latencyMs: res.latencyMs };
  return { ok: false, latencyMs: res.latencyMs, error: res.error };
}
