import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import type { AuditSummary } from "@/lib/unified-ad-schema";
import { isLlmConfigured, llmChatCompletion } from "@/lib/llm/client";
import { buildOrgContext } from "@/lib/mcp/org-context";
import { buildMergedSkillPrompt } from "@/lib/mcp/skill-router";
import type { OrchestratorTurn } from "@/lib/agent/types";

export function serializeAuditData(summary: AuditSummary): string {
  const t = summary.totals;
  const lines: string[] = [
    `Totaux (${summary.accounts.length} plateforme(s)) : dépense ${Math.round(t.spend)} ${t.currency}, ` +
      `${t.conversions} conversion(s), CPA ${t.cpa ? Math.round(t.cpa) : "n/d"}, ROAS ${t.roas ? t.roas.toFixed(2) : "n/d"}.`,
  ];
  for (const a of summary.accounts) {
    lines.push(
      `\n${a.platform} — « ${a.accountName || a.accountId} » (id ${a.accountId}) : ${Math.round(a.spend)} ${a.currency}, ` +
        `${a.conversions} conv, CPA ${a.cpa ? Math.round(a.cpa) : "n/d"}, ROAS ${a.roas ? a.roas.toFixed(2) : "n/d"}.`,
    );
    const camps = [...a.campaigns].sort((x, y) => y.spend - x.spend).slice(0, 8);
    for (const c of camps) {
      lines.push(
        `  • ${c.name} [${c.status}] — ${Math.round(c.spend)} ${c.currency}, ` +
          `${c.impressions} impr, ${c.clicks} clics, CTR ${c.ctr.toFixed(2)}%, ` +
          `${c.conversions} conv, CPA ${c.cpa ? Math.round(c.cpa) : "n/d"}.`,
      );
    }
    if (!camps.length) lines.push("  (aucune campagne listée sur ce compte)");
    if (a.issues.length) lines.push(`  Signaux : ${a.issues.slice(0, 4).join(" ; ")}.`);
  }
  lines.push(
    "CONSIGNE RÉDACTION : cite nommément chaque compte (nom + id) présent ci-dessus. Ne mentionne que ces plateformes. N'invente pas d'autres régies.",
  );
  return lines.join("\n");
}

export function formatAuditReply(summary: AuditSummary): string {
  if (!summary.accounts.length) {
    return "Aucun compte publicitaire connecté. Allez dans **Connexions** pour relier votre régie via OAuth.";
  }
  const acc = summary.accounts[0]!;
  const header = `Sur **${acc.accountName || acc.accountId}** (${acc.accountId}) — ${acc.period || "période"} :`;
  const problems =
    summary.problems.length > 0
      ? summary.problems.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "Aucun problème critique détecté sur la période.";
  const opps =
    summary.opportunities.length > 0
      ? summary.opportunities.map((o, i) => `${i + 1}. ${o}`).join("\n")
      : "Continuez à monitorer les performances.";
  return (
    `${header}\n${summary.situation}\n\n` +
    `**Problèmes à corriger :**\n${problems}\n\n` +
    `**Opportunités :**\n${opps}\n\n` +
    `**Première action recommandée :**\n${summary.firstAction}`
  );
}

export async function composeAuditReply(opts: {
  orgId: string;
  message: string;
  intent: "audit" | "report";
  summary: AuditSummary;
  history?: OrchestratorTurn[];
}): Promise<string> {
  const { orgId, message, intent, summary } = opts;
  if (!summary.accounts.length) {
    return "Aucun compte publicitaire connecté. Allez dans **Connexions** pour relier votre régie via OAuth.";
  }
  if (!isLlmConfigured()) return formatAuditReply(summary);

  try {
    const conns = await db
      .select()
      .from(connections)
      .where(eq(connections.organizationId, orgId));
    const connectedConnectors = conns
      .filter((c) => c.status === "connectée")
      .map((c) => c.connector);
    const { mediaSkill, promptBlock: mergedSkills } = buildMergedSkillPrompt(`${message} audit performance analyse`, connectedConnectors);

    const { loadOrchestratorPrompt } = await import("@/lib/mcp/orchestrator");
    const [prompt, orgContext] = await Promise.all([
      loadOrchestratorPrompt(),
      buildOrgContext(orgId, message),
    ]);

    const skillBlock = mergedSkills ? `\n\n${mergedSkills}` : "";

    const auditData = serializeAuditData(summary);

    const system =
      `${prompt}\n\n` +
      `--- Contexte du compte (source de vérité) ---\n${orgContext}\n\n` +
      `--- Données d'audit réelles (${intent === "report" ? "rapport" : "audit"}) ---\n${auditData}${skillBlock}\n\n` +
      `Règles de réponse (strictes) :\n` +
      `- Ouvre en citant le compte (nom + id) et la Page Facebook du contexte — le dirigeant doit sentir que tu le connais.\n` +
      `- Parle simple et expert media buyer (argent, CPA, budget). Pas de jargon d'agence.\n` +
      `- Cite les campagnes réelles. N'invente aucun chiffre.\n` +
      `- Reste UNIQUEMENT sur les plateformes présentes dans les données d'audit. Si une seule régie (ex. Meta), ne parle PAS de Google/TikTok/Snap/Reddit.\n` +
      `- Si dépense = 0 et 0 campagne : « compte vide ». Propose les objectifs Meta : Ventes, Prospects, Trafic, Messages (WhatsApp ou Messenger). Shopify / WhatsApp Business API (envoi) = bientôt.\n` +
      `- Une seule prochaine action, concrète, liée à CE compte.\n` +
      `- Max 120 mots. Interdit : listes multi-plateformes, « diversifiez », « connectez aussi… ».\n` +
      `Structure :\n` +
      `1) 2–3 phrases de synthèse avec nom du compte / page (sans titre)\n` +
      `2) **Problèmes à corriger :** 1–3 points max\n` +
      `3) **Première action recommandée :** une phrase (demande les infos manquantes si besoin : offre, pays, budget/j, URL)`;

    const history = (opts.history ?? []).slice(-6).map((turn) => ({
      role: turn.role === "user" ? ("user" as const) : ("assistant" as const),
      content: turn.text,
    }));

    const res = await llmChatCompletion({
      messages: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: message },
      ],
      maxTokens: 700,
    });
    return res?.trim() ? res : formatAuditReply(summary);
  } catch {
    return formatAuditReply(summary);
  }
}
