import { readAccountSnapshot, type MCPClientContext } from "@/lib/mcp/clients/base";

const TOOLS = {
  campaignReport: "campaign_report",
  audienceOverview: "audience_overview",
} as const;

export async function tiktokAdsRead(ctx: MCPClientContext, mcpUrl?: string, tool = TOOLS.campaignReport) {
  return readAccountSnapshot(ctx, mcpUrl, tool);
}

export { TOOLS as TIKTOK_ADS_TOOLS };
