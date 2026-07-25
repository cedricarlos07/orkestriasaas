import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Self-hosted Facebook Ads Library MCP
 * https://github.com/proxy-intell/facebook-ads-library-mcp
 *
 * Requires SCRAPECREATORS_API_KEY. Optional GEMINI_API_KEY for video analysis.
 */

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

export function fbAdsLibraryMcpCommand(): string {
  return (
    process.env.FB_ADS_LIBRARY_MCP_COMMAND?.trim() ||
    process.env.FBAL_MCP_COMMAND?.trim() ||
    "/opt/facebook-ads-library-mcp/venv/bin/python"
  );
}

export function fbAdsLibraryMcpArgs(): string[] {
  const raw = process.env.FB_ADS_LIBRARY_MCP_ARGS?.trim() || process.env.FBAL_MCP_ARGS?.trim();
  if (raw) return raw.split(/\s+/).filter(Boolean);
  return ["/opt/facebook-ads-library-mcp/mcp_server.py"];
}

export function isFbAdsLibraryConfigured(): boolean {
  return Boolean(process.env.SCRAPECREATORS_API_KEY?.trim());
}

function mergeProcessEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  const scrape = process.env.SCRAPECREATORS_API_KEY?.trim();
  if (scrape) env.SCRAPECREATORS_API_KEY = scrape;
  const gemini = process.env.GEMINI_API_KEY?.trim();
  if (gemini) env.GEMINI_API_KEY = gemini;
  return env;
}

export async function callFbAdsLibraryTool(
  tool: string,
  args: Record<string, unknown> = {},
  timeoutMs = 90_000,
): Promise<{ ok: boolean; data?: unknown; error?: string; latencyMs: number }> {
  const start = Date.now();
  if (!isFbAdsLibraryConfigured()) {
    return {
      ok: false,
      error: "SCRAPECREATORS_API_KEY manquant — requis pour facebook-ads-library-mcp (self-host)",
      latencyMs: 0,
    };
  }

  const transport = new StdioClientTransport({
    command: fbAdsLibraryMcpCommand(),
    args: fbAdsLibraryMcpArgs(),
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
          : "facebook-ads-library MCP tool error";
      return { ok: false, error: msg, latencyMs: Date.now() - start };
    }
    return { ok: true, data: unwrapToolResult(result), latencyMs: Date.now() - start };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "facebook-ads-library MCP call failed";
    const hint =
      msg.includes("ENOENT") || msg.includes("spawn")
        ? ` — installez le MCP : git clone proxy-intell/facebook-ads-library-mcp → ${fbAdsLibraryMcpCommand()}`
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

export async function probeFbAdsLibraryHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  if (!isFbAdsLibraryConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      error: "SCRAPECREATORS_API_KEY manquant pour facebook-ads-library-mcp",
    };
  }
  const res = await callFbAdsLibraryTool("get_meta_platform_id", { brand_names: ["Nike"] }, 45_000);
  if (res.ok) return { ok: true, latencyMs: res.latencyMs };
  return { ok: false, latencyMs: res.latencyMs, error: humanizeFbAdsLibraryError(res.error) };
}

export function humanizeFbAdsLibraryError(raw?: string): string {
  const t = (raw ?? "").toLowerCase();
  if (!t.trim()) return "Probe facebook-ads-library échoué";
  if (t.includes("scrapecreators") || t.includes("api key") || t.includes("api_key")) {
    return "Clé ScrapeCreators manquante ou invalide (SCRAPECREATORS_API_KEY)";
  }
  if (t.includes("credit") || t.includes("exhausted")) {
    return "Crédits ScrapeCreators épuisés — rechargez sur scrapecreators.com";
  }
  if (t.includes("enoent") || t.includes("spawn")) {
    return "MCP facebook-ads-library non installé sur le serveur";
  }
  return raw!.length > 180 ? `${raw!.slice(0, 177)}…` : raw!;
}

export type CompetitorResearchInput = {
  brand: string;
  brands?: string[];
  country?: string;
};

export async function researchCompetitorAds(input: CompetitorResearchInput): Promise<Record<string, unknown>> {
  const brands = input.brands?.length ? input.brands : [input.brand];
  const platformRes = await callFbAdsLibraryTool("get_meta_platform_id", { brand_names: brands });
  if (!platformRes.ok) throw new Error(platformRes.error ?? "get_meta_platform_id failed");

  const platformData = platformRes.data as { platform_ids?: string[]; results?: unknown };
  const ids = platformData?.platform_ids ?? [];
  const adsRes = await callFbAdsLibraryTool("get_meta_ads", {
    platform_ids: ids.length ? ids : undefined,
    brand_names: brands,
    country: input.country,
  });
  if (!adsRes.ok) throw new Error(adsRes.error ?? "get_meta_ads failed");

  return {
    brands,
    country: input.country ?? null,
    platformLookup: platformRes.data,
    ads: adsRes.data,
    upstream: "facebook-ads-library-mcp",
  };
}
