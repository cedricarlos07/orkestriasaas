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

// ─── Measure ──────────────────────────────────────────────────────────────────

export const measureTools: AgentTool[] = [
  {
    name: "research_competitor_ads",
    description:
      "Spy competitor ads via Meta Ad Library API (ads_archive on your Meta app). Read-only — no spend. Coverage: commercial mainly EU/UK; political worldwide.",
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
    description: "Search Meta interest targeting (lecture seule). Use before launch_meta_brief.",
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
      return searchMetaInterests(tokens.accessToken, query, str(args.type) ?? "adinterest");
    },
  },
  {
    name: "estimate_meta_audience",
    description:
      "Estime la taille d'audience Meta avant lancement (geo + intérêts). Lecture seule — guide audience sizing.",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: {
        countries: { type: "array", items: { type: "string" }, description: "ISO codes e.g. FR, CI" },
        interestIds: { type: "array", items: { type: "string" } },
        ageMin: { type: "number" },
        ageMax: { type: "number" },
        accountId: { type: "string" },
      },
      required: ["countries"],
    },
    handler: async (ctx, args) => {
      const { tokens } = await getTokensFor(ctx.organizationId, "meta_ads");
      const accountId = str(args.accountId) ?? tokens.accountId ?? "";
      if (!accountId) throw new Error("compte Meta manquant");
      const countries = Array.isArray(args.countries)
        ? (args.countries as string[]).map((c) => String(c).toUpperCase())
        : ["FR"];
      const targeting: Record<string, unknown> = {
        geo_locations: { countries },
        age_min: num(args.ageMin) ?? 18,
        age_max: num(args.ageMax) ?? 65,
      };
      if (Array.isArray(args.interestIds) && args.interestIds.length) {
        targeting.flexible_spec = [
          {
            interests: (args.interestIds as string[]).map((id) => ({ id: String(id) })),
          },
        ];
      }
      return estimateMetaAudience(tokens.accessToken, accountId, targeting);
    },
  },
  {
    name: "search_meta_geo",
    description: "Recherche géo Meta (pays, villes, régions) avant ciblage.",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
    handler: async (ctx, args) => {
      const query = str(args.query);
      if (!query) throw new Error("query requis");
      const { tokens } = await getTokensFor(ctx.organizationId, "meta_ads");
      return searchMetaGeoLocations(tokens.accessToken, query);
    },
  },
  {
    name: "list_meta_adsets",
    description: "Liste les ad sets Meta (optionnellement filtrés par campagne).",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        accountId: { type: "string" },
      },
    },
    handler: async (ctx, args) => {
      const { tokens } = await getTokensFor(ctx.organizationId, "meta_ads");
      const accountId = str(args.accountId) ?? tokens.accountId ?? "";
      if (!accountId) throw new Error("compte Meta manquant");
      return listMetaAdSets(tokens.accessToken, accountId, {
        campaignId: str(args.campaignId) ?? undefined,
      });
    },
  },
  {
    name: "list_meta_ads",
    description: "Liste les pubs Meta (filtre campagne ou ad set).",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        adSetId: { type: "string" },
        accountId: { type: "string" },
      },
    },
    handler: async (ctx, args) => {
      const { tokens } = await getTokensFor(ctx.organizationId, "meta_ads");
      const accountId = str(args.accountId) ?? tokens.accountId ?? "";
      if (!accountId) throw new Error("compte Meta manquant");
      return listMetaAds(tokens.accessToken, accountId, {
        campaignId: str(args.campaignId) ?? undefined,
        adSetId: str(args.adSetId) ?? undefined,
      });
    },
  },
  {
    name: "list_meta_pages",
    description: "Pages Facebook liées au compte Meta.",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: { accountId: { type: "string" } },
    },
    handler: async (ctx) => {
      const { tokens } = await getTokensFor(ctx.organizationId, "meta_ads");
      return listMetaPages(tokens.accessToken);
    },
  },
  {
    name: "duplicate_meta_campaign",
    description: "Duplique une campagne Meta en pause (scaling / A-B).",
    family: "optimize",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        name: { type: "string" },
      },
      required: ["campaignId"],
    },
    handler: async () => {
      throw new Error(
        "Duplication Meta : bientôt. Recréez la campagne via create_meta_campaign pour l'instant.",
      );
    },
  },
  {
    name: "optimize_meta_ads",
    description: "Insights / recommandations Meta (read-only).",
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
      const accountId = str(args.accountId) ?? tokens.accountId ?? "";
      if (!accountId) throw new Error("compte Meta manquant");
      const insights = await listMetaAdsInsights(tokens.accessToken, accountId);
      return { insights, campaignId: str(args.campaignId) ?? null, window: str(args.window) ?? "last_30d" };
    },
  },
  {
    name: "bulk_meta_insights",
    description: "Insights Meta du compte connecté.",
    family: "measure",
    inputSchema: {
      type: "object",
      properties: {
        window: { type: "string", description: "last_7d | last_30d" },
      },
    },
    handler: async (ctx, args) => {
      const { tokens } = await getTokensFor(ctx.organizationId, "meta_ads");
      const accountId = tokens.accountId ?? "";
      if (!accountId) throw new Error("compte Meta manquant");
      const insights = await listMetaAdsInsights(tokens.accessToken, accountId);
      return { insights, window: str(args.window) ?? "last_30d" };
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

