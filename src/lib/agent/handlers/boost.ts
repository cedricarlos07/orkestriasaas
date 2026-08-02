import { parseCampaignBrief } from "@/lib/agent/brief-parser";
import type { OrchestratorInput, OrchestratorOutput } from "@/lib/agent/types";

export async function handleBoostIntent(input: OrchestratorInput): Promise<OrchestratorOutput> {
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
