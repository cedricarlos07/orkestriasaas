import type { TokenPayload } from "@/lib/crypto/tokens";
import type { ConnectorId } from "@/lib/oauth/connectors";
import type { UnifiedAccountSnapshot } from "@/lib/unified-ad-schema";

export type AdAccountRef = { id: string; name: string; currency?: string };

/**
 * Unified interface over every supported ad platform.
 * `createCampaign` is optional: platforms without it reject the tool with a clear error.
 */
export type PlatformAdapter = {
  connector: ConnectorId;
  label: string;
  listAccounts: (tokens: TokenPayload) => Promise<AdAccountRef[]>;
  fetchSnapshot: (tokens: TokenPayload, accountId: string, period?: string) => Promise<UnifiedAccountSnapshot>;
  pauseCampaign: (tokens: TokenPayload, accountId: string, campaignId: string) => Promise<void>;
  enableCampaign: (tokens: TokenPayload, accountId: string, campaignId: string) => Promise<void>;
  /** budget: main currency unit per day (converted internally to micro where needed) */
  updateBudget: (tokens: TokenPayload, accountId: string, campaignId: string, dailyBudget: number) => Promise<void>;
  createCampaign?: (
    tokens: TokenPayload,
    accountId: string,
    input: { name: string; dailyBudget: number; objective?: string; countries?: string[] },
  ) => Promise<{ campaignId: string; details?: Record<string, unknown> }>;
};

function micro(amount: number): number {
  return Math.round(amount * 1_000_000);
}

const googleAds: PlatformAdapter = {
  connector: "google_ads",
  label: "Google Ads",
  listAccounts: async (t) => {
    const { listAccessibleGoogleAdsCustomers } = await import("./google-ads-api");
    return listAccessibleGoogleAdsCustomers(t.accessToken);
  },
  fetchSnapshot: async (t, accountId, period) => {
    const { fetchGoogleAdsSnapshot } = await import("./google-ads-api");
    return fetchGoogleAdsSnapshot(t.accessToken, accountId, period);
  },
  pauseCampaign: async () => {
    throw new Error("Pause Google Ads non supportée pour l'instant — utilisez update_budget ou la console Google");
  },
  enableCampaign: async () => {
    throw new Error("Activation Google Ads non supportée pour l'instant");
  },
  updateBudget: async (t, accountId, campaignId, dailyBudget) => {
    const { updateGoogleCampaignBudget } = await import("./google-ads-api");
    await updateGoogleCampaignBudget(t.accessToken, accountId, campaignId, micro(dailyBudget));
  },
};

const metaAds: PlatformAdapter = {
  connector: "meta_ads",
  label: "Meta Ads",
  listAccounts: async (t) => {
    const { listMetaAdAccounts } = await import("./meta-api");
    return listMetaAdAccounts(t.accessToken);
  },
  fetchSnapshot: async (t, accountId, period) => {
    const { fetchMetaAdsSnapshot } = await import("./meta-api");
    return fetchMetaAdsSnapshot(t.accessToken, accountId, period);
  },
  pauseCampaign: async (t, _accountId, campaignId) => {
    const { pauseMetaCampaign } = await import("./meta-api");
    await pauseMetaCampaign(t.accessToken, campaignId);
  },
  enableCampaign: async (t, _accountId, campaignId) => {
    const { resumeMetaCampaign } = await import("./meta-api");
    await resumeMetaCampaign(t.accessToken, campaignId);
  },
  updateBudget: async () => {
    throw new Error("Budget Meta géré au niveau ad set — utilisez pause/enable ou la création de campagne");
  },
  createCampaign: async (t, accountId, input) => {
    const { createMetaCampaignPaused } = await import("./meta-api");
    const result = await createMetaCampaignPaused({
      accessToken: t.accessToken,
      adAccountId: accountId,
      name: input.name,
      dailyBudget: input.dailyBudget,
      objective: input.objective,
      countries: input.countries,
    });
    return { campaignId: result.campaignId, details: { adSetId: result.adSetId, status: "PAUSED" } };
  },
};

