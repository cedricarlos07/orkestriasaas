import type { TokenPayload } from "@/lib/crypto/tokens";
import type { ConnectorId } from "@/lib/oauth/connectors";
import { getOrgAdloopApiKey } from "@/lib/mcp/adloop-org";
import {
  adloopCreateSearchCampaign,
  adloopGetCampaignPerformance,
} from "@/lib/mcp/clients/adloop";
import {
  adkitActivateAd,
  adkitLaunchBrief,
  adkitPauseAd,
  buildAdkitEnv,
} from "@/lib/mcp/adkit-bridge";
import { researchCompetitorAds } from "@/lib/mcp/clients/useproxy";
import { resolveMetaPageId } from "@/lib/mcp/meta-org";
import type { WriteActionInput, WriteActionName } from "@/lib/mcp/policy-engine";
import { getAdapter } from "@/lib/platforms/adapter";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import type { UnifiedAccountSnapshot } from "@/lib/unified-ad-schema";

export type ReadRouteContext = {
  orgId: string;
  connector: ConnectorId;
  connectionId: string;
  accountId?: string;
  period?: string;
};

export type WriteRouteContext = WriteActionInput & {
  connectionId: string;
};

export async function routeReadSnapshot(ctx: ReadRouteContext): Promise<{
  snapshot: UnifiedAccountSnapshot;
  upstream: "adloop" | "native";
}> {
  const tokens = await ensureFreshTokens(ctx.connectionId, ctx.orgId, ctx.connector);
  const accountId = ctx.accountId ?? tokens.accountId ?? "";
  const period = ctx.period ?? "30 derniers jours";

  if (ctx.connector === "google_ads") {
    const adloopKey = await getOrgAdloopApiKey(ctx.orgId);
    if (adloopKey) {
      try {
        const snapshot = await adloopGetCampaignPerformance(adloopKey, {
          customer_id: accountId.replace(/\D/g, ""),
          period,
        });
        return { snapshot, upstream: "adloop" };
      } catch {
        // fall through to native
      }
    }
  }

  const adapter = getAdapter(ctx.connector);
  const snapshot = await adapter.fetchSnapshot(tokens, accountId, period);
  return { snapshot, upstream: "native" };
}

export async function routeResearch(
  _orgId: string,
  input: { brand: string; brands?: string[]; country?: string },
): Promise<Record<string, unknown>> {
  return researchCompetitorAds(input);
}

export async function routeWrite(ctx: WriteRouteContext): Promise<Record<string, unknown>> {
  const adapter = getAdapter(ctx.connector);
  const tokens = await ensureFreshTokens(ctx.connectionId, ctx.orgId, ctx.connector);
  const accountId = ctx.accountId ?? tokens.accountId ?? "";

  if (ctx.connector === "google_ads") {
    const adloopKey = await getOrgAdloopApiKey(ctx.orgId);
    if (adloopKey && ctx.action === "create_campaign") {
      const p = ctx.params;
      if (!p.name || !p.dailyBudget) throw new Error("name et dailyBudget requis");
      const result = await adloopCreateSearchCampaign(adloopKey, {
        name: p.name,
        dailyBudget: p.dailyBudget,
        finalUrl: p.finalUrl,
        keywords: p.keywords,
        headlines: p.headlines,
        descriptions: p.descriptions,
      });
      return { ...result, upstream: "adloop", status: "PAUSED" };
    }
  }

  if (ctx.connector === "meta_ads") {
    const pageId = await resolveMetaPageId(ctx.orgId, ctx.params.pageId as string | undefined);
    const env = buildAdkitEnv({
      accessToken: tokens.accessToken,
      accountId,
      pageId: pageId ?? undefined,
      allowSpend: ctx.action === "activate_meta_chain",
    });

    if (ctx.action === "launch_meta_brief") {
      const brief = ctx.params.brief as MetaBrief | undefined;
      if (!brief?.campaign?.name || !brief.adsets?.length) {
        throw new Error("brief { campaign, adsets[] } requis pour launch_meta_brief");
      }
      if (!pageId) {
        throw new Error(
          "pageId requis — enregistrez votre Page Facebook dans Connexions ou passez pageId au tool",
        );
      }
      return adkitLaunchBrief(env, brief, { go: true, pageId, accountId });
    }

    if (ctx.action === "activate_meta_chain") {
      const adId = ctx.params.adId as string;
      if (!adId) throw new Error("adId requis");
      return adkitActivateAd(env, adId);
    }

    if (ctx.action === "pause_ad" && ctx.params.adId) {
      return adkitPauseAd(env, ctx.params.adId);
    }
  }

  return executeAdapterWrite(ctx.action, adapter, tokens, accountId, ctx);
}

