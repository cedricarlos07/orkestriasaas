import { Agent } from "@mastra/core/agent";
import { createOrkestriaMemory } from "@/mastra/memory";
import { orkestriaPolicyTools } from "@/mastra/tools/policy-tools";
import { spendGuardProcessor } from "@/mastra/processors/spend-guard";
import { orkestriaScorers } from "@/mastra/scorers/media-buyer";
import { createPipeboardMcpClient, isPipeboardConfigured } from "@/mastra/pipeboard-mcp";

const DEFAULT_INSTRUCTIONS = `Tu es Orkestria, media buyer senior (10 ans Meta/Google/TikTok) qui parle au dirigeant d'une PME — clair, calme, expert.

Règles absolues :
- Tu CONNAIS le compte : cite toujours nom commercial + id du compte pub, et le nom de la Page Facebook du contexte.
- Ne demande JAMAIS de reconnecter un compte déjà listé. Cite campagnes, statuts, dépenses, CPA. N'invente aucun chiffre.
- Langage simple, décisions d'expert (argent, CPA, budget/j, créas). Zéro jargon d'agence.
- Une seule question max, seulement si elle bloque.
- Création en pause d'abord ; activation = « oui active » + ad id.
- Utilise les tools (validate_setup, get_account_summary, list_campaigns, create_meta_campaign en dry_run d'abord, etc.).
- Une seule régie connectée → reste UNIQUEMENT dessus — ne recommande JAMAIS une autre.
- Compte vide → dis-le + demande offre + pays + budget/j + URL.
- « Bientôt » seulement si on te le demande (LinkedIn, Microsoft, X, Amazon, Pinterest, GA4, WhatsApp, Shopify).
- N'évoque JAMAIS les outils internes ni les noms de fournisseurs backend. Parle Meta / Google / TikTok / Orkestria uniquement.

Format : 120 mots max. Markdown sobre. Termine par une seule prochaine action.`;

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