const linkedinAds: PlatformAdapter = {
  connector: "linkedin_ads",
  label: "LinkedIn Ads",
  listAccounts: async (t) => {
    const { listLinkedInAdAccounts } = await import("./linkedin-api");
    return listLinkedInAdAccounts(t.accessToken);
  },
  fetchSnapshot: async (t, accountId, period) => {
    const { fetchLinkedInSnapshot } = await import("./linkedin-api");
    return fetchLinkedInSnapshot(t.accessToken, accountId, period);
  },
  pauseCampaign: async (t, accountId, campaignId) => {
    const { pauseLinkedInCampaign } = await import("./linkedin-api");
    await pauseLinkedInCampaign(t.accessToken, accountId, campaignId);
  },
  enableCampaign: async (t, accountId, campaignId) => {
    const { enableLinkedInCampaign } = await import("./linkedin-api");
    await enableLinkedInCampaign(t.accessToken, accountId, campaignId);
  },
  updateBudget: async (t, accountId, campaignId, dailyBudget) => {
    const { updateLinkedInCampaignBudget } = await import("./linkedin-api");
    await updateLinkedInCampaignBudget(t.accessToken, accountId, campaignId, dailyBudget);
  },
};

const tiktokAds: PlatformAdapter = {
  connector: "tiktok_ads",
  label: "TikTok Ads",
  listAccounts: async (t) => {
    const { listTikTokAdvertisers } = await import("./tiktok-api");
    const appId = process.env.TIKTOK_APP_ID ?? "";
    const secret = process.env.TIKTOK_APP_SECRET ?? "";
    return listTikTokAdvertisers(t.accessToken, appId, secret);
  },
  fetchSnapshot: async (t, accountId, period) => {
    const { fetchTikTokAdsSnapshot } = await import("./tiktok-api");
    return fetchTikTokAdsSnapshot(t.accessToken, accountId, period);
  },
  pauseCampaign: async (t, accountId, campaignId) => {
    await tiktokStatus(t.accessToken, accountId, campaignId, "DISABLE");
  },
  enableCampaign: async (t, accountId, campaignId) => {
    await tiktokStatus(t.accessToken, accountId, campaignId, "ENABLE");
  },
  updateBudget: async (t, accountId, campaignId, dailyBudget) => {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/campaign/update/", {
      method: "POST",
      headers: { "Access-Token": t.accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ advertiser_id: accountId, campaign_id: campaignId, budget: dailyBudget }),
    });
    const data = (await res.json()) as { code?: number; message?: string };
    if (!res.ok || (data.code !== undefined && data.code !== 0)) {
      throw new Error(`TikTok budget update: ${data.message ?? (await res.text())}`);
    }
  },
};

async function tiktokStatus(
  accessToken: string,
  advertiserId: string,
  campaignId: string,
  operation: "ENABLE" | "DISABLE",
): Promise<void> {
  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/campaign/status/update/", {
    method: "POST",
    headers: { "Access-Token": accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      campaign_ids: [campaignId],
      operation_status: operation,
    }),
  });
  const data = (await res.json()) as { code?: number; message?: string };
  if (!res.ok || (data.code !== undefined && data.code !== 0)) {
    throw new Error(`TikTok status update: ${data.message ?? "erreur inconnue"}`);
  }
}

const snapchatAds: PlatformAdapter = {
  connector: "snapchat_ads",
  label: "Snapchat Ads",
  listAccounts: async (t) => {
    const { listSnapchatAdAccounts } = await import("./snapchat-api");
    return listSnapchatAdAccounts(t.accessToken);
  },
  fetchSnapshot: async (t, accountId, period) => {
    const { fetchSnapchatSnapshot } = await import("./snapchat-api");
    return fetchSnapchatSnapshot(t.accessToken, accountId, period);
  },
  pauseCampaign: async (t, _accountId, campaignId) => {
    const { pauseSnapchatCampaign } = await import("./snapchat-api");
    await pauseSnapchatCampaign(t.accessToken, campaignId);
  },
  enableCampaign: async (t, _accountId, campaignId) => {
    const { enableSnapchatCampaign } = await import("./snapchat-api");
    await enableSnapchatCampaign(t.accessToken, campaignId);
  },
  updateBudget: async (t, _accountId, campaignId, dailyBudget) => {
    const { updateSnapchatCampaignBudget } = await import("./snapchat-api");
    await updateSnapchatCampaignBudget(t.accessToken, campaignId, micro(dailyBudget));
  },
};

