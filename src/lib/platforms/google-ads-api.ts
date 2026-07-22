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

async function mutateCampaignStatus(
  accessToken: string,
  customerId: string,
  campaignId: string,
  status: "PAUSED" | "ENABLED",
): Promise<void> {
  const cid = customerId.replace(/\D/g, "");
  const res = await fetch(`${API}/customers/${cid}/campaigns:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: [
        {
          update: {
            resourceName: `customers/${cid}/campaigns/${campaignId}`,
            status,
          },
          updateMask: "status",
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Google Ads status update: ${await res.text()}`);
}

export async function pauseGoogleCampaign(accessToken: string, customerId: string, campaignId: string) {
  await mutateCampaignStatus(accessToken, customerId, campaignId, "PAUSED");
}

export async function enableGoogleCampaign(accessToken: string, customerId: string, campaignId: string) {
  await mutateCampaignStatus(accessToken, customerId, campaignId, "ENABLED");
}

export async function addGoogleKeywords(
  accessToken: string,
  customerId: string,
  adGroupId: string,
  keywords: { text: string; matchType?: "BROAD" | "PHRASE" | "EXACT" }[],
): Promise<{ resourceNames: string[] }> {
  const cid = customerId.replace(/\D/g, "");
  const res = await fetch(`${API}/customers/${cid}/adGroupCriteria:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: keywords.map((kw) => ({
        create: {
          adGroup: `customers/${cid}/adGroups/${adGroupId}`,
          status: "ENABLED",
          keyword: {
            text: kw.text,
            matchType: kw.matchType ?? "BROAD",
          },
        },
      })),
    }),
  });
  if (!res.ok) throw new Error(`Google Ads add keywords: ${await res.text()}`);
  const data = (await res.json()) as { results?: { resourceName?: string }[] };
  return { resourceNames: (data.results ?? []).map((r) => r.resourceName ?? "").filter(Boolean) };
}

function resourceId(resourceName: string): string {
  return resourceName.split("/").pop() ?? resourceName;
}

export type GoogleCreateCampaignInput = {
  name: string;
  dailyBudget: number;
  type?: "search" | "pmax" | "default";
  keywords?: { text: string; matchType?: "BROAD" | "PHRASE" | "EXACT" | string }[];
  finalUrl?: string;
  headlines?: string[];
  descriptions?: string[];
  countries?: string[];
};

export async function createGoogleCampaignPaused(
  accessToken: string,
  customerId: string,
  input: GoogleCreateCampaignInput,
): Promise<{ campaignId: string; details: Record<string, unknown> }> {
  const cid = customerId.replace(/\D/g, "");
  const budgetMicros = Math.round(input.dailyBudget * 1_000_000);
  const type = input.type === "pmax" ? "pmax" : "search";

  const budgetRes = await fetch(`${API}/customers/${cid}/campaignBudgets:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: [
        {
          create: {
            name: `Budget — ${input.name}`.slice(0, 100),
            amountMicros: String(Math.max(budgetMicros, 1_000_000)),
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      ],
    }),
  });
  if (!budgetRes.ok) throw new Error(`Google create budget: ${await budgetRes.text()}`);
  const budgetData = (await budgetRes.json()) as { results?: { resourceName?: string }[] };
  const budgetRn = budgetData.results?.[0]?.resourceName;
  if (!budgetRn) throw new Error("Google create budget: resourceName manquant");

  if (type === "pmax") {
    const campRes = await fetch(`${API}/customers/${cid}/campaigns:mutate`, {
      method: "POST",
      headers: headers(accessToken),
      body: JSON.stringify({
        operations: [
          {
            create: {
              name: input.name,
              status: "PAUSED",
              advertisingChannelType: "PERFORMANCE_MAX",
              campaignBudget: budgetRn,
              maximizeConversions: {},
            },
          },
        ],
      }),
    });
    if (!campRes.ok) throw new Error(`Google create PMax: ${await campRes.text()}`);
    const campData = (await campRes.json()) as { results?: { resourceName?: string }[] };
    const campRn = campData.results?.[0]?.resourceName;
    if (!campRn) throw new Error("Google create PMax: campaign manquant");
    const campaignId = resourceId(campRn);

    const headlines = (input.headlines?.length ? input.headlines : [input.name, `${input.name} — offre`, "Découvrir"]).slice(0, 5);
    const descriptions = (input.descriptions?.length ? input.descriptions : ["Découvrez notre offre", "En savoir plus"]).slice(0, 4);
    const finalUrl = input.finalUrl ?? "https://example.com";

    const agRes = await fetch(`${API}/customers/${cid}/assetGroups:mutate`, {
      method: "POST",
      headers: headers(accessToken),
      body: JSON.stringify({
        operations: [
          {
            create: {
              name: `${input.name} — assets`.slice(0, 128),
              campaign: campRn,
              finalUrls: [finalUrl],
              status: "PAUSED",
            },
          },
        ],
      }),
    });
    // Asset group may fail on some accounts — still return campaign
    let assetGroupId: string | undefined;
    if (agRes.ok) {
      const agData = (await agRes.json()) as { results?: { resourceName?: string }[] };
      assetGroupId = agData.results?.[0]?.resourceName
        ? resourceId(agData.results[0].resourceName!)
        : undefined;
    }

    return {
      campaignId,
      details: {
        status: "PAUSED",
        type: "pmax",
        budgetResource: budgetRn,
        assetGroupId,
        headlines,
        descriptions,
        note: assetGroupId
          ? "PMax créée en PAUSE avec asset group textuel minimal"
          : "PMax créée en PAUSE — asset group à compléter dans Google Ads",
      },
    };
  }

  // Search
  const campRes = await fetch(`${API}/customers/${cid}/campaigns:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: [
        {
          create: {
            name: input.name,
            status: "PAUSED",
            advertisingChannelType: "SEARCH",
            campaignBudget: budgetRn,
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: true,
              targetContentNetwork: false,
            },
            manualCpc: {},
          },
        },
      ],
    }),
  });
  if (!campRes.ok) throw new Error(`Google create Search: ${await campRes.text()}`);
  const campData = (await campRes.json()) as { results?: { resourceName?: string }[] };
  const campRn = campData.results?.[0]?.resourceName;
  if (!campRn) throw new Error("Google create Search: campaign manquant");
  const campaignId = resourceId(campRn);

  const agRes = await fetch(`${API}/customers/${cid}/adGroups:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: [
        {
          create: {
            name: `${input.name} — ad group`.slice(0, 255),
            campaign: campRn,
            status: "PAUSED",
            type: "SEARCH_STANDARD",
            cpcBidMicros: String(Math.max(100_000, Math.round(input.dailyBudget * 10_000))),
          },
        },
      ],
    }),
  });
  if (!agRes.ok) throw new Error(`Google create ad group: ${await agRes.text()}`);
  const agData = (await agRes.json()) as { results?: { resourceName?: string }[] };
  const adGroupRn = agData.results?.[0]?.resourceName;
  if (!adGroupRn) throw new Error("Google create ad group: resourceName manquant");
  const adGroupId = resourceId(adGroupRn);

  const keywords = input.keywords?.length
    ? input.keywords
    : [{ text: input.name, matchType: "BROAD" as const }];
  const kw = await addGoogleKeywords(accessToken, cid, adGroupId, keywords);

  const headlines = (input.headlines?.length ? input.headlines : [input.name, "Offre limitée", "En savoir plus"]).slice(0, 15);
  const descriptions = (input.descriptions?.length ? input.descriptions : ["Découvrez notre solution", "Demandez une démo"]).slice(0, 4);
  const finalUrl = input.finalUrl ?? "https://example.com";

  let adId: string | undefined;
  const adRes = await fetch(`${API}/customers/${cid}/adGroupAds:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: [
        {
          create: {
            adGroup: adGroupRn,
            status: "PAUSED",
            ad: {
              responsiveSearchAd: {
                headlines: headlines.map((h) => ({ text: h.slice(0, 30) })),
                descriptions: descriptions.map((d) => ({ text: d.slice(0, 90) })),
              },
              finalUrls: [finalUrl],
            },
          },
        },
      ],
    }),
  });
  if (adRes.ok) {
    const adData = (await adRes.json()) as { results?: { resourceName?: string }[] };
    adId = adData.results?.[0]?.resourceName ? resourceId(adData.results[0].resourceName!) : undefined;
  }

  return {
    campaignId,
    details: {
      status: "PAUSED",
      type: "search",
      adGroupId,
      adId,
      keywords: kw.resourceNames.length,
      note: "Search créée en PAUSE avec ad group, mots-clés et RSA",
    },
  };
}

export async function addGoogleNegativeKeywords(
  accessToken: string,
  customerId: string,
  campaignId: string,
  keywords: { text: string; matchType?: string }[],
): Promise<{ count: number }> {
  const cid = customerId.replace(/\D/g, "");
  const res = await fetch(`${API}/customers/${cid}/campaignCriteria:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: keywords.map((kw) => ({
        create: {
          campaign: `customers/${cid}/campaigns/${campaignId}`,
          negative: true,
          keyword: {
            text: kw.text,
            matchType: kw.matchType ?? "BROAD",
          },
        },
      })),
    }),
  });
  if (!res.ok) throw new Error(`Google negative keywords: ${await res.text()}`);
  return { count: keywords.length };
}

