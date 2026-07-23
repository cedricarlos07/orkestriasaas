import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { actionRuns, adActions, approvals, connections } from "@/db/schema/index";
import type { ApiKeyContext } from "@/lib/mcp/api-keys";
import { requireScope } from "@/lib/mcp/api-keys";
import {
  approveAndExecute,
  getOrgPolicy,
  logReadRun,
  rejectPendingAction,
  runWriteAction,
  updateOrgPolicy,
  WRITE_ACTION_NAMES,
  type ExecutionMode,
  type WriteActionName,
} from "@/lib/mcp/policy-engine";
import { listSkills, getSkill } from "@/lib/mcp/skills";
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
import { ADLOOP_CONNECTION_ID, isAdloopHealthy, syntheticAdloopConnection } from "@/lib/mcp/adloop-org";
import type { UnifiedAccountSnapshot } from "@/lib/unified-ad-schema";
import { isLlmConfigured, llmChatCompletion } from "@/lib/llm/client";

export type AgentToolContext = ApiKeyContext;

export type AgentTool = {
  name: string;
  description: string;
  family: "core" | "launch" | "optimize" | "create" | "measure" | "govern";
  inputSchema: Record<string, unknown>;
  handler: (ctx: AgentToolContext, args: Record<string, unknown>) => Promise<unknown>;
};

const PLATFORM_ENUM = AD_CONNECTOR_IDS;

const platformProp = {
  platform: {
    type: "string",
    enum: PLATFORM_ENUM,
    description: "Ad platform connector id (e.g. meta_ads, google_ads, linkedin_ads…)",
  },
};

