export type ConnectorId =
  | "google_ads"
  | "meta_ads"
  | "linkedin_ads"
  | "tiktok_ads"
  | "snapchat_ads"
  | "reddit_ads"
  | "microsoft_ads"
  | "x_ads"
  | "amazon_ads"
  | "pinterest_ads"
  | "ga4";

export type MCPServerName =
  | "google_ads_read"
  | "meta_ads"
  | "linkedin_ads"
  | "tiktok_ads"
  | "snapchat_ads"
  | "reddit_ads"
  | "microsoft_ads"
  | "x_ads"
  | "amazon_ads"
  | "pinterest_ads"
  | "ga4";

export type ConnectorConfig = {
  id: ConnectorId;
  label: string;
  group: "ads" | "analytics" | "business";
  oauth: {
    authorizeUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientIdEnv: string;
    clientSecretEnv: string;
    extraParams?: Record<string, string>;
    /** How client credentials are sent to the token endpoint (default: body). */
    tokenAuth?: "body" | "basic";
    /** Scope separator in the authorize URL (default: space). */
    scopeSeparator?: string;
    /** PKCE plain method (required by X). */
    usePkce?: boolean;
  };
  mcpServer: MCPServerName;
};

export const CONNECTORS: Record<ConnectorId, ConnectorConfig> = {
  google_ads: {
    id: "google_ads",
    label: "Google Ads",
    group: "ads",
    oauth: {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/adwords"],
      clientIdEnv: "GOOGLE_ADS_CLIENT_ID",
      clientSecretEnv: "GOOGLE_ADS_CLIENT_SECRET",
      extraParams: { access_type: "offline", prompt: "consent" },
    },
    mcpServer: "google_ads_read",
  },
  meta_ads: {
    id: "meta_ads",
    label: "Meta Ads",
    group: "ads",
    oauth: {
      authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
      scopes: [
        "ads_read",
        "ads_management",
        "business_management",
        "pages_show_list",
        "pages_read_engagement",
      ],
      clientIdEnv: "META_APP_ID",
      clientSecretEnv: "META_APP_SECRET",
    },
    mcpServer: "meta_ads",
  },
  linkedin_ads: {
    id: "linkedin_ads",
    label: "LinkedIn Ads",
    group: "ads",
    oauth: {
      authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
      tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      scopes: ["r_ads", "rw_ads", "r_ads_reporting"],
      clientIdEnv: "LINKEDIN_CLIENT_ID",
      clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    },
    mcpServer: "linkedin_ads",
  },
  tiktok_ads: {
    id: "tiktok_ads",
    label: "TikTok Ads",
    group: "ads",
    oauth: {
      authorizeUrl: "https://business-api.tiktok.com/portal/auth",
      tokenUrl: "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
      scopes: ["advertiser.read", "campaign.read"],
      clientIdEnv: "TIKTOK_APP_ID",
      clientSecretEnv: "TIKTOK_APP_SECRET",
    },
    mcpServer: "tiktok_ads",
  },
  snapchat_ads: {
    id: "snapchat_ads",
    label: "Snapchat Ads",
    group: "ads",
    oauth: {
      authorizeUrl: "https://accounts.snapchat.com/login/oauth2/authorize",
      tokenUrl: "https://accounts.snapchat.com/login/oauth2/access_token",
      scopes: ["snapchat-marketing-api"],
      clientIdEnv: "SNAPCHAT_CLIENT_ID",
      clientSecretEnv: "SNAPCHAT_CLIENT_SECRET",
    },
    mcpServer: "snapchat_ads",
  },
  reddit_ads: {
    id: "reddit_ads",
    label: "Reddit Ads",
    group: "ads",
    oauth: {
      authorizeUrl: "https://www.reddit.com/api/v1/authorize",
      tokenUrl: "https://www.reddit.com/api/v1/access_token",
      scopes: ["adsread", "adsedit"],
      clientIdEnv: "REDDIT_CLIENT_ID",
      clientSecretEnv: "REDDIT_CLIENT_SECRET",
      extraParams: { duration: "permanent" },
      tokenAuth: "basic",
    },
    mcpServer: "reddit_ads",
  },
  microsoft_ads: {
    id: "microsoft_ads",
    label: "Microsoft Ads",
    group: "ads",
    oauth: {
      authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      scopes: ["https://ads.microsoft.com/msads.manage", "offline_access"],
      clientIdEnv: "MICROSOFT_ADS_CLIENT_ID",
      clientSecretEnv: "MICROSOFT_ADS_CLIENT_SECRET",
    },
    mcpServer: "microsoft_ads",
  },
  x_ads: {
    id: "x_ads",
    label: "X Ads",
    group: "ads",
    oauth: {
      authorizeUrl: "https://twitter.com/i/oauth2/authorize",
      tokenUrl: "https://api.twitter.com/2/oauth2/token",
      scopes: ["tweet.read", "users.read", "offline.access"],
      clientIdEnv: "X_ADS_CLIENT_ID",
      clientSecretEnv: "X_ADS_CLIENT_SECRET",
      tokenAuth: "basic",
      usePkce: true,
    },
    mcpServer: "x_ads",
  },
  amazon_ads: {
    id: "amazon_ads",
    label: "Amazon Ads",
    group: "ads",
    oauth: {
      authorizeUrl: "https://www.amazon.com/ap/oa",
      tokenUrl: "https://api.amazon.com/auth/o2/token",
      scopes: ["advertising::campaign_management"],
      clientIdEnv: "AMAZON_ADS_CLIENT_ID",
      clientSecretEnv: "AMAZON_ADS_CLIENT_SECRET",
    },
    mcpServer: "amazon_ads",
  },
  pinterest_ads: {
    id: "pinterest_ads",
    label: "Pinterest Ads",
    group: "ads",
    oauth: {
      authorizeUrl: "https://www.pinterest.com/oauth/",
      tokenUrl: "https://api.pinterest.com/v5/oauth/token",
      scopes: ["ads:read", "ads:write"],
      clientIdEnv: "PINTEREST_CLIENT_ID",
      clientSecretEnv: "PINTEREST_CLIENT_SECRET",
      tokenAuth: "basic",
      scopeSeparator: ",",
    },
    mcpServer: "pinterest_ads",
  },
  ga4: {
    id: "ga4",
    label: "Google Analytics 4",
    group: "analytics",
    oauth: {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
      clientIdEnv: "GOOGLE_ANALYTICS_CLIENT_ID",
      clientSecretEnv: "GOOGLE_ANALYTICS_CLIENT_SECRET",
      extraParams: { access_type: "offline", prompt: "consent" },
    },
    mcpServer: "ga4",
  },
};

