import { readAccountSnapshot, type MCPClientContext } from "@/lib/mcp/clients/base";

const TOOLS = {
  conversionReport: "conversion_report",
  funnel: "funnel",
  realtimeActiveUsers: "realtime_active_users",
} as const;

export async function ga4Read(ctx: MCPClientContext, mcpUrl?: string, tool = TOOLS.conversionReport) {
  return readAccountSnapshot(ctx, mcpUrl, tool);
}

export { TOOLS as GA4_TOOLS };
