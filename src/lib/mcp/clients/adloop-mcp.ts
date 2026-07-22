import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

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

/** Self-hosted AdLoop MCP (`pip install adloop` → `python -m adloop`). */
export function adloopMcpCommand(): string {
  return process.env.ADLOOP_MCP_COMMAND?.trim() || "python3";
}

export function adloopMcpArgs(): string[] {
  const raw = process.env.ADLOOP_MCP_ARGS?.trim();
  if (raw) return raw.split(/\s+/).filter(Boolean);
  return ["-m", "adloop"];
}

function mergeProcessEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  const config = process.env.ADLOOP_CONFIG?.trim();
  if (config) env.ADLOOP_CONFIG = config;
  return env;
}

export async function callAdloopMcpTool(
  tool: string,
  args: Record<string, unknown> = {},
  timeoutMs = 120_000,
): Promise<{ ok: boolean; data?: unknown; error?: string; latencyMs: number }> {
  const start = Date.now();
  const transport = new StdioClientTransport({
    command: adloopMcpCommand(),
    args: adloopMcpArgs(),
    env: mergeProcessEnv(),
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
          : "adloop MCP tool error";
      return { ok: false, error: msg, latencyMs: Date.now() - start };
    }
    return { ok: true, data: unwrapToolResult(result), latencyMs: Date.now() - start };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "adloop MCP call failed";
    const hint =
      msg.includes("ENOENT") || msg.includes("spawn")
        ? ` — installez adloop : pip install adloop && adloop init (commande: ${adloopMcpCommand()} ${adloopMcpArgs().join(" ")})`
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

export async function probeAdloopMcp(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  if (process.env.ADLOOP_ENABLED === "false") {
    return { ok: false, latencyMs: 0, error: "ADLOOP_ENABLED=false" };
  }
  const res = await callAdloopMcpTool("health_check", {}, 30_000);
  if (!res.ok) return { ok: false, latencyMs: res.latencyMs, error: res.error };
  return { ok: true, latencyMs: res.latencyMs };
}
