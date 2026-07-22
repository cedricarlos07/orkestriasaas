import type { MCPServerId, MCPMode } from "@/lib/unified-ad-schema";
import { getCapabilityMatrix } from "@/lib/mcp/capability-matrix";

export type ToolDefinition = {
  name: string;
  server: MCPServerId;
  mode: MCPMode;
  label: string;
  risk: "none" | "low" | "medium" | "high";
};

/** Legacy skill → tool-name hints (orchestrator). Prefer MCP skills.ts for agent SOPs. */
export const SKILL_TOOL_MAP: Record<string, string[]> = {
  analysis: ["list_campaigns", "get_performance", "get_account_summary"],
  strategy: ["list_campaigns", "get_performance", "create_media_plan"],
  budget: ["get_spend", "update_budget", "reallocate_budget"],
  protection: ["pause_campaign", "detect_anomalies"],
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

/** Honest platform matrix derived from adapters + maturity tags (Synter-style). */
export const MCP_CAPABILITIES = getCapabilityMatrix().map((c) => ({
  platform: c.label,
  connector: c.connector,
  maturity: c.maturity,
  read: c.read,
  create: c.createCampaign,
  modify: c.budget || c.pause,
  pause: c.pause,
  budget: c.budget,
  creatives: c.creatives,
  keywords: c.keywords,
  audiences: c.audiences,
  tracking: c.tracking,
  note: c.note,
  docsUrl: c.docsUrl,
}));

/** Minimal write-tool lookup for older action pipeline paths. */
const WRITE_HINTS: ToolDefinition[] = [
  { name: "update_budget", server: "google_ads_write", mode: "write", label: "Budget", risk: "medium" },
  { name: "pause_campaign", server: "google_ads_write", mode: "write", label: "Pause", risk: "low" },
  { name: "enable_campaign", server: "google_ads_write", mode: "write", label: "Enable", risk: "medium" },
  { name: "add_keywords", server: "google_ads_write", mode: "write", label: "Keywords", risk: "medium" },
  { name: "create_campaign", server: "meta_ads", mode: "write", label: "Create campaign", risk: "high" },
  { name: "create_ad_set", server: "meta_ads", mode: "write", label: "Create ad set", risk: "high" },
  { name: "create_ad", server: "meta_ads", mode: "write", label: "Create ad", risk: "high" },
  { name: "upload_creative", server: "meta_ads", mode: "write", label: "Upload creative", risk: "medium" },
  { name: "create_audience", server: "meta_ads", mode: "write", label: "Audience", risk: "medium" },
  { name: "pause_campaign", server: "meta_ads", mode: "write", label: "Pause Meta", risk: "low" },
  { name: "update_budget", server: "meta_ads", mode: "write", label: "Budget Meta", risk: "medium" },
  { name: "add_keywords", server: "microsoft_ads", mode: "write", label: "Keywords MS", risk: "medium" },
  { name: "add_keywords", server: "amazon_ads", mode: "write", label: "Keywords Amazon", risk: "medium" },
];

export const MCP_TOOL_REGISTRY: ToolDefinition[] = WRITE_HINTS;

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