async function executeAdapterWrite(
  action: WriteActionName,
  adapter: ReturnType<typeof getAdapter>,
  tokens: TokenPayload,
  accountId: string,
  input: WriteRouteContext,
): Promise<Record<string, unknown>> {
  switch (action) {
    case "create_campaign": {
      if (!adapter.createCampaign) {
        throw new Error(`Création de campagne non supportée pour ${adapter.label}`);
      }
      if (!input.params.name || !input.params.dailyBudget) throw new Error("name et dailyBudget requis");
      const res = await adapter.createCampaign(tokens, accountId, {
        name: input.params.name,
        dailyBudget: input.params.dailyBudget,
        objective: input.params.objective,
        countries: input.params.countries,
        type: input.params.campaignType,
        keywords: input.params.keywords,
        finalUrl: input.params.finalUrl,
        headlines: input.params.headlines,
        descriptions: input.params.descriptions,
      });
      return { campaignId: res.campaignId, ...res.details, upstream: "native" };
    }
    case "update_budget": {
      if (!input.campaignId || !input.params.dailyBudget) throw new Error("campaignId et dailyBudget requis");
      await adapter.updateBudget(tokens, accountId, input.campaignId, input.params.dailyBudget);
      return { campaignId: input.campaignId, dailyBudget: input.params.dailyBudget };
    }
    case "pause_campaign": {
      if (!input.campaignId) throw new Error("campaignId requis");
      await adapter.pauseCampaign(tokens, accountId, input.campaignId);
      return { campaignId: input.campaignId, status: "PAUSED" };
    }
    case "enable_campaign": {
      if (!input.campaignId) throw new Error("campaignId requis");
      await adapter.enableCampaign(tokens, accountId, input.campaignId);
      return { campaignId: input.campaignId, status: "ACTIVE" };
    }
    case "pause_ad_set": {
      if (!adapter.pauseAdSet) throw new Error(`pause_ad_set non supporté pour ${adapter.label}`);
      const adSetId = input.params.adSetId ?? input.campaignId;
      if (!adSetId) throw new Error("adSetId requis");
      await adapter.pauseAdSet(tokens, accountId, adSetId);
      return { adSetId, status: "PAUSED" };
    }
    case "enable_ad_set": {
      if (!adapter.enableAdSet) throw new Error(`enable_ad_set non supporté pour ${adapter.label}`);
      const adSetId = input.params.adSetId ?? input.campaignId;
      if (!adSetId) throw new Error("adSetId requis");
      await adapter.enableAdSet(tokens, accountId, adSetId);
      return { adSetId, status: "ACTIVE" };
    }
    case "create_ad_set": {
      if (!adapter.createAdSet) throw new Error(`create_ad_set non supporté pour ${adapter.label}`);
      if (!input.campaignId || !input.params.name || !input.params.dailyBudget) {
        throw new Error("campaignId, name et dailyBudget requis");
      }
      const res = await adapter.createAdSet(tokens, accountId, {
        campaignId: input.campaignId,
        name: input.params.name,
        dailyBudget: input.params.dailyBudget,
        countries: input.params.countries,
        optimizationGoal: input.params.optimizationGoal,
      });
      return { adSetId: res.adSetId, ...res.details };
    }
    case "create_ad": {
      if (!adapter.createAd) throw new Error(`create_ad non supporté pour ${adapter.label}`);
      if (!input.params.adSetId || !input.params.name) throw new Error("adSetId et name requis");
      const res = await adapter.createAd(tokens, accountId, {
        adSetId: input.params.adSetId,
        name: input.params.name,
        pageId: input.params.pageId,
        linkUrl: input.params.linkUrl,
        message: input.params.message,
        headline: input.params.headline,
        imageUrl: input.params.imageUrl,
        imageHash: input.params.imageHash,
      });
      return { adId: res.adId, ...res.details };
    }
    case "upload_creative": {
      if (!adapter.uploadCreative) throw new Error(`upload_creative non supporté pour ${adapter.label}`);
      if (!input.params.imageUrl) throw new Error("imageUrl requis");
      const res = await adapter.uploadCreative(tokens, accountId, {
        imageUrl: input.params.imageUrl,
        name: input.params.name,
      });
      return { imageHash: res.imageHash, creativeId: res.creativeId, ...res.details };
    }
    case "create_audience": {
      if (!adapter.createAudience) throw new Error(`create_audience non supporté pour ${adapter.label}`);
      if (!input.params.name) throw new Error("name requis");
      const res = await adapter.createAudience(tokens, accountId, {
        name: input.params.name,
        description: input.params.description,
        subtype: input.params.subtype,
        lookalikeRatio: input.params.lookalikeRatio,
        originAudienceId: input.params.originAudienceId,
        country: input.params.country,
      });
      return { audienceId: res.audienceId, ...res.details };
    }
    case "add_keywords": {
      if (!adapter.addKeywords) throw new Error(`add_keywords non supporté pour ${adapter.label}`);
      if (!input.params.adGroupId || !input.params.keywords?.length) {
        throw new Error("adGroupId et keywords[] requis");
      }
      const res = await adapter.addKeywords(tokens, accountId, {
        adGroupId: input.params.adGroupId,
        keywords: input.params.keywords,
      });
      return { count: res.count, ...res.details };
    }
    case "add_negative_keywords": {
      if (!adapter.addNegativeKeywords) throw new Error(`add_negative_keywords non supporté pour ${adapter.label}`);
      if (!input.campaignId || !input.params.keywords?.length) throw new Error("campaignId et keywords[] requis");
      const res = await adapter.addNegativeKeywords(tokens, accountId, {
        campaignId: input.campaignId,
        keywords: input.params.keywords,
      });
      return { count: res.count, ...res.details };
    }
    case "create_conversion": {
      if (!adapter.createConversion) throw new Error(`create_conversion non supporté pour ${adapter.label}`);
      if (!input.params.name) throw new Error("name requis");
      const res = await adapter.createConversion(tokens, accountId, {
        name: input.params.name,
        category: input.params.category,
      });
      return { conversionId: res.conversionId, ...res.details };
    }
    case "attach_audience": {
      if (!adapter.attachAudience) throw new Error(`attach_audience non supporté pour ${adapter.label}`);
      if (!input.params.audienceId) throw new Error("audienceId requis");
      const res = await adapter.attachAudience(tokens, accountId, {
        audienceId: input.params.audienceId,
        campaignId: input.campaignId,
        adSetId: input.params.adSetId,
      });
      return { ok: true, ...res.details };
    }
    case "pause_ad": {
      if (!adapter.pauseAd) throw new Error(`pause_ad non supporté pour ${adapter.label}`);
      if (!input.params.adId) throw new Error("adId requis");
      await adapter.pauseAd(tokens, accountId, input.params.adId);
      return { adId: input.params.adId, status: "PAUSED" };
    }
  }
}
