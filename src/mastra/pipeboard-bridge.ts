/**
 * High-level Pipeboard ops for execution-router
 * (Meta, Google, TikTok, Snap, Reddit).
 */
import type { ConnectorId } from "@/lib/oauth/connectors";
import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";
import {
  callPipeboardTool,
  isPipeboardConfigured,
  type PipeboardServer,
} from "@/mastra/pipeboard-mcp";

function actId(accountId: string): string {
  const id = accountId.replace(/^act_/, "");
  return accountId.startsWith("act_") ? accountId : `act_${id}`;
}

function cents(dailyBudget: number): number {
  // Pipeboard expects daily_budget in account currency cents
  return Math.round(dailyBudget * 100);
}

export function requirePipeboard(): void {
  if (!isPipeboardConfigured()) {
    throw new Error(
      "Pipeboard non configuré — définissez PIPEBOARD_API_TOKEN (https://pipeboard.co/api-tokens)",
    );
  }
}

export async function pipeboardMetaCreateCampaign(input: {
  accountId: string;
  name: string;
  dailyBudget: number;
  objective?: string;
  countries?: string[];
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const objective = input.objective?.startsWith("OUTCOME_")
    ? input.objective
    : input.objective === "leads"
      ? "OUTCOME_LEADS"
      : input.objective === "sales"
        ? "OUTCOME_SALES"
        : "OUTCOME_TRAFFIC";

  const campaign = (await callPipeboardTool(
    "meta-ads",
    "create_campaign",
    {
      account_id: actId(input.accountId),
      name: input.name,
      objective,
      status: "PAUSED",
      daily_budget: cents(input.dailyBudget),
      special_ad_categories: [],
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    },
    { partnerUserId: input.partnerUserId },
  )) as Record<string, unknown>;

  const campaignId = String(
    campaign.id ?? campaign.campaign_id ?? (campaign as { campaign?: { id?: string } }).campaign?.id ?? "",
  );

  let adSet: Record<string, unknown> | undefined;
  if (campaignId && input.countries?.length) {
    try {
      adSet = (await callPipeboardTool(
        "meta-ads",
        "create_adset",
        {
          account_id: actId(input.accountId),
          campaign_id: campaignId,
          name: `${input.name} — Ad set`,
          status: "PAUSED",
          daily_budget: String(cents(input.dailyBudget)),
          billing_event: "IMPRESSIONS",
          optimization_goal: "LINK_CLICKS",
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          targeting: {
            geo_locations: {
              countries: input.countries.map((c) => c.toUpperCase()),
            },
          },
        },
        { partnerUserId: input.partnerUserId },
      )) as Record<string, unknown>;
    } catch {
      // campaign created; ad set optional if targeting fails
    }
  }

  return {
    campaignId,
    adSetId: adSet?.id ?? adSet?.adset_id,
    status: "PAUSED",
    upstream: "pipeboard",
    campaign,
    adSet,
  };
}

export async function pipeboardMetaActivateAd(input: {
  adId: string;
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const result = await callPipeboardTool(
    "meta-ads",
    "update_ad",
    { ad_id: input.adId, status: "ACTIVE" },
    { partnerUserId: input.partnerUserId },
  );
  return { adId: input.adId, status: "ACTIVE", upstream: "pipeboard", result };
}

export async function pipeboardMetaPauseAd(input: {
  adId: string;
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const result = await callPipeboardTool(
    "meta-ads",
    "update_ad",
    { ad_id: input.adId, status: "PAUSED" },
    { partnerUserId: input.partnerUserId },
  );
  return { adId: input.adId, status: "PAUSED", upstream: "pipeboard", result };
}

export async function pipeboardMetaPauseCampaign(input: {
  campaignId: string;
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  // Prefer update_campaign if available; fall back to update_adset patterns
  try {
    const result = await callPipeboardTool(
      "meta-ads",
      "update_campaign",
      { campaign_id: input.campaignId, status: "PAUSED" },
      { partnerUserId: input.partnerUserId },
    );
    return { campaignId: input.campaignId, status: "PAUSED", upstream: "pipeboard", result };
  } catch {
    const result = await callPipeboardTool(
      "meta-ads",
      "update_adset",
      { adset_id: input.campaignId, status: "PAUSED" },
      { partnerUserId: input.partnerUserId },
    );
    return { campaignId: input.campaignId, status: "PAUSED", upstream: "pipeboard", result };
  }
}

export async function pipeboardMetaUpdateBudget(input: {
  campaignId: string;
  dailyBudget: number;
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const result = await callPipeboardTool(
    "meta-ads",
    "update_campaign",
    { campaign_id: input.campaignId, daily_budget: cents(input.dailyBudget) },
    { partnerUserId: input.partnerUserId },
  );
  return { campaignId: input.campaignId, dailyBudget: input.dailyBudget, upstream: "pipeboard", result };
}

export async function pipeboardMetaLaunchBrief(input: {
  accountId: string;
  pageId: string;
  brief: {
    campaign: { name: string; objective?: string; dailyBudget?: number };
    adsets: Array<{
      name: string;
      dailyBudget: number;
      countries?: string[];
      ads?: Array<{ name: string; message?: string; headline?: string; link?: string; image?: string }>;
    }>;
  };
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const daily = input.brief.campaign.dailyBudget ?? input.brief.adsets[0]?.dailyBudget ?? 10;
  const created = await pipeboardMetaCreateCampaign({
    accountId: input.accountId,
    name: input.brief.campaign.name,
    dailyBudget: daily,
    objective: input.brief.campaign.objective,
    countries: input.brief.adsets[0]?.countries,
    partnerUserId: input.partnerUserId,
  });
  return { ...created, pageId: input.pageId, note: "Créé via Pipeboard (PAUSED)" };
}

export async function pipeboardGoogleCreateCampaign(input: {
  customerId: string;
  name: string;
  dailyBudget: number;
  campaignType?: string;
  finalUrl?: string;
  keywords?: string[];
  headlines?: string[];
  descriptions?: string[];
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const customerId = input.customerId.replace(/\D/g, "");
  const result = await callPipeboardTool(
    "google-ads",
    "create_campaign",
    {
      customer_id: customerId,
      name: input.name,
      daily_budget_micros: Math.round(input.dailyBudget * 1_000_000),
      campaign_type: input.campaignType ?? "SEARCH",
      status: "PAUSED",
      final_url: input.finalUrl,
      keywords: input.keywords,
      headlines: input.headlines,
      descriptions: input.descriptions,
    },
    { partnerUserId: input.partnerUserId },
  );
  const rec = result as Record<string, unknown>;
  return {
    campaignId: String(rec.campaign_id ?? rec.id ?? ""),
    status: "PAUSED",
    upstream: "pipeboard",
    result,
  };
}

function asCampaignList(raw: unknown, platform: string): UnifiedCampaign[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { campaigns?: unknown[] })?.campaigns)
      ? ((raw as { campaigns: unknown[] }).campaigns)
      : Array.isArray((raw as { data?: unknown[] })?.data)
        ? ((raw as { data: unknown[] }).data)
        : [];
  return list.map((c, i) => {
    const row = c as Record<string, unknown>;
    const spend = Number(row.spend ?? row.amount_spent ?? 0);
    const clicks = Number(row.clicks ?? 0);
    const impressions = Number(row.impressions ?? 0);
    const conversions = Number(row.conversions ?? 0);
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpa = conversions > 0 ? spend / conversions : null;
    return {
      platform,
      id: String(row.id ?? row.campaign_id ?? `c-${i}`),
      name: String(row.name ?? "Sans nom"),
      status: String(row.status ?? "UNKNOWN"),
      spend,
      impressions,
      clicks,
      conversions,
      currency: String(row.currency ?? row.currency_code ?? "USD"),
      ctr,
      cpa,
      roas: null,
    };
  });
}

export async function pipeboardMetaSnapshot(input: {
  accountId: string;
  partnerUserId?: string;
}): Promise<UnifiedAccountSnapshot> {
  requirePipeboard();
  const accountId = actId(input.accountId);
  const [campaignsRaw, insightsRaw] = await Promise.all([
    callPipeboardTool(
      "meta-ads",
      "get_campaigns",
      { account_id: accountId, limit: 50 },
      { partnerUserId: input.partnerUserId },
    ).catch(() => []),
    callPipeboardTool(
      "meta-ads",
      "get_insights",
      { object_id: accountId, time_range: "last_30d" },
      { partnerUserId: input.partnerUserId },
    ).catch(() => null),
  ]);
  const campaigns = asCampaignList(campaignsRaw, "meta_ads");
  const insights = insightsRaw as Record<string, unknown> | null;
  const spend = Number(insights?.spend ?? campaigns.reduce((s, c) => s + c.spend, 0));
  const conversions = Number(
    insights?.conversions ?? campaigns.reduce((s, c) => s + c.conversions, 0),
  );
  return {
    platform: "meta_ads",
    accountId,
    accountName: String(insights?.account_name ?? accountId),
    period: "30 derniers jours",
    currency: String(insights?.account_currency ?? campaigns[0]?.currency ?? "USD"),
    spend,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues: [],
    opportunities: [],
  };
}

export async function pipeboardGoogleSnapshot(input: {
  customerId: string;
  partnerUserId?: string;
}): Promise<UnifiedAccountSnapshot> {
  requirePipeboard();
  const customerId = input.customerId.replace(/\D/g, "");
  const campaignsRaw = await callPipeboardTool(
    "google-ads",
    "get_campaigns",
    { customer_id: customerId },
    { partnerUserId: input.partnerUserId },
  ).catch(() => []);
  const campaigns = asCampaignList(campaignsRaw, "google_ads");
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  return {
    platform: "google_ads",
    accountId: customerId,
    accountName: customerId,
    period: "30 derniers jours",
    currency: campaigns[0]?.currency ?? "USD",
    spend,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues: [],
    opportunities: [],
  };
}

/** TikTok / Snap / Reddit — same Pipeboard family, shared create/list patterns. */
const FAMILY_SERVER: Record<"tiktok_ads" | "snapchat_ads" | "reddit_ads", PipeboardServer> = {
  tiktok_ads: "tiktok-ads",
  snapchat_ads: "snap-ads",
  reddit_ads: "reddit-ads",
};

function accountArg(
  connector: "tiktok_ads" | "snapchat_ads" | "reddit_ads",
  accountId: string,
): Record<string, string> {
  if (connector === "tiktok_ads") return { advertiser_id: accountId };
  if (connector === "snapchat_ads") return { ad_account_id: accountId };
  return { account_id: accountId };
}

export async function pipeboardFamilySnapshot(input: {
  connector: "tiktok_ads" | "snapchat_ads" | "reddit_ads";
  accountId: string;
  partnerUserId?: string;
}): Promise<UnifiedAccountSnapshot> {
  requirePipeboard();
  const server = FAMILY_SERVER[input.connector];
  const campaignsRaw = await callPipeboardTool(
    server,
    "get_campaigns",
    accountArg(input.connector, input.accountId),
    { partnerUserId: input.partnerUserId },
  ).catch(() => []);
  const campaigns = asCampaignList(campaignsRaw, input.connector);
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  return {
    platform: input.connector,
    accountId: input.accountId,
    accountName: input.accountId,
    period: "30 derniers jours",
    currency: campaigns[0]?.currency ?? "USD",
    spend,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues: [],
    opportunities: [],
  };
}

export async function pipeboardFamilyCreateCampaign(input: {
  connector: "tiktok_ads" | "snapchat_ads" | "reddit_ads";
  accountId: string;
  name: string;
  dailyBudget: number;
  objective?: string;
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const server = FAMILY_SERVER[input.connector];
  const args: Record<string, unknown> = {
    ...accountArg(input.connector, input.accountId),
    name: input.name,
    status: "PAUSED",
    daily_budget: cents(input.dailyBudget),
  };
  if (input.objective) args.objective = input.objective;
  const result = (await callPipeboardTool(server, "create_campaign", args, {
    partnerUserId: input.partnerUserId,
  })) as Record<string, unknown>;
  return {
    campaignId: String(result.id ?? result.campaign_id ?? ""),
    status: "PAUSED",
    upstream: "pipeboard",
    server,
    result,
  };
}

export async function pipeboardFamilyPauseCampaign(input: {
  connector: "tiktok_ads" | "snapchat_ads" | "reddit_ads";
  campaignId: string;
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const server = FAMILY_SERVER[input.connector];
  const result = await callPipeboardTool(
    server,
    "update_campaign",
    { campaign_id: input.campaignId, status: "PAUSED" },
    { partnerUserId: input.partnerUserId },
  );
  return { campaignId: input.campaignId, status: "PAUSED", upstream: "pipeboard", server, result };
}

export async function pipeboardFamilyUpdateBudget(input: {
  connector: "tiktok_ads" | "snapchat_ads" | "reddit_ads";
  campaignId: string;
  dailyBudget: number;
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const server = FAMILY_SERVER[input.connector];
  const result = await callPipeboardTool(
    server,
    "update_campaign",
    { campaign_id: input.campaignId, daily_budget: cents(input.dailyBudget) },
    { partnerUserId: input.partnerUserId },
  );
  return {
    campaignId: input.campaignId,
    dailyBudget: input.dailyBudget,
    upstream: "pipeboard",
    server,
    result,
  };
}

export function isPipeboardFamilyConnector(
  connector: ConnectorId,
): connector is "tiktok_ads" | "snapchat_ads" | "reddit_ads" {
  return connector === "tiktok_ads" || connector === "snapchat_ads" || connector === "reddit_ads";
}
