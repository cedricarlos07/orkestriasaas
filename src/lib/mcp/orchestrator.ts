import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections, orchestratorPrompts, skills } from "@/db/schema/index";
import { toolsForSkill, type ToolDefinition } from "@/lib/mcp/tool-registry";
import type { AuditSummary } from "@/lib/unified-ad-schema";
import { runMultichannelAudit } from "@/lib/mcp/audit-runner";
import { readPlatformSnapshot } from "@/lib/mcp/read-platform";
import { routeResearch } from "@/lib/mcp/execution-router";
import { requireOpenAiKey } from "@/lib/platforms/config";
import { llmChatCompletion } from "@/lib/llm/client";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";

export type OrchestratorInput = {
  orgId: string;
  userId: string;
  message: string;
  skill?: string;
  runId?: string;
};

export type OrchestratorOutput = {
  reply: string;
  toolsUsed: string[];
  auditSummary?: AuditSummary;
  runId?: string;
};

function detectIntent(message: string): "audit" | "report" | "campaign" | "research" | "setup" | "general" {
  const t = message.toLowerCase();
  if (/config|configuration|setup|validate|vérifier|verifier|prêt|pret/.test(t)) return "setup";
  if (/concurrent|competitor|ad library|spy|espion|benchmark/.test(t)) return "research";
  if (/audit|analys|diagnostic|bilan|problème/.test(t)) return "audit";
  if (/rapport|report|performance|résultat/.test(t)) return "report";
  if (/campagne|lancer|créer|budget|commande|vente/.test(t)) return "campaign";
  return "general";
}

export async function loadOrchestratorPrompt(): Promise<string> {
  const rows = await db
    .select()
    .from(orchestratorPrompts)
    .where(eq(orchestratorPrompts.key, "default"))
    .limit(1);
  if (rows[0]?.content) return rows[0].content;
  return "Tu es Orkestria. Réponds en langage commercial simple. Utilise les outils MCP pour lire les données réelles avant de recommander.";
}

async function executeReadTools(
  orgId: string,
  tools: ToolDefinition[],
  runId?: string,
): Promise<{ results: string[]; toolsUsed: string[] }> {
  const conns = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, orgId))
    .then((rows) => rows.filter((c) => c.status === "connectée"));

  const results: string[] = [];
  const toolsUsed: string[] = [];

  for (const tool of tools) {
    const connector = Object.values(CONNECTORS).find((c) => c.mcpServer === tool.server)?.id;
    const conn = conns.find((c) => c.connector === connector);
    if (!conn) continue;

    const { snapshot } = await readPlatformSnapshot({
      orgId,
      connectionId: conn.id,
      connector: connector as ConnectorId,
    });
    toolsUsed.push(tool.name);
    results.push(`${tool.label}: ${JSON.stringify(snapshot).slice(0, 800)}`);
    void runId;
  }

  return { results, toolsUsed };
}

