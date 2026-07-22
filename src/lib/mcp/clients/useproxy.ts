import { callMcpTool, probeMcpEndpoint } from "@/lib/mcp/clients/mcp-jsonrpc";

export function useproxyMcpUrl(): string {
  return (process.env.USEPROXY_MCP_URL?.trim() || "https://mcp.useproxy.dev/mcp").replace(/\/$/, "");
}

function useproxyApiKey(): string | undefined {
  return process.env.USEPROXY_API_KEY?.trim();
}

export async function callUseproxyTool(
  tool: string,
  params: Record<string, unknown> = {},
): Promise<{ ok: boolean; data?: unknown; error?: string; latencyMs: number }> {
  const key = useproxyApiKey();
  if (!key) return { ok: false, error: "USEPROXY_API_KEY manquant", latencyMs: 0 };
  return callMcpTool({ url: useproxyMcpUrl(), tool, params, bearer: key });
}

export async function probeUseproxyHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const key = useproxyApiKey();
  if (!key) return { ok: false, latencyMs: 0, error: "USEPROXY_API_KEY unset" };
  const health = await probeMcpEndpoint(useproxyMcpUrl(), key);
  if (health.ok) return health;
  const fallback = await callUseproxyTool("get_meta_platform_id", { brand_names: ["Nike"] });
  if (fallback.ok) return { ok: true, latencyMs: fallback.latencyMs };
  return { ok: false, latencyMs: health.latencyMs, error: fallback.error ?? health.error };
}

export type CompetitorResearchInput = {
  brand: string;
  brands?: string[];
  country?: string;
};

export async function researchCompetitorAds(input: CompetitorResearchInput): Promise<Record<string, unknown>> {
  const brands = input.brands?.length ? input.brands : [input.brand];
  const platformRes = await callUseproxyTool("get_meta_platform_id", { brand_names: brands });
  if (!platformRes.ok) throw new Error(platformRes.error ?? "get_meta_platform_id failed");

  const platformData = platformRes.data as { platform_ids?: string[]; results?: unknown };
  const ids = platformData?.platform_ids ?? [];
  const adsRes = await callUseproxyTool("get_meta_ads", {
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
    upstream: "useproxy",
  };
}
