import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections, orchestratorPrompts, skills } from "@/db/schema/index";
import type { AuditSummary } from "@/lib/unified-ad-schema";
import { runMultichannelAudit } from "@/lib/mcp/audit-runner";
import { readPlatformSnapshot } from "@/lib/mcp/read-platform";
import { routeResearch } from "@/lib/mcp/execution-router";
import { requireOpenAiKey } from "@/lib/platforms/config";
import { llmChatCompletion, isLlmConfigured } from "@/lib/llm/client";
import { buildOrgContext } from "@/lib/mcp/org-context";
import { matchMediaSkill, formatSkillForPrompt } from "@/lib/mcp/skill-router";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";

export type OrchestratorTurn = { role: "user" | "agent"; text: string };

export type OrchestratorInput = {
  orgId: string;
  userId: string;
  message: string;
  skill?: string;
  runId?: string;
  /** Mastra memory thread id (chat thread). */
  threadId?: string;
  /** Previous turns of the thread, oldest first, excluding the current message. */
  history?: OrchestratorTurn[];
  /** Optional image attachments from chat (Pipeboard upload). */
  attachments?: Array<{
    kind: "image";
    dataUrl?: string;
    url?: string;
    name?: string;
  }>;
};

export type OrchestratorOutput = {
  reply: string;
  toolsUsed: string[];
  auditSummary?: AuditSummary;
  runId?: string;
  matchedMediaSkill?: string;
};

function detectIntent(
  message: string,
): "audit" | "report" | "campaign" | "research" | "setup" | "boost" | "general" {
  const t = message.toLowerCase();
  if (/config|configuration|setup|validate|vérifier|verifier|prêt|pret|\bv1\b/.test(t)) return "setup";
  if (/concurrent|competitor|ad library|spy|espion|benchmark/.test(t)) return "research";
  if (
    /boost|sponsoris|promouvoir\s+(le\s+|un\s+|ce\s+)?post|post\s+(à\s+)?(booster|sponsoriser)|utiliser\s+(un\s+)?post/.test(
      t,
    )
  ) {
    return "boost";
  }
  // Rapport before audit — "rapport ... 30 jours" must stay a report
  if (/rapport|report|hebdo|dirigeant/.test(t)) return "report";
  if (/audit|analys|diagnostic|bilan|problème|performance|résultat/.test(t)) return "audit";
  if (
    /campagne|lancer\s+(une\s+)?(pub|campagne)|créer\s+(une\s+)?(pub|campagne)|launch|activer\s+la\s+campagne|lancement de campagne|nouveau menu/.test(
      t,
    )
  ) {
    return "campaign";
  }
  return "general";
}

function extractPeriod(message: string): string {
  const t = message.toLowerCase();
  if (/7\s*jours|cette semaine|semaine dernière/.test(t)) return "7 derniers jours";
  if (/90\s*jours|3\s*mois/.test(t)) return "90 derniers jours";
  if (/mois en cours|ce mois|30\s*jours/.test(t)) return "30 derniers jours";
  if (/semaine/.test(t)) return "7 derniers jours";
  return "30 derniers jours";
}

