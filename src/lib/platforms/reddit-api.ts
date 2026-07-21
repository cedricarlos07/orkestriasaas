import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

const API = "https://ads-api.reddit.com/api/v3";

function headers(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

export async function listRedditAdAccounts(
  accessToken: string,
): Promise<{ id: string; name: string; currency: string }[]> {
  const meRes = await fetch(`${API}/me`, { headers: headers(accessToken) });
  if (!meRes.ok) throw new Error(`Reddit me: ${await meRes.text()}`);
  const me = (await meRes.json()) as { data?: { id?: string } };
  const businessRes = await fetch(`${API}/users/${me.data?.id}/businesses`, { headers: headers(accessToken) });
  if (!businessRes.ok) throw new Error(`Reddit businesses: ${await businessRes.text()}`);
  const businesses = (await businessRes.json()) as { data?: { id: string }[] };

  const accounts: { id: string; name: string; currency: string }[] = [];
  for (const b of businesses.data ?? []) {
    const res = await fetch(`${API}/businesses/${b.id}/ad_accounts`, { headers: headers(accessToken) });
    if (!res.ok) continue;
    const data = (await res.json()) as { data?: { id: string; name: string; currency?: string }[] };
    for (const a of data.data ?? []) {
      accounts.push({ id: a.id, name: a.name, currency: a.currency ?? "USD" });
    }
  }
  return accounts;
}

export async function fetchRedditSnapshot(
  accessToken: string,
  adAccountId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
  const campRes = await fetch(`${API}/ad_accounts/${adAccountId}/campaigns`, { headers: headers(accessToken) });
  if (!campRes.ok) throw new Error(`Reddit campaigns: ${await campRes.text()}`);
  const campData = (await campRes.json()) as {
    data?: { id: string; name: string; effective_status?: string; configured_status?: string }[];
  };

  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const reportRes = await fetch(`${API}/ad_accounts/${adAccountId}/reports`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      data: {
        breakdowns: ["CAMPAIGN_ID"],
        fields: ["SPEND", "IMPRESSIONS", "CLICKS", "CONVERSION_SIGNUPS", "CONVERSION_PURCHASES"],
        starts_at: fmt(start),
        ends_at: fmt(end),
        time_zone_id: "GMT",
      },
    }),
  });
  const metricsByCampaign = new Map<
    string,
    { spend: number; impressions: number; clicks: number; conversions: number }
  >();
  if (reportRes.ok) {
    const report = (await reportRes.json()) as {
      data?: {
        metrics?: {
          campaign_id?: string;
          spend?: number;
          impressions?: number;
          clicks?: number;
          conversion_purchases?: number;
        }[];
      };
    };
    for (const row of report.data?.metrics ?? []) {
      metricsByCampaign.set(String(row.campaign_id ?? ""), {
        // Reddit reports spend in micro-currency
        spend: Number(row.spend ?? 0) / 1_000_000,
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        conversions: Number(row.conversion_purchases ?? 0),
      });
    }
  }

  let spend = 0;
  let conversions = 0;
  const campaigns: UnifiedCampaign[] = (campData.data ?? []).map((c) => {
    const m = metricsByCampaign.get(c.id) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    spend += m.spend;
    conversions += m.conversions;
    return {
      platform: "Reddit Ads",
      id: c.id,
      name: c.name,
      status: c.effective_status ?? c.configured_status ?? "UNKNOWN",
      spend: m.spend,
      currency: "USD",
      impressions: m.impressions,
      clicks: m.clicks,
      conversions: m.conversions,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
      cpa: m.conversions > 0 ? m.spend / m.conversions : null,
      roas: null,
    };
  });

  return {
    platform: "Reddit Ads",
    accountId: adAccountId,
    accountName: `Reddit ${adAccountId}`,
    period,
    spend,
    currency: "USD",
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues: conversions ? [] : ["Aucune conversion Reddit sur 30 jours — vérifiez le Reddit Pixel"],
    opportunities: ["Ciblez les subreddits proches de votre niche pour un CPC bas"],
  };
}

async function setRedditCampaignStatus(
  accessToken: string,
  campaignId: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  const res = await fetch(`${API}/campaigns/${campaignId}`, {
    method: "PATCH",
    headers: headers(accessToken),
    body: JSON.stringify({ data: { configured_status: status } }),
  });
  if (!res.ok) throw new Error(`Reddit update status: ${await res.text()}`);
}

export async function pauseRedditCampaign(accessToken: string, campaignId: string) {
  await setRedditCampaignStatus(accessToken, campaignId, "PAUSED");
}

export async function enableRedditCampaign(accessToken: string, campaignId: string) {
  await setRedditCampaignStatus(accessToken, campaignId, "ACTIVE");
}

export async function updateRedditCampaignBudget(
  accessToken: string,
  campaignId: string,
  dailyBudgetMicro: number,
): Promise<void> {
  const res = await fetch(`${API}/campaigns/${campaignId}`, {
    method: "PATCH",
    headers: headers(accessToken),
    body: JSON.stringify({ data: { funding_instrument_daily_budget_micro: dailyBudgetMicro } }),
  });
  if (!res.ok) throw new Error(`Reddit budget update: ${await res.text()}`);
}