export const AD_CONNECTOR_IDS: ConnectorId[] = Object.values(CONNECTORS)
  .filter((c) => c.group === "ads")
  .map((c) => c.id);

export function getBaseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:8080";
}

export function oauthCallbackUrl(connector: ConnectorId): string {
  return `${getBaseUrl()}/api/oauth/${connector}/callback`;
}

export function hasOAuthCredentials(connector: ConnectorId): boolean {
  const cfg = CONNECTORS[connector];
  return !!(process.env[cfg.oauth.clientIdEnv] && process.env[cfg.oauth.clientSecretEnv]);
}

export function requireOAuthCredentials(connector: ConnectorId): void {
  if (!hasOAuthCredentials(connector)) {
    const cfg = CONNECTORS[connector];
    throw new Error(
      `OAuth ${cfg.label} non configuré. Définissez ${cfg.oauth.clientIdEnv} et ${cfg.oauth.clientSecretEnv}`,
    );
  }
}

export function connectorFromPlatform(platform: string): ConnectorId | null {
  const direct = Object.keys(CONNECTORS).find((k) => k === platform);
  if (direct) return direct as ConnectorId;
  const map: Record<string, ConnectorId> = {
    google: "google_ads",
    meta: "meta_ads",
    facebook: "meta_ads",
    instagram: "meta_ads",
    linkedin: "linkedin_ads",
    tiktok: "tiktok_ads",
    snapchat: "snapchat_ads",
    snap: "snapchat_ads",
    reddit: "reddit_ads",
    microsoft: "microsoft_ads",
    bing: "microsoft_ads",
    x: "x_ads",
    twitter: "x_ads",
    amazon: "amazon_ads",
    pinterest: "pinterest_ads",
    ga4: "ga4",
    google_ads_read: "google_ads",
    google_ads_write: "google_ads",
  };
  return map[platform] ?? null;
}
