/**
 * Maps Orkestria MCP tools / campaign ops onto AdKit adkit_manage calls.
 */
import type { TokenPayload } from "@/lib/crypto/tokens";
import type { MCPServerId, UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";
import {
  callAdkitTool,
  isAdkitEnabled,
  parseAdkitTextPayload,
  resolveAdkitProjectId,
} from "@/lib/mcp/clients/adkit";

export type AdkitPlatform = "meta" | "google" | "tiktok" | "reddit";

const SERVER_PLATFORM: Partial<Record<MCPServerId, AdkitPlatform>> = {
  meta_ads: "meta",
  google_ads_read: "google",
  google_ads_write: "google",
  tiktok_ads: "tiktok",
};

export function serverToAdkitPlatform(server: MCPServerId): AdkitPlatform | null {
  return SERVER_PLATFORM[server] ?? null;
}

export function connectorToAdkitPlatform(connector: string): AdkitPlatform | null {
  if (connector.includes("meta")) return "meta";
  if (connector.includes("google") && !connector.includes("analytics")) return "google";
  if (connector.includes("tiktok")) return "tiktok";
  return null;
}

const META_OBJECTIVE: Record<string, string> = {
  OUTCOME_TRAFFIC: "traffic",
  OUTCOME_AWARENESS: "awareness",
  OUTCOME_ENGAGEMENT: "engagement",
  OUTCOME_LEADS: "leads",
  OUTCOME_SALES: "sales",
  OUTCOME_CONVERSIONS: "sales",
  OUTCOME_APP_PROMOTION: "app_promotion",
  traffic: "traffic",
  awareness: "awareness",
  engagement: "engagement",
  leads: "leads",
  sales: "sales",
  app_promotion: "app_promotion",
};

export function mapMetaObjective(raw?: string): string {
  if (!raw) return "traffic";
  return META_OBJECTIVE[raw] ?? META_OBJECTIVE[raw.toUpperCase()] ?? "traffic";
}

/** Convert org-facing FCFA/XOF daily budget into AdKit account currency (often USD). */
export function toAdkitDailyBudget(amount: number, accountCurrency?: string): number {
  const cur = (accountCurrency ?? "USD").toUpperCase();
  if (cur === "XOF" || cur === "FCFA" || cur === "CFA") return Math.max(1000, Math.round(amount));
  const xofPerUsd = Number(process.env.ADKIT_XOF_PER_USD ?? 600);
  if (amount >= 500) {
    // Heuristic: Orkestria UI budgets are usually FCFA; convert when account is USD/EUR.
    return Math.max(1, Math.round(amount / Math.max(1, xofPerUsd)));
  }
  return Math.max(1, Math.round(amount));
}

function extractCampaignId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.campaignId === "string") return p.campaignId;
  if (typeof p.id === "string") return p.id;
  const draft = p.draft as Record<string, unknown> | undefined;
  if (draft && typeof draft.id === "string") return draft.id;
  const campaigns = p.campaigns as Record<string, unknown>[] | undefined;
  if (campaigns?.[0]) {
    const c = campaigns[0]!;
    if (typeof c.id === "string") return c.id;
    if (typeof c.campaignId === "string") return c.campaignId;
  }
  const result = p.result as Record<string, unknown> | undefined;
  if (result) return extractCampaignId(result);
  const data = p.data as Record<string, unknown> | undefined;
  if (data) return extractCampaignId(data);
  return null;
}

export async function adkitManage(
  projectId: string,
  args: {
    platform: AdkitPlatform;
    entity: string;
    action: string;
    accountId?: string;
    id?: string;
    params?: Record<string, unknown>;
    publish?: boolean;
    data?: Record<string, unknown>;
  },
): Promise<unknown> {
  const res = await callAdkitTool("adkit_manage", {
    projectId,
    platform: args.platform,
    entity: args.entity,
    action: args.action,
    ...(args.accountId ? { accountId: args.accountId } : {}),
    ...(args.id ? { id: args.id } : {}),
    ...(args.params ? { params: args.params } : {}),
    ...(args.publish != null ? { publish: args.publish } : {}),
    ...(args.data ? { data: args.data } : {}),
  });
  if (!res.ok) throw new Error(res.error ?? "adkit_manage failed");
  return parseAdkitTextPayload(res.data);
}