const DEFAULT_SYSTEM_PROMPT = `Tu es Orkestria, media buyer senior qui parle au dirigeant d'une PME — clair, calme, expert.

Règles absolues :
- Tu CONNAIS le compte : cite toujours le nom commercial + l'id du compte pub, et le nom de la Page Facebook (ex. « Boutique X » (act_123) · Page « Boutique X »).
- Ne demande JAMAIS de reconnecter un compte déjà listé. Cite campagnes, statuts, dépenses, CPA du contexte. Si une donnée manque, dis-le — n'invente aucun chiffre.
- Langage simple (dirigeant PME), décisions d'expert media buyer (argent, CPA, budget/j, créas). Zéro jargon d'agence.
- Une seule question max, seulement si elle bloque la suite.
- Création toujours en pause d'abord ; activation = validation explicite.
- Une seule régie connectée → reste UNIQUEMENT dessus. Ne recommande JAMAIS une autre plateforme.
- Compte vide (0 campagne / 0 dépense) → dis-le clairement + demande offre + pays + budget/j + URL.
- « Bientôt » (LinkedIn, Microsoft, X, Amazon, Pinterest, GA4, WhatsApp, Shopify) : une phrase max, seulement si on te le demande.
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
async function loadLiveAccountData(orgId: string): Promise<{ results: string[]; toolsUsed: string[] }> {
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

function extractBrandFromMessage(message: string): string | null {
  const quoted = message.match(/["«]([^"»]+)["»]/);
  if (quoted?.[1]) return quoted[1].trim();
  const m = message.match(/(?:concurrent|marque|brand)\s+(\w[\w\s-]{1,40})/i);
  return m?.[1]?.trim() ?? null;
}

type CampaignBrief = {
  name?: string;
  objective?: "traffic" | "leads" | "sales";
  dailyBudget?: number;
  countries?: string[];
  linkUrl?: string;
  confirmCreate?: boolean;
  confirmActivate?: boolean;
};

function parseCampaignBrief(message: string, history?: OrchestratorTurn[]): CampaignBrief {
  const blob = [...(history ?? []).map((h) => h.text), message].join("\n");
  const lower = blob.toLowerCase();
  const brief: CampaignBrief = {};

  const budget =
    blob.match(/(\d+[.,]?\d*)\s*(?:€|eur|usd|\$)?\s*(?:\/\s*j(?:our)?|par\s*jour|daily)/i) ||
    blob.match(/budget\s*(?:journalier|daily)?\s*[:=]?\s*(\d+[.,]?\d*)/i);
  if (budget?.[1]) brief.dailyBudget = Number(budget[1].replace(",", "."));

  if (/lead|prospect|formulaire/.test(lower)) brief.objective = "leads";
  else if (/achat|vente|purchase|conversion|catalogue/.test(lower)) brief.objective = "sales";
  else if (/trafic|traffic|visite|clics?/.test(lower)) brief.objective = "traffic";

  const countries: string[] = [];
  if (/\b(france|français|fr)\b/i.test(blob)) countries.push("FR");
  if (/\b(belgique|be)\b/i.test(blob)) countries.push("BE");
  if (/\b(suisse|ch)\b/i.test(blob)) countries.push("CH");
  if (/\b(canada|ca)\b/i.test(blob)) countries.push("CA");
  if (/\b(usa|états-unis|etats-unis|us)\b/i.test(blob)) countries.push("US");
  if (countries.length) brief.countries = [...new Set(countries)];

  const url = blob.match(/https?:\/\/[^\s)>\]]+/i);
  if (url?.[0]) brief.linkUrl = url[0].replace(/[.,;]+$/, "");

  const name = blob.match(/(?:campagne|campaign)\s+[«"]([^»"]+)[»"]/i);
  if (name?.[1]) brief.name = name[1].trim();

  brief.confirmCreate =
    /oui[,.]?\s*(crée|creer|crée[- ]la|lance|valide)|confirme\s+la\s+cr[eé]ation|crée\s+en\s+pause|go\s+pause/i.test(
      message,
    );
  brief.confirmActivate =
    /oui[,.]?\s*active|active\s+(la\s+)?campagne|confirme\s+l['']activation|go\s+live|mets?\s+en\s+ligne/i.test(
      message,
    );

  return brief;
}

async function handleBoostIntent(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const toolsUsed: string[] = ["boost_post"];
  try {
    const {
      listOrgPagePosts,
      boostOrgPagePost,
      extractObjectStoryIdWithPage,
      resolveOrgMetaIds,
    } = await import("@/lib/mcp/meta-creatives");
    const { pageId } = await resolveOrgMetaIds(input.orgId);
    const brief = parseCampaignBrief(input.message, input.history);

    let objectStoryId = extractObjectStoryIdWithPage(input.message, pageId);
    // "booster #3" / "post 3" against last listed posts in history
    if (!objectStoryId) {
      const idx =
        input.message.match(/(?:post|n[°o]?|#)\s*(\d{1,2})\b/i)?.[1] ||
        input.message.match(/\b(\d{1,2})\s*$/)?.[1];
      if (idx) {
        const posts = await listOrgPagePosts(input.orgId, 12);
        toolsUsed.push("list_page_posts");
        const n = Number(idx);
        const pick = posts[n - 1];
        if (pick) objectStoryId = pick.objectStoryId;
      }
    }

    const confirm =
      /oui[,.]?\s*(boost|sponsoris|crée|creer|lance|valide)|confirme\s+le\s+boost|go\s+boost|crée\s+en\s+pause/i.test(
        input.message,
      );

    if (objectStoryId && (confirm || (brief.dailyBudget && brief.dailyBudget > 0 && brief.confirmCreate))) {
      const budget = brief.dailyBudget && brief.dailyBudget > 0 ? brief.dailyBudget : 10;
      const result = await boostOrgPagePost(input.orgId, {
        objectStoryId,
        dailyBudget: budget,
        countries: brief.countries ?? ["FR"],
        name: brief.name ?? `Boost — ${objectStoryId.split("_").pop()}`,
      });
      toolsUsed.push("boost_post");
      return {
        reply:
          `Boost du post **${objectStoryId}** créé en **pause**.\n\n` +
          `• Budget : **${budget} / jour**\n` +
          `• Campagne : \`${String((result as { campaignId?: string }).campaignId ?? "")}\`\n` +
          `• Ad : \`${String((result as { adId?: string }).adId ?? "—")}\`\n\n` +
          `Aucune dépense tant que vous n'activez pas. Dites **« oui active »** + ad id pour lancer.`,
        toolsUsed,
        runId: input.runId,
      };
    }

    const posts = await listOrgPagePosts(input.orgId, 8);
    toolsUsed.push("list_page_posts");
    if (!posts.length) {
      return {
        reply:
          "Aucun post récent trouvé sur votre Page Facebook. Publiez d'abord un post, ou joignez une **image** pour une nouvelle créa.",
        toolsUsed,
        runId: input.runId,
      };
    }
    const lines = posts
      .map(
        (p, i) =>
          `${i + 1}. ${p.message.slice(0, 90)}${p.message.length > 90 ? "…" : ""}\n` +
          `   id \`${p.objectStoryId}\`${p.createdTime ? ` · ${p.createdTime.slice(0, 10)}` : ""}`,
      )
      .join("\n");
    return {
      reply:
        `Voici les derniers posts de votre Page — choisissez lequel sponsoriser :\n\n${lines}\n\n` +
        `Répondez par ex. : **« booster #1 budget 15/j France oui crée en pause »**\n` +
        `Ou collez un id \`pageId_postId\`.`,
      toolsUsed,
      runId: input.runId,
    };
  } catch (e) {
    return {
      reply: `Boost indisponible : ${e instanceof Error ? e.message : "erreur"}. Vérifiez Meta et votre Page dans Connexions.`,
      toolsUsed,
      runId: input.runId,
    };
  }
}

