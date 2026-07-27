import { Agent } from "@mastra/core/agent";
import { createOrkestriaMemory } from "@/mastra/memory";
import { orkestriaPolicyTools } from "@/mastra/tools/policy-tools";
import { spendGuardProcessor } from "@/mastra/processors/spend-guard";
import { orkestriaScorers } from "@/mastra/scorers/media-buyer";
import { createPipeboardMcpClient, isPipeboardConfigured } from "@/mastra/pipeboard-mcp";

const DEFAULT_INSTRUCTIONS = `Tu es Orkestria, media buyer senior (10 ans d'agence Meta/Google/TikTok) qui parle au dirigeant d'une PME africaine.

Règles absolues :
- Ne demande JAMAIS de connecter un compte déjà listé comme connecté dans le contexte / working memory.
- Tu CONNAIS le compte : cite les noms de campagnes, statuts, dépenses et CPA du contexte outil. Si une donnée manque, dis-le — n'invente aucun chiffre.
- Une seule question maximum par réponse, et seulement si elle bloque la suite.
- Réponds en français, ton direct et concret, orienté argent (dépense, coût par client, rentabilité).
- Une création de campagne se fait toujours en pause d'abord ; l'activation qui dépense exige « oui active » + ad id.
- Utilise les tools (validate_setup, get_account_summary, list_campaigns, create_meta_campaign en dry_run d'abord, etc.).
- Pipeboard gère Meta, Google, TikTok, Snapchat et Reddit Ads en backend — ne mentionne pas AdLoop ni adkit.
- « Bientôt » uniquement pour LinkedIn, Microsoft, X, Amazon, Pinterest, GA4, WhatsApp, Shopify.

Format : 180 mots maximum. Markdown sobre. Termine par une seule prochaine action claire.`;

function deepseekModel() {
  const modelId = process.env.LLM_MODEL?.trim() || "deepseek-v4-flash";
  return {
    id: `deepseek/${modelId}` as const,
    url: (process.env.LLM_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, ""),
    apiKey: process.env.DEEPSEEK_API_KEY ?? process.env.LLM_API_KEY,
  };
}

async function buildTools() {
  const tools: Record<string, unknown> = { ...orkestriaPolicyTools };
  if (isPipeboardConfigured()) {
    try {
      const mcp = createPipeboardMcpClient({ id: "orkestria-agent-pb" });
      if (mcp) {
        const pbTools = await mcp.listTools();
        // Prefer read-oriented Pipeboard tools; writes stay policy-gated via local tools
        for (const [name, tool] of Object.entries(pbTools)) {
          if (/get_|list_|search_|insights|performance|accounts|campaigns/i.test(name)) {
            tools[name] = tool;
          }
        }
      }
    } catch {
      // Pipeboard optional at boot — local tools still work
    }
  }
  return tools as typeof orkestriaPolicyTools;
}

export const orkestriaAgent = new Agent({
  id: "orkestria",
  name: "Orkestria",
  instructions: DEFAULT_INSTRUCTIONS,
  model: deepseekModel(),
  memory: createOrkestriaMemory(),
  tools: async () => buildTools(),
  inputProcessors: [spendGuardProcessor],
  scorers: {
    mediaBuyerSafety: {
      scorer: orkestriaScorers.mediaBuyerSafety,
      sampling: { type: "ratio", rate: 0.2 },
    },
  },
});

export const campaignSpecialistAgent = new Agent({
  id: "campaign-specialist",
  name: "Campaign Specialist",
  instructions: `${DEFAULT_INSTRUCTIONS}

Tu es spécialisé dans le lancement de campagnes Meta. Toujours dry_run puis pause, jamais de spend sans confirmation.`,
  model: deepseekModel(),
  memory: createOrkestriaMemory(),
  tools: {
    validate_setup: orkestriaPolicyTools.validate_setup,
    create_meta_campaign: orkestriaPolicyTools.create_meta_campaign,
    activate_meta_campaign: orkestriaPolicyTools.activate_meta_campaign,
    list_campaigns: orkestriaPolicyTools.list_campaigns,
  },
  inputProcessors: [spendGuardProcessor],
});

export const auditSpecialistAgent = new Agent({
  id: "audit-specialist",
  name: "Audit Specialist",
  instructions: `${DEFAULT_INSTRUCTIONS}

Tu es spécialisé dans l'audit de comptes pubs. Utilise get_account_summary, list_campaigns, get_performance.`,
  model: deepseekModel(),
  memory: createOrkestriaMemory(),
  tools: {
    get_account_summary: orkestriaPolicyTools.get_account_summary,
    list_campaigns: orkestriaPolicyTools.list_campaigns,
    get_performance: orkestriaPolicyTools.get_performance,
    research_competitor_ads: orkestriaPolicyTools.research_competitor_ads,
  },
});

export { DEFAULT_INSTRUCTIONS as ORKESTRIA_AGENT_INSTRUCTIONS };
