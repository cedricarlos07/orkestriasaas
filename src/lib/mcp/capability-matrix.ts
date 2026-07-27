import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";
import { PLATFORM_ADAPTERS, type PlatformAdapter } from "@/lib/platforms/adapter";

export type CapabilityMaturity = "production" | "experimental" | "reporting";

export type PlatformCapability = {
  connector: ConnectorId;
  label: string;
  maturity: CapabilityMaturity;
  read: boolean;
  pause: boolean;
  budget: boolean;
  createCampaign: boolean;
  createAdSet: boolean;
  createAd: boolean;
  keywords: boolean;
  negativeKeywords: boolean;
  audiences: boolean;
  attachAudience: boolean;
  creatives: boolean;
  tracking: boolean;
  note?: string;
  /** Official docs for soft-fail / agent guidance when writes fail. */
  docsUrl?: string;
};

/**
 * Manual maturity tags — honest Synter-style matrix.
 * production = payloads reviewed against official docs for core paths.
 * experimental = API surface present but not certified end-to-end.
 * reporting = read / pause / budget only (or analytics).
 */
const MATURITY: Record<ConnectorId, CapabilityMaturity> = {
  google_ads: "production",
  meta_ads: "production",
  ga4: "reporting",
  linkedin_ads: "experimental",
  tiktok_ads: "production",
  snapchat_ads: "production",
  reddit_ads: "production",
  microsoft_ads: "experimental",
  x_ads: "experimental",
  amazon_ads: "experimental",
  pinterest_ads: "experimental",
};

const NOTES: Partial<Record<ConnectorId, string>> = {
  google_ads:
    "Pipeboard Google Ads MCP (remote). Fallback API native OAuth pour lectures.",
  meta_ads:
    "Meta via Pipeboard Meta Ads MCP (create_campaign PAUSED + update_ad). Reads OAuth natif ou Pipeboard.",
  ga4: "Read-only analytics. Writes are rejected.",
  linkedin_ads: "Pas sur Pipeboard — DRAFT create experimental (API native).",
  tiktok_ads:
    "Pipeboard TikTok Ads MCP — create/pause/budget PAUSED. OAuth client pour lier advertiser_id.",
  snapchat_ads:
    "Pipeboard Snap Ads MCP — create/pause/budget PAUSED. OAuth client pour lier ad_account_id.",
  reddit_ads:
    "Pipeboard Reddit Ads MCP — create/pause/budget PAUSED. OAuth client pour lier le compte.",
  microsoft_ads: "Pas sur Pipeboard — SOAP v13 experimental.",
  x_ads: "Pas sur Pipeboard — Ads API experimental.",
  amazon_ads: "Pas sur Pipeboard — Sponsored Products experimental.",
  pinterest_ads: "Pas sur Pipeboard — create PAUSED experimental.",
};

const DOCS: Partial<Record<ConnectorId, string>> = {
  google_ads: "https://developers.google.com/google-ads/api/docs/start",
  meta_ads: "https://developers.facebook.com/docs/marketing-api/",
  ga4: "https://developers.google.com/analytics/devguides/reporting/data/v1",
  linkedin_ads: "https://learn.microsoft.com/en-us/linkedin/marketing/",
  tiktok_ads: "https://business-api.tiktok.com/portal/docs",
  snapchat_ads: "https://marketingapi.snapchat.com/docs/",
  reddit_ads: "https://ads-api.reddit.com/docs/",
  microsoft_ads: "https://learn.microsoft.com/en-us/advertising/guides/",
  x_ads: "https://developer.x.com/en/docs/x-ads-api",
  amazon_ads: "https://advertising.amazon.com/API/docs",
  pinterest_ads: "https://developers.pinterest.com/docs/api/v5/",
};

function capsFromAdapter(adapter: PlatformAdapter, connector: ConnectorId): PlatformCapability {
  const readOnly = connector === "ga4";
  return {
    connector,
    label: adapter.label,
    maturity: MATURITY[connector],
    read: true,
    pause: !readOnly,
    budget: !readOnly,
    createCampaign: Boolean(adapter.createCampaign) && !readOnly,
    createAdSet: Boolean(adapter.createAdSet),
    createAd: Boolean(adapter.createAd),
    keywords: Boolean(adapter.addKeywords),
    negativeKeywords: Boolean(adapter.addNegativeKeywords),
    audiences: Boolean(adapter.createAudience),
    attachAudience: Boolean(adapter.attachAudience),
    creatives: Boolean(adapter.listCreatives || adapter.uploadCreative),
    tracking: Boolean(adapter.listConversions || adapter.diagnoseTracking || adapter.createConversion),
    note: NOTES[connector],
    docsUrl: DOCS[connector],
  };
}

/** Soft-fail: API errors stay visible, with maturity + official docs link (no silent swallow). */
export function enrichPlatformError(connector: ConnectorId, err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  const cap = getCapability(connector);
  const parts = [msg, `[maturity=${cap.maturity}]`];
  if (cap.docsUrl) parts.push(`Docs: ${cap.docsUrl}`);
  if (cap.maturity === "experimental") {
    parts.push("This connector is experimental — verify payloads against the official API for your account.");
  }
  return new Error(parts.join(" "));
}

export function getCapabilityMatrix(): PlatformCapability[] {
  return (Object.keys(CONNECTORS) as ConnectorId[]).map((id) => {
    const adapter = PLATFORM_ADAPTERS[id];
    return capsFromAdapter(adapter, id);
  });
}

export function getCapability(connector: ConnectorId): PlatformCapability {
  return capsFromAdapter(PLATFORM_ADAPTERS[connector], connector);
}

export function summarizeMaturity(matrix: PlatformCapability[] = getCapabilityMatrix()) {
  return {
    production: matrix.filter((m) => m.maturity === "production").map((m) => m.connector),
    experimental: matrix.filter((m) => m.maturity === "experimental").map((m) => m.connector),
    reporting: matrix.filter((m) => m.maturity === "reporting").map((m) => m.connector),
    research: ["meta_ads_archive"] as const,
  };
}
