import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

const API = "https://api.pinterest.com/v5";

function headers(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

export async function listPinterestAdAccounts(
  accessToken: string,
): Promise<{ id: string; name: string; currency: string }[]> {
  const res = await fetch(`${API}/ad_accounts?page_size=50`, { headers: headers(accessToken) });
  if (!res.ok) throw new Error(`Pinterest ad accounts: ${await res.text()}`);
  const data = (await res.json()) as {
    items?: { id: string; name: string; currency?: string }[];
  };
  return (data.items ?? []).map((a) => ({ id: a.id, name: a.name, currency: a.currency ?? "USD" }));
}

export async function fetchPinterestSnapshot(
  accessToken: string,
  adAccountId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
  const campRes = await fetch(
    `${API}/ad_accounts/${adAccountId}/campaigns?page_size=100&entity_statuses=ACTIVE&entity_statuses=PAUSED`,
    { headers: headers(accessToken) },
  );
  if (!campRes.ok) throw new Error(`Pinterest campaigns: ${await campRes.text()}`);
  const campData = (await campRes.json()) as {
    items?: { id: string; name: string; status?: string }[];
  };
  const camps = campData.items ?? [];

  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const metricsByCampaign = new Map<
    string,
    { spend: number; impressions: number; clicks: number; conversions: number }
  >();
  if (camps.length) {
    const ids = camps.slice(0, 100).map((c) => c.id).join(",");
    const analyticsRes = await fetch(
      `${API}/ad_accounts/${adAccountId}/campaigns/analytics?campaign_ids=${ids}&start_date=${fmt(start)}&end_date=${fmt(end)}&columns=SPEND_IN_DOLLAR,IMPRESSION_1,CLICKTHROUGH_1,TOTAL_CHECKOUT&granularity=TOTAL`,
      { headers: headers(accessToken) },
    );
    if (analyticsRes.ok) {
      const analytics = (await analyticsRes.json()) as {
        CAMPAIGN_ID?: number;
        SPEND_IN_DOLLAR?: number;
        IMPRESSION_1?: number;
        CLICKTHROUGH_1?: number;
        TOTAL_CHECKOUT?: number;
      }[];
      for (const row of analytics ?? []) {
        metricsByCampaign.set(String(row.CAMPAIGN_ID ?? ""), {
          spend: Number(row.SPEND_IN_DOLLAR ?? 0),
          impressions: Number(row.IMPRESSION_1 ?? 0),
          clicks: Number(row.CLICKTHROUGH_1 ?? 0),
          conversions: Number(row.TOTAL_CHECKOUT ?? 0),
        });
      }
    }
  }

  let spend = 0;
  let conversions = 0;
  const campaigns: UnifiedCampaign[] = camps.map((c) => {
    const m = metricsByCampaign.get(c.id) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    spend += m.spend;
    conversions += m.conversions;
    return {
      platform: "Pinterest Ads",
      id: c.id,
      name: c.name,
      status: c.status ?? "UNKNOWN",
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
    platform: "Pinterest Ads",
    accountId: adAccountId,
    accountName: `Pinterest ${adAccountId}`,
    period,
    spend,
    currency: "USD",
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues: conversions ? [] : ["Aucune conversion Pinterest sur 30 jours — vérifiez la Pinterest Tag"],
    opportunities: ["Les épingles produit avec prix affiché convertissent mieux sur Pinterest"],
  };
}

async function patchPinterestCampaign(
  accessToken: string,
  adAccountId: string,
  campaign: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${API}/ad_accounts/${adAccountId}/campaigns`, {
    method: "PATCH",
    headers: headers(accessToken),
    body: JSON.stringify([campaign]),
  });
  if (!res.ok) throw new Error(`Pinterest update campaign: ${await res.text()}`);
}

export async function pausePinterestCampaign(accessToken: string, adAccountId: string, campaignId: string) {
  await patchPinterestCampaign(accessToken, adAccountId, { id: campaignId, status: "PAUSED" });
}

export async function enablePinterestCampaign(accessToken: string, adAccountId: string, campaignId: string) {
  await patchPinterestCampaign(accessToken, adAccountId, { id: campaignId, status: "ACTIVE" });
}

export async function updatePinterestCampaignBudget(
  accessToken: string,
  adAccountId: string,
  campaignId: string,
  dailyBudgetMicro: number,
): Promise<void> {
  await patchPinterestCampaign(accessToken, adAccountId, {
    id: campaignId,
    daily_spend_cap: dailyBudgetMicro,
  });
}

export async function createPinterestCampaignPaused(
  accessToken: string,
  adAccountId: string,
  input: { name: string; dailyBudget: number; objective?: string },
): Promise<{ campaignId: string; details: Record<string, unknown> }> {
  const dailySpendCap = Math.round(Math.max(1, input.dailyBudget) * 1_000_000);
  const res = await fetch(`${API}/ad_accounts/${adAccountId}/campaigns`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify([
      {
        ad_account_id: adAccountId,
        name: input.name.slice(0, 180),
        status: "PAUSED",
        objective_type: input.objective ?? "TRAFFIC",
        daily_spend_cap: dailySpendCap,
      },
    ]),
  });
  if (!res.ok) throw new Error(`Pinterest create campaign: ${await res.text()}`);
  const data = (await res.json()) as { items?: { id?: string }[]; data?: { id?: string } };
  const campaignId = data.items?.[0]?.id ?? data.data?.id;
  if (!campaignId) throw new Error("Pinterest create campaign: id manquant");
  return {
    campaignId,
    details: { status: "PAUSED", note: "Campagne Pinterest créée en PAUSED" },
  };
}