export async function createGoogleUserList(
  accessToken: string,
  customerId: string,
  input: { name: string; description?: string },
): Promise<{ audienceId: string }> {
  const cid = customerId.replace(/\D/g, "");
  const res = await fetch(`${API}/customers/${cid}/userLists:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: [
        {
          create: {
            name: input.name,
            description: input.description ?? "Orkestria audience",
            membershipLifeSpan: 30,
            crmBasedUserList: {
              uploadKeyType: "CONTACT_INFO",
              dataSourceType: "FIRST_PARTY",
            },
          },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Google create audience: ${await res.text()}`);
  const data = (await res.json()) as { results?: { resourceName?: string }[] };
  const rn = data.results?.[0]?.resourceName;
  if (!rn) throw new Error("Google create audience: id manquant");
  return { audienceId: resourceId(rn) };
}

export async function createGoogleConversionAction(
  accessToken: string,
  customerId: string,
  input: { name: string; category?: string },
): Promise<{ conversionId: string }> {
  const cid = customerId.replace(/\D/g, "");
  const res = await fetch(`${API}/customers/${cid}/conversionActions:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: [
        {
          create: {
            name: input.name,
            type: "WEBPAGE",
            category: input.category ?? "PURCHASE",
            status: "ENABLED",
            valueSettings: { defaultValue: 1, alwaysUseDefaultValue: true },
          },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Google create conversion: ${await res.text()}`);
  const data = (await res.json()) as { results?: { resourceName?: string }[] };
  const rn = data.results?.[0]?.resourceName;
  if (!rn) throw new Error("Google create conversion: id manquant");
  return { conversionId: resourceId(rn) };
}

