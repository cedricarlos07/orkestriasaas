import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { actionRuns, adActions, approvals, connections } from "@/db/schema/index";
import { requireScope } from "@/lib/mcp/api-keys";
import {
  approveAndExecute,
  getOrgPolicy,
  rejectPendingAction,
  runWriteAction,
  updateOrgPolicy,
  WRITE_ACTION_NAMES,
  type ExecutionMode,
  type WriteActionName,
} from "@/lib/mcp/policy-engine";
import { listSkills, getSkill } from "@/lib/mcp/skills";
import { listMediaBuyingSkills } from "@/lib/mcp/skills-repo";
import { runAutonomyTick } from "@/lib/mcp/autonomy";
import { getCapabilityMatrix, summarizeMaturity } from "@/lib/mcp/capability-matrix";
import {
  AD_CONNECTOR_IDS,
  CONNECTORS,
  hasOAuthCredentials,
  type ConnectorId,
} from "@/lib/oauth/connectors";
import { getAdapter } from "@/lib/platforms/adapter";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import { routeReadSnapshot, routeResearch } from "@/lib/mcp/execution-router";
import {
  estimateMetaAudience,
  listMetaAds,
  listMetaAdsInsights,
  listMetaAdSets,
  listMetaPages,
  searchMetaGeoLocations,
  searchMetaInterests,
} from "@/lib/platforms/meta-api";
import type { UnifiedAccountSnapshot } from "@/lib/unified-ad-schema";
import { isLlmConfigured, llmChatCompletion } from "@/lib/llm/client";
import {
  type AgentTool,
  platformProp,
  modeProp,
  dryRunProp,
  str,
  num,
  writeTool,
  getConnectedRows,
  getTokensFor,
  fetchSnapshot,
  fetchAllSnapshots,
} from "./shared";

// ─── Core ─────────────────────────────────────────────────────────────────────

export const coreTools: AgentTool[] = [
  {
    name: "whoami",
    description: "Identify the workspace and scopes behind the current API key.",
    family: "core",
    inputSchema: { type: "object", properties: {} },
    handler: async (ctx) => ({
      workspace: ctx.organizationId,
      keyName: ctx.name,
      scopes: ctx.scopes,
    }),
  },
  {
    name: "validate_setup",
    description:
      "Validate the API key, list connected platforms, policy, and the honest capability matrix (production vs experimental). Safe: no writes.",
    family: "core",
    inputSchema: { type: "object", properties: {} },
    handler: async (ctx) => {
      const rows = await db.select().from(connections).where(eq(connections.organizationId, ctx.organizationId));
      const policy = await getOrgPolicy(ctx.organizationId);
      const capabilities = getCapabilityMatrix();
      const { getStackSetupStatus } = await import("@/lib/mcp/setup-status");
      const stack = await getStackSetupStatus(ctx.organizationId);
      return {
        ok: true,
        keyName: ctx.name,
        scopes: ctx.scopes,
        policy,
        maturity: summarizeMaturity(capabilities),
        capabilities,
        stack,
        platforms: Object.values(CONNECTORS)
          .filter((c) => c.group === "ads" || c.id === "ga4")
          .map((c) => {
            const conn = rows.find((r) => r.connector === c.id);
            const cap = capabilities.find((x) => x.connector === c.id);
            return {
              platform: c.id,
              label: c.label,
              maturity: cap?.maturity ?? "experimental",
              oauthConfigured: hasOAuthCredentials(c.id),
              connected: conn?.status === "connectée",
              account: conn?.externalAccount ?? null,
              createCampaign: cap?.createCampaign ?? false,
            };
          }),
        protocol:
          "For writes: call execute (or any write tool) with dry_run=true first, review the diff, then re-call with dry_run=false. Prefer production platforms for spend.",
      };
    },
  },
  {
    name: "list_capabilities",
    description:
      "Honest Synter-style platform matrix: what Orkestria can read/create/pause per connector, with production vs experimental maturity.",
    family: "core",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const capabilities = getCapabilityMatrix();
      return { capabilities, maturity: summarizeMaturity(capabilities) };
    },
  },
  {
    name: "list_connections",
    description: "List every ad platform and its connection status for this workspace.",
    family: "core",
    inputSchema: { type: "object", properties: {} },
    handler: async (ctx) => {
      const rows = await db.select().from(connections).where(eq(connections.organizationId, ctx.organizationId));
      const capabilities = getCapabilityMatrix();
      return Object.values(CONNECTORS).map((c) => {
        const conn = rows.find((r) => r.connector === c.id);
        const cap = capabilities.find((x) => x.connector === c.id);
        return {
          platform: c.id,
          label: c.label,
          group: c.group,
          maturity: cap?.maturity ?? "experimental",
          connected: conn?.status === "connectée",
          account: conn?.externalAccount ?? null,
          lastSync: conn?.lastSync?.toISOString() ?? null,
          oauthConfigured: hasOAuthCredentials(c.id),
        };
      });
    },
  },
  {
    name: "list_ad_accounts",
    description: "List the ad accounts accessible on a connected platform.",
    family: "core",
    inputSchema: { type: "object", properties: { ...platformProp }, required: ["platform"] },
    handler: async (ctx, args) => {
      const connector = args.platform as ConnectorId;
      const { tokens } = await getTokensFor(ctx.organizationId, connector);
      return getAdapter(connector).listAccounts(tokens);
    },
  },
];

