import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

const API = "https://ads-api.twitter.com/12";

function headers(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

export async function listXAdAccounts(
  accessToken: string,
): Promise<{ id: string; name: string; currency: string }[]> {
  const res = await fetch(`${API}/accounts`, { headers: headers(accessToken) });
  if (!res.ok) throw new Error(`X Ads accounts: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: { id: string; name: string }[];
  };
  return (data.data ?? []).map((a) => ({ id: a.id, name: a.name, currency: "USD" }));
}

export async function fetchXSnapshot(
  accessToken: string,
  accountId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
  const campRes = await fetch(`${API}/accounts/${accountId}/campaigns?with_deleted=false&count=200`, {
    headers: headers(accessToken),
  });
  if (!campRes.ok) throw new Error(`X Ads campaigns: ${await campRes.text()}`);
  const campData = (await campRes.json()) as {
    data?: { id: string; name: string; entity_status?: string; currency?: string }[];
  };
  const camps = campData.data ?? [];
  const currency = camps[0]?.currency ?? "USD";

  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const metricsByCampaign = new Map<
    string,
    { spend: number; impressions: number; clicks: number; conversions: number }
  >();
  if (camps.length) {
    const ids = camps.slice(0, 20).map((c) => c.id).join(",");
    const statsRes = await fetch(
      `${API}/stats/accounts/${accountId}?entity=CAMPAIGN&entity_ids=${ids}&start_time=${iso(start)}&end_time=${iso(end)}&granularity=TOTAL&metric_groups=ENGAGEMENT,BILLING,WEB_CONVERSION&placement=ALL_ON_TWITTER`,
      { headers: headers(accessToken) },
    );
    if (statsRes.ok) {
      const stats = (await statsRes.json()) as {
        data?: {
          id: string;
          id_data?: {
            metrics?: {
              billed_charge_local_micro?: number[];
              impressions?: number[];
              clicks?: number[];
              conversion_purchases?: { metric?: number[] };
            };
          }[];
        }[];
      };
      for (const row of stats.data ?? []) {
        const m = row.id_data?.[0]?.metrics;
        metricsByCampaign.set(row.id, {
          spend: Number(m?.billed_charge_local_micro?.[0] ?? 0) / 1_000_000,
          impressions: Number(m?.impressions?.[0] ?? 0),
          clicks: Number(m?.clicks?.[0] ?? 0),
          conversions: Number(m?.conversion_purchases?.metric?.[0] ?? 0),
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
      platform: "X Ads",
      id: c.id,
      name: c.name,
      status: c.entity_status ?? "UNKNOWN",
      spend: m.spend,
      currency,
      impressions: m.impressions,
      clicks: m.clicks,
      conversions: m.conversions,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
      cpa: m.conversions > 0 ? m.spend / m.conversions : null,
      roas: null,
    };
  });

  return {
    platform: "X Ads",
    accountId,
    accountName: `X Ads ${accountId}`,
    period,
    spend,
    currency,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues: conversions ? [] : ["Aucune conversion X sur 30 jours — vérifiez le X Pixel"],
    opportunities: ["Les Keyword Ads X sont sous-exploitées — CPC souvent inférieur aux autres régies"],
  };
}

async function setXCampaignStatus(
  accessToken: string,
  accountId: string,
  campaignId: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  const res = await fetch(`${API}/accounts/${accountId}/campaigns/${campaignId}`, {
    method: "PUT",
    headers: { ...headers(accessToken), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ entity_status: status }),
  });
  if (!res.ok) throw new Error(`X Ads update status: ${await res.text()}`);
}

export async function pauseXCampaign(accessToken: string, accountId: string, campaignId: string) {
  await setXCampaignStatus(accessToken, accountId, campaignId, "PAUSED");
}

export async function enableXCampaign(accessToken: string, accountId: string, campaignId: string) {
  await setXCampaignStatus(accessToken, accountId, campaignId, "ACTIVE");
}

export async function updateXCampaignBudget(
  accessToken: string,
  accountId: string,
  campaignId: string,
  dailyBudgetMicro: number,
): Promise<void> {
  const res = await fetch(`${API}/accounts/${accountId}/campaigns/${campaignId}`, {
    method: "PUT",
    headers: { ...headers(accessToken), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ daily_budget_amount_local_micro: String(dailyBudgetMicro) }),
  });
  if (!res.ok) throw new Error(`X Ads budget update: ${await res.text()}`);
}
