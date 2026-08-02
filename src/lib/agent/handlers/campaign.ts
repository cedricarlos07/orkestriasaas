import {
  geoBriefResolved,
  metaCampaignGeoArgs,
  metaCreateParams,
  parseCampaignBrief,
} from "@/lib/agent/brief-parser";
import type { OrchestratorInput, OrchestratorOutput } from "@/lib/agent/types";
import { requireOpenAiKey } from "@/lib/platforms/config";
import { llmChatCompletion } from "@/lib/llm/client";
import { buildOrgContext } from "@/lib/mcp/org-context";
import { matchMediaSkill, formatSkillForPrompt, buildMergedSkillPrompt } from "@/lib/mcp/skill-router";

function chatToolCtx(orgId: string, userId: string) {
  return {
    keyId: "chat",
    organizationId: orgId,
    userId,
    name: "orkestria-chat",
    scopes: ["read", "write"] as ("read" | "write" | "admin")[],
  };
}

export async function handleCampaignIntent(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const { getStackSetupStatus } = await import("@/lib/mcp/setup-status");
  const {
    campaignNextSuggestions,
    extractSuggestionsFromReply,
    mergeSuggestions,
  } = await import("@/lib/mcp/chat-suggestions");
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

  // Guided buttons: ask ONE missing field before creating / calling the LLM
  const guided = campaignNextSuggestions(brief);
  const needsChannel =
    brief.objective === "messages" && (brief.channelPending || !brief.channel);
  const needsGeoPrecision =
    Boolean(brief.countries?.length) &&
    brief.geoScope !== "country_wide" &&
    !(brief.cities?.length || brief.neighborhoods?.length);
  const needsRadius =
    Boolean(brief.cities?.length || brief.neighborhoods?.length) &&
    brief.geoScope !== "country_wide" &&
    brief.radiusKm === undefined;
  const needsDevice = geoBriefResolved(brief) && !brief.deviceTargeting;
  const briefIncomplete =
    !brief.objective ||
    needsChannel ||
    !brief.countries?.length ||
    needsGeoPrecision ||
    needsRadius ||
    needsDevice ||
    !(typeof brief.dailyBudget === "number" && brief.dailyBudget > 0);

  if (briefIncomplete && guided.length && !brief.confirmCreate) {
    const mediaSkill = matchMediaSkill(
      `${input.message} lancer campagne ciblage geo`,
      ["meta_ads"],
    );
    const acc =
      stack.meta.accountName && stack.meta.account
        ? `« ${stack.meta.accountName} » (${stack.meta.account})`
        : stack.meta.account
          ? stack.meta.account
          : "votre compte Meta";
    const page =
      stack.meta.pageName && stack.meta.pageId
        ? `« ${stack.meta.pageName} »`
        : stack.meta.pageId
          ? stack.meta.pageId
          : "votre Page";

    let question = "Que voulez-vous optimiser ?";
    if (!brief.objective) question = "Quel **objectif** Meta pour cette campagne ?";
    else if (needsChannel) question = "Quel **canal** voulez-vous utiliser pour recevoir les messages ?";
    else if (!brief.countries?.length) question = "Dans quel **pays** cibler ?";
    else if (needsGeoPrecision)
      question =
        "Ciblage précis (media buyer) : **ville / quartier**, ou tout le pays ? Un pays entier dilue souvent le budget.";
    else if (needsRadius)
      question = "Quel **rayon** autour de la zone (livraison / clients locaux) ?";
    else if (needsDevice)
      question =
        "Sur quels **appareils** cibler ? En Afrique de l'Ouest, **mobile uniquement** évite souvent le gaspillage budget.";
    else if (!(typeof brief.dailyBudget === "number" && brief.dailyBudget > 0))
      question = "Quel **budget** par jour ?";

    const geoBits = [
      brief.countries?.length ? brief.countries.join(", ") : null,
      brief.cities?.length ? brief.cities.join(", ") : null,
      brief.neighborhoods?.length ? `quartier ${brief.neighborhoods.join(", ")}` : null,
      typeof brief.radiusKm === "number" && brief.radiusKm > 0 ? `${brief.radiusKm} km` : null,
      typeof brief.radiusKm === "number" && brief.radiusKm === 0 ? "ville entière" : null,
      brief.geoScope === "country_wide" ? "pays entier" : null,
      brief.deviceTargeting === "mobile" ? "mobile uniquement" : brief.deviceTargeting === "all" ? "tous appareils" : null,
    ].filter(Boolean);

    const skillHint = mediaSkill
      ? `\n\n_${formatSkillForPrompt(mediaSkill).split("\n").slice(0, 4).join("\n")}_`
      : "";

    const lines = [
      `Compte **${acc}** · Page ${page}.`,
      skillHint || null,
      brief.objective
        ? `• Objectif : **${brief.objective === "messages" ? "Messages" : brief.objective}**`
        : null,
      brief.dailyBudget ? `• Budget : **${brief.dailyBudget} / jour**` : null,
      geoBits.length ? `• Zone : **${geoBits.join(" · ")}**` : null,
      "",
      question,
    ].filter((x) => x !== null) as string[];

    return {
      reply: lines.join("\n"),
      toolsUsed: mediaSkill ? [...toolsUsed, `media_skill:${mediaSkill.id}`] : toolsUsed,
      runId: input.runId,
      suggestions: guided,
      matchedMediaSkill: mediaSkill?.name,
    };
  }

  const canCreate =
    brief.confirmCreate &&
    typeof brief.dailyBudget === "number" &&
    brief.dailyBudget > 0 &&
    Boolean(brief.countries?.length || brief.objective) &&
    geoBriefResolved(brief) &&
    Boolean(brief.deviceTargeting) &&
    !(brief.objective === "messages" && (brief.channelPending || !brief.channel));

  if (canCreate) {
    try {
      const meta = metaCreateParams(brief);
      const name =
        brief.name ??
        `Orkestria — ${meta.label} ${new Date().toISOString().slice(0, 10)}`;
      const outcome = (await invokeAgentTool(ctx, "create_meta_campaign", {
        name,
        dailyBudget: brief.dailyBudget,
        objective: meta.objective,
        channel: meta.channel,
        countries: brief.countries ?? ["FR"],
        ...metaCampaignGeoArgs(brief),
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
      const isMsg = meta.channel === "whatsapp" || meta.channel === "messenger";
      const landing =
        brief.linkUrl && !/\.(png|jpe?g|webp|gif)(\?|$)/i.test(brief.linkUrl)
          ? brief.linkUrl
          : isMsg
            ? "https://www.facebook.com"
            : "https://orkestria.top";

      if (adSetId && (imageAtt || imageUrlFromMsg)) {
        try {
          const { attachPausedImageAd } = await import("@/lib/mcp/meta-creatives");
          const ad = await attachPausedImageAd(input.orgId, {
            adSetId,
            name: `${name} — annonce`,
            linkUrl: landing,
            callToAction: isMsg
              ? meta.channel === "messenger"
                ? "MESSAGE_PAGE"
                : "WHATSAPP_MESSAGE"
              : "LEARN_MORE",
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
          `• Zone : ${[
            ...(brief.countries ?? ["FR"]),
            ...(brief.cities ?? []),
            ...(brief.neighborhoods?.map((n) => `quartier ${n}`) ?? []),
            typeof brief.radiusKm === "number" && brief.radiusKm > 0 ? `${brief.radiusKm} km` : null,
            brief.deviceTargeting === "mobile" ? "mobile" : null,
          ]
            .filter(Boolean)
            .join(" · ")}\n` +
          `• Objectif : ${meta.label}\n` +
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
      suggestions: campaignNextSuggestions(brief),
    };
  }

  let dryRunBlock = "";
  let readyConfirm = false;
  if (
    typeof brief.dailyBudget === "number" &&
    brief.dailyBudget > 0 &&
    Boolean(brief.countries?.length || brief.objective) &&
    geoBriefResolved(brief) &&
    Boolean(brief.deviceTargeting) &&
    !(brief.objective === "messages" && (brief.channelPending || !brief.channel))
  ) {
    try {
      const meta = metaCreateParams(brief);
      const name =
        brief.name ??
        `Orkestria — ${meta.label} ${new Date().toISOString().slice(0, 10)}`;
      const preview = await invokeAgentTool(ctx, "create_meta_campaign", {
        name,
        dailyBudget: brief.dailyBudget,
        objective: meta.objective,
        channel: meta.channel,
        countries: brief.countries ?? ["FR"],
        ...metaCampaignGeoArgs(brief),
        dry_run: true,
      });
      toolsUsed.push("create_meta_campaign:dry_run");
      readyConfirm = true;
      const zoneLabel = [
        (brief.countries ?? ["FR"]).join(","),
        ...(brief.cities ?? []),
        ...(brief.neighborhoods ?? []),
        typeof brief.radiusKm === "number" && brief.radiusKm > 0 ? `${brief.radiusKm}km` : null,
        brief.deviceTargeting === "mobile" ? "mobile" : null,
      ]
        .filter(Boolean)
        .join(" · ");
      dryRunBlock =
        `\n\n--- Aperçu création (dry_run, rien créé) ---\n` +
        `Nom: ${name} | Budget/j: ${brief.dailyBudget} | Zone: ${zoneLabel} | Objectif: ${meta.label}\n` +
        `${JSON.stringify(preview).slice(0, 400)}\n` +
        `Si OK, l'utilisateur doit répondre exactement : « oui crée en pause ».`;
    } catch (e) {
      dryRunBlock = `\n\n(Dry-run impossible : ${e instanceof Error ? e.message : "erreur"})`;
    }
  }

  requireOpenAiKey();
  const { mediaSkill, hubAgent, promptBlock: mergedSkills } = buildMergedSkillPrompt(`${input.message} launch campaign meta`, ["meta_ads"]);
  const { loadOrchestratorPrompt, loadLiveAccountData } = await import("@/lib/mcp/orchestrator");
  const [prompt, orgContext, live] = await Promise.all([
    loadOrchestratorPrompt(),
    buildOrgContext(input.orgId, input.message),
    loadLiveAccountData(input.orgId),
  ]);
  toolsUsed.push(...live.toolsUsed, `hub_agent:${hubAgent}`);

  const skillBlock = mergedSkills ? `\n\n${mergedSkills}` : "";
  const liveData = live.results.length
    ? `\n\nDonnées live du compte :\n${live.results.join("\n\n")}`
    : "";

  const system =
    `${prompt}\n\n--- Contexte du compte (source de vérité) ---\n${orgContext}${liveData}${skillBlock}${dryRunBlock}\n\n` +
    `Tâche : tu es en mode BRIEF CAMPAGNE. Utilise les campagnes déjà présentes pour conseiller (ne pas tout recréer bêtement). ` +
    `Si le brief est incomplet, demande UNE seule info manquante — après le pays : ville/quartier, puis rayon si local, puis mobile vs tous appareils, puis budget. ` +
    `Si un aperçu dry_run est présent, résume-le clairement et demande confirmation « oui crée en pause ». ` +
    `Quand tu proposes 2–5 choix, formate-les en lignes « → **Label** (détail) » — l'UI les transforme en boutons. ` +
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

  const extracted = extractSuggestionsFromReply(res);
  const fallback = readyConfirm
    ? [{ label: "Oui, crée en pause", value: "oui crée en pause" }]
    : campaignNextSuggestions(brief);

  return {
    reply: extracted.suggestions.length ? extracted.cleanText : res,
    toolsUsed: mediaSkill ? [...toolsUsed, `media_skill:${mediaSkill.id}`] : toolsUsed,
    runId: input.runId,
    matchedMediaSkill: mediaSkill?.name,
    suggestions: mergeSuggestions(extracted.suggestions, fallback),
  };
}
