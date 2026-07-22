import { requireEnv } from "@/lib/platforms/config";
import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

const API = "https://advertising-api.amazon.com";

function headers(accessToken: string, profileId?: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Amazon-Advertising-API-ClientId": requireEnv("AMAZON_ADS_CLIENT_ID"),
    "Content-Type": "application/json",
  };
  if (profileId) h["Amazon-Advertising-API-Scope"] = profileId;
  return h;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function periodToDates(period?: string): { startDate: string; endDate: string } {
  const end = new Date();
  let days = 30;
  if (period?.includes("7")) days = 7;
  else if (period?.includes("14")) days = 14;
  else if (period?.includes("90")) days = 90;
  const start = new Date(end.getTime() - days * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export async function listAmazonProfiles(
  accessToken: string,
): Promise<{ id: string; name: string; currency: string }[]> {
  const res = await fetch(`${API}/v2/profiles`, { headers: headers(accessToken) });
  if (!res.ok) throw new Error(`Amazon profiles: ${await res.text()}`);
  const data = (await res.json()) as {
    profileId: number;
    countryCode?: string;
    currencyCode?: string;
    accountInfo?: { name?: string };
  }[];
  return data.map((p) => ({
    id: String(p.profileId),
    name: p.accountInfo?.name ?? `Amazon ${p.countryCode ?? ""} ${p.profileId}`,
    currency: p.currencyCode ?? "USD",
  }));
}

async function fetchSpCampaignMetrics(
  accessToken: string,
  profileId: string,
  period?: string,
): Promise<Map<string, { spend: number; impressions: number; clicks: number; conversions: number }>> {
  const { startDate, endDate } = periodToDates(period);
  const createRes = await fetch(`${API}/reporting/reports`, {
    method: "POST",
    headers: {
      ...headers(accessToken, profileId),
      "Content-Type": "application/vnd.createasyncreportrequest.v3+json",
      Accept: "application/vnd.createasyncreportrequest.v3+json",
    },
    body: JSON.stringify({
      name: `orkestria-sp-${Date.now()}`,
      startDate,
      endDate,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        groupBy: ["campaign"],
        columns: [
          "campaignId",
          "impressions",
          "clicks",
          "cost",
          "purchases14d",
        ],
        reportTypeId: "spCampaigns",
        timeUnit: "SUMMARY",
        format: "GZIP_JSON",
      },
    }),
  });
  if (!createRes.ok) throw new Error(`Amazon reporting create: ${await createRes.text()}`);
  const created = (await createRes.json()) as { reportId?: string };
  if (!created.reportId) throw new Error("Amazon reporting: reportId manquant");

  let downloadUrl: string | null = null;
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const statusRes = await fetch(`${API}/reporting/reports/${created.reportId}`, {
      headers: {
        ...headers(accessToken, profileId),
        Accept: "application/vnd.getasyncreportresponse.v3+json",
      },
    });
    if (!statusRes.ok) throw new Error(`Amazon reporting poll: ${await statusRes.text()}`);
    const status = (await statusRes.json()) as { status?: string; url?: string; failureReason?: string };
    if (status.status === "FAILURE") {
      throw new Error(`Amazon reporting failed: ${status.failureReason ?? "unknown"}`);
    }
    if (status.status === "COMPLETED" && status.url) {
      downloadUrl = status.url;
      break;
    }
  }
  if (!downloadUrl) throw new Error("Amazon reporting: timeout");

  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) throw new Error(`Amazon report download: ${fileRes.status}`);
  const buf = new Uint8Array(await fileRes.arrayBuffer());
  let text: string;
  try {
    // Decompress gzip if needed
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      const ds = new DecompressionStream("gzip");
      const stream = new Blob([buf]).stream().pipeThrough(ds);
      text = await new Response(stream).text();
    } else {
      text = new TextDecoder().decode(buf);
    }
  } catch {
    text = new TextDecoder().decode(buf);
  }

  const metrics = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number }>();
  let rows: Record<string, unknown>[] = [];
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>[] | { data?: Record<string, unknown>[] };
    rows = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
  } catch {
    throw new Error("Amazon reporting: JSON illisible");
  }
  for (const row of rows) {
    const id = String(row.campaignId ?? "");
    if (!id) continue;
    metrics.set(id, {
      spend: Number(row.cost ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      conversions: Number(row.purchases14d ?? 0),
    });
  }
  return metrics;
}

