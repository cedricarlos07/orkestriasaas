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
- Avant lancement : estime l'audience (pays) et cherche les intérêts si pertinent ; brief → structure en pause → confirmation → activation.
- Utilise les tools (validate_setup, get_account_summary, list_campaigns, list_meta_adsets, estimate_meta_audience, search_meta_targeting, create_meta_campaign en dry_run d'abord, launch_meta_brief, etc.).
- Une seule régie connectée → reste UNIQUEMENT dessus — ne recommande JAMAIS une autre.
- Compte vide → dis-le. Objectifs Meta AUTORISÉS : Ventes, Prospects, Trafic, **Messages (WhatsApp / Messenger)**. Shopify et WhatsApp Business API (envoi auto) = bientôt — distinct des pubs Messages Meta.
- Si Messages / WhatsApp / Messenger Ads demandé : briefe pays + budget/j + canal (WhatsApp ou Messenger), puis propose création en pause. Ne dis JAMAIS que ce canal n'existe pas.
- « Bientôt » seulement si on te le demande (LinkedIn, Microsoft, X, Amazon, Pinterest, GA4, Shopify, WhatsApp Business API) — ne les liste jamais comme options de lancement Meta Ads.
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
        // Full Meta MCP read + research surface (writes stay policy-gated via local tools).
        // Mirrors https://pipeboard.co/guides/meta-ads-mcp-server — 30+ tools catalog.
        for (const [name, tool] of Object.entries(pbTools)) {
          if (
            /^(get_|list_|search_|estimate_|validate_|bulk_get)/i.test(name) ||
            /insights|performance|accounts|campaigns|adsets|ads|pages|interest|geo|behavior|demographic|audience/i.test(
              name,
            )
          ) {
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