function chatToolCtx(orgId: string, userId: string) {
  return {
    keyId: "chat",
    organizationId: orgId,
    userId,
    name: "orkestria-chat",
    scopes: ["read", "write"] as ("read" | "write" | "admin")[],
  };
}

async function handleCampaignIntent(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const { getStackSetupStatus } = await import("@/lib/mcp/setup-status");
  const stack = await getStackSetupStatus(input.orgId);
  if (!stack.readyForMeta && !stack.readyForCampaign) {
    const steps = stack.missingSteps.length
      ? stack.missingSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "1. Connecter Meta Ads\n2. Choisir une Page Facebook";
    return {
      reply: `Avant de lancer une campagne Meta, complétez :\n\n${steps}\n\n→ **Connexions** : /app/connections\n\nEnsuite : brief → création en pause → votre validation → activation (dépense).`,
      toolsUsed: ["validate_setup"],
      runId: input.runId,
    };
  }

  const brief = parseCampaignBrief(input.message, input.history);
  const toolsUsed: string[] = ["validate_setup"];
  const { invokeAgentTool } = await import("@/lib/mcp/agent-tools");
  const ctx = chatToolCtx(input.orgId, input.userId);

  const canCreate =
    brief.confirmCreate &&
    typeof brief.dailyBudget === "number" &&
    brief.dailyBudget > 0 &&
    Boolean(brief.countries?.length || brief.objective);

  if (canCreate) {
    try {
      const objective =
        brief.objective === "leads"
          ? "OUTCOME_LEADS"
          : brief.objective === "sales"
            ? "OUTCOME_SALES"
            : "OUTCOME_TRAFFIC";
      const name =
        brief.name ??
        `Orkestria — ${brief.objective ?? "trafic"} ${new Date().toISOString().slice(0, 10)}`;
      const outcome = (await invokeAgentTool(ctx, "create_meta_campaign", {
        name,
        dailyBudget: brief.dailyBudget,
        objective,
        countries: brief.countries ?? ["FR"],
        dry_run: false,
        mode: "live",
      })) as {
        status?: string;
        message?: string;
        result?: Record<string, unknown>;
        adSetId?: string;
        campaignId?: string;
      };
      toolsUsed.push("create_meta_campaign");

      if (outcome.status && outcome.status !== "executed" && outcome.status !== "dry_run") {
        return {
          reply:
            `Campagne non créée tout de suite (statut **${outcome.status}**).\n` +
            `${outcome.message ?? ""}\n\n` +
            `Validez l'action dans Approvals si besoin, puis joignez l'image ensuite.`,
          toolsUsed,
          runId: input.runId,
        };
      }

      const result = (outcome.result ?? outcome) as Record<string, unknown>;
      let creativeLine = "";
      const adSetId = String(result.adSetId ?? result.adset_id ?? outcome.adSetId ?? "");
      const imageAtt = (input.attachments ?? []).find((a) => a.kind === "image" && (a.dataUrl || a.url));
      const imageUrlFromMsg = brief.linkUrl?.match(/\.(png|jpe?g|webp|gif)(\?|$)/i)
        ? brief.linkUrl
        : undefined;
      const landing =
        brief.linkUrl && !/\.(png|jpe?g|webp|gif)(\?|$)/i.test(brief.linkUrl)
          ? brief.linkUrl
          : "https://orkestria.top";

      if (adSetId && (imageAtt || imageUrlFromMsg)) {
        try {
          const { attachPausedImageAd } = await import("@/lib/mcp/meta-creatives");
          const ad = await attachPausedImageAd(input.orgId, {
            adSetId,
            name: `${name} — annonce`,
            linkUrl: landing,
            attachment: imageAtt
              ? {
                  kind: "image",
                  dataUrl: imageAtt.dataUrl,
                  url: imageAtt.url,
                  name: imageAtt.name,
                }
              : imageUrlFromMsg
                ? { kind: "image", url: imageUrlFromMsg }
                : undefined,
          });
          toolsUsed.push("upload_ad_image", "create_ad_creative", "create_ad");
          creativeLine =
            `\n• Annonce (pause) : **${ad.adId}** · créa ${ad.creativeId} · hash ${ad.imageHash}\n`;
        } catch (ce) {
          creativeLine =
            `\n• Créa non attachée : ${ce instanceof Error ? ce.message : "erreur"} — campagne OK, ajoutez l'image ensuite.\n`;
        }
      } else if (!imageAtt) {
        creativeLine =
          `\n• Pas d'image jointe — joignez une image au prochain message ou dites **« sponsoriser un post »**.\n`;
      }

      return {
        reply:
          `Campagne Meta créée en **pause** (aucune dépense).\n\n` +
          `• Nom : **${name}**\n` +
          `• Budget : **${brief.dailyBudget} / jour**\n` +
          `• Pays : ${(brief.countries ?? ["FR"]).join(", ")}\n` +
          `• Objectif : ${brief.objective ?? "trafic"}\n` +
          creativeLine +
          `\nProchaine action : vérifiez dans Meta Ads Manager, puis dites **« oui active »** + ad id seulement quand vous voulez dépenser.`,
        toolsUsed,
        runId: input.runId,
      };
    } catch (e) {
      return {
        reply: `Je n'ai pas pu créer la campagne : ${e instanceof Error ? e.message : "erreur"}. Reformulez le brief (budget/j, pays, objectif) ou créez via **Campagnes → Nouvelle**.`,
        toolsUsed,
        runId: input.runId,
      };
    }
  }

  if (brief.confirmActivate) {
    return {
      reply:
        "L'activation qui dépense exige l'id de la pub (ad) Meta. Donnez l'**ad id** à activer, ou activez depuis **Campagnes** dans l'app. Je ne lance jamais la dépense sans cet id explicite.",
      toolsUsed,
      runId: input.runId,
    };
  }

  const hasImage = (input.attachments ?? []).some((a) => a.kind === "image" && (a.dataUrl || a.url));
  if (hasImage && !canCreate) {
    return {
      reply:
        `Image bien reçue (elle sera utilisée pour l'annonce Meta à la création).\n\n` +
        `Il me manque encore pour créer en pause :\n` +
        `• budget / jour (ex. 15/j)\n` +
        `• pays (ex. France)\n` +
        `• URL de destination\n` +
        `• puis **« oui crée en pause »**\n\n` +
        `Sinon : **« sponsoriser un post »** pour booster un post déjà publié sur votre Page.`,
      toolsUsed: [...toolsUsed, "attachment:image"],
      runId: input.runId,
    };
  }

  let dryRunBlock = "";
  if (
    typeof brief.dailyBudget === "number" &&
    brief.dailyBudget > 0 &&
    Boolean(brief.countries?.length || brief.objective)
  ) {
    try {
      const objective =
        brief.objective === "leads"
          ? "OUTCOME_LEADS"
          : brief.objective === "sales"
            ? "OUTCOME_SALES"
            : "OUTCOME_TRAFFIC";
      const name =
        brief.name ??
        `Orkestria — ${brief.objective ?? "trafic"} ${new Date().toISOString().slice(0, 10)}`;
      const preview = await invokeAgentTool(ctx, "create_meta_campaign", {
        name,
        dailyBudget: brief.dailyBudget,
        objective,
        countries: brief.countries ?? ["FR"],
        dry_run: true,
      });
      toolsUsed.push("create_meta_campaign:dry_run");
      dryRunBlock =
        `\n\n--- Aperçu création (dry_run, rien créé) ---\n` +
        `Nom: ${name} | Budget/j: ${brief.dailyBudget} | Pays: ${(brief.countries ?? ["FR"]).join(",")} | Objectif: ${brief.objective ?? "trafic"}\n` +
        `${JSON.stringify(preview).slice(0, 400)}\n` +
        `Si OK, l'utilisateur doit répondre exactement : « oui crée en pause ».`;
    } catch (e) {
      dryRunBlock = `\n\n(Dry-run impossible : ${e instanceof Error ? e.message : "erreur"})`;
    }
  }

  requireOpenAiKey();
  const mediaSkill = matchMediaSkill(`${input.message} launch campaign meta`, ["meta_ads"]);
  const [prompt, orgContext, live] = await Promise.all([
    loadOrchestratorPrompt(),
    buildOrgContext(input.orgId, input.message),
    loadLiveAccountData(input.orgId),
  ]);
  toolsUsed.push(...live.toolsUsed);

  const skillBlock = mediaSkill
    ? `\n\n--- SOP media buying ---\n${formatSkillForPrompt(mediaSkill)}`
    : "";
  const liveData = live.results.length
    ? `\n\nDonnées live du compte :\n${live.results.join("\n\n")}`
    : "";

  const system =
    `${prompt}\n\n--- Contexte du compte (source de vérité) ---\n${orgContext}${liveData}${skillBlock}${dryRunBlock}\n\n` +
    `Tâche : tu es en mode BRIEF CAMPAGNE. Utilise les campagnes déjà présentes pour conseiller (ne pas tout recréer bêtement). ` +
    `Si le brief est incomplet, demande UNE seule info manquante. ` +
    `Si un aperçu dry_run est présent, résume-le clairement et demande confirmation « oui crée en pause ». ` +
    `Ne prétends JAMAIS avoir créé ou activé une campagne si ce n'est pas dans le contexte outil.`;

  const history = (input.history ?? []).slice(-10).map((turn) => ({
    role: turn.role === "user" ? ("user" as const) : ("assistant" as const),
    content: turn.text,
  }));

  const res = await llmChatCompletion({
    messages: [
      { role: "system", content: system },
      ...history,
      { role: "user", content: input.message },
    ],
    maxTokens: 700,
  });

  return {
    reply: res,
    toolsUsed: mediaSkill ? [...toolsUsed, `media_skill:${mediaSkill.id}`] : toolsUsed,
    runId: input.runId,
    matchedMediaSkill: mediaSkill?.name,
  };
}

