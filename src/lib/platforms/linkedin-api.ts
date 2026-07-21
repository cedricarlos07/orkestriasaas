import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

const API = "https://api.linkedin.com/rest";
const VERSION = "202411";

function headers(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

export async function listLinkedInAdAccounts(
  accessToken: string,
): Promise<{ id: string; name: string; currency: string }[]> {
  const res = await fetch(`${API}/adAccounts?q=search&search=(status:(values:List(ACTIVE)))`, {
    headers: headers(accessToken),
  });
  if (!res.ok) throw new Error(`LinkedIn ad accounts: ${await res.text()}`);
  const data = (await res.json()) as {
    elements?: { id: number; name: string; currency?: string }[];
  };
  return (data.elements ?? []).map((a) => ({
    id: String(a.id),
    name: a.name,
    currency: a.currency ?? "USD",
  }));
}

export async function fetchLinkedInSnapshot(
  accessToken: string,
  accountId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
  const acctUrn = `urn:li:sponsoredAccount:${accountId.replace(/\D/g, "")}`;

  const campRes = await fetch(
    `${API}/adAccounts/${accountId.replace(/\D/g, "")}/adCampaigns?q=search&search=(status:(values:List(ACTIVE,PAUSED)))`,
    { headers: headers(accessToken) },
  );
  if (!campRes.ok) throw new Error(`LinkedIn campaigns: ${await campRes.text()}`);
  const campData = (await campRes.json()) as {
    elements?: { id: number; name: string; status: string; dailyBudget?: { amount?: string; currencyCode?: string } }[];
  };

  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400_000);
  const dateRange = `(start:(year:${start.getFullYear()},month:${start.getMonth() + 1},day:${start.getDate()}),end:(year:${end.getFullYear()},month:${end.getMonth() + 1},day:${end.getDate()}))`;
  const analyticsRes = await fetch(
    `${API}/adAnalytics?q=analytics&pivot=CAMPAIGN&dateRange=${dateRange}&timeGranularity=ALL&accounts=List(${encodeURIComponent(acctUrn)})&fields=costInLocalCurrency,impressions,clicks,externalWebsiteConversions,pivotValues`,
    { headers: headers(accessToken) },
  );
  const analytics = analyticsRes.ok
    ? ((await analyticsRes.json()) as {
        elements?: {
          costInLocalCurrency?: string;
          impressions?: number;
          clicks?: number;
          externalWebsiteConversions?: number;
          pivotValues?: string[];
        }[];
      })
    : { elements: [] };

  const metricsByCampaign = new Map<
    string,
    { spend: number; impressions: number; clicks: number; conversions: number }
  >();
  for (const row of analytics.elements ?? []) {
    const urn = row.pivotValues?.[0] ?? "";
    const id = urn.split(":").pop() ?? "";
    metricsByCampaign.set(id, {
      spend: Number(row.costInLocalCurrency ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      conversions: Number(row.externalWebsiteConversions ?? 0),
    });
  }

  let spend = 0;
  let conversions = 0;
  const currency = campData.elements?.[0]?.dailyBudget?.currencyCode ?? "USD";
  const campaigns: UnifiedCampaign[] = (campData.elements ?? []).map((c) => {
    const m = metricsByCampaign.get(String(c.id)) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    spend += m.spend;
    conversions += m.conversions;
    return {
      platform: "LinkedIn Ads",
      id: String(c.id),
      name: c.name,
      status: c.status,
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

  const issues: string[] = [];
  if (!conversions) issues.push("Aucune conversion LinkedIn sur 30 jours — vérifiez l'Insight Tag");

  return {
    platform: "LinkedIn Ads",
    accountId,
    accountName: `LinkedIn ${accountId}`,
    period,
    spend,
    currency,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues,
    opportunities: ["Testez le ciblage par fonction et seniorité sur vos meilleures audiences B2B"],
  };
}

async function setLinkedInCampaignStatus(
  accessToken: string,
  accountId: string,
  campaignId: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  const res = await fetch(`${API}/adAccounts/${accountId.replace(/\D/g, "")}/adCampaigns/${campaignId}`, {
    method: "POST",
    headers: { ...headers(accessToken), "X-RestLi-Method": "PARTIAL_UPDATE" },
    body: JSON.stringify({ patch: { $set: { status } } }),
  });
  if (!res.ok) throw new Error(`LinkedIn ${status === "PAUSED" ? "pause" : "activate"}: ${await res.text()}`);
}

export async function pauseLinkedInCampaign(accessToken: string, accountId: string, campaignId: string) {
  await setLinkedInCampaignStatus(accessToken, accountId, campaignId, "PAUSED");
}

export async function enableLinkedInCampaign(accessToken: string, accountId: string, campaignId: string) {
  await setLinkedInCampaignStatus(accessToken, accountId, campaignId, "ACTIVE");
}

export async function updateLinkedInCampaignBudget(
  accessToken: string,
  accountId: string,
  campaignId: string,
  dailyBudget: number,
  currency = "USD",
): Promise<void> {
  const res = await fetch(`${API}/adAccounts/${accountId.replace(/\D/g, "")}/adCampaigns/${campaignId}`, {
    method: "POST",
    headers: { ...headers(accessToken), "X-RestLi-Method": "PARTIAL_UPDATE" },
    body: JSON.stringify({
      patch: { $set: { dailyBudget: { amount: String(dailyBudget), currencyCode: currency } } },
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn budget update: ${await res.text()}`);
}
