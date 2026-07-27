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
    throw new Error("Service publicitaire temporairement indisponible. Réessayez plus tard.");
  }
}

export async function pipeboardMetaCreateCampaign(input: {
  accountId: string;
  name: string;
  dailyBudget: number;
  objective?: string;
  countries?: string[];
  /** Meta Ads destination — website (default), click-to-WhatsApp, or Messenger. */
  channel?: "website" | "whatsapp" | "messenger";
  pageId?: string;
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const channel =
    input.channel ??
    (input.objective === "messages" ||
    input.objective === "whatsapp" ||
    input.objective === "messenger" ||
    /WHATSAPP|MESSENGER/i.test(String(input.objective ?? ""))
      ? input.objective === "messenger" || /MESSENGER/i.test(String(input.objective ?? ""))
        ? "messenger"
        : "whatsapp"
      : "website");
  const isMessaging = channel === "whatsapp" || channel === "messenger";

  let objective: string;
  if (isMessaging) {
    // Click-to-WhatsApp / Messenger — Pipeboard: OUTCOME_ENGAGEMENT + CONVERSATIONS
    objective =
      input.objective?.startsWith("OUTCOME_") && input.objective !== "OUTCOME_TRAFFIC"
        ? input.objective
        : "OUTCOME_ENGAGEMENT";
  } else if (input.objective?.startsWith("OUTCOME_")) {
    objective = input.objective;
  } else if (input.objective === "leads") {
    objective = "OUTCOME_LEADS";
  } else if (input.objective === "sales") {
    objective = "OUTCOME_SALES";
  } else {
    objective = "OUTCOME_TRAFFIC";
  }

  // Messaging: budget on ad set only (avoid CBO double-budget). Website: keep campaign budget.
  const campaignArgs: Record<string, unknown> = {
    account_id: actId(input.accountId),
    name: input.name,
    objective,
    status: "PAUSED",
    special_ad_categories: [],
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
  };
  if (!isMessaging) {
    campaignArgs.daily_budget = cents(input.dailyBudget);
  }

  const campaign = (await callPipeboardTool("meta-ads", "create_campaign", campaignArgs, {
    partnerUserId: input.partnerUserId,
  })) as Record<string, unknown>;

  const campaignId = String(
    campaign.id ?? campaign.campaign_id ?? (campaign as { campaign?: { id?: string } }).campaign?.id ?? "",
  );

  let adSet: Record<string, unknown> | undefined;
  if (campaignId && (input.countries?.length || isMessaging)) {
    try {
      const countries = (input.countries?.length ? input.countries : ["CI"]).map((c) => c.toUpperCase());
      const adsetArgs: Record<string, unknown> = {
        account_id: actId(input.accountId),
        campaign_id: campaignId,
        name: `${input.name} — Ad set`,
        status: "PAUSED",
        daily_budget: String(cents(input.dailyBudget)),
        billing_event: "IMPRESSIONS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: {
          geo_locations: { countries },
          targeting_automation: { advantage_audience: 0 },
        },
      };

      if (isMessaging) {
        if (!input.pageId) {
          throw new Error("pageId requis pour une campagne Messages (WhatsApp / Messenger)");
        }
        adsetArgs.destination_type = channel === "whatsapp" ? "WHATSAPP" : "MESSENGER";
        adsetArgs.optimization_goal = "CONVERSATIONS";
        adsetArgs.promoted_object = { page_id: input.pageId };
      } else {
        adsetArgs.optimization_goal =
          objective === "OUTCOME_LEADS"
            ? "LEAD_GENERATION"
            : objective === "OUTCOME_SALES"
              ? "OFFSITE_CONVERSIONS"
              : "LINK_CLICKS";
        adsetArgs.destination_type = "WEBSITE";
      }

      adSet = (await callPipeboardTool("meta-ads", "create_adset", adsetArgs, {
        partnerUserId: input.partnerUserId,
      })) as Record<string, unknown>;
    } catch (e) {
      if (isMessaging) throw e;
      // website: campaign created; ad set optional if targeting fails
    }
  }

  return {
    campaignId,
    adSetId: adSet?.id ?? adSet?.adset_id,
    status: "PAUSED",
    upstream: "pipeboard",
    channel,
    objective,
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
    campaign: {
      name: string;
      objective?: string;
      dailyBudget?: number;
      /** website | whatsapp | messenger */
      channel?: string;
    };
    adsets: Array<{
      name: string;
      dailyBudget: number;
      countries?: string[];
      ads?: Array<{
        name: string;
        message?: string;
        headline?: string;
        link?: string;
        image?: string;
        imageUrl?: string;
        imageHash?: string;
        callToAction?: string;
        cta?: string;
      }>;
    }>;
  };
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const channelRaw = (input.brief.campaign.channel ?? "").toLowerCase();
  const objectiveRaw = (input.brief.campaign.objective ?? "").toLowerCase();
  const channel: "website" | "whatsapp" | "messenger" =
    channelRaw === "whatsapp" || /whatsapp|messages?/.test(objectiveRaw)
      ? "whatsapp"
      : channelRaw === "messenger" || /messenger/.test(objectiveRaw)
        ? "messenger"
        : "website";
  const daily = input.brief.campaign.dailyBudget ?? input.brief.adsets[0]?.dailyBudget ?? 10;
  const created = await pipeboardMetaCreateCampaign({
    accountId: input.accountId,
    name: input.brief.campaign.name,
    dailyBudget: daily,
    objective: input.brief.campaign.objective,
    countries: input.brief.adsets[0]?.countries,
    channel,
    pageId: input.pageId,
    partnerUserId: input.partnerUserId,
  });

  const adSetId = String(created.adSetId ?? "");
  const adsCreated: Array<Record<string, unknown>> = [];
  const firstAds = input.brief.adsets[0]?.ads ?? [];
  const isMsg = channel === "whatsapp" || channel === "messenger";
  const defaultCta = isMsg
    ? channel === "messenger"
      ? "MESSAGE_PAGE"
      : "WHATSAPP_MESSAGE"
    : "LEARN_MORE";

  if (adSetId && firstAds.length) {
    for (const ad of firstAds.slice(0, 5)) {
      const image = ad.image ?? ad.imageUrl;
      if (!image && !ad.imageHash) continue;
      try {
        const attached = await pipeboardAttachImageAd({
          accountId: input.accountId,
          adSetId,
          pageId: input.pageId,
          name: ad.name || `${input.brief.campaign.name} — ad`,
          linkUrl: ad.link || (isMsg ? "https://www.facebook.com" : "https://orkestria.top"),
          message: ad.message,
          headline: ad.headline,
          imageUrl: image,
          imageHash: ad.imageHash,
          callToAction: ad.callToAction ?? ad.cta ?? defaultCta,
          partnerUserId: input.partnerUserId,
        });
        adsCreated.push(attached);
      } catch (e) {
        adsCreated.push({
          error: e instanceof Error ? e.message : "créa échouée",
          name: ad.name,
        });
      }
    }
  }

  // Extra ABO ad sets (beyond the first created with the campaign)
  const extraAdSets: Array<Record<string, unknown>> = [];
  for (const aset of input.brief.adsets.slice(1, 4)) {
    try {
      const extra = await pipeboardMetaCreateAdSet({
        accountId: input.accountId,
        campaignId: String(created.campaignId),
        name: aset.name,
        dailyBudget: aset.dailyBudget,
        countries: aset.countries ?? input.brief.adsets[0]?.countries ?? ["FR"],
        channel,
        pageId: input.pageId,
        partnerUserId: input.partnerUserId,
      });
      extraAdSets.push(extra);
    } catch (e) {
      extraAdSets.push({
        error: e instanceof Error ? e.message : "ad set échoué",
        name: aset.name,
      });
    }
  }

  return {
    ...created,
    pageId: input.pageId,
    channel,
    ads: adsCreated,
    extraAdSets,
    status: "PAUSED",
    note: "Structure créée en pause — confirmez avant activation",
  };
}

