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

// ─── Launch ───────────────────────────────────────────────────────────────────

export const launchTools: AgentTool[] = [
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
    "Create a Meta campaign + paused ad set. Use channel=whatsapp|messenger for Click-to-Message (Messages objective).",
    "launch",
    {
      name: { type: "string" },
      dailyBudget: { type: "number" },
      objective: {
        type: "string",
        description: "OUTCOME_TRAFFIC | OUTCOME_LEADS | OUTCOME_SALES | OUTCOME_ENGAGEMENT (messages)",
      },
      channel: {
        type: "string",
        description: "website (default) | whatsapp | messenger — Messages Ads destinations",
      },
      countries: { type: "array", items: { type: "string" } },
      cities: { type: "array", items: { type: "string" }, description: "City names e.g. Abidjan" },
      neighborhoods: { type: "array", items: { type: "string" }, description: "Neighborhood / quartier" },
      radiusKm: { type: "number", description: "Radius km around city (0 = whole city)" },
      geoScope: { type: "string", description: "country_wide | city" },
      deviceTargeting: { type: "string", description: "mobile | all" },
      pageId: { type: "string", description: "Required for whatsapp/messenger channel" },
      accountId: { type: "string" },
    },
    ["name", "dailyBudget"],
    (args) => ({
      accountId: str(args.accountId),
      params: {
        name: str(args.name),
        dailyBudget: num(args.dailyBudget),
        objective: str(args.objective) ?? "OUTCOME_TRAFFIC",
        channel: (str(args.channel) as "website" | "whatsapp" | "messenger" | undefined) ?? undefined,
        countries: Array.isArray(args.countries) ? (args.countries as string[]) : undefined,
        cities: Array.isArray(args.cities) ? (args.cities as string[]) : undefined,
        neighborhoods: Array.isArray(args.neighborhoods) ? (args.neighborhoods as string[]) : undefined,
        radiusKm: num(args.radiusKm),
        geoScope: str(args.geoScope) as "country_wide" | "city" | undefined,
        deviceTargeting: str(args.deviceTargeting) as "mobile" | "all" | undefined,
        pageId: str(args.pageId),
      },
    }),
    "meta_ads",
  ),
  writeTool(
    "launch_meta_brief",
    "launch_meta_brief",
    "Create a full Meta funnel (campagne + ad sets en pause).",
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
    "Go live (annonce ACTIVE). Spend-gated — dry_run first.",
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
    "Create a Reddit PAUSED campaign .",
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
    "create_tiktok_campaign",
    "create_campaign",
    "Create a TikTok PAUSED campaign .",
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
    "tiktok_ads",
  ),
  writeTool(
    "create_snap_campaign",
    "create_campaign",
    "Create a Snapchat PAUSED campaign .",
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
    "snapchat_ads",
  ),
  writeTool(
    "create_ad_set",
    "create_ad_set",
    "Create a paused Meta ad set (channel=website|whatsapp|messenger) or TikTok/LinkedIn equivalent.",
    "launch",
    {
      campaignId: { type: "string" },
      name: { type: "string" },
      dailyBudget: { type: "number" },
      countries: { type: "array", items: { type: "string" } },
      optimizationGoal: { type: "string" },
      channel: { type: "string", description: "website | whatsapp | messenger" },
      pageId: { type: "string" },
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
        channel: (str(args.channel) as "website" | "whatsapp" | "messenger" | undefined) ?? undefined,
        pageId: str(args.pageId),
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

