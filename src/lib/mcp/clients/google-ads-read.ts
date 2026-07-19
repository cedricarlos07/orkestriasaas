import { readAccountSnapshot, type MCPClientContext } from "@/lib/mcp/clients/base";

const TOOLS = {
  listCampaigns: "list_campaigns",
  gaqlQuery: "gaql_query",
  accountDiagnostics: "account_diagnostics",
} as const;

export async function googleAdsRead(ctx: MCPClientContext, mcpUrl?: string, tool = TOOLS.accountDiagnostics) {
  return readAccountSnapshot(ctx, mcpUrl, tool);
}

export { TOOLS as GOOGLE_ADS_READ_TOOLS };
