import type { TokenPayload } from "@/lib/crypto/tokens";
import type { ConnectorId } from "@/lib/oauth/connectors";
import { isPipeboardConfigured } from "@/mastra/pipeboard-mcp";
import {
  isPipeboardFamilyConnector,
  pipeboardFamilyCreateCampaign,
  pipeboardFamilyPauseCampaign,
  pipeboardFamilySnapshot,
  pipeboardFamilyUpdateBudget,
  pipeboardGoogleCreateCampaign,
  pipeboardGoogleSnapshot,
  pipeboardMetaActivateAd,
  pipeboardMetaCreateCampaign,
  pipeboardMetaLaunchBrief,
  pipeboardMetaPauseAd,
  pipeboardMetaPauseCampaign,
  pipeboardMetaSnapshot,
  pipeboardMetaUpdateBudget,
} from "@/mastra/pipeboard-bridge";
import { researchCompetitorAds } from "@/lib/mcp/clients/useproxy";
import { resolveMetaPageId } from "@/lib/mcp/meta-org";
import { resolveActiveAdAccountId } from "@/lib/mcp/resolve-ad-account";
import type { WriteActionInput, WriteActionName } from "@/lib/mcp/policy-engine";
import { getAdapter } from "@/lib/platforms/adapter";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import type { UnifiedAccountSnapshot } from "@/lib/unified-ad-schema";
import type { MetaBrief } from "@/lib/mcp/meta-brief";

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

async function resolveGoogleCustomerId(orgId: string, accountId?: string): Promise<string> {
  if (accountId) return accountId.replace(/\D/g, "");
  const preferred = await resolveActiveAdAccountId(orgId, "google_ads");
  return (preferred || "").replace(/\D/g, "");
}

export async function routeReadSnapshot(ctx: ReadRouteContext): Promise<{
  snapshot: UnifiedAccountSnapshot;
  upstream: "pipeboard" | "native";
}> {
  const period = ctx.period ?? "30 derniers jours";

  if (isPipeboardConfigured() && ctx.connector === "meta_ads") {
    const tokens = await ensureFreshTokens(ctx.connectionId, ctx.orgId, ctx.connector).catch(() => null);
    const accountId =
      ctx.accountId ||
      (await resolveActiveAdAccountId(ctx.orgId, "meta_ads")) ||
      tokens?.accountId ||
      "";
    if (accountId) {
      try {
        const snapshot = await pipeboardMetaSnapshot({ accountId });
        return { snapshot: { ...snapshot, period }, upstream: "pipeboard" };
      } catch {
        // fall through to native
      }
    }
  }

  if (isPipeboardConfigured() && ctx.connector === "google_ads") {
    const customerId = await resolveGoogleCustomerId(ctx.orgId, ctx.accountId);
    if (customerId) {
      try {
        const snapshot = await pipeboardGoogleSnapshot({ customerId });
        return { snapshot: { ...snapshot, period }, upstream: "pipeboard" };
      } catch {
        // fall through to native
      }
    }
  }

  if (isPipeboardConfigured() && isPipeboardFamilyConnector(ctx.connector)) {
    const tokens = await ensureFreshTokens(ctx.connectionId, ctx.orgId, ctx.connector).catch(() => null);
    const accountId =
      ctx.accountId ||
      (await resolveActiveAdAccountId(ctx.orgId, ctx.connector)) ||
      tokens?.accountId ||
      "";
    if (accountId) {
      try {
        const snapshot = await pipeboardFamilySnapshot({
          connector: ctx.connector,
          accountId,
        });
        return { snapshot: { ...snapshot, period }, upstream: "pipeboard" };
      } catch {
        // fall through to native
      }
    }
  }

  const tokens = await ensureFreshTokens(ctx.connectionId, ctx.orgId, ctx.connector);
  const preferred =
    ctx.accountId ||
    (await resolveActiveAdAccountId(ctx.orgId, ctx.connector)) ||
    tokens.accountId ||
    "";
  const adapter = getAdapter(ctx.connector);
  const snapshot = await adapter.fetchSnapshot(tokens, preferred, period);
  return { snapshot, upstream: "native" };
}

export async function routeResearch(
  orgId: string,
  input: { brand: string; brands?: string[]; country?: string },
): Promise<Record<string, unknown>> {
  return researchCompetitorAds({ ...input, orgId });
}

