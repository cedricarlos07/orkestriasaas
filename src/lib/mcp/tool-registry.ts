import type { MCPServerId, MCPMode } from "@/lib/unified-ad-schema";

export type ToolDefinition = {
  name: string;
  server: MCPServerId;
  mode: MCPMode;
  label: string;
  risk: "none" | "low" | "medium" | "high";
};

export const MCP_TOOL_REGISTRY: ToolDefinition[] = [
  { name: "list_campaigns", server: "google_ads_read", mode: "read", label: "Lister campagnes Google", risk: "none" },
  { name: "update_budget", server: "google_ads_write", mode: "write", label: "Modifier budget Google", risk: "medium" },
  { name: "pause_campaign", server: "google_ads_write", mode: "write", label: "Pause campagne Google", risk: "low" },
  { name: "enable_campaign", server: "google_ads_write", mode: "write", label: "Activer campagne Google", risk: "medium" },
  { name: "add_keywords", server: "google_ads_write", mode: "write", label: "Mots-clés Google", risk: "medium" },
  { name: "list_ad_accounts", server: "meta_ads", mode: "read", label: "Comptes Meta", risk: "none" },
  { name: "campaign_insights", server: "meta_ads", mode: "read", label: "Insights campagnes Meta", risk: "none" },
  { name: "create_campaign", server: "meta_ads", mode: "write", label: "Créer campagne Meta", risk: "high" },
  { name: "create_ad_set", server: "meta_ads", mode: "write", label: "Créer ad set Meta", risk: "high" },
  { name: "create_ad", server: "meta_ads", mode: "write", label: "Créer annonce Meta", risk: "high" },
  { name: "upload_creative", server: "meta_ads", mode: "write", label: "Upload créatif Meta", risk: "medium" },
  { name: "create_audience", server: "meta_ads", mode: "write", label: "Audience Meta", risk: "medium" },
  { name: "pause_campaign", server: "meta_ads", mode: "write", label: "Pause campagne Meta", risk: "low" },
  { name: "update_budget", server: "meta_ads", mode: "write", label: "Budget ad set Meta", risk: "medium" },
  { name: "campaign_report", server: "tiktok_ads", mode: "read", label: "Rapport TikTok", risk: "none" },
  { name: "conversion_report", server: "ga4", mode: "read", label: "Conversions GA4", risk: "none" },
  { name: "add_keywords", server: "microsoft_ads", mode: "write", label: "Mots-clés Microsoft", risk: "medium" },
  { name: "add_keywords", server: "amazon_ads", mode: "write", label: "Mots-clés Amazon SP", risk: "medium" },
];

export const SKILL_TOOL_MAP: Record<string, string[]> = {
  analysis: ["list_campaigns", "campaign_insights", "campaign_report", "conversion_report"],
  strategy: ["list_campaigns", "campaign_insights", "campaign_report", "conversion_report"],
  budget: ["campaign_insights", "conversion_report", "update_budget"],
  protection: ["pause_campaign"],
  creation: ["create_campaign", "create_ad_set", "create_ad", "upload_creative"],
};

export const MCP_SERVER_ENV: Record<MCPServerId, string> = {
  google_ads_read: "MCP_GOOGLE_ADS_READ_URL",
  google_ads_write: "MCP_GOOGLE_ADS_WRITE_URL",
  meta_ads: "MCP_META_ADS_URL",
  linkedin_ads: "MCP_LINKEDIN_ADS_URL",
  tiktok_ads: "MCP_TIKTOK_ADS_URL",
  snapchat_ads: "MCP_SNAPCHAT_ADS_URL",
  reddit_ads: "MCP_REDDIT_ADS_URL",
  microsoft_ads: "MCP_MICROSOFT_ADS_URL",
  x_ads: "MCP_X_ADS_URL",
  amazon_ads: "MCP_AMAZON_ADS_URL",
  pinterest_ads: "MCP_PINTEREST_ADS_URL",
  ga4: "MCP_GA4_URL",
};

export function getTool(name: string, server?: MCPServerId): ToolDefinition | undefined {
  if (server) return MCP_TOOL_REGISTRY.find((t) => t.name === name && t.server === server);
  return MCP_TOOL_REGISTRY.find((t) => t.name === name);
}

export function getWriteToolForConnector(connector: string, action: string): ToolDefinition | undefined {
  const server: MCPServerId | undefined = connector.includes("meta")
    ? "meta_ads"
    : connector.includes("google") && !connector.includes("analytics")
      ? "google_ads_write"
      : connector.includes("tiktok")
        ? "tiktok_ads"
        : undefined;
  if (!server) return getTool(action);
  return getTool(action, server) ?? getTool(action);
}

export function toolsForSkill(skill: string): ToolDefinition[] {
  const names = SKILL_TOOL_MAP[skill] ?? [];
  return names.map((n) => getTool(n)).filter(Boolean) as ToolDefinition[];
}

export const MCP_CAPABILITIES = [
  { platform: "Google Ads", read: true, create: false, modify: true, pause: true, budget: true, creatives: false, keywords: true },
  { platform: "Meta Ads", read: true, create: true, modify: true, pause: true, budget: true, creatives: true, keywords: false },
  { platform: "TikTok Ads", read: true, create: false, modify: true, pause: true, budget: true, creatives: false, keywords: false },
  { platform: "Microsoft Ads", read: true, create: false, modify: true, pause: true, budget: true, creatives: false, keywords: true },
  { platform: "Amazon Ads (SP)", read: true, create: false, modify: true, pause: true, budget: true, creatives: false, keywords: true },
  { platform: "LinkedIn / Snap / Reddit / X / Pinterest", read: true, create: false, modify: true, pause: true, budget: true, creatives: false, keywords: false },
  { platform: "GA4", read: true, create: false, modify: false, pause: false, budget: false, creatives: false, keywords: false },
];