export async function fetchAmazonSnapshot(
  accessToken: string,
  profileId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
  const profiles = await listAmazonProfiles(accessToken).catch(() => [] as { id: string; name: string; currency: string }[]);
  const profile = profiles.find((p) => p.id === profileId);
  const currency = profile?.currency ?? "USD";

  const res = await fetch(`${API}/sp/campaigns/list`, {
    method: "POST",
    headers: {
      ...headers(accessToken, profileId),
      "Content-Type": "application/vnd.spCampaign.v3+json",
      Accept: "application/vnd.spCampaign.v3+json",
    },
    body: JSON.stringify({ maxResults: 100 }),
  });
  if (!res.ok) throw new Error(`Amazon campaigns: ${await res.text()}`);
  const data = (await res.json()) as {
    campaigns?: { campaignId: string; name: string; state?: string; budget?: { budget?: number } }[];
  };

  const issues: string[] = [];
  let metrics = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number }>();
  try {
    metrics = await fetchSpCampaignMetrics(accessToken, profileId, period);
  } catch (e) {
    issues.push(e instanceof Error ? e.message : "Reporting Amazon indisponible");
  }

  let spend = 0;
  let conversions = 0;
  const campaigns: UnifiedCampaign[] = (data.campaigns ?? []).map((c) => {
    const m = metrics.get(String(c.campaignId)) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    spend += m.spend;
    conversions += m.conversions;
    return {
      platform: "Amazon Ads",
      id: String(c.campaignId),
      name: c.name,
      status: (c.state ?? "UNKNOWN").toUpperCase(),
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

  if (!campaigns.length) issues.push("Aucune campagne Sponsored Products trouvée sur ce profil");

  return {
    platform: "Amazon Ads",
    accountId: profileId,
    accountName: profile?.name ?? `Amazon Ads ${profileId}`,
    period,
    spend,
    currency,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues,
    opportunities: ["Activez les campagnes automatiques Amazon pour découvrir de nouveaux mots-clés rentables"],
  };
}

async function updateAmazonCampaign(
  accessToken: string,
  profileId: string,
  campaign: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${API}/sp/campaigns`, {
    method: "PUT",
    headers: {
      ...headers(accessToken, profileId),
      "Content-Type": "application/vnd.spCampaign.v3+json",
      Accept: "application/vnd.spCampaign.v3+json",
    },
    body: JSON.stringify({ campaigns: [campaign] }),
  });
  if (!res.ok) throw new Error(`Amazon update campaign: ${await res.text()}`);
}

export async function pauseAmazonCampaign(accessToken: string, profileId: string, campaignId: string) {
  await updateAmazonCampaign(accessToken, profileId, { campaignId, state: "PAUSED" });
}

export async function enableAmazonCampaign(accessToken: string, profileId: string, campaignId: string) {
  await updateAmazonCampaign(accessToken, profileId, { campaignId, state: "ENABLED" });
}

export async function updateAmazonCampaignBudget(
  accessToken: string,
  profileId: string,
  campaignId: string,
  dailyBudget: number,
): Promise<void> {
  await updateAmazonCampaign(accessToken, profileId, {
    campaignId,
    budget: { budget: dailyBudget, budgetType: "DAILY" },
  });
}

export async function addAmazonKeywords(
  accessToken: string,
  profileId: string,
  adGroupId: string,
  keywords: { text: string; matchType?: string; bid?: number }[],
): Promise<{ count: number }> {
  const res = await fetch(`${API}/sp/keywords`, {
    method: "POST",
    headers: {
      ...headers(accessToken, profileId),
      "Content-Type": "application/vnd.spKeyword.v3+json",
      Accept: "application/vnd.spKeyword.v3+json",
    },
    body: JSON.stringify({
      keywords: keywords.map((kw) => ({
        adGroupId,
        keywordText: kw.text,
        matchType: (kw.matchType ?? "BROAD").toUpperCase(),
        state: "ENABLED",
        bid: kw.bid,
      })),
    }),
  });
  if (!res.ok) throw new Error(`Amazon add keywords: ${await res.text()}`);
  return { count: keywords.length };
}
