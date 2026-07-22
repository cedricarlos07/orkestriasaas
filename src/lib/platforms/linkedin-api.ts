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

export async function createLinkedInCampaignPaused(
  accessToken: string,
  accountId: string,
  input: { name: string; dailyBudget: number; countries?: string[]; objective?: string; finalUrl?: string },
): Promise<{ campaignId: string; details: Record<string, unknown> }> {
  const acct = accountId.replace(/\D/g, "");
  const currency = "USD";

  const groupRes = await fetch(`${API}/adAccounts/${acct}/adCampaignGroups`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      account: `urn:li:sponsoredAccount:${acct}`,
      name: `${input.name} — group`.slice(0, 100),
      status: "DRAFT",
    }),
  });
  if (!groupRes.ok) throw new Error(`LinkedIn campaign group: ${await groupRes.text()}`);
  const groupId =
    groupRes.headers.get("x-restli-id") ??
    ((await groupRes.json().catch(() => ({}))) as { id?: number }).id;
  if (!groupId) throw new Error("LinkedIn campaign group: id manquant");

  const campRes = await fetch(`${API}/adAccounts/${acct}/adCampaigns`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      account: `urn:li:sponsoredAccount:${acct}`,
      campaignGroup: `urn:li:sponsoredCampaignGroup:${groupId}`,
      name: input.name,
      status: "DRAFT",
      type: "SPONSORED_UPDATES",
      costType: "CPC",
      dailyBudget: { amount: String(input.dailyBudget), currencyCode: currency },
      unitCost: { amount: "2", currencyCode: currency },
      locale: { country: input.countries?.[0] ?? "US", language: "en" },
      offsiteDeliveryEnabled: true,
    }),
  });
  if (!campRes.ok) throw new Error(`LinkedIn create campaign: ${await campRes.text()}`);
  const campaignId =
    campRes.headers.get("x-restli-id") ??
    String(((await campRes.json().catch(() => ({}))) as { id?: number }).id ?? "");
  if (!campaignId) throw new Error("LinkedIn create campaign: id manquant");

  return {
    campaignId: String(campaignId),
    details: {
      status: "DRAFT",
      campaignGroupId: String(groupId),
      note: "Campagne LinkedIn créée en DRAFT — à activer après revue créative",
    },
  };
}

export async function createLinkedInMatchedAudience(
  accessToken: string,
  accountId: string,
  input: { name: string; description?: string },
): Promise<{ audienceId: string }> {
  const acct = accountId.replace(/\D/g, "");
  const res = await fetch(`${API}/dmpSegments`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      account: `urn:li:sponsoredAccount:${acct}`,
      name: input.name,
      description: input.description ?? "",
      type: "USER_LIST",
      destinations: ["LINKEDIN"],
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn audience: ${await res.text()}`);
  const id =
    res.headers.get("x-restli-id") ??
    String(((await res.json().catch(() => ({}))) as { id?: number }).id ?? "");
  if (!id) throw new Error("LinkedIn audience: id manquant");
  return { audienceId: String(id) };
}

/** LinkedIn has no ad sets — creates a DRAFT child campaign under the same account. */
export async function createLinkedInAdSetPaused(
  accessToken: string,
  accountId: string,
  input: { campaignId: string; name: string; dailyBudget: number; countries?: string[] },
): Promise<{ adSetId: string; details?: Record<string, unknown> }> {
  const acct = accountId.replace(/\D/g, "");
  // Resolve parent campaign's campaign group
  const parentRes = await fetch(`${API}/adAccounts/${acct}/adCampaigns/${input.campaignId}`, {
    headers: headers(accessToken),
  });
  if (!parentRes.ok) throw new Error(`LinkedIn parent campaign: ${await parentRes.text()}`);
  const parent = (await parentRes.json()) as { campaignGroup?: string };
  const currency = "USD";
  const campRes = await fetch(`${API}/adAccounts/${acct}/adCampaigns`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      account: `urn:li:sponsoredAccount:${acct}`,
      campaignGroup: parent.campaignGroup,
      name: input.name,
      status: "DRAFT",
      type: "SPONSORED_UPDATES",
      costType: "CPC",
      dailyBudget: { amount: String(input.dailyBudget), currencyCode: currency },
      unitCost: { amount: "2", currencyCode: currency },
      locale: { country: input.countries?.[0] ?? "US", language: "en" },
      offsiteDeliveryEnabled: true,
    }),
  });
  if (!campRes.ok) throw new Error(`LinkedIn create ad-set campaign: ${await campRes.text()}`);
  const adSetId =
    campRes.headers.get("x-restli-id") ??
    String(((await campRes.json().catch(() => ({}))) as { id?: number }).id ?? "");
  if (!adSetId) throw new Error("LinkedIn create ad set: id manquant");
  return {
    adSetId: String(adSetId),
    details: {
      status: "DRAFT",
      note: "LinkedIn n'a pas d'ad sets — une campagne DRAFT a été créée sous le même groupe",
    },
  };
}

export async function createLinkedInCreativeDraft(
  accessToken: string,
  accountId: string,
  input: {
    adSetId: string;
    name: string;
    linkUrl?: string;
    message?: string;
    headline?: string;
  },
): Promise<{ adId: string; details?: Record<string, unknown> }> {
  const acct = accountId.replace(/\D/g, "");
  const res = await fetch(`${API}/adAccounts/${acct}/creatives`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      campaign: `urn:li:sponsoredCampaign:${input.adSetId}`,
      intendedStatus: "DRAFT",
      name: input.name,
      content: {
        commentary: input.message ?? input.headline ?? input.name,
        landingPage: input.linkUrl ?? "https://orkestria.top",
      },
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn create creative: ${await res.text()}`);
  const adId =
    res.headers.get("x-restli-id") ??
    String(((await res.json().catch(() => ({}))) as { id?: number | string }).id ?? "");
  if (!adId) throw new Error("LinkedIn create creative: id manquant");
  return { adId: String(adId), details: { status: "DRAFT" } };
}

export async function listLinkedInCreatives(
  accessToken: string,
  accountId: string,
): Promise<{ id: string; name: string; status?: string }[]> {
  const acct = accountId.replace(/\D/g, "");
  const res = await fetch(`${API}/adAccounts/${acct}/creatives?q=search&count=50`, {
    headers: headers(accessToken),
  });
  if (!res.ok) throw new Error(`LinkedIn list creatives: ${await res.text()}`);
  const data = (await res.json()) as {
    elements?: { id?: number; name?: string; intendedStatus?: string }[];
  };
  return (data.elements ?? []).map((c) => ({
    id: String(c.id ?? ""),
    name: c.name ?? String(c.id ?? ""),
    status: c.intendedStatus,
  }));
}