/** Standalone paused Meta ad set (website or Messages destination). */
export async function pipeboardMetaCreateAdSet(input: {
  accountId: string;
  campaignId: string;
  name: string;
  dailyBudget: number;
  countries?: string[];
  channel?: "website" | "whatsapp" | "messenger";
  pageId?: string;
  optimizationGoal?: string;
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const channel = input.channel ?? "website";
  const isMessaging = channel === "whatsapp" || channel === "messenger";
  const countries = (input.countries?.length ? input.countries : ["FR"]).map((c) => c.toUpperCase());
  const args: Record<string, unknown> = {
    account_id: actId(input.accountId),
    campaign_id: input.campaignId,
    name: input.name,
    status: "PAUSED",
    daily_budget: String(cents(input.dailyBudget)),
    billing_event: "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: {
      geo_locations: { countries },
      targeting_automation: { advantage_audience: 0 },
    },
  };
  if (isMessaging) {
    if (!input.pageId) throw new Error("pageId requis pour ad set Messages");
    args.destination_type = channel === "whatsapp" ? "WHATSAPP" : "MESSENGER";
    args.optimization_goal = input.optimizationGoal ?? "CONVERSATIONS";
    args.promoted_object = { page_id: input.pageId };
  } else {
    args.destination_type = "WEBSITE";
    args.optimization_goal = input.optimizationGoal ?? "LINK_CLICKS";
  }
  const raw = (await callPipeboardTool("meta-ads", "create_adset", args, {
    partnerUserId: input.partnerUserId,
  })) as Record<string, unknown>;
  return {
    adSetId: String(raw.id ?? raw.adset_id ?? ""),
    status: "PAUSED",
    upstream: "pipeboard",
    channel,
    raw,
  };
}