const redditAds: PlatformAdapter = {
  connector: "reddit_ads",
  label: "Reddit Ads",
  listAccounts: async (t) => {
    const { listRedditAdAccounts } = await import("./reddit-api");
    return listRedditAdAccounts(t.accessToken);
  },
  fetchSnapshot: async (t, accountId, period) => {
    const { fetchRedditSnapshot } = await import("./reddit-api");
    return fetchRedditSnapshot(t.accessToken, accountId, period);
  },
  pauseCampaign: async (t, _accountId, campaignId) => {
    const { pauseRedditCampaign } = await import("./reddit-api");
    await pauseRedditCampaign(t.accessToken, campaignId);
  },
  enableCampaign: async (t, _accountId, campaignId) => {
    const { enableRedditCampaign } = await import("./reddit-api");
    await enableRedditCampaign(t.accessToken, campaignId);
  },
  updateBudget: async (t, _accountId, campaignId, dailyBudget) => {
    const { updateRedditCampaignBudget } = await import("./reddit-api");
    await updateRedditCampaignBudget(t.accessToken, campaignId, micro(dailyBudget));
  },
};

const microsoftAds: PlatformAdapter = {
  connector: "microsoft_ads",
  label: "Microsoft Ads",
  listAccounts: async (t) => {
    const { listMicrosoftAdAccounts } = await import("./microsoft-ads-api");
    return listMicrosoftAdAccounts(t.accessToken);
  },
  fetchSnapshot: async (t, accountId, period) => {
    const { fetchMicrosoftSnapshot } = await import("./microsoft-ads-api");
    return fetchMicrosoftSnapshot(t.accessToken, accountId, period);
  },
  pauseCampaign: async (t, accountId, campaignId) => {
    const { pauseMicrosoftCampaign } = await import("./microsoft-ads-api");
    await pauseMicrosoftCampaign(t.accessToken, accountId, campaignId);
  },
  enableCampaign: async (t, accountId, campaignId) => {
    const { enableMicrosoftCampaign } = await import("./microsoft-ads-api");
    await enableMicrosoftCampaign(t.accessToken, accountId, campaignId);
  },
  updateBudget: async (t, accountId, campaignId, dailyBudget) => {
    const { updateMicrosoftCampaignBudget } = await import("./microsoft-ads-api");
    await updateMicrosoftCampaignBudget(t.accessToken, accountId, campaignId, dailyBudget);
  },
};

const xAds: PlatformAdapter = {
  connector: "x_ads",
  label: "X Ads",
  listAccounts: async (t) => {
    const { listXAdAccounts } = await import("./x-ads-api");
    return listXAdAccounts(t.accessToken);
  },
  fetchSnapshot: async (t, accountId, period) => {
    const { fetchXSnapshot } = await import("./x-ads-api");
    return fetchXSnapshot(t.accessToken, accountId, period);
  },
  pauseCampaign: async (t, accountId, campaignId) => {
    const { pauseXCampaign } = await import("./x-ads-api");
    await pauseXCampaign(t.accessToken, accountId, campaignId);
  },
  enableCampaign: async (t, accountId, campaignId) => {
    const { enableXCampaign } = await import("./x-ads-api");
    await enableXCampaign(t.accessToken, accountId, campaignId);
  },
  updateBudget: async (t, accountId, campaignId, dailyBudget) => {
    const { updateXCampaignBudget } = await import("./x-ads-api");
    await updateXCampaignBudget(t.accessToken, accountId, campaignId, micro(dailyBudget));
  },
};