export async function routeWrite(ctx: WriteRouteContext): Promise<Record<string, unknown>> {
  if (isPipeboardConfigured() && ctx.connector === "google_ads" && ctx.action === "create_campaign") {
    const p = ctx.params;
    if (!p.name || !p.dailyBudget) throw new Error("name et dailyBudget requis");
    const customerId = await resolveGoogleCustomerId(ctx.orgId, ctx.accountId);
    if (!customerId) throw new Error("Google Ads customer id manquant — connectez un compte");
    return pipeboardGoogleCreateCampaign({
      customerId,
      name: p.name,
      dailyBudget: p.dailyBudget,
      campaignType: p.campaignType,
      finalUrl: p.finalUrl,
      keywords: p.keywords?.map((k) => (typeof k === "string" ? k : k.text)),
      headlines: p.headlines,
      descriptions: p.descriptions,
    });
  }

  if (
    isPipeboardConfigured() &&
    isPipeboardFamilyConnector(ctx.connector) &&
    (ctx.action === "create_campaign" ||
      ctx.action === "pause_campaign" ||
      ctx.action === "update_budget")
  ) {
    const tokensEarly = await ensureFreshTokens(ctx.connectionId, ctx.orgId, ctx.connector).catch(
      () => null,
    );
    const familyAccountId =
      ctx.accountId ||
      (await resolveActiveAdAccountId(ctx.orgId, ctx.connector)) ||
      tokensEarly?.accountId ||
      "";
    if (ctx.action === "create_campaign") {
      if (!familyAccountId) throw new Error(`Compte ${ctx.connector} manquant — connectez un compte`);
      if (!ctx.params.name || !ctx.params.dailyBudget) throw new Error("name et dailyBudget requis");
      return pipeboardFamilyCreateCampaign({
        connector: ctx.connector,
        accountId: familyAccountId,
        name: ctx.params.name,
        dailyBudget: ctx.params.dailyBudget,
        objective: ctx.params.objective,
      });
    }
    if (ctx.action === "pause_campaign" && ctx.campaignId) {
      return pipeboardFamilyPauseCampaign({
        connector: ctx.connector,
        campaignId: ctx.campaignId,
      });
    }
    if (ctx.action === "update_budget" && ctx.campaignId && ctx.params.dailyBudget) {
      return pipeboardFamilyUpdateBudget({
        connector: ctx.connector,
        campaignId: ctx.campaignId,
        dailyBudget: ctx.params.dailyBudget,
      });
    }
  }

  const adapter = getAdapter(ctx.connector);
  const tokens = await ensureFreshTokens(ctx.connectionId, ctx.orgId, ctx.connector);
  const accountId =
    ctx.accountId ||
    (await resolveActiveAdAccountId(ctx.orgId, ctx.connector)) ||
    tokens.accountId ||
    "";

  if (isPipeboardConfigured() && ctx.connector === "meta_ads") {
    const pageId = await resolveMetaPageId(ctx.orgId, ctx.params.pageId as string | undefined);

    if (ctx.action === "upload_creative") {
      if (!accountId) throw new Error("Meta ad account id manquant");
      if (!ctx.params.imageUrl && !(ctx.params as { file?: string }).file) {
        throw new Error("imageUrl requis pour upload_creative");
      }
      const { pipeboardUploadAdImage } = await import("@/mastra/pipeboard-bridge");
      return pipeboardUploadAdImage({
        accountId,
        imageUrl: ctx.params.imageUrl,
        file: (ctx.params as { file?: string }).file,
        name: ctx.params.name,
      });
    }

    if (ctx.action === "create_ad") {
      if (!accountId) throw new Error("Meta ad account id manquant");
      if (!ctx.params.adSetId || !ctx.params.name) throw new Error("adSetId et name requis");
      if (ctx.params.objectStoryId || (ctx.params as { object_story_id?: string }).object_story_id) {
        const { pipeboardCreateAdCreative, pipeboardCreateAd } = await import(
          "@/mastra/pipeboard-bridge"
        );
        const storyId = String(
          ctx.params.objectStoryId ?? (ctx.params as { object_story_id?: string }).object_story_id,
        );
        const creative = await pipeboardCreateAdCreative({
          accountId,
          name: `${ctx.params.name} — post`,
          objectStoryId: storyId,
        });
        const ad = await pipeboardCreateAd({
          accountId,
          adSetId: ctx.params.adSetId,
          creativeId: creative.creativeId,
          name: ctx.params.name,
        });
        return { adId: ad.adId, creativeId: creative.creativeId, status: "PAUSED", upstream: "pipeboard" };
      }
      if (!pageId) {
        throw new Error(
          "pageId requis — enregistrez votre Page Facebook dans Connexions ou passez pageId au tool",
        );
      }
      const { pipeboardAttachImageAd } = await import("@/mastra/pipeboard-bridge");
      if (!ctx.params.imageUrl && !ctx.params.imageHash) {
        throw new Error("imageUrl ou imageHash requis pour créer une annonce Meta");
      }
      if (!ctx.params.linkUrl) throw new Error("linkUrl requis pour create_ad Meta");
      return pipeboardAttachImageAd({
        accountId,
        adSetId: ctx.params.adSetId,
        pageId,
        name: ctx.params.name,
        linkUrl: ctx.params.linkUrl,
        message: ctx.params.message,
        headline: ctx.params.headline,
        imageUrl: ctx.params.imageUrl,
        imageHash: ctx.params.imageHash,
        callToAction: ctx.params.callToAction,
      });
    }

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
      if (!accountId) throw new Error("Meta ad account id manquant");
      return pipeboardMetaLaunchBrief({
        accountId,
        pageId,
        brief: brief as Parameters<typeof pipeboardMetaLaunchBrief>[0]["brief"],
      });
    }

    if (ctx.action === "activate_meta_chain") {
      const adId = ctx.params.adId as string;
      if (!adId) throw new Error("adId requis");
      return pipeboardMetaActivateAd({ adId });
    }

    if (ctx.action === "pause_ad" && ctx.params.adId) {
      return pipeboardMetaPauseAd({ adId: ctx.params.adId as string });
    }

    if (ctx.action === "create_campaign") {
      if (!accountId) throw new Error("Meta ad account id manquant");
      if (!ctx.params.name || !ctx.params.dailyBudget) throw new Error("name et dailyBudget requis");
      const channel = ctx.params.channel as "website" | "whatsapp" | "messenger" | undefined;
      const messaging = channel === "whatsapp" || channel === "messenger";
      if (messaging && !pageId) {
        throw new Error(
          "pageId requis pour Messages WhatsApp / Messenger — choisissez une Page Facebook dans Connexions",
        );
      }
      return pipeboardMetaCreateCampaign({
        accountId,
        name: ctx.params.name,
        dailyBudget: ctx.params.dailyBudget,
        objective: ctx.params.objective,
        countries: ctx.params.countries,
        cities: ctx.params.cities,
        neighborhoods: ctx.params.neighborhoods,
        radiusKm: ctx.params.radiusKm,
        geoScope: ctx.params.geoScope,
        deviceTargeting: ctx.params.deviceTargeting,
        channel,
        pageId: pageId ?? undefined,
      });
    }

    if (ctx.action === "create_ad_set") {
      if (!accountId) throw new Error("Meta ad account id manquant");
      if (!ctx.campaignId || !ctx.params.name || !ctx.params.dailyBudget) {
        throw new Error("campaignId, name et dailyBudget requis");
      }
      const { pipeboardMetaCreateAdSet } = await import("@/mastra/pipeboard-bridge");
      const channel = ctx.params.channel as "website" | "whatsapp" | "messenger" | undefined;
      if ((channel === "whatsapp" || channel === "messenger") && !pageId) {
        throw new Error("pageId requis pour ad set Messages");
      }
      return pipeboardMetaCreateAdSet({
        accountId,
        campaignId: ctx.campaignId,
        name: ctx.params.name,
        dailyBudget: ctx.params.dailyBudget,
        countries: ctx.params.countries,
        channel,
        pageId: pageId ?? undefined,
        optimizationGoal: ctx.params.optimizationGoal,
      });
    }

    if (ctx.action === "enable_campaign" && ctx.campaignId) {
      const { pipeboardMetaEnableCampaign } = await import("@/mastra/pipeboard-bridge");
      return pipeboardMetaEnableCampaign({ campaignId: ctx.campaignId });
    }

    if (ctx.action === "enable_ad_set") {
      const adSetId = (ctx.params.adSetId as string | undefined) ?? ctx.campaignId;
      if (!adSetId) throw new Error("adSetId requis");
      const { pipeboardMetaEnableAdSet } = await import("@/mastra/pipeboard-bridge");
      return pipeboardMetaEnableAdSet({ adSetId });
    }

    if (ctx.action === "pause_campaign" && ctx.campaignId) {
      return pipeboardMetaPauseCampaign({ campaignId: ctx.campaignId });
    }

    if (ctx.action === "update_budget" && ctx.campaignId && ctx.params.dailyBudget) {
      return pipeboardMetaUpdateBudget({
        campaignId: ctx.campaignId,
        dailyBudget: ctx.params.dailyBudget,
      });
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
    case "launch_meta_brief":
    case "activate_meta_chain":
      throw new Error(`Action temporairement indisponible. Réessayez plus tard.`);
  }
}
