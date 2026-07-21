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

export async function fetchAmazonSnapshot(
  accessToken: string,
  profileId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
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

  const campaigns: UnifiedCampaign[] = (data.campaigns ?? []).map((c) => ({
    platform: "Amazon Ads",
    id: String(c.campaignId),
    name: c.name,
    status: (c.state ?? "UNKNOWN").toUpperCase(),
    spend: 0,
    currency: "USD",
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
    cpa: null,
    roas: null,
  }));

  return {
    platform: "Amazon Ads",
    accountId: profileId,
    accountName: `Amazon Ads ${profileId}`,
    period,
    spend: 0,
    currency: "USD",
    conversions: 0,
    cpa: null,
    roas: null,
    campaigns,
    issues: campaigns.length
      ? ["Les métriques Amazon nécessitent l'API Reporting v3 (asynchrone) — lecture structure seulement"]
      : ["Aucune campagne Sponsored Products trouvée sur ce profil"],
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