export async function pipeboardMetaEnableCampaign(input: {
  campaignId: string;
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const result = await callPipeboardTool(
    "meta-ads",
    "update_campaign",
    { campaign_id: input.campaignId, status: "ACTIVE" },
    { partnerUserId: input.partnerUserId },
  );
  return { campaignId: input.campaignId, status: "ACTIVE", upstream: "pipeboard", result };
}

export async function pipeboardMetaEnableAdSet(input: {
  adSetId: string;
  partnerUserId?: string;
}): Promise<Record<string, unknown>> {
  requirePipeboard();
  const result = await callPipeboardTool(
    "meta-ads",
    "update_adset",
    { adset_id: input.adSetId, status: "ACTIVE" },
    { partnerUserId: input.partnerUserId },
  );
  return { adSetId: input.adSetId, status: "ACTIVE", upstream: "pipeboard", result };
}

export async function pipeboardMetaListAdSets(input: {
  accountId: string;
  campaignId?: string;
  partnerUserId?: string;
}): Promise<unknown> {
  requirePipeboard();
  const args: Record<string, unknown> = {
    account_id: actId(input.accountId),
    limit: 50,
  };
  if (input.campaignId) args.campaign_id = input.campaignId;
  return callPipeboardTool("meta-ads", "get_adsets", args, { partnerUserId: input.partnerUserId });
}

export async function pipeboardMetaListAds(input: {
  accountId: string;
  campaignId?: string;
  adSetId?: string;
  partnerUserId?: string;
}): Promise<unknown> {
  requirePipeboard();
  const args: Record<string, unknown> = {
    account_id: actId(input.accountId),
    limit: 50,
  };
  if (input.campaignId) args.campaign_id = input.campaignId;
  if (input.adSetId) args.adset_id = input.adSetId;
  return callPipeboardTool("meta-ads", "get_ads", args, { partnerUserId: input.partnerUserId });
}

export async function pipeboardMetaGetAccountPages(input: {
  accountId: string;
  partnerUserId?: string;
}): Promise<unknown> {
  requirePipeboard();
  return callPipeboardTool(
    "meta-ads",
    "get_account_pages",
    { account_id: actId(input.accountId) },
    { partnerUserId: input.partnerUserId },
  );
}

export async function pipeboardMetaEstimateAudience(input: {
  accountId: string;
  targeting: Record<string, unknown>;
  optimizationGoal?: string;
  partnerUserId?: string;
}): Promise<unknown> {
  requirePipeboard();
  return callPipeboardTool(
    "meta-ads",
    "estimate_audience_size",
    {
      account_id: actId(input.accountId),
      targeting_spec: input.targeting,
      optimization_goal: input.optimizationGoal ?? "REACH",
    },
    { partnerUserId: input.partnerUserId },
  );
}

export async function pipeboardMetaSearchGeo(input: {
  query: string;
  locationTypes?: string[];
  partnerUserId?: string;
}): Promise<unknown> {
  requirePipeboard();
  return callPipeboardTool(
    "meta-ads",
    "search_geo_locations",
    {
      query: input.query,
      location_types: input.locationTypes ?? ["country", "city", "region"],
    },
    { partnerUserId: input.partnerUserId },
  );
}

export async function pipeboardMetaDuplicateCampaign(input: {
  campaignId: string;
  name?: string;
  partnerUserId?: string;
}): Promise<unknown> {
  requirePipeboard();
  return callPipeboardTool(
    "meta-ads",
    "duplicate_campaign",
    {
      campaign_id: input.campaignId,
      name_suffix: input.name ?? " — copie",
      status_option: "PAUSED",
    },
    { partnerUserId: input.partnerUserId },
  );
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

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function extractPipeboardImageHash(res: unknown): string {
  const r = asRecord(res);
  const direct = pickStr(r.image_hash, r.hash);
  if (direct) return direct;
  const images = r.images;
  if (Array.isArray(images) && images[0]) {
    const first = asRecord(images[0]);
    const h = pickStr(first.hash, first.image_hash);
    if (h) return h;
  }
  if (images && typeof images === "object" && !Array.isArray(images)) {
    const first = Object.values(images as Record<string, unknown>)[0];
    const h = pickStr(asRecord(first).hash);
    if (h) return h;
  }
  throw new Error(`Upload image : hash manquant — ${JSON.stringify(res).slice(0, 240)}`);
}

export function extractPipeboardId(res: unknown, ...keys: string[]): string {
  const r = asRecord(res);
  for (const k of keys) {
    const v = pickStr(r[k]);
    if (v) return v;
  }
  const nested = asRecord(r.creative ?? r.ad ?? r.result);
  for (const k of keys) {
    const v = pickStr(nested[k]);
    if (v) return v;
  }
  throw new Error(`Création Meta : id manquant (${keys.join("/")}) — ${JSON.stringify(res).slice(0, 240)}`);
}

/** Upload image to Meta via Pipeboard (URL publique ou data URL / base64). */
export async function pipeboardUploadAdImage(input: {
  accountId: string;
  imageUrl?: string;
  /** data:image/...;base64,... or raw base64 */
  file?: string;
  name?: string;
  partnerUserId?: string;
}): Promise<{ imageHash: string; upstream: "pipeboard"; raw: unknown }> {
  requirePipeboard();
  if (!input.imageUrl && !input.file) throw new Error("imageUrl ou file (base64) requis");
  const args: Record<string, unknown> = { account_id: actId(input.accountId) };
  if (input.file) args.file = input.file;
  if (input.imageUrl) args.image_url = input.imageUrl;
  if (input.name) args.name = input.name;
  const raw = await callPipeboardTool("meta-ads", "upload_ad_image", args, {
    partnerUserId: input.partnerUserId,
  });
  return { imageHash: extractPipeboardImageHash(raw), upstream: "pipeboard", raw };
}

/** Create a Meta ad creative via Pipeboard (image, or existing post boost). */
export async function pipeboardCreateAdCreative(input: {
  accountId: string;
  name: string;
  pageId?: string;
  imageHash?: string;
  objectStoryId?: string;
  linkUrl?: string;
  message?: string;
  headline?: string;
  callToAction?: string;
  partnerUserId?: string;
}): Promise<{ creativeId: string; upstream: "pipeboard"; raw: unknown }> {
  requirePipeboard();
  if (!input.objectStoryId && !input.imageHash) {
    throw new Error("imageHash ou objectStoryId requis pour create_ad_creative");
  }
  const args: Record<string, unknown> = {
    account_id: actId(input.accountId),
    name: input.name,
  };
  if (input.objectStoryId) {
    args.object_story_id = input.objectStoryId;
  } else {
    args.image_hash = input.imageHash;
    if (input.pageId) args.page_id = input.pageId;
    if (input.linkUrl) args.link_url = input.linkUrl;
    if (input.message) args.message = input.message;
    if (input.headline) args.headline = input.headline;
    if (input.callToAction) args.call_to_action_type = input.callToAction;
  }
  const raw = await callPipeboardTool("meta-ads", "create_ad_creative", args, {
    partnerUserId: input.partnerUserId,
  });
  return {
    creativeId: extractPipeboardId(raw, "id", "creative_id"),
    upstream: "pipeboard",
    raw,
  };
}

export async function pipeboardCreateAd(input: {
  accountId: string;
  adSetId: string;
  creativeId: string;
  name: string;
  partnerUserId?: string;
}): Promise<{ adId: string; status: "PAUSED"; upstream: "pipeboard"; raw: unknown }> {
  requirePipeboard();
  const raw = await callPipeboardTool(
    "meta-ads",
    "create_ad",
    {
      account_id: actId(input.accountId),
      adset_id: input.adSetId,
      creative_id: input.creativeId,
      name: input.name,
      status: "PAUSED",
    },
    { partnerUserId: input.partnerUserId },
  );
  return {
    adId: extractPipeboardId(raw, "id", "ad_id"),
    status: "PAUSED",
    upstream: "pipeboard",
    raw,
  };
}

/**
 * Full path: upload image (optional) → creative → ad PAUSED on an existing ad set.
 */
export async function pipeboardAttachImageAd(input: {
  accountId: string;
  adSetId: string;
  pageId: string;
  name: string;
  linkUrl: string;
  message?: string;
  headline?: string;
  imageUrl?: string;
  file?: string;
  imageHash?: string;
  /** LEARN_MORE (site) | WHATSAPP_MESSAGE | MESSAGE_PAGE */
  callToAction?: string;
  partnerUserId?: string;
}): Promise<{
  adId: string;
  creativeId: string;
  imageHash: string;
  status: "PAUSED";
  upstream: "pipeboard";
}> {
  let imageHash = input.imageHash;
  if (!imageHash) {
    const up = await pipeboardUploadAdImage({
      accountId: input.accountId,
      imageUrl: input.imageUrl,
      file: input.file,
      name: input.name,
      partnerUserId: input.partnerUserId,
    });
    imageHash = up.imageHash;
  }
  const creative = await pipeboardCreateAdCreative({
    accountId: input.accountId,
    name: `${input.name} — créa`,
    pageId: input.pageId,
    imageHash,
    linkUrl: input.linkUrl,
    message: input.message,
    headline: input.headline,
    callToAction: input.callToAction ?? "LEARN_MORE",
    partnerUserId: input.partnerUserId,
  });
  const ad = await pipeboardCreateAd({
    accountId: input.accountId,
    adSetId: input.adSetId,
    creativeId: creative.creativeId,
    name: input.name,
    partnerUserId: input.partnerUserId,
  });
  return {
    adId: ad.adId,
    creativeId: creative.creativeId,
    imageHash,
    status: "PAUSED",
    upstream: "pipeboard",
  };
}

/**
 * Boost an existing Page post via Pipeboard object_story_id.
 * Creates a paused engagement campaign + ad set + ad.
 */
export async function pipeboardBoostPost(input: {
  accountId: string;
  pageId: string;
  objectStoryId: string;
  name: string;
  dailyBudget: number;
  countries?: string[];
  partnerUserId?: string;
}): Promise<{
  campaignId: string;
  adSetId?: string;
  adId?: string;
  creativeId?: string;
  status: "PAUSED";
  upstream: "pipeboard";
  error?: string;
}> {
  requirePipeboard();
  const campaign = (await callPipeboardTool(
    "meta-ads",
    "create_campaign",
    {
      account_id: actId(input.accountId),
      name: input.name,
      objective: "OUTCOME_ENGAGEMENT",
      status: "PAUSED",
      special_ad_categories: [],
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    },
    { partnerUserId: input.partnerUserId },
  )) as Record<string, unknown>;
  const campaignId = extractPipeboardId(campaign, "id", "campaign_id");

  let adSetId: string | undefined;
  try {
    const adSet = (await callPipeboardTool(
      "meta-ads",
      "create_adset",
      {
        account_id: actId(input.accountId),
        campaign_id: campaignId,
        name: `${input.name} — Ad set`,
        status: "PAUSED",
        daily_budget: String(cents(input.dailyBudget)),
        billing_event: "IMPRESSIONS",
        optimization_goal: "POST_ENGAGEMENT",
        destination_type: "ON_POST",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        promoted_object: { page_id: input.pageId },
        targeting: {
          geo_locations: {
            countries: (input.countries?.length ? input.countries : ["FR"]).map((c) =>
              c.toUpperCase(),
            ),
          },
        },
      },
      { partnerUserId: input.partnerUserId },
    )) as Record<string, unknown>;
    adSetId = extractPipeboardId(adSet, "id", "adset_id");
  } catch (e) {
    return {
      campaignId,
      status: "PAUSED",
      upstream: "pipeboard",
      error: e instanceof Error ? e.message : "adset failed",
    };
  }

  const creative = await pipeboardCreateAdCreative({
    accountId: input.accountId,
    name: `${input.name} — post`,
    objectStoryId: input.objectStoryId,
    partnerUserId: input.partnerUserId,
  });

  const ad = await pipeboardCreateAd({
    accountId: input.accountId,
    adSetId: adSetId!,
    creativeId: creative.creativeId,
    name: input.name,
    partnerUserId: input.partnerUserId,
  });

  return {
    campaignId,
    adSetId,
    adId: ad.adId,
    creativeId: creative.creativeId,
    status: "PAUSED",
    upstream: "pipeboard",
  };
}
