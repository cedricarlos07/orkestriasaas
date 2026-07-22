import { callMcpTool, probeMcpEndpoint } from "@/lib/mcp/clients/mcp-jsonrpc";
import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

export function adloopMcpUrl(): string {
  return (process.env.ADLOOP_MCP_URL?.trim() || "https://mcp.getadloop.com/mcp").replace(/\/$/, "");
}

export async function callAdloopTool(
  apiKey: string,
  tool: string,
  params: Record<string, unknown> = {},
): Promise<{ ok: boolean; data?: unknown; error?: string; latencyMs: number }> {
  return callMcpTool({ url: adloopMcpUrl(), tool, params, bearer: apiKey });
}

export async function probeAdloopHealth(apiKey?: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const key = apiKey ?? process.env.ADLOOP_API_KEY?.trim();
  if (!key) return { ok: false, latencyMs: 0, error: "ADLOOP_API_KEY unset" };
  return probeMcpEndpoint(adloopMcpUrl(), key);
}

/** Map AdLoop campaign performance → Orkestria snapshot (best-effort). */
export function adloopDataToSnapshot(data: unknown, period = "30 derniers jours"): UnifiedAccountSnapshot | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const rows = (d.campaigns ?? d.rows ?? d.data ?? d.results) as unknown[];
  if (!Array.isArray(rows)) return null;

  const campaigns: UnifiedCampaign[] = [];
  let spend = 0;
  let conversions = 0;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const metrics = (r.metrics as Record<string, unknown> | undefined) ?? {};
    const rowSpend = Number(r.cost ?? r.spend ?? metrics.cost ?? 0);
    const conv = Number(r.conversions ?? metrics.conversions ?? 0);
    spend += rowSpend;
    conversions += conv;
    campaigns.push({
      platform: "Google Ads",
      id: String(r.campaignId ?? r.id ?? r.campaign_id ?? ""),
      name: String(r.campaignName ?? r.name ?? "Campagne"),
      status: String(r.status ?? "UNKNOWN"),
      spend: rowSpend,
      currency: String(r.currency ?? "USD"),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      conversions: conv,
      ctr: Number(r.ctr ?? 0),
      cpa: conv > 0 ? rowSpend / conv : null,
      roas: null,
    });
  }

  return {
    platform: "Google Ads (AdLoop)",
    accountId: String(d.accountId ?? d.customerId ?? ""),
    accountName: String(d.accountName ?? "Google Ads"),
    period,
    spend,
    currency: String(d.currency ?? "USD"),
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues: [],
    opportunities: ["Diagnostics Ads↔GA4 disponibles via AdLoop"],
  };
}

export async function adloopGetCampaignPerformance(
  apiKey: string,
  params: Record<string, unknown> = {},
): Promise<UnifiedAccountSnapshot> {
  const res = await callAdloopTool(apiKey, "get_campaign_performance", {
    compact: true,
    ...params,
  });
  if (!res.ok) throw new Error(res.error ?? "AdLoop get_campaign_performance failed");
  const snapshot = adloopDataToSnapshot(res.data);
  if (!snapshot) throw new Error("Réponse AdLoop non normalisable");
  return snapshot;
}

export async function adloopCreateSearchCampaign(
  apiKey: string,
  input: {
    name: string;
    dailyBudget: number;
    finalUrl?: string;
    keywords?: { text: string; matchType?: string }[];
    headlines?: string[];
    descriptions?: string[];
  },
): Promise<Record<string, unknown>> {
  const res = await callAdloopTool(apiKey, "create_search_campaign", {
    name: input.name,
    daily_budget: input.dailyBudget,
    final_url: input.finalUrl,
    keywords: input.keywords,
    headlines: input.headlines,
    descriptions: input.descriptions,
    status: "PAUSED",
  });
  if (!res.ok) throw new Error(res.error ?? "AdLoop create_search_campaign failed");
  return (res.data as Record<string, unknown>) ?? { ok: true };
}

export async function adloopRunGaql(apiKey: string, query: string, customerId?: string): Promise<unknown> {
  const res = await callAdloopTool(apiKey, "run_gaql", { query, customer_id: customerId });
  if (!res.ok) throw new Error(res.error ?? "AdLoop run_gaql failed");
  return res.data;
}

export async function adloopAnalyzeConversions(apiKey: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const res = await callAdloopTool(apiKey, "analyze_campaign_conversions", params);
  if (!res.ok) throw new Error(res.error ?? "AdLoop analyze_campaign_conversions failed");
  return res.data;
}
