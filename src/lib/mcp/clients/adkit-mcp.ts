import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type AdkitMcpEnv = Record<string, string>;

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

/** Command that runs the upstream adkit MCP server (`pip install "meta-adkit[mcp]"`). */
export function adkitMcpCommand(): string {
  return process.env.ADKIT_MCP_COMMAND?.trim() || "adkit-mcp";
}

export function adkitMcpArgs(): string[] {
  const raw = process.env.ADKIT_MCP_ARGS?.trim();
  if (!raw) return [];
  return raw.split(/\s+/).filter(Boolean);
}

function mergeProcessEnv(extra: AdkitMcpEnv): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  return { ...env, ...extra };
}

export async function callAdkitMcpTool(
  env: AdkitMcpEnv,
  tool: string,
  args: Record<string, unknown> = {},
  timeoutMs = 120_000,
): Promise<{ ok: boolean; data?: unknown; error?: string; latencyMs: number }> {
  const start = Date.now();
  const transport = new StdioClientTransport({
    command: adkitMcpCommand(),
    args: adkitMcpArgs(),
    env: mergeProcessEnv(env),
    stderr: "pipe",
  });
  const client = new Client({ name: "orkestria", version: "1.0.0" });
  const timer = setTimeout(() => {
    void transport.close?.();
  }, timeoutMs);

  try {
    await client.connect(transport);
    const result = await client.callTool({ name: tool, arguments: args });
    if (result.isError) {
      const msg =
        typeof result.content?.[0] === "object" && result.content[0] && "text" in result.content[0]
          ? String((result.content[0] as { text?: string }).text)
          : "adkit MCP tool error";
      return { ok: false, error: msg, latencyMs: Date.now() - start };
    }
    return { ok: true, data: unwrapToolResult(result), latencyMs: Date.now() - start };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "adkit MCP call failed";
    const hint =
      msg.includes("ENOENT") || msg.includes("spawn")
        ? ` — installez meta-adkit : pipx install "meta-adkit[mcp]" (commande: ${adkitMcpCommand()})`
        : "";
    return { ok: false, error: `${msg}${hint}`, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
    try {
      await client.close();
    } catch {
      /* ignore */
    }
  }
}

export async function probeAdkitMcp(env: AdkitMcpEnv): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  if (!env.META_ACCESS_TOKEN?.trim()) {
    return { ok: false, latencyMs: 0, error: "META_ACCESS_TOKEN manquant pour adkit" };
  }
  const res = await callAdkitMcpTool(env, "verify", {}, 20_000);
  if (!res.ok) return { ok: false, latencyMs: res.latencyMs, error: res.error };
  const data = res.data as { token_valid?: boolean } | undefined;
  if (data?.token_valid === false) {
    return { ok: false, latencyMs: res.latencyMs, error: "adkit verify: token Meta invalide" };
  }
  return { ok: true, latencyMs: res.latencyMs };
}
