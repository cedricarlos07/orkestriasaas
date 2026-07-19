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
  { name: "gaql_query", server: "google_ads_read", mode: "read", label: "Requête GAQL", risk: "none" },
  { name: "account_diagnostics", server: "google_ads_read", mode: "read", label: "Diagnostic compte Google", risk: "none" },
  { name: "list_ad_accounts", server: "meta_ads", mode: "read", label: "Comptes Meta", risk: "none" },
  { name: "campaign_insights", server: "meta_ads", mode: "read", label: "Insights campagnes Meta", risk: "none" },
  { name: "creative_status", server: "meta_ads", mode: "read", label: "Statut créations Meta", risk: "none" },
  { name: "campaign_report", server: "tiktok_ads", mode: "read", label: "Rapport TikTok", risk: "none" },
  { name: "audience_overview", server: "tiktok_ads", mode: "read", label: "Audiences TikTok", risk: "none" },
  { name: "conversion_report", server: "ga4", mode: "read", label: "Conversions GA4", risk: "none" },
  { name: "funnel_report", server: "ga4", mode: "read", label: "Entonnoir GA4", risk: "none" },
  { name: "realtime_users", server: "ga4", mode: "read", label: "Utilisateurs temps réel GA4", risk: "none" },
  { name: "create_campaign", server: "google_ads_write", mode: "write", label: "Créer campagne Google", risk: "high" },
  { name: "update_budget", server: "google_ads_write", mode: "write", label: "Modifier budget Google", risk: "medium" },
  { name: "pause_campaign", server: "meta_ads", mode: "write", label: "Pause campagne Meta", risk: "low" },
];

export const SKILL_TOOL_MAP: Record<string, string[]> = {
  analysis: ["list_campaigns", "gaql_query", "campaign_insights", "campaign_report", "conversion_report", "funnel_report"],
  strategy: ["list_campaigns", "campaign_insights", "campaign_report", "conversion_report"],
  budget: ["account_diagnostics", "campaign_insights", "conversion_report"],
  protection: ["account_diagnostics", "realtime_users"],
  creation: ["creative_status"],
};

export const MCP_SERVER_ENV: Record<MCPServerId, string> = {
  google_ads_read: "MCP_GOOGLE_ADS_READ_URL",
  google_ads_write: "MCP_GOOGLE_ADS_WRITE_URL",
  meta_ads: "MCP_META_ADS_URL",
  tiktok_ads: "MCP_TIKTOK_ADS_URL",
  ga4: "MCP_GA4_URL",
};

export function getTool(name: string): ToolDefinition | undefined {
  return MCP_TOOL_REGISTRY.find((t) => t.name === name);
}

export function toolsForSkill(skill: string): ToolDefinition[] {
  const names = SKILL_TOOL_MAP[skill] ?? [];
  return names.map((n) => getTool(n)).filter(Boolean) as ToolDefinition[];
}

export const MCP_CAPABILITIES = [
  { platform: "Google Ads", read: true, create: true, modify: true, pause: true, budget: true, creatives: true },
  { platform: "Meta Ads", read: true, create: true, modify: true, pause: true, budget: true, creatives: true },
  { platform: "TikTok Ads", read: true, create: true, modify: true, pause: true, budget: true, creatives: true },
  { platform: "GA4", read: true, create: false, modify: false, pause: false, budget: false, creatives: false },
];