export async function listGoogleConversionActions(
  accessToken: string,
  customerId: string,
): Promise<{ id: string; name: string; status: string; category: string }[]> {
  const cid = customerId.replace(/\D/g, "");
  const rows = await gaqlSearch(
    cid,
    accessToken,
    `SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.category FROM conversion_action WHERE conversion_action.status != 'REMOVED'`,
  );
  return rows.map((row) => {
    const r = row as {
      conversionAction?: { id?: string; name?: string; status?: string; category?: string };
    };
    return {
      id: String(r.conversionAction?.id ?? ""),
      name: r.conversionAction?.name ?? "",
      status: r.conversionAction?.status ?? "",
      category: r.conversionAction?.category ?? "",
    };
  });
}

export async function diagnoseGoogleTracking(
  accessToken: string,
  customerId: string,
): Promise<{ ok: boolean; conversions: number; issues: string[] }> {
  const list = await listGoogleConversionActions(accessToken, customerId);
  const issues: string[] = [];
  if (!list.length) issues.push("Aucune conversion action configurée");
  const enabled = list.filter((c) => c.status === "ENABLED");
  if (list.length && !enabled.length) issues.push("Des conversions existent mais aucune n'est ENABLED");
  return { ok: issues.length === 0, conversions: list.length, issues };
}
