import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

const API = "https://business-api.tiktok.com/open_api/v1.3";

export async function listTikTokAdvertisers(
  accessToken: string,
  appId: string,
  secret: string,
): Promise<{ id: string; name: string }[]> {
  const url = new URL(`${API}/oauth2/advertiser/get/`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("secret", secret);

  const res = await fetch(url, {
    headers: { "Access-Token": accessToken },
  });
  if (!res.ok) throw new Error(`TikTok advertisers: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: { list?: { advertiser_id: string; advertiser_name: string }[] };
  };
  return (data.data?.list ?? []).map((a) => ({ id: a.advertiser_id, name: a.advertiser_name }));
}

export async function fetchTikTokAdsSnapshot(
  accessToken: string,
  advertiserId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const reportRes = await fetch(`${API}/report/integrated/get/`, {
    method: "POST",
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: ["campaign_id"],
      metrics: ["spend", "impressions", "clicks", "conversion"],
      start_date: fmt(start),
      end_date: fmt(end),
      page_size: 100,
    }),
  });

  if (!reportRes.ok) throw new Error(`TikTok report: ${await reportRes.text()}`);
  const report = (await reportRes.json()) as {
    data?: {
      list?: {
        dimensions?: { campaign_id?: string };
        metrics?: { spend?: string; impressions?: string; clicks?: string; conversion?: string };
      }[];
    };
  };

  let spend = 0;
  let conversions = 0;
  const campaigns: UnifiedCampaign[] = [];

  for (const row of report.data?.list ?? []) {
    const rowSpend = Number(row.metrics?.spend ?? 0);
    const conv = Number(row.metrics?.conversion ?? 0);
    spend += rowSpend;
    conversions += conv;
    const clicks = Number(row.metrics?.clicks ?? 0);
    const impressions = Number(row.metrics?.impressions ?? 0);
    campaigns.push({
      platform: "TikTok Ads",
      id: row.dimensions?.campaign_id ?? "",
      name: `Campagne ${row.dimensions?.campaign_id ?? ""}`,
      status: "ACTIVE",
      spend: rowSpend,
      currency: "USD",
      impressions,
      clicks,
      conversions: conv,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpa: conv > 0 ? rowSpend / conv : null,
      roas: null,
    });
  }

  const issues: string[] = [];
  const opportunities: string[] = [];
  if (campaigns.some((c) => c.ctr > 0 && c.ctr < 0.5)) {
    issues.push("Campagne(s) TikTok avec CTR très faible — format vidéo à renouveler");
  }
  opportunities.push("Exploitez les audiences jeunes via formats Spark Ads");

  return {
    platform: "TikTok Ads",
    accountId: advertiserId,
    accountName: `TikTok ${advertiserId}`,
    period,
    spend,
    currency: "USD",
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues,
    opportunities,
  };
}

async function tiktokJson(
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Access-Token": accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { code?: number; message?: string; data?: Record<string, unknown> };
  if (!res.ok || (data.code !== undefined && data.code !== 0)) {
    throw new Error(`TikTok ${path}: ${data.message ?? JSON.stringify(data)}`);
  }
  return data.data ?? {};
}

export async function createTikTokCampaignPaused(
  accessToken: string,
  advertiserId: string,
  input: { name: string; dailyBudget: number; objective?: string; countries?: string[] },
): Promise<{ campaignId: string; details: Record<string, unknown> }> {
  const camp = await tiktokJson(accessToken, "/campaign/create/", {
    advertiser_id: advertiserId,
    campaign_name: input.name,
    objective_type: input.objective ?? "TRAFFIC",
    budget_mode: "BUDGET_MODE_DAY",
    budget: Math.max(20, input.dailyBudget),
    operation_status: "DISABLE",
  });
  const campaignId = String(camp.campaign_id ?? "");
  if (!campaignId) throw new Error("TikTok create campaign: id manquant");

  let adGroupId: string | undefined;
  try {
    const ag = await tiktokJson(accessToken, "/adgroup/create/", {
      advertiser_id: advertiserId,
      campaign_id: campaignId,
      adgroup_name: `${input.name} — ad group`,
      promotion_type: "WEBSITE",
      budget_mode: "BUDGET_MODE_DAY",
      budget: Math.max(20, input.dailyBudget),
      schedule_type: "SCHEDULE_FROM_NOW",
      billing_event: "CPC",
      bid_type: "BID_TYPE_NO_BID",
      location_ids: [],
      operation_status: "DISABLE",
      pacing: "PACING_MODE_SMOOTH",
    });
    adGroupId = String(ag.adgroup_id ?? "") || undefined;
  } catch {
    // Campaign alone is still useful
  }

  return {
    campaignId,
    details: {
      status: "DISABLE",
      adGroupId,
      note: "Campagne TikTok créée désactivée (PAUSE équivalent)",
    },
  };
}

export async function updateTikTokCampaignBudget(
  accessToken: string,
  advertiserId: string,
  campaignId: string,
  dailyBudget: number,
): Promise<void> {
  await tiktokJson(accessToken, "/campaign/update/", {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    budget: dailyBudget,
  });
}

export async function setTikTokCampaignStatus(
  accessToken: string,
  advertiserId: string,
  campaignId: string,
  operation: "ENABLE" | "DISABLE",
): Promise<void> {
  await tiktokJson(accessToken, "/campaign/status/update/", {
    advertiser_id: advertiserId,
    campaign_ids: [campaignId],
    operation_status: operation,
  });
}
