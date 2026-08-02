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

// ─── Optimize ─────────────────────────────────────────────────────────────────

export const optimizeTools: AgentTool[] = [
  writeTool(
    "update_budget",
    "update_budget",
    "Change the daily budget of a campaign (Meta: pass the ad set id as campaignId). Policy-gated.",
    "optimize",
    {
      campaignId: { type: "string", description: "Campaign id (Meta: ad set id)" },
      dailyBudget: { type: "number" },
      currentDailyBudget: { type: "number" },
      accountId: { type: "string" },
    },
    ["campaignId", "dailyBudget"],
    (args) => ({
      campaignId: str(args.campaignId),
      accountId: str(args.accountId),
      params: { dailyBudget: num(args.dailyBudget), currentDailyBudget: num(args.currentDailyBudget) },
    }),
  ),
  writeTool(
    "pause_campaign",
    "pause_campaign",
    "Pause a running campaign.",
    "optimize",
    { campaignId: { type: "string" }, accountId: { type: "string" } },
    ["campaignId"],
    (args) => ({ campaignId: str(args.campaignId), accountId: str(args.accountId), params: {} }),
  ),
  writeTool(
    "enable_campaign",
    "enable_campaign",
    "Enable (resume) a paused campaign.",
    "optimize",
    { campaignId: { type: "string" }, accountId: { type: "string" } },
    ["campaignId"],
    (args) => ({ campaignId: str(args.campaignId), accountId: str(args.accountId), params: {} }),
  ),
  writeTool(
    "pause_ad_set",
    "pause_ad_set",
    "Pause an ad set (Meta).",
    "optimize",
    { adSetId: { type: "string" }, accountId: { type: "string" } },
    ["adSetId"],
    (args) => ({
      accountId: str(args.accountId),
      params: { adSetId: str(args.adSetId) },
    }),
  ),
  writeTool(
    "enable_ad_set",
    "enable_ad_set",
    "Enable an ad set (Meta).",
    "optimize",
    { adSetId: { type: "string" }, accountId: { type: "string" } },
    ["adSetId"],
    (args) => ({
      accountId: str(args.accountId),
      params: { adSetId: str(args.adSetId) },
    }),
  ),
  writeTool(
    "pause_ad",
    "pause_ad",
    "Pause a single Meta ad (use after suggest_creative_rotation).",
    "optimize",
    { adId: { type: "string" }, accountId: { type: "string" } },
    ["adId"],
    (args) => ({
      accountId: str(args.accountId),
      params: { adId: str(args.adId) },
    }),
  ),
  writeTool(
    "add_keywords",
    "add_keywords",
    "Add keywords to an ad group (Google Ads, Microsoft Ads, Amazon Sponsored Products).",
    "optimize",
    {
      adGroupId: { type: "string" },
      keywords: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            matchType: { type: "string", description: "BROAD | PHRASE | EXACT (platform-dependent)" },
            bid: { type: "number" },
          },
          required: ["text"],
        },
      },
      accountId: { type: "string" },
    },
    ["adGroupId", "keywords"],
    (args) => ({
      accountId: str(args.accountId),
      params: {
        adGroupId: str(args.adGroupId),
        keywords: Array.isArray(args.keywords)
          ? (args.keywords as { text: string; matchType?: string; bid?: number }[])
          : undefined,
      },
    }),
  ),
  writeTool(
    "add_negative_keywords",
    "add_negative_keywords",
    "Add negative keywords to a campaign (Google Ads).",
    "optimize",
    {
      campaignId: { type: "string" },
      keywords: {
        type: "array",
        items: {
          type: "object",
          properties: { text: { type: "string" }, matchType: { type: "string" } },
          required: ["text"],
        },
      },
      accountId: { type: "string" },
    },
    ["campaignId", "keywords"],
    (args) => ({
      campaignId: str(args.campaignId),
      accountId: str(args.accountId),
      params: {
        keywords: Array.isArray(args.keywords)
          ? (args.keywords as { text: string; matchType?: string }[])
          : undefined,
      },
    }),
  ),
  writeTool(
    "create_conversion",
    "create_conversion",
    "Create a conversion action (Google Ads).",
    "launch",
    {
      name: { type: "string" },
      category: { type: "string", description: "e.g. PURCHASE, SIGNUP, PAGE_VIEW" },
      accountId: { type: "string" },
    },
    ["name"],
    (args) => ({
      accountId: str(args.accountId),
      params: { name: str(args.name), category: str(args.category) },
    }),
  ),
  {
    name: "reallocate_budget",
    description:
      "Propose a budget reallocation between two campaigns of the same platform, then apply it as two update_budget actions (each policy-gated).",
    family: "optimize",
    inputSchema: {
      type: "object",
      properties: {
        ...platformProp,
        ...modeProp,
        fromCampaignId: { type: "string" },
        toCampaignId: { type: "string" },
        amount: { type: "number", description: "Daily amount to move (main currency unit)" },
        fromCurrentBudget: { type: "number" },
        toCurrentBudget: { type: "number" },
      },
      required: ["platform", "fromCampaignId", "toCampaignId", "amount", "fromCurrentBudget", "toCurrentBudget"],
    },
    handler: async (ctx, args) => {
      const mode = str(args.mode) as ExecutionMode | undefined;
      if (mode === "live") requireScope(ctx, "write");
      const amount = num(args.amount) ?? 0;
      const fromBudget = (num(args.fromCurrentBudget) ?? 0) - amount;
      const toBudget = (num(args.toCurrentBudget) ?? 0) + amount;
      if (fromBudget <= 0) throw new Error("La réallocation mettrait la campagne source à un budget nul ou négatif");
      const connector = args.platform as ConnectorId;
      const decrease = await runWriteAction({
        orgId: ctx.organizationId,
        apiKeyId: ctx.keyId,
        connector,
        action: "update_budget",
        mode,
        campaignId: str(args.fromCampaignId),
        params: { dailyBudget: fromBudget, currentDailyBudget: num(args.fromCurrentBudget) },
      });
      const increase = await runWriteAction({
        orgId: ctx.organizationId,
        apiKeyId: ctx.keyId,
        connector,
        action: "update_budget",
        mode,
        campaignId: str(args.toCampaignId),
        params: { dailyBudget: toBudget, currentDailyBudget: num(args.toCurrentBudget) },
      });
      return { decrease, increase };
    },
  },
];

