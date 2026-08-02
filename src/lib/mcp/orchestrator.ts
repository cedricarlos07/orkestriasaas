import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections, orchestratorPrompts, skills } from "@/db/schema/index";
import { runMultichannelAudit } from "@/lib/mcp/audit-runner";
import { readPlatformSnapshot } from "@/lib/mcp/read-platform";
import { routeResearch } from "@/lib/mcp/execution-router";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";
import { detectIntent, extractPeriod, extractBrandFromMessage } from "@/lib/agent/intent";
import { handleBoostIntent } from "@/lib/agent/handlers/boost";
import { handleCampaignIntent } from "@/lib/agent/handlers/campaign";
import { composeAuditReply } from "@/lib/agent/handlers/audit";
import type { OrchestratorInput, OrchestratorOutput } from "@/lib/agent/types";

export type { OrchestratorTurn, OrchestratorInput, OrchestratorOutput } from "@/lib/agent/types";

const DEFAULT_SYSTEM_PROMPT = `Tu es Orkestria, media buyer senior qui parle au dirigeant d'une PME — clair, calme, expert.

Règles absolues :
- Tu CONNAIS le compte : cite toujours le nom commercial + l'id du compte pub, et le nom de la Page Facebook (ex. « Boutique X » (act_123) · Page « Boutique X »).
- Ne demande JAMAIS de reconnecter un compte déjà listé. Cite campagnes, statuts, dépenses, CPA du contexte. Si une donnée manque, dis-le — n'invente aucun chiffre.
- Langage simple (dirigeant PME), décisions d'expert media buyer (argent, CPA, budget/j, créas). Zéro jargon d'agence.
- Une seule question max, seulement si elle bloque la suite.
- Création toujours en pause d'abord ; activation = validation explicite.
- Avant lancement : estime l'audience (pays) si le brief le permet ; structure brief → pause → confirmation → activation.
- Une seule régie connectée → reste UNIQUEMENT dessus. Ne recommande JAMAIS une autre plateforme.
- Compte vide (0 campagne / 0 dépense) → dis-le clairement. Objectifs Meta AUTORISÉS : **Ventes**, **Prospects (leads)**, **Trafic**, **Messages (WhatsApp ou Messenger)**. Shopify et WhatsApp Business API (envoi auto) = bientôt — ce n'est PAS la même chose que les pubs Messages Meta.
- Si on demande WhatsApp / Messenger / Messages Ads : briefe pays + budget/j + canal (WhatsApp ou Messenger), puis création en pause. Ne dis JAMAIS que WhatsApp ou Messenger Ads n'existent pas.
- « Bientôt » (LinkedIn, Microsoft, X, Amazon, Pinterest, GA4, Shopify, WhatsApp Business API) : une phrase max, seulement si on te le demande — ne les liste jamais comme options de lancement Meta Ads.
- N'évoque JAMAIS les outils internes (fournisseurs MCP, tokens serveur, noms techniques backend). Parle uniquement en termes Meta / Google / TikTok / Orkestria.

Format : 120 mots max. Markdown sobre. Termine par une seule prochaine action.`;

export async function loadOrchestratorPrompt(): Promise<string> {
  const rows = await db
    .select()
    .from(orchestratorPrompts)
    .where(eq(orchestratorPrompts.key, "default"))
    .limit(1);
  const stored = rows[0]?.content?.trim();
  // Legacy one-line seeds are too thin to steer the model — prefer the built-in prompt.
  if (stored && stored.length > 200) return stored;
  return DEFAULT_SYSTEM_PROMPT;
}

const LIVE_READ_CONNECTORS: ConnectorId[] = [
  "meta_ads",
  "google_ads",
  "tiktok_ads",
  "snapchat_ads",
  "reddit_ads",
  "ga4",
];

/** Load live account snapshots for every connected ad platform. */
export async function loadLiveAccountData(orgId: string): Promise<{ results: string[]; toolsUsed: string[] }> {
  const conns = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, orgId))
    .then((rows) =>
      rows.filter(
        (c) => c.status === "connectée" && LIVE_READ_CONNECTORS.includes(c.connector as ConnectorId),
      ),
    );

  const results: string[] = [];
  const toolsUsed: string[] = [];

  for (const conn of conns.slice(0, 4)) {
    try {
      const { snapshot } = await readPlatformSnapshot({
        orgId,
        connectionId: conn.id,
        connector: conn.connector as ConnectorId,
      });
      const label = CONNECTORS[conn.connector as ConnectorId]?.label ?? conn.connector;
      toolsUsed.push(`live:${conn.connector}`);
      const top = [...snapshot.campaigns].sort((a, b) => b.spend - a.spend).slice(0, 8);
      const campLines = top.length
        ? top
            .map(
              (c) =>
                `  • ${c.name} [${c.status}] — ${Math.round(c.spend)} ${c.currency}, ${c.impressions} impr, ${c.clicks} clics, ${c.conversions} conv`,
            )
            .join("\n")
        : "  (aucune campagne listée)";
      results.push(
        `${label} — compte ${snapshot.accountName || "n/d"} (id ${snapshot.accountId}) — dépense ${Math.round(snapshot.spend)} ${snapshot.currency}, ${snapshot.conversions} conv, ${snapshot.campaigns.length} campagne(s):\n${campLines}` +
          (snapshot.issues.length ? `\n  Signaux: ${snapshot.issues.slice(0, 3).join(" ; ")}` : ""),
      );
    } catch (e) {
      const label = CONNECTORS[conn.connector as ConnectorId]?.label ?? conn.connector;
      results.push(`${label} : lecture impossible — ${e instanceof Error ? e.message : "erreur"}`);
      toolsUsed.push(`live:${conn.connector}:error`);
    }
  }

  return { results, toolsUsed };
}

