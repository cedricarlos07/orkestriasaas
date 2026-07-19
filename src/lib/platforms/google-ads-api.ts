import { requireEnv } from "@/lib/platforms/config";
import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

const API = "https://googleads.googleapis.com/v17";

function headers(accessToken: string, loginCustomerId?: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": requireEnv("GOOGLE_ADS_DEVELOPER_TOKEN"),
    "Content-Type": "application/json",
  };
  if (loginCustomerId) h["login-customer-id"] = loginCustomerId.replace(/\D/g, "");
  return h;
}

export async function listAccessibleGoogleAdsCustomers(accessToken: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${API}/customers:listAccessibleCustomers`, {
    headers: headers(accessToken),
  });
  if (!res.ok) throw new Error(`Google Ads list customers: ${await res.text()}`);
  const data = (await res.json()) as { resourceNames?: string[] };
  const ids = (data.resourceNames ?? []).map((r) => r.replace("customers/", ""));
  const accounts: { id: string; name: string }[] = [];
  for (const id of ids.slice(0, 20)) {
    try {
      const detail = await gaqlSearch(
        id,
        accessToken,
        `SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1`,
      );
      const row = detail[0] as { customer?: { descriptiveName?: string } } | undefined;
      accounts.push({ id, name: row?.customer?.descriptiveName ?? `Compte ${id}` });
    } catch {
      accounts.push({ id, name: `Compte ${id}` });
    }
  }
  return accounts;
}

export async function gaqlSearch(
  customerId: string,
  accessToken: string,
  query: string,
  loginCustomerId?: string,
): Promise<unknown[]> {
  const res = await fetch(`${API}/customers/${customerId.replace(/\D/g, "")}/googleAds:search`, {
    method: "POST",
    headers: headers(accessToken, loginCustomerId),
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Google Ads GAQL: ${await res.text()}`);
  const data = (await res.json()) as { results?: unknown[] };
  return data.results ?? [];
}

export async function fetchGoogleAdsSnapshot(
  accessToken: string,
  customerId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
  const cid = customerId.replace(/\D/g, "");
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.ctr,
      metrics.cost_per_conversion,
      customer.currency_code,
      customer.descriptive_name
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status != 'REMOVED'
  `;
  const rows = await gaqlSearch(cid, accessToken, query);
  const campaigns: UnifiedCampaign[] = [];
  let spend = 0;
  let conversions = 0;
  let currency = "USD";
  let accountName = `Google Ads ${cid}`;

  for (const row of rows) {
    const r = row as {
      campaign?: { id?: string; name?: string; status?: string };
      metrics?: {
        costMicros?: string;
        impressions?: string;
        clicks?: string;
        conversions?: number;
        ctr?: number;
        costPerConversion?: number;
      };
      customer?: { currencyCode?: string; descriptiveName?: string };
    };
    if (r.customer?.currencyCode) currency = r.customer.currencyCode;
    if (r.customer?.descriptiveName) accountName = r.customer.descriptiveName;
    const cost = Number(r.metrics?.costMicros ?? 0) / 1_000_000;
    const conv = Number(r.metrics?.conversions ?? 0);
    spend += cost;
    conversions += conv;
    campaigns.push({
      platform: "Google Ads",
      id: String(r.campaign?.id ?? ""),
      name: r.campaign?.name ?? "Campagne",
      status: r.campaign?.status ?? "UNKNOWN",
      spend: cost,
      currency,
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks: Number(r.metrics?.clicks ?? 0),
      conversions: conv,
      ctr: Number(r.metrics?.ctr ?? 0) * 100,
      cpa: r.metrics?.costPerConversion ?? (conv > 0 ? cost / conv : null),
      roas: null,
    });
  }

  const issues: string[] = [];
  const opportunities: string[] = [];
  const lowCtr = campaigns.filter((c) => c.ctr > 0 && c.ctr < 1);
  if (lowCtr.length) issues.push(`${lowCtr.length} campagne(s) Google avec CTR inférieur à 1 %`);
  if (campaigns.some((c) => c.status === "PAUSED")) opportunities.push("Campagnes Google en pause — réactivation possible si ROAS favorable");
  if (!conversions) issues.push("Aucune conversion enregistrée sur Google Ads sur les 30 derniers jours");

  return {
    platform: "Google Ads",
    accountId: cid,
    accountName,
    period,
    spend,
    currency,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues,
    opportunities,
  };
}

export async function updateGoogleCampaignBudget(
  accessToken: string,
  customerId: string,
  campaignId: string,
  budgetMicros: number,
): Promise<void> {
  const cid = customerId.replace(/\D/g, "");
  const budgetQuery = `
    SELECT campaign.id, campaign_budget.resource_name, campaign_budget.amount_micros
    FROM campaign
    WHERE campaign.id = ${campaignId}
    LIMIT 1
  `;
  const rows = await gaqlSearch(cid, accessToken, budgetQuery);
  const budgetResource = (rows[0] as { campaignBudget?: { resourceName?: string } })?.campaignBudget?.resourceName;
  if (!budgetResource) throw new Error("Budget campagne Google introuvable");

  const res = await fetch(`${API}/customers/${cid}/campaignBudgets:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: [
        {
          update: {
            resourceName: budgetResource,
            amountMicros: String(budgetMicros),
          },
          updateMask: "amount_micros",
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Google Ads budget update: ${await res.text()}`);
}