const modeProp = {
  mode: {
    type: "string",
    enum: ["dry_run", "approval", "live"],
    description: "Execution mode. Defaults to the workspace policy (dry_run unless changed). live requires the write scope.",
  },
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

async function getConnectedRows(orgId: string) {
  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  return rows.filter((r) => r.status === "connectée" && r.connector !== "ga4");
}

async function getTokensFor(orgId: string, connector: ConnectorId) {
  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  const conn = rows.find((c) => c.connector === connector && c.status === "connectée");
  if (conn) {
    const tokens = await ensureFreshTokens(conn.id, orgId, connector);
    return { conn, tokens };
  }
  if (connector === "google_ads" && (await isAdloopHealthy())) {
    return {
      conn: syntheticAdloopConnection(orgId),
      tokens: { accessToken: "", accountId: "" },
    };
  }
  if (!hasOAuthCredentials(connector)) {
    throw new Error(
      `${CONNECTORS[connector].label} : connexion non configurée (identifiants OAuth ${CONNECTORS[connector].oauth.clientIdEnv} absents côté serveur).`,
    );
  }
  throw new Error(`${CONNECTORS[connector].label} : aucun compte connecté dans ce workspace.`);
}

async function fetchSnapshot(orgId: string, connector: ConnectorId, accountId?: string, period?: string) {
  const { conn, tokens } = await getTokensFor(orgId, connector);
  const acct = accountId ?? tokens.accountId;
  if (!acct && conn.id !== ADLOOP_CONNECTION_ID) {
    throw new Error(`${CONNECTORS[connector].label} : aucun compte publicitaire sélectionné.`);
  }
  const { snapshot } = await routeReadSnapshot({
    orgId,
    connector,
    connectionId: conn.id,
    accountId: acct,
    period,
  });
  return snapshot;
}

async function fetchAllSnapshots(orgId: string, period?: string): Promise<UnifiedAccountSnapshot[]> {
  const rows = await getConnectedRows(orgId);
  const snapshots: UnifiedAccountSnapshot[] = [];
  for (const row of rows) {
    try {
      snapshots.push(await fetchSnapshot(orgId, row.connector as ConnectorId, undefined, period));
    } catch (e) {
      snapshots.push({
        platform: CONNECTORS[row.connector as ConnectorId]?.label ?? row.connector,
        accountId: row.externalAccount ?? "",
        accountName: row.externalAccount ?? row.connector,
        period: period ?? "30 derniers jours",
        spend: 0,
        currency: "USD",
        conversions: 0,
        cpa: null,
        roas: null,
        campaigns: [],
        issues: [e instanceof Error ? e.message : "Erreur de lecture"],
        opportunities: [],
      });
    }
  }
  const hasGoogle = rows.some((r) => r.connector === "google_ads");
  if (!hasGoogle && (await isAdloopHealthy())) {
    try {
      snapshots.push(await fetchSnapshot(orgId, "google_ads", undefined, period));
    } catch {
      /* AdLoop MCC default unavailable */
    }
  }
  return snapshots;
}

const dryRunProp = {
  dry_run: {
    type: "boolean",
    description:
      "Default true (Synter-safe). Validates policy and returns confirm payload. Set false only after reviewing the dry-run diff.",
  },
};

function writeTool(
  name: string,
  action: WriteActionName,
  description: string,
  family: AgentTool["family"],
  extraProps: Record<string, unknown>,
  required: string[],
  mapArgs: (args: Record<string, unknown>) => {
    campaignId?: string;
    accountId?: string;
    params: Record<string, unknown>;
  },
  fixedPlatform?: ConnectorId,
): AgentTool {
  return {
    name,
    description,
    family,
    inputSchema: {
      type: "object",
      properties: {
        ...(fixedPlatform ? {} : platformProp),
        ...dryRunProp,
        ...modeProp,
        ...extraProps,
      },
      required: fixedPlatform ? required : ["platform", ...required],
    },
    handler: async (ctx, args) => {
      const platform = (fixedPlatform ?? (args.platform as ConnectorId)) as ConnectorId;
      if (!platform) throw new Error("platform requis");

      const dryRun = args.dry_run !== false && args.dry_run !== "false";
      const policy = await getOrgPolicy(ctx.organizationId);

      let mode: ExecutionMode;
      if (dryRun) {
        mode = "dry_run";
      } else {
        const requested = str(args.mode) as ExecutionMode | undefined;
        if (requested === "dry_run") {
          return {
            status: "blocked",
            message: "dry_run=false with mode=dry_run is a no-op. Use mode=live or mode=approval.",
          };
        }
        mode = requested ?? (policy.defaultMode === "approval" ? "approval" : "live");
        if (mode === "live") requireScope(ctx, "write");
      }

      const mapped = mapArgs(args);
      return runWriteAction({
        orgId: ctx.organizationId,
        apiKeyId: ctx.keyId,
        connector: platform,
        action,
        mode,
        campaignId: mapped.campaignId,
        accountId: mapped.accountId,
        params: mapped.params,
      });
    },
  };
}

// ─── Core ─────────────────────────────────────────────────────────────────────

const coreTools: AgentTool[] = [
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

// ─── Launch ───────────────────────────────────────────────────────────────────

const launchTools: AgentTool[] = [
  writeTool(
    "create_campaign",
    "create_campaign",
    "Create a paused/draft campaign. Check list_capabilities — google_ads/meta_ads are production; others experimental.",
    "launch",
    {
      name: { type: "string", description: "Campaign name" },
      dailyBudget: { type: "number", description: "Daily budget in the account's main currency unit" },
      objective: { type: "string", description: "Platform objective (e.g. OUTCOME_TRAFFIC for Meta, TRAFFIC for TikTok)" },
      countries: { type: "array", items: { type: "string" }, description: "ISO country codes for geo targeting" },
      campaignType: {
        type: "string",
        enum: ["search", "pmax", "traffic", "leads", "default"],
        description: "Google: search|pmax. Others: default/traffic/leads.",
      },
      keywords: {
        type: "array",
        items: {
          type: "object",
          properties: { text: { type: "string" }, matchType: { type: "string" } },
          required: ["text"],
        },
        description: "Keywords for Google Search create",
      },
      finalUrl: { type: "string" },
      headlines: { type: "array", items: { type: "string" } },
      descriptions: { type: "array", items: { type: "string" } },
      accountId: { type: "string", description: "Ad account id (defaults to the connected primary account)" },
    },
    ["name", "dailyBudget"],
    (args) => ({
      accountId: str(args.accountId),
      params: {
        name: str(args.name),
        dailyBudget: num(args.dailyBudget),
        objective: str(args.objective),
        countries: Array.isArray(args.countries) ? (args.countries as string[]) : undefined,
        campaignType: str(args.campaignType) as
          | "search"
          | "pmax"
          | "traffic"
          | "leads"
          | "default"
          | undefined,
        keywords: Array.isArray(args.keywords)
          ? (args.keywords as { text: string; matchType?: string }[])
          : undefined,
        finalUrl: str(args.finalUrl),
        headlines: Array.isArray(args.headlines) ? (args.headlines as string[]) : undefined,
        descriptions: Array.isArray(args.descriptions) ? (args.descriptions as string[]) : undefined,
      },
    }),
  ),
  writeTool(
    "create_search_campaign",
    "create_campaign",
    "Create a Google Search campaign (PAUSED) with ad group, keywords and RSA. Production path.",
    "launch",
    {
      name: { type: "string" },
      dailyBudget: { type: "number" },
      keywords: {
        type: "array",
        items: {
          type: "object",
          properties: { text: { type: "string" }, matchType: { type: "string" } },
          required: ["text"],
        },
      },
      finalUrl: { type: "string" },
      headlines: { type: "array", items: { type: "string" } },
      descriptions: { type: "array", items: { type: "string" } },
      accountId: { type: "string" },
    },
    ["name", "dailyBudget"],
    (args) => ({
      accountId: str(args.accountId),
      params: {
        name: str(args.name),
        dailyBudget: num(args.dailyBudget),
        campaignType: "search",
        keywords: Array.isArray(args.keywords)
          ? (args.keywords as { text: string; matchType?: string }[])
          : undefined,
        finalUrl: str(args.finalUrl),
        headlines: Array.isArray(args.headlines) ? (args.headlines as string[]) : undefined,
        descriptions: Array.isArray(args.descriptions) ? (args.descriptions as string[]) : undefined,
      },
    }),
    "google_ads",
  ),
  writeTool(
    "create_pmax_campaign",
    "create_campaign",
    "Create a Google Performance Max campaign (PAUSED). Production path.",
    "launch",
    {
      name: { type: "string" },
      dailyBudget: { type: "number" },
      finalUrl: { type: "string" },
      headlines: { type: "array", items: { type: "string" } },
      descriptions: { type: "array", items: { type: "string" } },
      accountId: { type: "string" },
    },
    ["name", "dailyBudget"],
    (args) => ({
      accountId: str(args.accountId),
      params: {
        name: str(args.name),
        dailyBudget: num(args.dailyBudget),
        campaignType: "pmax",
        finalUrl: str(args.finalUrl),
        headlines: Array.isArray(args.headlines) ? (args.headlines as string[]) : undefined,
        descriptions: Array.isArray(args.descriptions) ? (args.descriptions as string[]) : undefined,
      },
    }),
    "google_ads",
  ),
  writeTool(
    "create_meta_campaign",
    "create_campaign",
    "Create a Meta (Facebook/Instagram) campaign + paused ad set. Production path.",
    "launch",
    {
      name: { type: "string" },
      dailyBudget: { type: "number" },
      objective: { type: "string", description: "Default OUTCOME_TRAFFIC" },
      countries: { type: "array", items: { type: "string" } },
      accountId: { type: "string" },
    },
    ["name", "dailyBudget"],
    (args) => ({
      accountId: str(args.accountId),
      params: {
        name: str(args.name),
        dailyBudget: num(args.dailyBudget),
        objective: str(args.objective) ?? "OUTCOME_TRAFFIC",
        countries: Array.isArray(args.countries) ? (args.countries as string[]) : undefined,
      },
    }),
    "meta_ads",
  ),
  writeTool(
    "launch_meta_brief",
    "launch_meta_brief",
    "Create a full Meta funnel via upstream adkit (launch_brief). Everything PAUSED. dry_run calls adkit without --go.",
    "launch",
    {
      brief: {
        type: "object",
        description: "Meta brief: { campaign: { name, objective?, dailyBudget? }, adsets: [{ name, dailyBudget, countries?, ads: [{ name, message?, headline?, link?, image? }] }] }",
      },
      pageId: { type: "string", description: "Facebook Page ID for creatives" },
      accountId: { type: "string" },
    },
    ["brief", "pageId"],
    (args) => ({
      accountId: str(args.accountId),
      params: {
        brief: args.brief as Record<string, unknown>,
        pageId: str(args.pageId),
      },
    }),
    "meta_ads",
  ),
  writeTool(
    "activate_meta_campaign",
    "activate_meta_chain",
    "Go live via adkit activate_ad (ad + ad set + campaign). Spend-gated — dry_run first.",
    "launch",
    {
      adId: { type: "string", description: "Meta ad id to activate (chain goes live)" },
      accountId: { type: "string" },
    },
    ["adId"],
    (args) => ({
      accountId: str(args.accountId),
      params: { adId: str(args.adId) },
    }),
    "meta_ads",
  ),
  writeTool(
    "create_linkedin_campaign",
    "create_campaign",
    "Create a LinkedIn DRAFT campaign (experimental maturity).",
    "launch",
    {
      name: { type: "string" },
      dailyBudget: { type: "number" },
      countries: { type: "array", items: { type: "string" } },
      finalUrl: { type: "string" },
      accountId: { type: "string" },
    },
    ["name", "dailyBudget"],
    (args) => ({
      accountId: str(args.accountId),
      params: {
        name: str(args.name),
        dailyBudget: num(args.dailyBudget),
        countries: Array.isArray(args.countries) ? (args.countries as string[]) : undefined,
        finalUrl: str(args.finalUrl),
      },
    }),
    "linkedin_ads",
  ),
  writeTool(
    "create_reddit_campaign",
    "create_campaign",
    "Create a Reddit PAUSED campaign (experimental — requires funding instrument).",
    "launch",
    {
      name: { type: "string" },
      dailyBudget: { type: "number" },
      objective: { type: "string" },
      accountId: { type: "string" },
    },
    ["name", "dailyBudget"],
    (args) => ({
      accountId: str(args.accountId),
      params: {
        name: str(args.name),
        dailyBudget: num(args.dailyBudget),
        objective: str(args.objective),
      },
    }),
    "reddit_ads",
  ),
  writeTool(
    "create_ad_set",
    "create_ad_set",
    "Create a paused ad set / ad group (Meta, TikTok) or DRAFT LinkedIn campaign under a parent.",
    "launch",
    {
      campaignId: { type: "string" },
      name: { type: "string" },
      dailyBudget: { type: "number" },
      countries: { type: "array", items: { type: "string" } },
      optimizationGoal: { type: "string" },
      accountId: { type: "string" },
    },
    ["campaignId", "name", "dailyBudget"],
    (args) => ({
      campaignId: str(args.campaignId),
      accountId: str(args.accountId),
      params: {
        name: str(args.name),
        dailyBudget: num(args.dailyBudget),
        countries: Array.isArray(args.countries) ? (args.countries as string[]) : undefined,
        optimizationGoal: str(args.optimizationGoal),
      },
    }),
  ),
  writeTool(
    "create_ad",
    "create_ad",
    "Create a paused ad/creative (Meta needs pageId+linkUrl+image; TikTok needs imageUrl; LinkedIn DRAFT creative).",
    "launch",
    {
      adSetId: { type: "string" },
      name: { type: "string" },
      pageId: { type: "string", description: "Facebook Page id (Meta)" },
      linkUrl: { type: "string" },
      message: { type: "string" },
      headline: { type: "string" },
      imageUrl: { type: "string" },
      imageHash: { type: "string" },
      accountId: { type: "string" },
    },
    ["adSetId", "name"],
    (args) => ({
      accountId: str(args.accountId),
      params: {
        adSetId: str(args.adSetId),
        name: str(args.name),
        pageId: str(args.pageId),
        linkUrl: str(args.linkUrl),
        message: str(args.message),
        headline: str(args.headline),
        imageUrl: str(args.imageUrl),
        imageHash: str(args.imageHash),
      },
    }),
  ),
  writeTool(
    "create_audience",
    "create_audience",
    "Create an audience (Meta, Google, LinkedIn, TikTok, Snapchat).",
    "launch",
    {
      name: { type: "string" },
      description: { type: "string" },
      subtype: { type: "string", description: "CUSTOM or LOOKALIKE" },
      originAudienceId: { type: "string" },
      lookalikeRatio: { type: "number" },
      country: { type: "string" },
      accountId: { type: "string" },
    },
    ["name"],
    (args) => ({
      accountId: str(args.accountId),
      params: {
        name: str(args.name),
        description: str(args.description),
        subtype: str(args.subtype),
        originAudienceId: str(args.originAudienceId),
        lookalikeRatio: num(args.lookalikeRatio),
        country: str(args.country),
      },
    }),
  ),
  writeTool(
    "attach_audience",
    "attach_audience",
    "Attach an audience to a campaign (Google/LinkedIn) or ad set (Meta).",
    "launch",
    {
      audienceId: { type: "string" },
      campaignId: { type: "string", description: "Google / LinkedIn campaign id" },
      adSetId: { type: "string", description: "Meta ad set id" },
      accountId: { type: "string" },
    },
    ["audienceId"],
    (args) => ({
      campaignId: str(args.campaignId),
      accountId: str(args.accountId),
      params: {
        audienceId: str(args.audienceId),
        adSetId: str(args.adSetId),
      },
    }),
  ),
  writeTool(
    "set_budget",
    "update_budget",
    "Set the daily budget of an existing campaign (Meta: pass the ad set id as campaignId).",
    "launch",
    {
      campaignId: { type: "string", description: "Campaign id (Meta: ad set id)" },
      dailyBudget: { type: "number", description: "New daily budget (main currency unit)" },
      currentDailyBudget: { type: "number", description: "Current budget, used by the policy to validate the % change" },
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
    "update_campaign_budget",
    "update_budget",
    "Synter-style alias of set_budget / update_budget.",
    "launch",
    {
      campaignId: { type: "string" },
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
  {
    name: "create_media_plan",
    description:
      "Build a media plan: allocate a total budget across the connected platforms based on 30-day performance. Read-only, returns a proposal.",
    family: "launch",
    inputSchema: {
      type: "object",
      properties: {
        totalDailyBudget: { type: "number", description: "Total daily budget to allocate" },
        objective: { type: "string", description: "Business goal (traffic, conversions, awareness…)" },
      },
      required: ["totalDailyBudget"],
    },
    handler: async (ctx, args) => {
      const total = num(args.totalDailyBudget) ?? 0;
      const snapshots = await fetchAllSnapshots(ctx.organizationId);
      const usable = snapshots.filter((s) => !s.issues.some((i) => i.includes("non configurée")));
      if (!usable.length) return { plan: [], note: "Aucune plateforme connectée — connectez au moins une régie." };

      // Weight by conversions, then clicks as fallback signal.
      const weights = usable.map((s) => {
        const conv = s.conversions;
        const clicks = s.campaigns.reduce((sum, c) => sum + c.clicks, 0);
        return { platform: s.platform, weight: conv > 0 ? conv * 10 : Math.max(clicks, 1) };
      });
      const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
      const plan = weights.map((w) => ({
        platform: w.platform,
        share: Math.round((w.weight / totalWeight) * 100),
        dailyBudget: Math.round((w.weight / totalWeight) * total * 100) / 100,
        rationale:
          w.weight > 1
            ? "Performance observée sur 30 jours (conversions/clics)"
            : "Aucun signal — budget de test minimal",
      }));
      return {
        objective: str(args.objective) ?? "non précisé",
        totalDailyBudget: total,
        plan,
        note: "Proposition indicative basée sur les 30 derniers jours. Appliquez avec set_budget / create_campaign.",
      };
    },
  },
];

// ─── Optimize ─────────────────────────────────────────────────────────────────

const optimizeTools: AgentTool[] = [
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

// ─── Create ───────────────────────────────────────────────────────────────────

const createTools: AgentTool[] = [
  writeTool(
    "upload_creative",
    "upload_creative",
    "Upload an image creative from URL (Meta returns imageHash for create_ad).",
    "create",
    {
      imageUrl: { type: "string" },
      name: { type: "string" },
      accountId: { type: "string" },
    },
    ["imageUrl"],
    (args) => ({
      accountId: str(args.accountId),
      params: { imageUrl: str(args.imageUrl), name: str(args.name) },
    }),
  ),
  {
    name: "generate_ad_copy",
    description:
      "Generate ad copy variants (headline + primary text + CTA) for a product and platform. Uses the workspace LLM when configured, deterministic templates otherwise.",
    family: "create",
    inputSchema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Product or offer to promote" },
        audience: { type: "string", description: "Target audience" },
        tone: { type: "string", description: "Tone (direct, premium, playful…)" },
        language: { type: "string", description: "Output language (default: fr)" },
        ...platformProp,
        variants: { type: "number", description: "Number of variants (default 3, max 5)" },
      },
      required: ["product"],
    },
    handler: async (_ctx, args) => {
      const product = str(args.product) ?? "";
      const audience = str(args.audience) ?? "votre audience cible";
      const tone = str(args.tone) ?? "direct";
      const language = str(args.language) ?? "fr";
      const count = Math.min(Math.max(num(args.variants) ?? 3, 1), 5);

      if (isLlmConfigured()) {
        try {
          const text = await llmChatCompletion({
            jsonMode: true,
            messages: [
              {
                role: "system",
                content: `Tu écris des publicités performantes. Réponds en JSON: {"variants":[{"headline":"","primaryText":"","cta":""}]}. Langue: ${language}.`,
              },
              {
                role: "user",
                content: `Produit: ${product}. Audience: ${audience}. Ton: ${tone}. Plateforme: ${str(args.platform) ?? "meta_ads"}. Génère ${count} variantes.`,
              },
            ],
          });
          return JSON.parse(text);
        } catch {
          // fall through to templates
        }
      }

      const templates = [
        { headline: `${product} — essayez-le aujourd'hui`, primaryText: `Conçu pour ${audience}. Résultats dès la première semaine.`, cta: "En savoir plus" },
        { headline: `Et si ${audience} choisissait mieux ?`, primaryText: `${product} : la solution simple qui fait la différence.`, cta: "Découvrir" },
        { headline: `${product}, sans compromis`, primaryText: `Rejoignez ceux qui ont déjà adopté ${product}.`, cta: "Commencer" },
        { headline: `Le choix malin pour ${audience}`, primaryText: `${product} — testé, approuvé, recommandé.`, cta: "Essayer" },
        { headline: `${product} change la donne`, primaryText: `Une offre pensée pour ${audience}. Ne passez pas à côté.`, cta: "Profiter de l'offre" },
      ];
      return { variants: templates.slice(0, count), source: "templates" };
    },
  },
  {
    name: "list_creatives",
    description: "List creative assets (Google assets, Meta images, TikTok images, LinkedIn creatives).",
    family: "create",
    inputSchema: { type: "object", properties: { ...platformProp, accountId: { type: "string" } }, required: ["platform"] },
    handler: async (ctx, args) => {
      const connector = args.platform as ConnectorId;
      const { tokens, conn } = await getTokensFor(ctx.organizationId, connector);
      const accountId = str(args.accountId) ?? tokens.accountId ?? "";
      const adapter = getAdapter(connector);
      if (adapter.listCreatives && accountId) {
        const creatives = await adapter.listCreatives(tokens, accountId);
        return { platform: adapter.label, creatives, count: creatives.length };
      }
      const snapshot = await fetchSnapshot(ctx.organizationId, connector, str(args.accountId));
      return {
        platform: snapshot.platform,
        campaigns: snapshot.campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status })),
        note: "Liste créatives native non dispo — retour campagnes.",
        connectionId: conn.id,
      };
    },
  },
  {
    name: "suggest_creative_rotation",
    description:
      "Suggest Meta ads to pause (low CTR with meaningful spend). Read-only; confirm with pause_ad via execute.",
    family: "create",
    inputSchema: {
      type: "object",
      properties: {
        ...platformProp,
        accountId: { type: "string" },
        minSpend: { type: "number", description: "Default 20" },
        maxCtr: { type: "number", description: "Default 0.5 (%)" },
      },
      required: ["platform"],
    },
    handler: async (ctx, args) => {
      const connector = args.platform as ConnectorId;
      if (connector !== "meta_ads") {
        return {
          suggestions: [],
          note: "suggest_creative_rotation is Meta-first for now — use list_creatives + detect_anomalies elsewhere.",
        };
      }
      const { tokens } = await getTokensFor(ctx.organizationId, connector);
      const accountId = str(args.accountId) ?? tokens.accountId;
      if (!accountId) throw new Error("accountId requis");
      const adapter = getAdapter(connector);
      if (!adapter.listAdInsights) throw new Error("Insights ads non supportés");
      const minSpend = num(args.minSpend) ?? 20;
      const maxCtr = num(args.maxCtr) ?? 0.5;
      const ads = await adapter.listAdInsights(tokens, accountId);
      const suggestions = ads
        .filter((a) => a.spend >= minSpend && a.ctr > 0 && a.ctr < maxCtr)
        .map((a) => ({
          adId: a.id,
          name: a.name,
          spend: a.spend,
          ctr: a.ctr,
          action: "pause_ad" as const,
          reason: `CTR ${a.ctr.toFixed(2)}% with ${Math.round(a.spend)} spend`,
        }));
      return { platform: "Meta Ads", suggestions, count: suggestions.length };
    },
  },
];

// ─── Measure ──────────────────────────────────────────────────────────────────

const measureTools: AgentTool[] = [
  {
    name: "research_competitor_ads",
    description:
      "Spy competitor ads via Meta Ad Library (useproxy). Read-only research — no spend. Use before creating campaigns.",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string", description: "Primary brand or advertiser name" },
        brands: { type: "array", items: { type: "string" }, description: "Multiple brands to compare" },
        country: { type: "string", description: "ISO country code filter (optional)" },
      },
      required: ["brand"],
    },
    handler: async (ctx, args) => {
      const brand = str(args.brand);
      if (!brand) throw new Error("brand requis");
      return routeResearch(ctx.organizationId, {
        brand,
        brands: Array.isArray(args.brands) ? (args.brands as string[]) : undefined,
        country: str(args.country),
      });
    },
  },
  {
    name: "search_meta_targeting",
    description: "Search Meta interest or job-title IDs via adkit (read-only). Use before launch_meta_brief.",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        type: { type: "string", enum: ["adinterest", "adworkposition"], description: "Default adinterest" },
        accountId: { type: "string" },
      },
      required: ["query"],
    },
    handler: async (ctx, args) => {
      const query = str(args.query);
      if (!query) throw new Error("query requis");
      const { tokens } = await getTokensFor(ctx.organizationId, "meta_ads");
      const { buildAdkitEnv, adkitSearchTargeting } = await import("@/lib/mcp/adkit-bridge");
      const { resolveMetaPageId } = await import("@/lib/mcp/meta-org");
      const pageId = await resolveMetaPageId(ctx.organizationId, null);
      const env = buildAdkitEnv({
        accessToken: tokens.accessToken,
        accountId: str(args.accountId) ?? tokens.accountId ?? "",
        pageId: pageId ?? undefined,
        allowSpend: false,
      });
      return adkitSearchTargeting(env, query, str(args.type) ?? "adinterest");
    },
  },
  {
    name: "optimize_meta_ads",
    description: "adkit optimize_report — KILL/SCALE/KEEP recommendations (read-only, no changes).",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        window: { type: "string", description: "e.g. last_3d" },
        targetCpl: { type: "number" },
        targetRoas: { type: "number" },
        leadFormId: { type: "string" },
        accountId: { type: "string" },
      },
    },
    handler: async (ctx, args) => {
      const { tokens } = await getTokensFor(ctx.organizationId, "meta_ads");
      const { buildAdkitEnv, adkitOptimizeReport } = await import("@/lib/mcp/adkit-bridge");
      const { resolveMetaPageId } = await import("@/lib/mcp/meta-org");
      const pageId = await resolveMetaPageId(ctx.organizationId, null);
      const env = buildAdkitEnv({
        accessToken: tokens.accessToken,
        accountId: str(args.accountId) ?? tokens.accountId ?? "",
        pageId: pageId ?? undefined,
        allowSpend: false,
      });
      return adkitOptimizeReport(env, {
        campaign_id: str(args.campaignId),
        window: str(args.window) ?? "last_3d",
        target_cpl: num(args.targetCpl),
        target_roas: num(args.targetRoas),
        lead_form_id: str(args.leadFormId),
      });
    },
  },
  {
    name: "get_performance",
    description: "Get campaign-level performance (spend, impressions, clicks, conversions, CTR, CPA) for one platform over the last 30 days.",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: { ...platformProp, accountId: { type: "string" }, period: { type: "string" } },
      required: ["platform"],
    },
    handler: async (ctx, args) =>
      fetchSnapshot(ctx.organizationId, args.platform as ConnectorId, str(args.accountId), str(args.period)),
  },
  {
    name: "list_campaigns",
    description: "List campaigns with status and key metrics for one platform (or all connected platforms when platform is omitted).",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: { ...platformProp, accountId: { type: "string" } },
    },
    handler: async (ctx, args) => {
      if (str(args.platform)) {
        const snap = await fetchSnapshot(ctx.organizationId, args.platform as ConnectorId, str(args.accountId));
        return snap.campaigns;
      }
      const snapshots = await fetchAllSnapshots(ctx.organizationId);
      return snapshots.flatMap((s) => s.campaigns);
    },
  },
  {
    name: "get_account_summary",
    description: "Cross-platform account summary: totals and per-platform breakdown over the last 30 days.",
    family: "measure",
    inputSchema: { type: "object", properties: { period: { type: "string" } } },
    handler: async (ctx, args) => {
      const snapshots = await fetchAllSnapshots(ctx.organizationId, str(args.period));
      const totalSpend = snapshots.reduce((s, a) => s + a.spend, 0);
      const totalConv = snapshots.reduce((s, a) => s + a.conversions, 0);
      return {
        totals: {
          spend: totalSpend,
          conversions: totalConv,
          cpa: totalConv > 0 ? totalSpend / totalConv : null,
        },
        platforms: snapshots.map((s) => ({
          platform: s.platform,
          account: s.accountName,
          spend: s.spend,
          currency: s.currency,
          conversions: s.conversions,
          cpa: s.cpa,
          campaigns: s.campaigns.length,
          issues: s.issues,
        })),
      };
    },
  },
  {
    name: "compare_campaigns",
    description: "Rank campaigns by a metric (spend, conversions, ctr, cpa) across one or all platforms.",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: {
        ...platformProp,
        metric: { type: "string", enum: ["spend", "conversions", "ctr", "cpa"], description: "Ranking metric (default: conversions)" },
        limit: { type: "number" },
      },
    },
    handler: async (ctx, args) => {
      const metric = (str(args.metric) ?? "conversions") as "spend" | "conversions" | "ctr" | "cpa";
      const limit = Math.min(num(args.limit) ?? 10, 50);
      const campaigns = str(args.platform)
        ? (await fetchSnapshot(ctx.organizationId, args.platform as ConnectorId)).campaigns
        : (await fetchAllSnapshots(ctx.organizationId)).flatMap((s) => s.campaigns);
      const sorted = [...campaigns].sort((a, b) => {
        const av = a[metric] ?? (metric === "cpa" ? Infinity : 0);
        const bv = b[metric] ?? (metric === "cpa" ? Infinity : 0);
        return metric === "cpa" ? Number(av) - Number(bv) : Number(bv) - Number(av);
      });
      return { metric, ranking: sorted.slice(0, limit) };
    },
  },
  {
    name: "get_spend",
    description: "Total spend over the last 30 days, per platform and overall.",
    family: "measure",
    inputSchema: { type: "object", properties: { ...platformProp } },
    handler: async (ctx, args) => {
      const snapshots = str(args.platform)
        ? [await fetchSnapshot(ctx.organizationId, args.platform as ConnectorId)]
        : await fetchAllSnapshots(ctx.organizationId);
      return {
        total: snapshots.reduce((s, a) => s + a.spend, 0),
        perPlatform: snapshots.map((s) => ({ platform: s.platform, spend: s.spend, currency: s.currency })),
      };
    },
  },
  {
    name: "get_daily_spend",
    description: "Synter-style alias of get_spend — daily/period spend breakdown by platform.",
    family: "measure",
    inputSchema: { type: "object", properties: { ...platformProp } },
    handler: async (ctx, args) => {
      const snapshots = str(args.platform)
        ? [await fetchSnapshot(ctx.organizationId, args.platform as ConnectorId)]
        : await fetchAllSnapshots(ctx.organizationId);
      return {
        total: snapshots.reduce((s, a) => s + a.spend, 0),
        perPlatform: snapshots.map((s) => ({ platform: s.platform, spend: s.spend, currency: s.currency })),
      };
    },
  },
  {
    name: "list_conversions",
    description: "List conversion actions / pixels (Google Ads conversion actions, Meta pixels).",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: { ...platformProp, accountId: { type: "string" } },
      required: ["platform"],
    },
    handler: async (ctx, args) => {
      const connector = args.platform as ConnectorId;
      const { tokens } = await getTokensFor(ctx.organizationId, connector);
      const adapter = getAdapter(connector);
      if (!adapter.listConversions) throw new Error(`list_conversions non supporté pour ${adapter.label}`);
      const accountId = str(args.accountId) ?? tokens.accountId;
      if (!accountId) throw new Error("accountId requis");
      return adapter.listConversions(tokens, accountId);
    },
  },
  {
    name: "diagnose_tracking",
    description: "Diagnose conversion tracking (Google Ads, Meta pixels, TikTok pixels).",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: { ...platformProp, accountId: { type: "string" } },
      required: ["platform"],
    },
    handler: async (ctx, args) => {
      const connector = args.platform as ConnectorId;
      const { tokens } = await getTokensFor(ctx.organizationId, connector);
      const adapter = getAdapter(connector);
      if (!adapter.diagnoseTracking) throw new Error(`diagnose_tracking non supporté pour ${adapter.label}`);
      const accountId = str(args.accountId) ?? tokens.accountId;
      if (!accountId) throw new Error("accountId requis");
      return adapter.diagnoseTracking(tokens, accountId);
    },
  },
  {
    name: "detect_anomalies",
    description: "Detect anomalies across connected platforms: spend without conversions, very low CTR, outlier CPA.",
    family: "measure",
    inputSchema: { type: "object", properties: {} },
    handler: async (ctx) => {
      const snapshots = await fetchAllSnapshots(ctx.organizationId);
      const anomalies: { platform: string; campaignId: string; campaign: string; kind: string; detail: string }[] = [];
      for (const s of snapshots) {
        const cpas = s.campaigns.map((c) => c.cpa).filter((v): v is number => v !== null);
        const avgCpa = cpas.length ? cpas.reduce((a, b) => a + b, 0) / cpas.length : null;
        for (const c of s.campaigns) {
          if (c.spend > 0 && c.conversions === 0) {
            anomalies.push({
              platform: s.platform, campaignId: c.id, campaign: c.name, kind: "spend_no_conversion",
              detail: `${Math.round(c.spend)} ${c.currency} dépensés sans conversion sur 30 jours`,
            });
          }
          if (c.impressions > 1000 && c.ctr < 0.5) {
            anomalies.push({
              platform: s.platform, campaignId: c.id, campaign: c.name, kind: "low_ctr",
              detail: `CTR ${c.ctr.toFixed(2)} % (< 0,5 %) — créations ou ciblage à revoir`,
            });
          }
          if (avgCpa !== null && c.cpa !== null && c.cpa > avgCpa * 2 && cpas.length > 1) {
            anomalies.push({
              platform: s.platform, campaignId: c.id, campaign: c.name, kind: "high_cpa",
              detail: `CPA ${Math.round(c.cpa)} ${c.currency} — plus du double de la moyenne du compte (${Math.round(avgCpa)})`,
            });
          }
        }
      }
      return { anomalies, checkedPlatforms: snapshots.map((s) => s.platform) };
    },
  },
];