function extractBrandFromMessage(message: string): string | null {
  const quoted = message.match(/["«]([^"»]+)["»]/);
  if (quoted?.[1]) return quoted[1].trim();
  const m = message.match(/(?:concurrent|marque|brand)\s+(\w[\w\s-]{1,40})/i);
  return m?.[1]?.trim() ?? null;
}

export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const intent = detectIntent(input.message);
  const skill =
    input.skill ??
    (intent === "audit" || intent === "report"
      ? "analysis"
      : intent === "campaign"
        ? "strategy"
        : "analysis");
  const tools = toolsForSkill(skill);

  if (intent === "setup") {
    const { getStackSetupStatus } = await import("@/lib/mcp/setup-status");
    const stack = await getStackSetupStatus(input.orgId);
    const lines = [
      `**Meta OAuth :** ${stack.meta.oauthConnected ? "OK" : "manquant"}`,
      `**Page Facebook :** ${stack.meta.pageId ?? "manquante"}`,
      `**adkit :** ${stack.meta.adkitVerify}${stack.meta.adkitError ? ` (${stack.meta.adkitError})` : ""}`,
      `**AdLoop Google :** ${stack.google.adloopHealth}${stack.google.adloopError ? ` (${stack.google.adloopError})` : ""}${stack.google.oauthConnected ? " · OAuth lié" : ""}`,
      `**Research useproxy :** ${stack.research.useproxyConfigured ? stack.research.useproxyHealth : "clé serveur manquante"}`,
      "",
      stack.readyForCampaign
        ? "Prêt pour lancer des campagnes Meta (dry-run → PAUSED → activation)."
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
        reply: `Voici ce que j'ai trouvé sur **${brand}** dans la Meta Ad Library :\n\n${JSON.stringify(data, null, 2).slice(0, 2000)}\n\n**Prochaines étapes :** décrivez votre brief (objectif, budget, audience) → je lance un dry-run adkit (PAUSED) → vous confirmez → activation explicite.`,
        toolsUsed: ["research_competitor_ads"],
        runId: input.runId,
      };
    } catch (e) {
      return {
        reply: `Recherche concurrentielle indisponible : ${e instanceof Error ? e.message : "erreur"}. La clé useproxy doit être configurée côté serveur (URL : mcp.useproxy.dev). Contactez l'admin ou continuez sans research.`,
        toolsUsed: [],
        runId: input.runId,
      };
    }
  }

  if (intent === "campaign") {
    const { getStackSetupStatus } = await import("@/lib/mcp/setup-status");
    const stack = await getStackSetupStatus(input.orgId);
    if (!stack.readyForCampaign) {
      const steps = stack.missingSteps.length
        ? stack.missingSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")
        : "1. Connecter Meta\n2. Enregistrer Page Facebook ID\n3. Vérifier adkit";
      return {
        reply: `Avant de lancer une campagne, complétez la configuration V1 :\n\n${steps}\n\n→ **Connexions** : /app/connections\n\nUne fois prêt, le flux sera : research concurrents (optionnel) → brief Meta en dry-run (adkit, tout PAUSED) → votre validation → activation explicite (dépense).`,
        toolsUsed: ["validate_setup"],
        runId: input.runId,
      };
    }
    return {
      reply:
        "Configuration OK. Décrivez votre campagne Meta : objectif (trafic/leads), budget journalier, pays cibles, message et headline. Je commencerai par un **dry-run adkit** (rien ne dépense) avant toute création réelle.",
      toolsUsed: [],
      runId: input.runId,
    };
  }

  if (intent === "audit" || intent === "report") {
    const { runId, summary } = await runMultichannelAudit({
      orgId: input.orgId,
      userId: input.userId,
      runId: input.runId,
    });
    return {
      reply: formatAuditReply(summary),
      toolsUsed: tools.map((t) => t.name),
      auditSummary: summary,
      runId,
    };
  }

  requireOpenAiKey();
  const prompt = await loadOrchestratorPrompt();
  const { results, toolsUsed } = await executeReadTools(input.orgId, tools.slice(0, 4), input.runId);

  const toolContext =
    results.length > 0
      ? `\n\nDonnées live des plateformes connectées :\n${results.join("\n\n")}`
      : "\n\nAucune connexion active — demandez à l'utilisateur de connecter ses comptes.";

  const res = await llmChatCompletion({
    messages: [
      { role: "system", content: prompt + toolContext },
      { role: "user", content: input.message },
    ],
    maxTokens: 800,
  });

  return { reply: res, toolsUsed, runId: input.runId };
}

function formatAuditReply(summary: AuditSummary): string {
  if (!summary.accounts.length) {
    return "Aucun compte publicitaire connecté. Allez dans **Connexions** pour relier Meta, Google Ads, TikTok ou GA4 via OAuth.";
  }
  const problems =
    summary.problems.length > 0
      ? summary.problems.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "Aucun problème critique détecté sur la période.";
  const opps =
    summary.opportunities.length > 0
      ? summary.opportunities.map((o, i) => `${i + 1}. ${o}`).join("\n")
      : "Continuez à monitorer les performances.";
  return `${summary.situation}\n\n**Problèmes à corriger :**\n${problems}\n\n**Opportunités :**\n${opps}\n\n**Première action recommandée :** ${summary.firstAction}`;
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
  const pr = await db.select().from(orchestratorPrompts).where(eq(orchestratorPrompts.key, "default")).limit(1);
  if (!pr.length) {
    await db.insert(orchestratorPrompts).values({
      id: "orch_default",
      key: "default",
      content:
        "Tu es Orkestria. Un seul agent visible. Langage commercial. Base tes réponses uniquement sur les données MCP fournies. Research concurrents d'abord (Ad Library) avant de créer des campagnes.",
      version: 1,
      updatedAt: new Date(),
    });
  }
}
