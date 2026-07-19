export type ConnectorId = "google_ads" | "meta_ads" | "tiktok_ads" | "ga4";

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
  };
  mcpServer: "google_ads_read" | "meta_ads" | "tiktok_ads" | "ga4";
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
      scopes: ["ads_read", "ads_management", "business_management"],
      clientIdEnv: "META_APP_ID",
      clientSecretEnv: "META_APP_SECRET",
    },
    mcpServer: "meta_ads",
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
  const map: Record<string, ConnectorId> = {
    google: "google_ads",
    meta: "meta_ads",
    tiktok: "tiktok_ads",
    ga4: "ga4",
    google_ads: "google_ads",
    google_ads_read: "google_ads",
    google_ads_write: "google_ads",
    meta_ads: "meta_ads",
    tiktok_ads: "tiktok_ads",
  };
  return map[platform] ?? null;
}