export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const intent = detectIntent(input.message);

  // Deterministic paths first — chat suggestions / guided form must be reliable.
  if (intent === "setup") {
    const { getStackSetupStatus } = await import("@/lib/mcp/setup-status");
    const stack = await getStackSetupStatus(input.orgId);
    const stackLabel =
      stack.meta.pipeboardVerify === "ok"
        ? "OK"
        : stack.meta.pipeboardVerify === "error"
          ? "à vérifier"
          : stack.google.pipeboardConfigured
            ? "en cours"
            : "non prêt";
    const googleLabel = stack.google.oauthConnected
      ? `compte client lié${stack.google.customerId ? ` (${stack.google.customerId})` : ""}`
      : stack.google.pipeboardConfigured
        ? "prêt — connectez OAuth Google Ads"
        : "non configuré";
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

  // Open conversation → Mastra (memory + Pipeboard tools)
  if (process.env.ORKESTRIA_AGENT_RUNTIME !== "legacy") {
    const { runMastraOrchestrator } = await import("@/lib/mastra/run-chat");
    return runMastraOrchestrator(input);
  }

  requireOpenAiKey();

  const conns = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, input.orgId));
  const connectedConnectors = conns
    .filter((c) => c.status === "connectée")
    .map((c) => c.connector);
  const mediaSkill = matchMediaSkill(input.message, connectedConnectors);

  const [prompt, orgContext, live] = await Promise.all([
    loadOrchestratorPrompt(),
    buildOrgContext(input.orgId, input.message),
    loadLiveAccountData(input.orgId),
  ]);

  const liveData = live.results.length
    ? `\n\nDonnées live des plateformes :\n${live.results.join("\n\n")}`
    : "";

  const skillBlock = mediaSkill
    ? `\n\n--- SOP media buying ---\n${formatSkillForPrompt(mediaSkill)}`
    : "";

  const system = `${prompt}\n\n--- Contexte du compte (source de vérité) ---\n${orgContext}${liveData}${skillBlock}`;

  const history = (input.history ?? []).slice(-10).map((turn) => ({
    role: turn.role === "user" ? ("user" as const) : ("assistant" as const),
    content: turn.text,
  }));

  const res = await llmChatCompletion({
    messages: [
      { role: "system", content: system },
      ...history,
      { role: "user", content: input.message },
    ],
    maxTokens: 700,
  });

  return {
    reply: res,
    toolsUsed: mediaSkill
      ? [...live.toolsUsed, `media_skill:${mediaSkill.id}`]
      : live.toolsUsed,
    runId: input.runId,
    matchedMediaSkill: mediaSkill?.name,
  };
}

function serializeAuditData(summary: AuditSummary): string {
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

async function composeAuditReply(opts: {
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
    const mediaSkill = matchMediaSkill(`${message} audit performance analyse`, connectedConnectors);

    const [prompt, orgContext] = await Promise.all([
      loadOrchestratorPrompt(),
      buildOrgContext(orgId, message),
    ]);

    const skillBlock = mediaSkill
      ? `\n\n--- SOP media buying à appliquer ---\n${formatSkillForPrompt(mediaSkill)}`
      : "";

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
      `- Si dépense = 0 et 0 campagne : « compte vide » + prochaine étape sur CETTE régie seulement.\n` +
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

function formatAuditReply(summary: AuditSummary): string {
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
