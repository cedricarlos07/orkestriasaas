import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { invokeAgentTool, type AgentToolContext } from "@/lib/mcp/agent-tools";

function ctxFromRequest(requestContext: unknown): AgentToolContext {
  const rc = requestContext as { get?: (k: string) => unknown } | Record<string, unknown> | undefined;
  const get = (k: string) => {
    if (rc && typeof (rc as { get?: (k: string) => unknown }).get === "function") {
      return (rc as { get: (k: string) => unknown }).get(k);
    }
    return (rc as Record<string, unknown> | undefined)?.[k];
  };
  const orgId = String(get("organizationId") ?? get("orgId") ?? "");
  const userId = String(get("userId") ?? "mastra");
  if (!orgId) throw new Error("organizationId manquant dans le requestContext Mastra");
  return {
    keyId: "mastra-chat",
    organizationId: orgId,
    userId,
    name: "orkestria-mastra",
    scopes: ["read", "write"],
  };
}

async function runTool(
  name: string,
  args: Record<string, unknown>,
  requestContext: unknown,
): Promise<unknown> {
  return invokeAgentTool(ctxFromRequest(requestContext), name, args);
}

export const validateSetupTool = createTool({
  id: "validate_setup",
  description: "Vérifie si Meta/Google/TikTok/Snap/Reddit sont prêts (OAuth + stack).",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => runTool("validate_setup", {}, ctx?.requestContext),
});

export const getAccountSummaryTool = createTool({
  id: "get_account_summary",
  description: "Résumé du compte pub (dépense, campagnes, signaux).",
  inputSchema: z.object({
    platform: z
      .enum(["meta_ads", "google_ads", "tiktok_ads", "snapchat_ads", "reddit_ads", "ga4"])
      .optional(),
  }),
  execute: async (input, ctx) =>
    runTool("get_account_summary", { platform: input.platform ?? "meta_ads" }, ctx?.requestContext),
});

export const listCampaignsTool = createTool({
  id: "list_campaigns",
  description: "Liste les campagnes du compte connecté.",
  inputSchema: z.object({
    platform: z
      .enum(["meta_ads", "google_ads", "tiktok_ads", "snapchat_ads", "reddit_ads"])
      .optional(),
  }),
  execute: async (input, ctx) =>
    runTool("list_campaigns", { platform: input.platform ?? "meta_ads" }, ctx?.requestContext),
});

export const getPerformanceTool = createTool({
  id: "get_performance",
  description: "Métriques de performance (spend, CPA, conversions).",
  inputSchema: z.object({
    platform: z
      .enum(["meta_ads", "google_ads", "tiktok_ads", "snapchat_ads", "reddit_ads"])
      .optional(),
    period: z.string().optional(),
  }),
  execute: async (input, ctx) =>
    runTool(
      "get_performance",
      { platform: input.platform ?? "meta_ads", period: input.period },
      ctx?.requestContext,
    ),
});

export const researchCompetitorAdsTool = createTool({
  id: "research_competitor_ads",
  description: "Recherche pubs concurrents (Meta Ad Library).",
  inputSchema: z.object({
    brand: z.string(),
    country: z.string().optional(),
  }),
  execute: async (input, ctx) => runTool("research_competitor_ads", input, ctx?.requestContext),
});

export const createMetaCampaignTool = createTool({
  id: "create_meta_campaign",
  description:
    "Crée une campagne Meta + ad set en pause (policy dry_run par défaut). Demander confirmation avant dry_run=false.",
  inputSchema: z.object({
    name: z.string(),
    dailyBudget: z.number().positive(),
    objective: z.string().optional(),
    countries: z.array(z.string()).optional(),
    dry_run: z.boolean().optional(),
    mode: z.enum(["dry_run", "approval", "live"]).optional(),
  }),
  execute: async (input, ctx) =>
    runTool(
      "create_meta_campaign",
      {
        ...input,
        dry_run: input.dry_run ?? true,
        mode: input.mode ?? (input.dry_run === false ? "live" : "dry_run"),
      },
      ctx?.requestContext,
    ),
});

export const activateMetaCampaignTool = createTool({
  id: "activate_meta_campaign",
  description: "Active une pub Meta (ad id) — dépense réelle. Exige confirmation explicite.",
  inputSchema: z.object({
    adId: z.string(),
    dry_run: z.boolean().optional(),
    mode: z.enum(["dry_run", "approval", "live"]).optional(),
  }),
  execute: async (input, ctx) =>
    runTool(
      "activate_meta_campaign",
      {
        ...input,
        dry_run: input.dry_run ?? true,
        mode: input.mode ?? (input.dry_run === false ? "live" : "dry_run"),
      },
      ctx?.requestContext,
    ),
});

export const reallocateBudgetTool = createTool({
  id: "reallocate_budget",
  description: "Met à jour le budget journalier d'une campagne (policy-gated).",
  inputSchema: z.object({
    platform: z
      .enum(["meta_ads", "google_ads", "tiktok_ads", "snapchat_ads", "reddit_ads"])
      .optional(),
    campaignId: z.string(),
    dailyBudget: z.number().positive(),
    dry_run: z.boolean().optional(),
  }),
  execute: async (input, ctx) =>
    runTool(
      "reallocate_budget",
      {
        platform: input.platform ?? "meta_ads",
        campaignId: input.campaignId,
        dailyBudget: input.dailyBudget,
        dry_run: input.dry_run ?? true,
      },
      ctx?.requestContext,
    ),
});

export const orkestriaPolicyTools = {
  validate_setup: validateSetupTool,
  get_account_summary: getAccountSummaryTool,
  list_campaigns: listCampaignsTool,
  get_performance: getPerformanceTool,
  research_competitor_ads: researchCompetitorAdsTool,
  create_meta_campaign: createMetaCampaignTool,
  activate_meta_campaign: activateMetaCampaignTool,
  reallocate_budget: reallocateBudgetTool,
};
