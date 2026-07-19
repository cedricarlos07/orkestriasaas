import { readAccountSnapshot, type MCPClientContext } from "@/lib/mcp/clients/base";

const TOOLS = {
  listAdAccounts: "list_ad_accounts",
  campaignInsights: "campaign_insights",
  creativeStatus: "creative_status",
} as const;

export async function metaAdsRead(ctx: MCPClientContext, mcpUrl?: string, tool = TOOLS.campaignInsights) {
  return readAccountSnapshot(ctx, mcpUrl, tool);
}

export { TOOLS as META_ADS_TOOLS };
