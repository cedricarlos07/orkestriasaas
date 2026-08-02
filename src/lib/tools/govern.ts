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

// ─── Govern ───────────────────────────────────────────────────────────────────

export const governTools: AgentTool[] = [
  {
    name: "execute",
    description:
      "Universal write tool (Synter-style). Defaults to dry_run=true: validates policy and returns the exact confirm payload. Re-call with dry_run=false to apply (respects org policy: dry_run / approval / live).",
    family: "govern",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: WRITE_ACTION_NAMES,
          description: "Write action name",
        },
        ...platformProp,
        dry_run: {
          type: "boolean",
          description: "Default true. Set false only after reviewing the dry-run diff.",
        },
        mode: {
          type: "string",
          enum: ["dry_run", "approval", "live"],
          description: "Override org policy when dry_run=false. Ignored when dry_run=true.",
        },
        campaignId: { type: "string" },
        accountId: { type: "string" },
        params: {
          type: "object",
          description: "Action-specific params (name, dailyBudget, keywords, adSetId, imageUrl, …)",
        },
      },
      required: ["action", "platform"],
    },
    handler: async (ctx, args) => {
      const action = str(args.action) as WriteActionName | undefined;
      if (!action || !WRITE_ACTION_NAMES.includes(action)) {
        throw new Error(`action invalide — attendu: ${WRITE_ACTION_NAMES.join(", ")}`);
      }
      const dryRun = args.dry_run !== false && args.dry_run !== "false";
      const policy = await getOrgPolicy(ctx.organizationId);

      let mode: ExecutionMode;
      if (dryRun) {
        mode = "dry_run";
      } else {
        // Explicit confirm: honor mode override, else approval if org requires it, else live
        const requested = str(args.mode) as ExecutionMode | undefined;
        if (requested === "dry_run") {
          return {
            status: "blocked",
            message: "dry_run=false with mode=dry_run is a no-op. Use mode=live or mode=approval.",
          };
        }
        if (policy.defaultMode === "dry_run") {
          return {
            status: "blocked",
            message:
              "Workspace policy is dry_run. An org admin must set_policy(defaultMode=approval|live) before confirming writes.",
          };
        }
        if (policy.defaultMode === "approval") {
          mode = "approval";
        } else {
          mode = requested === "approval" ? "approval" : "live";
        }
        if (mode === "live") requireScope(ctx, "write");
      }

      const params = (typeof args.params === "object" && args.params !== null ? args.params : {}) as Record<
        string,
        unknown
      >;
      const merged = {
        ...params,
        name: str(params.name) ?? str(args.name),
        dailyBudget: num(params.dailyBudget) ?? num(args.dailyBudget),
        objective: str(params.objective) ?? str(args.objective),
        countries: (params.countries as string[]) ?? (args.countries as string[] | undefined),
        currentDailyBudget: num(params.currentDailyBudget) ?? num(args.currentDailyBudget),
        adSetId: str(params.adSetId) ?? str(args.adSetId),
        adGroupId: str(params.adGroupId) ?? str(args.adGroupId),
        pageId: str(params.pageId) ?? str(args.pageId),
        linkUrl: str(params.linkUrl) ?? str(args.linkUrl),
        message: str(params.message) ?? str(args.message),
        headline: str(params.headline) ?? str(args.headline),
        imageUrl: str(params.imageUrl) ?? str(args.imageUrl),
        imageHash: str(params.imageHash) ?? str(args.imageHash),
        description: str(params.description) ?? str(args.description),
        subtype: str(params.subtype) ?? str(args.subtype),
        lookalikeRatio: num(params.lookalikeRatio) ?? num(args.lookalikeRatio),
        originAudienceId: str(params.originAudienceId) ?? str(args.originAudienceId),
        country: str(params.country) ?? str(args.country),
        optimizationGoal: str(params.optimizationGoal) ?? str(args.optimizationGoal),
        keywords:
          (params.keywords as { text: string; matchType?: string; bid?: number }[]) ??
          (args.keywords as { text: string; matchType?: string; bid?: number }[] | undefined),
        campaignType: (str(params.campaignType) ?? str(args.campaignType)) as
          | "search"
          | "pmax"
          | "traffic"
          | "leads"
          | "default"
          | undefined,
        finalUrl: str(params.finalUrl) ?? str(args.finalUrl),
        headlines: (params.headlines as string[]) ?? (args.headlines as string[] | undefined),
        descriptions: (params.descriptions as string[]) ?? (args.descriptions as string[] | undefined),
        category: str(params.category) ?? str(args.category),
      };

      return runWriteAction({
        orgId: ctx.organizationId,
        apiKeyId: ctx.keyId,
        connector: args.platform as ConnectorId,
        action,
        mode,
        campaignId: str(args.campaignId),
        accountId: str(args.accountId),
        params: merged,
      });
    },
  },
  {
    name: "list_pending_approvals",
    description: "List write actions waiting for a human approval in this workspace.",
    family: "govern",
    inputSchema: { type: "object", properties: {} },
    handler: async (ctx) => {
      const rows = await db
        .select()
        .from(approvals)
        .where(and(eq(approvals.organizationId, ctx.organizationId), eq(approvals.status, "pending")));
      const detailed = await Promise.all(
        rows.map(async (a) => {
          const acts = a.actionId
            ? await db.select().from(adActions).where(eq(adActions.id, a.actionId)).limit(1)
            : [];
          return {
            approvalId: a.id,
            createdAt: a.createdAt.toISOString(),
            expiresAt: a.expiresAt?.toISOString() ?? null,
            connector: acts[0]?.connector ?? null,
            action: acts[0]?.action ?? null,
            diff: acts[0]?.after ?? null,
          };
        }),
      );
      return detailed;
    },
  },
  {
    name: "approve_action",
    description: "Approve a pending action and execute it live. Requires the write scope.",
    family: "govern",
    inputSchema: { type: "object", properties: { approvalId: { type: "string" } }, required: ["approvalId"] },
    handler: async (ctx, args) => {
      requireScope(ctx, "write");
      return approveAndExecute(ctx.organizationId, str(args.approvalId) ?? "");
    },
  },
  {
    name: "reject_action",
    description: "Reject a pending action.",
    family: "govern",
    inputSchema: { type: "object", properties: { approvalId: { type: "string" } }, required: ["approvalId"] },
    handler: async (ctx, args) => {
      requireScope(ctx, "write");
      await rejectPendingAction(ctx.organizationId, str(args.approvalId) ?? "");
      return { ok: true };
    },
  },
  {
    name: "get_audit_log",
    description: "Read the audit trail of agent actions (reads and writes) for this workspace.",
    family: "govern",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max entries (default 50)" },
        tool: { type: "string", description: "Filter by tool name" },
        mode: { type: "string", enum: ["read", "dry_run", "approval", "live"] },
      },
    },
    handler: async (ctx, args) => {
      const limit = Math.min(num(args.limit) ?? 50, 200);
      let rows = await db
        .select()
        .from(actionRuns)
        .where(eq(actionRuns.organizationId, ctx.organizationId))
        .orderBy(desc(actionRuns.createdAt))
        .limit(limit * 2);
      if (str(args.tool)) rows = rows.filter((r) => r.tool === args.tool);
      if (str(args.mode)) rows = rows.filter((r) => r.mode === args.mode);
      return rows.slice(0, limit).map((r) => ({
        id: r.id,
        tool: r.tool,
        connector: r.connector,
        mode: r.mode,
        status: r.status,
        error: r.error,
        latencyMs: r.latencyMs,
        createdAt: r.createdAt.toISOString(),
      }));
    },
  },
  {
    name: "get_policies",
    description: "Read the workspace policy (default mode, spend caps, protected campaigns, max budget change).",
    family: "govern",
    inputSchema: { type: "object", properties: {} },
    handler: async (ctx) => getOrgPolicy(ctx.organizationId),
  },
  {
    name: "set_policy",
    description: "Update the workspace policy. Requires the admin scope. Can toggle autonomyEnabled.",
    family: "govern",
    inputSchema: {
      type: "object",
      properties: {
        defaultMode: { type: "string", enum: ["dry_run", "approval", "live"] },
        dailySpendCap: { type: ["number", "null"] },
        monthlySpendCap: { type: ["number", "null"] },
        maxBudgetChangePct: { type: "number" },
        protectedCampaignIds: { type: "array", items: { type: "string" } },
        autonomyEnabled: { type: "boolean", description: "Enable capped autonomy ticks (pause spend-with-zero-conversion)" },
      },
    },
    handler: async (ctx, args) => {
      requireScope(ctx, "admin");
      return updateOrgPolicy(ctx.organizationId, {
        defaultMode: str(args.defaultMode) as ExecutionMode | undefined,
        dailySpendCap: args.dailySpendCap === null ? null : num(args.dailySpendCap),
        monthlySpendCap: args.monthlySpendCap === null ? null : num(args.monthlySpendCap),
        maxBudgetChangePct: num(args.maxBudgetChangePct),
        protectedCampaignIds: Array.isArray(args.protectedCampaignIds)
          ? (args.protectedCampaignIds as string[])
          : undefined,
        autonomyEnabled: typeof args.autonomyEnabled === "boolean" ? args.autonomyEnabled : undefined,
      });
    },
  },
  {
    name: "list_skills",
    description:
      "List Orkestria MCP skills: built-in launch/optimize/audit plus media-buying SOPs (mb/* from ai-media-buying-skills).",
    family: "govern",
    inputSchema: { type: "object", properties: {} },
    handler: async () =>
      listSkills().map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        source: s.source ?? "builtin",
        platform: s.platform,
        category: s.category,
        steps: s.steps,
      })),
  },
  {
    name: "run_skill",
    description:
      "Return the step plan (and full SOP markdown for mb/* skills). Execute steps via named tools; prefer dry_run for writes.",
    family: "govern",
    inputSchema: {
      type: "object",
      properties: {
        skillId: {
          type: "string",
          description: "Skill id from list_skills (e.g. launch, optimize, mb/meta-ads/diagnostics/anomaly-detector)",
        },
      },
      required: ["skillId"],
    },
    handler: async (_ctx, args) => {
      const skill = getSkill(str(args.skillId) ?? "");
      if (!skill) throw new Error("Unknown skill — call list_skills");
      return {
        skill: {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          source: skill.source,
          platform: skill.platform,
          category: skill.category,
          steps: skill.steps,
        },
        sopMarkdown: skill.fullMarkdown,
        instructions:
          skill.source === "media_buying"
            ? "Apply this SOP using live data from get_account_summary / get_performance. Do not ask to connect accounts already in context."
            : "Execute steps in order. For writes, call execute with dry_run=true first, then dry_run=false after review. Check list_capabilities for maturity.",
      };
    },
  },
  {
    name: "get_media_skill",
    description: "Find a media-buying SOP by platform and/or category (from ai-media-buying-skills repo).",
    family: "govern",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          description: "Platform filter (e.g. Meta Ads, Google LSA, TikTok Ads)",
        },
        category: {
          type: "string",
          description: "Category filter (e.g. diagnostics, creative, launch, reporting)",
        },
      },
    },
    handler: async (_ctx, args) => {
      const platform = str(args.platform)?.toLowerCase();
      const category = str(args.category)?.toLowerCase();
      const matches = listMediaBuyingSkills().filter((s) => {
        if (platform && !s.platform.toLowerCase().includes(platform)) return false;
        if (category && !s.category.toLowerCase().includes(category)) return false;
        return true;
      });
      if (!matches.length) throw new Error("No media skill matched — try list_skills");
      const skill = matches[0]!;
      return {
        id: skill.id,
        name: skill.name,
        platform: skill.platform,
        category: skill.category,
        whenToUse: skill.whenToUse,
        promptExcerpt: skill.promptExcerpt,
        fullMarkdown: skill.fullMarkdown,
        totalMatches: matches.length,
      };
    },
  },
  {
    name: "list_tool_catalog",
    description: "Catalog of all MCP tools (name, family, description) — Synter-style discovery.",
    family: "govern",
    inputSchema: { type: "object", properties: {} },
    handler: async () =>
      (await import("./catalog")).AGENT_TOOLS.filter((t) => t.name !== "run_tool").map((t) => ({
        name: t.name,
        family: t.family,
        description: t.description,
      })),
  },
  {
    name: "run_tool",
    description:
      "Run any Orkestria MCP tool by name (Synter-style long-tail). Prefer named tools when you know them. Writes still default to dry_run.",
    family: "govern",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tool name from list_tool_catalog" },
        arguments: { type: "object", description: "Arguments for that tool" },
      },
      required: ["name"],
    },
    handler: async (ctx, args) => {
      const toolName = str(args.name);
      if (!toolName) throw new Error("name requis");
      if (toolName === "run_tool") throw new Error("run_tool cannot call itself");
      const nested =
        typeof args.arguments === "object" && args.arguments !== null
          ? (args.arguments as Record<string, unknown>)
          : {};
      const { invokeAgentTool } = await import("./catalog");
      return invokeAgentTool(ctx, toolName, nested);
    },
  },
  {
    name: "autonomy_tick",
    description:
      "Run one capped autonomy tick: propose/pause campaigns with spend and zero conversions. Respects autonomyEnabled and policy mode. Never creates campaigns.",
    family: "govern",
    inputSchema: {
      type: "object",
      properties: {
        forceDryRun: { type: "boolean", description: "Force dry_run outcomes even if policy is live" },
      },
    },
    handler: async (ctx, args) => {
      requireScope(ctx, "write");
      return runAutonomyTick({
        orgId: ctx.organizationId,
        apiKeyId: ctx.keyId,
        forceDryRun: args.forceDryRun === true || args.forceDryRun === "true",
      });
    },
  },
];