const amazonAds: PlatformAdapter = {
  connector: "amazon_ads",
  label: "Amazon Ads",
  listAccounts: async (t) => {
    const { listAmazonProfiles } = await import("./amazon-ads-api");
    return listAmazonProfiles(t.accessToken);
  },
  fetchSnapshot: async (t, accountId, period) => {
    const { fetchAmazonSnapshot } = await import("./amazon-ads-api");
    return fetchAmazonSnapshot(t.accessToken, accountId, period);
  },
  pauseCampaign: async (t, accountId, campaignId) => {
    const { pauseAmazonCampaign } = await import("./amazon-ads-api");
    await pauseAmazonCampaign(t.accessToken, accountId, campaignId);
  },
  enableCampaign: async (t, accountId, campaignId) => {
    const { enableAmazonCampaign } = await import("./amazon-ads-api");
    await enableAmazonCampaign(t.accessToken, accountId, campaignId);
  },
  updateBudget: async (t, accountId, campaignId, dailyBudget) => {
    const { updateAmazonCampaignBudget } = await import("./amazon-ads-api");
    await updateAmazonCampaignBudget(t.accessToken, accountId, campaignId, dailyBudget);
  },
};

const pinterestAds: PlatformAdapter = {
  connector: "pinterest_ads",
  label: "Pinterest Ads",
  listAccounts: async (t) => {
    const { listPinterestAdAccounts } = await import("./pinterest-api");
    return listPinterestAdAccounts(t.accessToken);
  },
  fetchSnapshot: async (t, accountId, period) => {
    const { fetchPinterestSnapshot } = await import("./pinterest-api");
    return fetchPinterestSnapshot(t.accessToken, accountId, period);
  },
  pauseCampaign: async (t, accountId, campaignId) => {
    const { pausePinterestCampaign } = await import("./pinterest-api");
    await pausePinterestCampaign(t.accessToken, accountId, campaignId);
  },
  enableCampaign: async (t, accountId, campaignId) => {
    const { enablePinterestCampaign } = await import("./pinterest-api");
    await enablePinterestCampaign(t.accessToken, accountId, campaignId);
  },
  updateBudget: async (t, accountId, campaignId, dailyBudget) => {
    const { updatePinterestCampaignBudget } = await import("./pinterest-api");
    await updatePinterestCampaignBudget(t.accessToken, accountId, campaignId, micro(dailyBudget));
  },
};

const ga4: PlatformAdapter = {
  connector: "ga4",
  label: "Google Analytics 4",
  listAccounts: async (t) => {
    const { listGa4Properties } = await import("./ga4-api");
    return listGa4Properties(t.accessToken);
  },
  fetchSnapshot: async (t, accountId, period) => {
    const { fetchGa4Snapshot } = await import("./ga4-api");
    return fetchGa4Snapshot(t.accessToken, accountId, period);
  },
  pauseCampaign: async () => {
    throw new Error("GA4 est en lecture seule");
  },
  enableCampaign: async () => {
    throw new Error("GA4 est en lecture seule");
  },
  updateBudget: async () => {
    throw new Error("GA4 est en lecture seule");
  },
};

export const PLATFORM_ADAPTERS: Record<ConnectorId, PlatformAdapter> = {
  google_ads: googleAds,
  meta_ads: metaAds,
  linkedin_ads: linkedinAds,
  tiktok_ads: tiktokAds,
  snapchat_ads: snapchatAds,
  reddit_ads: redditAds,
  microsoft_ads: microsoftAds,
  x_ads: xAds,
  amazon_ads: amazonAds,
  pinterest_ads: pinterestAds,
  ga4,
};

export function getAdapter(connector: ConnectorId): PlatformAdapter {
  const adapter = PLATFORM_ADAPTERS[connector];
  if (!adapter) throw new Error(`Plateforme inconnue : ${connector}`);
  return adapter;
}