export async function fetchAdkitAccountSnapshot(opts: {
  projectId: string;
  platform: AdkitPlatform;
  accountId?: string;
  period?: string;
}): Promise<UnifiedAccountSnapshot> {
  const period = mapPeriod(opts.period);
  const results = (await adkitManage(opts.projectId, {
    platform: opts.platform,
    entity: "results",
    action: "list",
    accountId: opts.accountId,
    params: {
      level: "campaigns",
      period,
      fields: ["spend", "impressions", "clicks", "conversionEvents"],
    },
  })) as {
    rows?: {
      entity?: { id?: string; name?: string; status?: string };
      metrics?: {
        spend?: number;
        impressions?: number;
        clicks?: number;
      };
      conversionEvents?: { key?: string; value?: number }[];
    }[];
    totals?: { spend?: number };
    report?: { currency?: string; accountName?: string; accountId?: string };
  };

  const currency = results.report?.currency ?? "USD";
  const campaigns: UnifiedCampaign[] = [];
  let spend = 0;
  let conversions = 0;

  for (const row of results.rows ?? []) {
    const rowSpend = Number(row.metrics?.spend ?? 0);
    const conv =
      row.conversionEvents?.reduce((s, e) => s + Number(e.value ?? 0), 0) ?? 0;
    const clicks = Number(row.metrics?.clicks ?? 0);
    const impressions = Number(row.metrics?.impressions ?? 0);
    spend += rowSpend;
    conversions += conv;
    campaigns.push({
      platform: platformLabel(opts.platform),
      id: row.entity?.id ?? "",
      name: row.entity?.name ?? "Campagne",
      status: row.entity?.status ?? "ACTIVE",
      spend: rowSpend,
      currency,
      impressions,
      clicks,
      conversions: conv,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpa: conv > 0 ? rowSpend / conv : null,
      roas: null,
    });
  }

  if (!campaigns.length) {
    const listed = (await adkitManage(opts.projectId, {
      platform: opts.platform,
      entity: "campaigns",
      action: "list",
      accountId: opts.accountId,
      params: { limit: 50 },
    })) as { campaigns?: { id?: string; name?: string; status?: string }[]; items?: { id?: string; name?: string; status?: string }[] };

    const items = listed.campaigns ?? listed.items ?? [];
    for (const c of items) {
      campaigns.push({
        platform: platformLabel(opts.platform),
        id: c.id ?? "",
        name: c.name ?? "Campagne",
        status: c.status ?? "UNKNOWN",
        spend: 0,
        currency,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        cpa: null,
        roas: null,
      });
    }
  }

  return {
    platform: platformLabel(opts.platform),
    accountId: opts.accountId ?? results.report?.accountId ?? "",
    accountName: results.report?.accountName ?? opts.accountId ?? "AdKit",
    period: opts.period ?? "30 derniers jours",
    spend: Number(results.totals?.spend ?? spend),
    currency,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues: [],
    opportunities: [],
  };
}

function platformLabel(p: AdkitPlatform): string {
  if (p === "meta") return "Meta Ads";
  if (p === "google") return "Google Ads";
  if (p === "tiktok") return "TikTok Ads";
  return "Reddit Ads";
}

function mapPeriod(period?: string): string {
  if (!period) return "30d";
  if (/30/.test(period)) return "30d";
  if (/14/.test(period)) return "14d";
  if (/7/.test(period)) return "7d";
  if (/today|aujourd/i.test(period)) return "today";
  return "30d";
}