export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const intent = detectIntent(input.message);

  // Deterministic paths first — chat suggestions / guided form must be reliable.
  if (intent === "setup") {
    const { getStackSetupStatus } = await import("@/lib/mcp/setup-status");
    const stack = await getStackSetupStatus(input.orgId);
    const stackLabel = stack.readyForMeta
      ? "OK"
      : stack.meta.oauthConnected
        ? "à vérifier"
        : "non prêt";
    const googleLabel = stack.readyForGoogle
      ? `compte client lié${stack.google.customerId ? ` (${stack.google.customerId})` : ""}`
      : stack.google.oauthConnected
        ? "OAuth OK — choisissez un compte client"
        : "non connecté";
    const researchLabel =
      stack.research.adsLibraryHealth === "ok"
        ? "Meta Ad Library OK"
        : stack.research.adsLibraryConfigured
          ? "Meta Ad Library à vérifier"
          : "non configurée";
    const accLabel =
      stack.meta.accountName && stack.meta.account
        ? `« ${stack.meta.accountName} » (${stack.meta.account})`
        : stack.meta.account
          ? stack.meta.account
          : "non lié";
    const pageLabel =
      stack.meta.pageName && stack.meta.pageId
        ? `« ${stack.meta.pageName} » (${stack.meta.pageId})`
        : stack.meta.pageId
          ? stack.meta.pageId
          : "manquante";
    const lines = [
      `**Meta :** ${stack.meta.oauthConnected ? `connecté — ${accLabel}` : "à connecter"}`,
      `**Page Facebook :** ${pageLabel}`,
      `**Stack pubs (Meta/Google/TikTok/Snap/Reddit) :** ${stackLabel}`,
      `**Google Ads :** ${googleLabel}`,
      `**Recherche concurrents :** ${researchLabel}`,
      `**Mémoire agent :** ${stack.memory.mastraConfigured ? "OK" : "à configurer"}`,
      "",
      stack.readyForMeta || stack.readyForCampaign
        ? "Prêt pour lancer des campagnes Meta (création en pause → activation explicite)."
        : `Étapes restantes :\n${stack.missingSteps.map((s) => `• ${s}`).join("\n")}`,
      "",
      "→ Connexions : /app/connections",
    ];
    return { reply: lines.join("\n"), toolsUsed: ["validate_setup"], runId: input.runId };
  }

  if (intent === "research") {
    const brand = extractBrandFromMessage(input.message) ?? "Nike";
    try {
      const data = await routeResearch(input.orgId, { brand });
      return {
        reply: `Voici ce que j'ai trouvé sur **${brand}** dans la Meta Ad Library :\n\n${JSON.stringify(data, null, 2).slice(0, 2000)}\n\n**Prochaines étapes :** décrivez votre brief (objectif, budget, audience) → création Meta en pause → votre validation → activation explicite.`,
        toolsUsed: ["research_competitor_ads"],
        runId: input.runId,
      };
    } catch (e) {
      return {
        reply: `Recherche concurrentielle indisponible pour le moment : ${e instanceof Error ? e.message : "erreur"}. Vous pouvez continuer sans cette étape — décrivez directement votre brief campagne.`,
        toolsUsed: [],
        runId: input.runId,
      };
    }
  }

  if (intent === "campaign") {
    return handleCampaignIntent(input);
  }

  if (intent === "boost") {
    return handleBoostIntent(input);
  }

  if (intent === "audit" || intent === "report") {
    const { runId, summary } = await runMultichannelAudit({
      orgId: input.orgId,
      userId: input.userId,
      runId: input.runId,
      period: extractPeriod(input.message),
    });
    const reply = await composeAuditReply({
      orgId: input.orgId,
      message: input.message,
      intent,
      summary,
      history: input.history,
    });
    return {
      reply,
      toolsUsed: ["audit", "live_snapshots"],
      auditSummary: summary,
      runId,
    };
  }

  // Open conversation → Mastra only (memory + policy tools)
  const { runMastraOrchestrator } = await import("@/lib/mastra/run-chat");
  return runMastraOrchestrator(input);
}

export async function seedOrchestratorDefaults() {
  const sk = await db.select().from(skills).limit(1);
  if (!sk.length) {
    await db.insert(skills).values([
      {
        id: "skill_analysis",
        key: "analysis",
        name: "Analyse",
        description: "Audit et diagnostic",
        config: { allowedTools: ["meta.read", "google.read", "ga4.read"] },
        active: true,
      },
      {
        id: "skill_strategy",
        key: "strategy",
        name: "Stratégie",
        description: "Plan multicanal",
        config: { allowedTools: ["policy.check"] },
        active: true,
      },
    ]);
  }
  const pr = await db
    .select()
    .from(orchestratorPrompts)
    .where(eq(orchestratorPrompts.key, "default"))
    .limit(1);
  if (!pr.length) {
    await db.insert(orchestratorPrompts).values({
      id: "orch_default",
      key: "default",
      content: DEFAULT_SYSTEM_PROMPT,
      version: 2,
      updatedAt: new Date(),
    });
  }
}
