import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections, orchestratorPrompts, skills } from "@/db/schema/index";
import { invokeMCP } from "@/lib/mcp/gateway";
import { toolsForSkill, type ToolDefinition } from "@/lib/mcp/tool-registry";
import type { AuditSummary } from "@/lib/unified-ad-schema";
import { runMultichannelAudit } from "@/lib/mcp/audit-runner";
import { requireOpenAiKey } from "@/lib/platforms/config";
import { CONNECTORS } from "@/lib/oauth/connectors";

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

function detectIntent(message: string): "audit" | "report" | "campaign" | "general" {
  const t = message.toLowerCase();
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

    const { result } = await invokeMCP({
      server: tool.server,
      tool: tool.name,
      orgId,
      connectionId: conn.id,
      mode: "read",
      runId,
    });
    toolsUsed.push(tool.name);
    results.push(`${tool.label}: ${JSON.stringify(result).slice(0, 800)}`);
  }

  return { results, toolsUsed };
}

export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const intent = detectIntent(input.message);
  const skill =
    input.skill ??
    (intent === "audit" || intent === "report" ? "analysis" : intent === "campaign" ? "strategy" : "analysis");
  const tools = toolsForSkill(skill);

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

  const apiKey = requireOpenAiKey();
  const prompt = await loadOrchestratorPrompt();
  const { results, toolsUsed } = await executeReadTools(input.orgId, tools.slice(0, 4), input.runId);

  const toolContext =
    results.length > 0
      ? `\n\nDonnées live des plateformes connectées :\n${results.join("\n\n")}`
      : "\n\nAucune connexion active — demandez à l'utilisateur de connecter ses comptes.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt + toolContext },
        { role: "user", content: input.message },
      ],
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${await res.text()}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Réponse OpenAI vide");

  return { reply: text, toolsUsed, runId: input.runId };
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
        "Tu es Orkestria. Un seul agent visible. Langage commercial. Base tes réponses uniquement sur les données MCP fournies.",
      version: 1,
      updatedAt: new Date(),
    });
  }
}