/** Execute an Orkestria registry write tool via AdKit. */
export async function executeAdkitWrite(opts: {
  projectId: string;
  server: MCPServerId;
  tool: string;
  tokens: TokenPayload;
  params: Record<string, unknown>;
  publish?: boolean;
}): Promise<unknown> {
  const platform = serverToAdkitPlatform(opts.server);
  if (!platform) throw new Error(`AdKit ne couvre pas ${opts.server}`);

  const accountId = opts.tokens.accountId
    ? opts.tokens.accountId.startsWith("act_") || platform !== "meta"
      ? opts.tokens.accountId
      : `act_${opts.tokens.accountId.replace(/\D/g, "")}`
    : undefined;

  const publish = opts.publish ?? process.env.MCP_WRITE_ENABLED === "true";

  if (opts.tool === "pause_campaign") {
    const campaignId = String(opts.params.campaignId ?? opts.params.campaign_id ?? opts.params.id ?? "");
    if (!campaignId) throw new Error("campaignId requis");
    return adkitManage(opts.projectId, {
      platform,
      entity: "campaigns",
      action: "update",
      accountId,
      id: campaignId,
      params: { id: campaignId, status: "paused" },
      publish,
    });
  }

  if (opts.tool === "resume_campaign") {
    const campaignId = String(opts.params.campaignId ?? opts.params.campaign_id ?? opts.params.id ?? "");
    if (!campaignId) throw new Error("campaignId requis");
    return adkitManage(opts.projectId, {
      platform,
      entity: "campaigns",
      action: "update",
      accountId,
      id: campaignId,
      params: { id: campaignId, status: "active" },
      publish,
    });
  }

  if (opts.tool === "create_campaign") {
    const name = String(opts.params.name ?? "");
    const dailyBudget = Number(opts.params.dailyBudget ?? opts.params.daily_budget ?? 0);
    if (!name || !dailyBudget) throw new Error("name et dailyBudget requis");
    const objective = mapMetaObjective(String(opts.params.objective ?? "traffic"));
    const daily = toAdkitDailyBudget(dailyBudget);
    const result = await adkitManage(opts.projectId, {
      platform,
      entity: "campaigns",
      action: "create",
      accountId,
      params: {
        name,
        objective,
        status: "paused",
        budget: { daily },
      },
      publish,
    });
    const campaignId = extractCampaignId(result);
    (opts.params as Record<string, unknown>)._result = { campaignId, raw: result, dailyBudgetUsd: daily };
    return result;
  }

  if (opts.tool === "update_budget") {
    const campaignId = String(opts.params.campaignId ?? opts.params.campaign_id ?? "");
    const budgetMicros = Number(opts.params.budgetMicros ?? opts.params.budget_micros ?? 0);
    const dailyBudget = Number(opts.params.dailyBudget ?? (budgetMicros > 0 ? budgetMicros / 1_000_000 : 0));
    if (!campaignId || !dailyBudget) throw new Error("campaignId et budget requis");
    return adkitManage(opts.projectId, {
      platform,
      entity: "campaigns",
      action: "update",
      accountId,
      id: campaignId,
      params: { id: campaignId, budget: { daily: toAdkitDailyBudget(dailyBudget) } },
      publish,
    });
  }

  throw new Error(`Write AdKit non mappé : ${opts.server}/${opts.tool}`);
}

export async function tryAdkitReadSnapshot(opts: {
  orgProjectId?: string | null;
  server: MCPServerId;
  tokens: TokenPayload;
  period?: string;
}): Promise<UnifiedAccountSnapshot | null> {
  if (!isAdkitEnabled()) return null;
  const platform = serverToAdkitPlatform(opts.server);
  if (!platform) return null;
  try {
    const projectId = await resolveAdkitProjectId(opts.orgProjectId);
    return await fetchAdkitAccountSnapshot({
      projectId,
      platform,
      accountId: opts.tokens.accountId ?? undefined,
      period: opts.period,
    });
  } catch {
    return null;
  }
}