// ─── Govern ───────────────────────────────────────────────────────────────────

const governTools: AgentTool[] = [
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
        mode = requested ?? (policy.defaultMode === "approval" ? "approval" : "live");
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
    description: "List built-in Orkestria MCP skills (file SOPs + launch/optimize/audit/audience/creative_rotate).",
    family: "govern",
    inputSchema: { type: "object", properties: {} },
    handler: async () => listSkills(),
  },
  {
    name: "run_skill",
    description:
      "Return the step plan for a skill. The agent should then call each tool (prefer execute dry_run for writes).",
    family: "govern",
    inputSchema: {
      type: "object",
      properties: {
        skillId: {
          type: "string",
          enum: [
            "launch",
            "optimize",
            "audit",
            "audience",
            "creative_rotate",
            "campaign-manager",
            "performance-analyzer",
            "budget-optimizer",
            "creative-generator",
          ],
        },
      },
      required: ["skillId"],
    },
    handler: async (_ctx, args) => {
      const skill = getSkill(str(args.skillId) ?? "");
      if (!skill) throw new Error("Unknown skill — call list_skills");
      return {
        skill,
        instructions:
          "Execute steps in order. For writes, call execute with dry_run=true first, then dry_run=false after review. Check list_capabilities for maturity.",
      };
    },
  },
  {
    name: "list_tool_catalog",
    description: "Catalog of all MCP tools (name, family, description) — Synter-style discovery.",
    family: "govern",
    inputSchema: { type: "object", properties: {} },
    handler: async () =>
      getAgentTools().filter((t) => t.name !== "run_tool").map((t) => ({
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

export const AGENT_TOOLS: AgentTool[] = [
  ...coreTools,
  ...launchTools,
  ...optimizeTools,
  ...createTools,
  ...measureTools,
  ...governTools,
];

function getAgentTools(): AgentTool[] {
  return AGENT_TOOLS;
}
export function getAgentTool(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((t) => t.name === name);
}

/** Invoke a tool with audit logging for reads (writes log themselves via the policy engine). */
export async function invokeAgentTool(
  ctx: AgentToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = getAgentTool(name);
  if (!tool) throw new Error(`Tool inconnu : ${name}`);
  const isWrite =
    ["launch", "optimize"].includes(tool.family) ||
    [
      "execute",
      "approve_action",
      "reject_action",
      "set_policy",
      "upload_creative",
      "autonomy_tick",
      "launch_meta_brief",
      "activate_meta_campaign",
    ].includes(name);
  const start = Date.now();
  try {
    const result = await tool.handler(ctx, args ?? {});
    if (!isWrite) {
      await logReadRun({
        orgId: ctx.organizationId,
        apiKeyId: ctx.keyId,
        connector: str(args?.platform),
        tool: name,
        params: args ?? {},
        status: "ok",
        latencyMs: Date.now() - start,
      });
    }
    return result;
  } catch (e) {
    if (!isWrite) {
      await logReadRun({
        orgId: ctx.organizationId,
        apiKeyId: ctx.keyId,
        connector: str(args?.platform),
        tool: name,
        params: args ?? {},
        status: "error",
        error: e instanceof Error ? e.message : "Erreur",
        latencyMs: Date.now() - start,
      });
    }
    throw e;
  }
}
