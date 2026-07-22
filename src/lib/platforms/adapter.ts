import type { TokenPayload } from "@/lib/crypto/tokens";
import type { ConnectorId } from "@/lib/oauth/connectors";
import type { UnifiedAccountSnapshot } from "@/lib/unified-ad-schema";

export type AdAccountRef = { id: string; name: string; currency?: string };

export type KeywordInput = { text: string; matchType?: "BROAD" | "PHRASE" | "EXACT" | string; bid?: number };

export type CreateCampaignInput = {
  name: string;
  dailyBudget: number;
  objective?: string;
  countries?: string[];
  type?: "search" | "pmax" | "traffic" | "leads" | "default";
  keywords?: KeywordInput[];
  finalUrl?: string;
  headlines?: string[];
  descriptions?: string[];
};

/**
 * Unified interface over every supported ad platform.
 * Optional methods reject with a clear error when unsupported.
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
    input: CreateCampaignInput,
  ) => Promise<{ campaignId: string; details?: Record<string, unknown> }>;
  createAdSet?: (
    tokens: TokenPayload,
    accountId: string,
    input: { campaignId: string; name: string; dailyBudget: number; countries?: string[]; optimizationGoal?: string },
  ) => Promise<{ adSetId: string; details?: Record<string, unknown> }>;
  pauseAdSet?: (tokens: TokenPayload, accountId: string, adSetId: string) => Promise<void>;
  enableAdSet?: (tokens: TokenPayload, accountId: string, adSetId: string) => Promise<void>;
  createAd?: (
    tokens: TokenPayload,
    accountId: string,
    input: {
      adSetId: string;
      name: string;
      pageId?: string;
      linkUrl?: string;
      message?: string;
      headline?: string;
      imageUrl?: string;
      imageHash?: string;
    },
  ) => Promise<{ adId: string; details?: Record<string, unknown> }>;
  uploadCreative?: (
    tokens: TokenPayload,
    accountId: string,
    input: { imageUrl: string; name?: string },
  ) => Promise<{ imageHash?: string; creativeId?: string; details?: Record<string, unknown> }>;
  createAudience?: (
    tokens: TokenPayload,
    accountId: string,
    input: {
      name: string;
      description?: string;
      subtype?: string;
      lookalikeRatio?: number;
      originAudienceId?: string;
      country?: string;
    },
  ) => Promise<{ audienceId: string; details?: Record<string, unknown> }>;
  addKeywords?: (
    tokens: TokenPayload,
    accountId: string,
    input: { adGroupId: string; keywords: KeywordInput[] },
  ) => Promise<{ count: number; details?: Record<string, unknown> }>;
  addNegativeKeywords?: (
    tokens: TokenPayload,
    accountId: string,
    input: { campaignId: string; keywords: KeywordInput[] },
  ) => Promise<{ count: number; details?: Record<string, unknown> }>;
  createConversion?: (
    tokens: TokenPayload,
    accountId: string,
    input: { name: string; category?: string },
  ) => Promise<{ conversionId: string; details?: Record<string, unknown> }>;
  listConversions?: (
    tokens: TokenPayload,
    accountId: string,
  ) => Promise<{ id: string; name: string; status?: string; category?: string }[]>;
  diagnoseTracking?: (
    tokens: TokenPayload,
    accountId: string,
  ) => Promise<{ ok: boolean; conversions?: number; issues: string[] }>;
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
  pauseCampaign: async (t, accountId, campaignId) => {
    const { pauseGoogleCampaign } = await import("./google-ads-api");
    await pauseGoogleCampaign(t.accessToken, accountId, campaignId);
  },
  enableCampaign: async (t, accountId, campaignId) => {
    const { enableGoogleCampaign } = await import("./google-ads-api");
    await enableGoogleCampaign(t.accessToken, accountId, campaignId);
  },
  updateBudget: async (t, accountId, campaignId, dailyBudget) => {
    const { updateGoogleCampaignBudget } = await import("./google-ads-api");
    await updateGoogleCampaignBudget(t.accessToken, accountId, campaignId, micro(dailyBudget));
  },
  addKeywords: async (t, accountId, input) => {
    const { addGoogleKeywords } = await import("./google-ads-api");
    const res = await addGoogleKeywords(t.accessToken, accountId, input.adGroupId, input.keywords);
    return { count: res.resourceNames.length, details: { resourceNames: res.resourceNames } };
  },
  createCampaign: async (t, accountId, input) => {
    const { createGoogleCampaignPaused } = await import("./google-ads-api");
    return createGoogleCampaignPaused(t.accessToken, accountId, {
      name: input.name,
      dailyBudget: input.dailyBudget,
      type: input.type === "pmax" ? "pmax" : "search",
      keywords: input.keywords,
      finalUrl: input.finalUrl,
      headlines: input.headlines,
      descriptions: input.descriptions,
      countries: input.countries,
    });
  },
  addNegativeKeywords: async (t, accountId, input) => {
    const { addGoogleNegativeKeywords } = await import("./google-ads-api");
    return addGoogleNegativeKeywords(t.accessToken, accountId, input.campaignId, input.keywords);
  },
  createAudience: async (t, accountId, input) => {
    const { createGoogleUserList } = await import("./google-ads-api");
    const res = await createGoogleUserList(t.accessToken, accountId, {
      name: input.name,
      description: input.description,
    });
    return { audienceId: res.audienceId };
  },
  createConversion: async (t, accountId, input) => {
    const { createGoogleConversionAction } = await import("./google-ads-api");
    const res = await createGoogleConversionAction(t.accessToken, accountId, input);
    return { conversionId: res.conversionId };
  },
  listConversions: async (t, accountId) => {
    const { listGoogleConversionActions } = await import("./google-ads-api");
    return listGoogleConversionActions(t.accessToken, accountId);
  },
  diagnoseTracking: async (t, accountId) => {
    const { diagnoseGoogleTracking } = await import("./google-ads-api");
    return diagnoseGoogleTracking(t.accessToken, accountId);
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
  updateBudget: async (t, _accountId, entityId, dailyBudget) => {
    const { updateMetaAdSetBudget } = await import("./meta-api");
    await updateMetaAdSetBudget(t.accessToken, entityId, dailyBudget);
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
  createAdSet: async (t, accountId, input) => {
    const { createMetaAdSet } = await import("./meta-api");
    const res = await createMetaAdSet(t.accessToken, accountId, input);
    return { adSetId: res.adSetId, details: { status: "PAUSED" } };
  },
  pauseAdSet: async (t, _accountId, adSetId) => {
    const { setMetaAdSetStatus } = await import("./meta-api");
    await setMetaAdSetStatus(t.accessToken, adSetId, "PAUSED");
  },
  enableAdSet: async (t, _accountId, adSetId) => {
    const { setMetaAdSetStatus } = await import("./meta-api");
    await setMetaAdSetStatus(t.accessToken, adSetId, "ACTIVE");
  },
  createAd: async (t, accountId, input) => {
    if (!input.pageId || !input.linkUrl) throw new Error("Meta create_ad requiert pageId et linkUrl");
    const { createMetaAd } = await import("./meta-api");
    const res = await createMetaAd(t.accessToken, accountId, {
      adSetId: input.adSetId,
      name: input.name,
      pageId: input.pageId,
      linkUrl: input.linkUrl,
      message: input.message,
      headline: input.headline,
      imageUrl: input.imageUrl,
      imageHash: input.imageHash,
    });
    return { adId: res.adId, details: { creativeId: res.creativeId, imageHash: res.imageHash, status: "PAUSED" } };
  },
  uploadCreative: async (t, accountId, input) => {
    const { uploadMetaCreative } = await import("./meta-api");
    const res = await uploadMetaCreative(t.accessToken, accountId, input);
    return { imageHash: res.imageHash };
  },
  createAudience: async (t, accountId, input) => {
    const { createMetaCustomAudience } = await import("./meta-api");
    const res = await createMetaCustomAudience(t.accessToken, accountId, input);
    return { audienceId: res.audienceId };
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
  createCampaign: async (t, accountId, input) => {
    const { createLinkedInCampaignPaused } = await import("./linkedin-api");
    return createLinkedInCampaignPaused(t.accessToken, accountId, {
      name: input.name,
      dailyBudget: input.dailyBudget,
      countries: input.countries,
      objective: input.objective,
      finalUrl: input.finalUrl,
    });
  },
  createAudience: async (t, accountId, input) => {
    const { createLinkedInMatchedAudience } = await import("./linkedin-api");
    const res = await createLinkedInMatchedAudience(t.accessToken, accountId, {
      name: input.name,
      description: input.description,
    });
    return { audienceId: res.audienceId };
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
    const { setTikTokCampaignStatus } = await import("./tiktok-api");
    await setTikTokCampaignStatus(t.accessToken, accountId, campaignId, "DISABLE");
  },
  enableCampaign: async (t, accountId, campaignId) => {
    const { setTikTokCampaignStatus } = await import("./tiktok-api");
    await setTikTokCampaignStatus(t.accessToken, accountId, campaignId, "ENABLE");
  },
  updateBudget: async (t, accountId, campaignId, dailyBudget) => {
    const { updateTikTokCampaignBudget } = await import("./tiktok-api");
    await updateTikTokCampaignBudget(t.accessToken, accountId, campaignId, dailyBudget);
  },
  createCampaign: async (t, accountId, input) => {
    const { createTikTokCampaignPaused } = await import("./tiktok-api");
    return createTikTokCampaignPaused(t.accessToken, accountId, {
      name: input.name,
      dailyBudget: input.dailyBudget,
      objective: input.objective,
      countries: input.countries,
    });
  },
};

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
  addKeywords: async (t, accountId, input) => {
    const { addMicrosoftKeywords } = await import("./microsoft-ads-api");
    return addMicrosoftKeywords(t.accessToken, accountId, input.adGroupId, input.keywords);
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
  addKeywords: async (t, accountId, input) => {
    const { addAmazonKeywords } = await import("./amazon-ads-api");
    return addAmazonKeywords(t.accessToken, accountId, input.adGroupId, input.keywords);
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
