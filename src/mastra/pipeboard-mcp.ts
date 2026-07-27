/**
 * Pipeboard remote MCP family — Meta, Google, TikTok, Snap, Reddit.
 * @see https://github.com/pipeboard-co/meta-ads-mcp
 */
import { MCPClient } from "@mastra/mcp";
import type { ConnectorId } from "@/lib/oauth/connectors";

export const PIPEBOARD_URLS = {
  "meta-ads": "https://meta-ads.mcp.pipeboard.co/",
  "google-ads": "https://google-ads.mcp.pipeboard.co/",
  "tiktok-ads": "https://tiktok-ads.mcp.pipeboard.co/",
  "snap-ads": "https://snap-ads.mcp.pipeboard.co/",
  "reddit-ads": "https://reddit-ads.mcp.pipeboard.co/",
} as const;

export type PipeboardServer = keyof typeof PIPEBOARD_URLS;

export const PIPEBOARD_META_URL = PIPEBOARD_URLS["meta-ads"];
export const PIPEBOARD_GOOGLE_URL = PIPEBOARD_URLS["google-ads"];
export const PIPEBOARD_TIKTOK_URL = PIPEBOARD_URLS["tiktok-ads"];
export const PIPEBOARD_SNAP_URL = PIPEBOARD_URLS["snap-ads"];
export const PIPEBOARD_REDDIT_URL = PIPEBOARD_URLS["reddit-ads"];

/** Orkestria connector → Pipeboard MCP server */
export const CONNECTOR_TO_PIPEBOARD: Partial<Record<ConnectorId, PipeboardServer>> = {
  meta_ads: "meta-ads",
  google_ads: "google-ads",
  tiktok_ads: "tiktok-ads",
  snapchat_ads: "snap-ads",
  reddit_ads: "reddit-ads",
};

export const PIPEBOARD_CONNECTORS = Object.keys(CONNECTOR_TO_PIPEBOARD) as ConnectorId[];

export function isPipeboardConfigured(): boolean {
  return Boolean(process.env.PIPEBOARD_API_TOKEN?.trim());
}

export function isPipeboardConnector(connector: ConnectorId): boolean {
  return Boolean(CONNECTOR_TO_PIPEBOARD[connector]);
}

export function pipeboardServerFor(connector: ConnectorId): PipeboardServer | null {
  return CONNECTOR_TO_PIPEBOARD[connector] ?? null;
}

export function pipeboardAuthHeaders(partnerUserId?: string): Record<string, string> {
  const token = process.env.PIPEBOARD_API_TOKEN?.trim();
  if (!token) throw new Error("Service publicitaire temporairement indisponible.");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };
  const partner = partnerUserId?.trim() || process.env.PIPEBOARD_PARTNER_USER_ID?.trim();
  if (partner) headers["X-Partner-User-Id"] = partner;
  return headers;
}

function pipeboardFetch(partnerUserId?: string): typeof fetch {
  return async (url, init) => {
    const headers = new Headers(init?.headers);
    const auth = pipeboardAuthHeaders(partnerUserId);
    for (const [k, v] of Object.entries(auth)) headers.set(k, v);
    return fetch(url, { ...init, headers });
  };
}

/** Mastra MCPClient — all 5 Pipeboard family servers. */
export function createPipeboardMcpClient(opts?: { partnerUserId?: string; id?: string }): MCPClient | null {
  if (!isPipeboardConfigured()) return null;
  const fetchFn = pipeboardFetch(opts?.partnerUserId);
  const headers = pipeboardAuthHeaders(opts?.partnerUserId);
  const servers: Record<string, { url: URL; fetch: typeof fetch; requestInit: { headers: Record<string, string> } }> =
    {};
  for (const [id, url] of Object.entries(PIPEBOARD_URLS)) {
    servers[id] = {
      url: new URL(url),
      fetch: fetchFn,
      requestInit: { headers },
    };
  }
  return new MCPClient({
    id: opts?.id ?? `pipeboard-${opts?.partnerUserId ?? "default"}`,
    servers,
    timeout: 60_000,
  });
}

/**
 * Direct JSON-RPC tools/call against Pipeboard remote MCP (Streamable HTTP).
 */
export async function callPipeboardTool(
  server: PipeboardServer,
  toolName: string,
  args: Record<string, unknown> = {},
  opts?: { partnerUserId?: string },
): Promise<unknown> {
  const base = PIPEBOARD_URLS[server];
  const headers = pipeboardAuthHeaders(opts?.partnerUserId);
  const res = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Régie ${server}/${toolName} HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  let data: {
    result?: { content?: { type: string; text?: string }[]; isError?: boolean; structuredContent?: unknown };
    error?: { message?: string };
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`Régie ${server}/${toolName}: réponse non-JSON — ${text.slice(0, 200)}`);
  }
  if (data.error?.message) throw new Error(`Régie ${server}/${toolName}: ${data.error.message}`);
  const result = data.result;
  if (result?.isError) {
    const errText = result.content?.map((c) => c.text).filter(Boolean).join("\n") || "tool error";
    throw new Error(`Régie ${server}/${toolName}: ${errText}`);
  }
  if (result?.structuredContent != null) return result.structuredContent;
  const joined = result?.content?.map((c) => c.text).filter(Boolean).join("\n") ?? text;
  try {
    return JSON.parse(joined) as unknown;
  } catch {
    return { raw: joined };
  }
}

export async function probePipeboardMcp(opts?: { partnerUserId?: string }): Promise<{
  ok: boolean;
  servers?: Record<PipeboardServer, string>;
  meta?: string;
  google?: string;
  error?: string;
}> {
  if (!isPipeboardConfigured()) {
    return { ok: false, error: "PIPEBOARD_API_TOKEN manquant" };
  }
  try {
    const headers = pipeboardAuthHeaders(opts?.partnerUserId);
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    const entries = Object.entries(PIPEBOARD_URLS) as [PipeboardServer, string][];
    const results = await Promise.all(
      entries.map(async ([id, url]) => {
        const res = await fetch(url, { method: "POST", headers, body });
        return [id, res.ok ? `ok ${res.status}` : `fail ${res.status}`] as const;
      }),
    );
    const servers = Object.fromEntries(results) as Record<PipeboardServer, string>;
    const ok = results.some(([, s]) => s.startsWith("ok"));
    return {
      ok,
      servers,
      meta: servers["meta-ads"],
      google: servers["google-ads"],
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
