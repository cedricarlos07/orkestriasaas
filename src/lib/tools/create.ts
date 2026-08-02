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

// ─── Create ───────────────────────────────────────────────────────────────────

export const createTools: AgentTool[] = [
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

