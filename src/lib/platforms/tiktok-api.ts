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
