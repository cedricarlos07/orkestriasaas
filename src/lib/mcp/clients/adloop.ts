import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";
import { adloopMcpCommand, adloopMcpArgs, callAdloopMcpTool, probeAdloopMcp } from "@/lib/mcp/clients/adloop-mcp";

export { adloopMcpCommand, adloopMcpArgs };

export function isAdloopEnabled(): boolean {
  return process.env.ADLOOP_ENABLED !== "false";
}

export async function callAdloopTool(
  tool: string,
  params: Record<string, unknown> = {},
): Promise<{ ok: boolean; data?: unknown; error?: string; latencyMs: number }> {
  if (!isAdloopEnabled()) {
    return { ok: false, latencyMs: 0, error: "AdLoop self-hosted désactivé (ADLOOP_ENABLED=false)" };
  }
  return callAdloopMcpTool(tool, params);
}

export async function probeAdloopHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  return probeAdloopMcp();
}

/** Extract plan_id from AdLoop draft preview response. */
export function extractAdloopPlanId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const nested = (d.preview ?? d.result) as Record<string, unknown> | undefined;
  const id = d.plan_id ?? d.planId ?? nested?.plan_id ?? nested?.planId;
  return id != null && String(id).trim() ? String(id) : null;
}

function adloopCampaignType(type?: string): string {
  if (type === "pmax" || type === "PERFORMANCE_MAX") return "PERFORMANCE_MAX";
  return "SEARCH";
}

export type AdloopDraftCampaignInput = {
  name: string;
  dailyBudget: number;
  campaignType?: string;
  customerId?: string;
  finalUrl?: string;
  keywords?: { text: string; matchType?: string }[];
  headlines?: string[];
  descriptions?: string[];
};

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
    opportunities: ["Diagnostics Ads↔GA4 disponibles via AdLoop self-hosted"],
  };
}

export async function adloopGetCampaignPerformance(
  params: Record<string, unknown> = {},
): Promise<UnifiedAccountSnapshot> {
  const res = await callAdloopTool("get_campaign_performance", {
    compact: true,
    ...params,
  });
  if (!res.ok) throw new Error(res.error ?? "AdLoop get_campaign_performance failed");
  const snapshot = adloopDataToSnapshot(res.data, String(params.period ?? "30 derniers jours"));
  if (!snapshot) throw new Error("Réponse AdLoop non normalisable");
  return snapshot;
}

export async function adloopDraftCampaign(input: AdloopDraftCampaignInput): Promise<Record<string, unknown>> {
  const res = await callAdloopTool("draft_campaign", {
    campaign_type: adloopCampaignType(input.campaignType),
    name: input.name,
    daily_budget: input.dailyBudget,
    customer_id: input.customerId?.replace(/\D/g, "") || undefined,
    final_url: input.finalUrl,
    keywords: input.keywords,
    headlines: input.headlines,
    descriptions: input.descriptions,
  });
  if (!res.ok) throw new Error(res.error ?? "AdLoop draft_campaign failed");
  const planId = extractAdloopPlanId(res.data);
  return { preview: res.data, planId, upstream: "adloop", status: "PREVIEW" };
}

export async function adloopConfirmAndApply(
  planId: string,
  dryRun = false,
): Promise<Record<string, unknown>> {
  const res = await callAdloopTool("confirm_and_apply", {
    plan_id: planId,
    dry_run: dryRun,
  });
  if (!res.ok) throw new Error(res.error ?? "AdLoop confirm_and_apply failed");
  return { applied: res.data, planId, dryRun, upstream: "adloop" };
}

/** Draft then apply (live). Campaigns created PAUSED per AdLoop safety model. */
export async function adloopCreateCampaign(input: AdloopDraftCampaignInput): Promise<Record<string, unknown>> {
  const draft = await adloopDraftCampaign(input);
  const planId = draft.planId as string | null;
  if (!planId) {
    throw new Error("AdLoop draft_campaign n'a pas retourné de plan_id — impossible d'appliquer");
  }
  const applied = await adloopConfirmAndApply(planId, false);
  return { ...draft, ...applied, status: "PAUSED" };
}

/** @deprecated use adloopDraftCampaign */
export async function adloopCreateSearchCampaign(input: AdloopDraftCampaignInput): Promise<Record<string, unknown>> {
  return adloopDraftCampaign({ ...input, campaignType: input.campaignType ?? "search" });
}

export async function adloopRunGaql(query: string, customerId?: string): Promise<unknown> {
  const res = await callAdloopTool("run_gaql", { query, customer_id: customerId?.replace(/\D/g, "") });
  if (!res.ok) throw new Error(res.error ?? "AdLoop run_gaql failed");
  return res.data;
}

export async function adloopAnalyzeConversions(params: Record<string, unknown> = {}): Promise<unknown> {
  const res = await callAdloopTool("analyze_campaign_conversions", params);
  if (!res.ok) throw new Error(res.error ?? "AdLoop analyze_campaign_conversions failed");
  return res.data;
}
