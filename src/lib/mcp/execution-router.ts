import type { TokenPayload } from "@/lib/crypto/tokens";
import type { ConnectorId } from "@/lib/oauth/connectors";
import { researchCompetitorAds } from "@/lib/mcp/clients/meta-ad-library-client";
import { resolveMetaPageId } from "@/lib/mcp/meta-org";
import { resolveActiveAdAccountId } from "@/lib/mcp/resolve-ad-account";
import type { WriteActionInput, WriteActionName } from "@/lib/mcp/policy-engine";
import { getAdapter } from "@/lib/platforms/adapter";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import type { UnifiedAccountSnapshot } from "@/lib/unified-ad-schema";

/** Live write platforms — everything else is product "Bientôt". */
const LIVE_WRITE_CONNECTORS = new Set<ConnectorId>(["meta_ads", "google_ads"]);

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
  upstream: "native";
}> {
  const period = ctx.period ?? "30 derniers jours";
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

/**
 * Single write entry: gate Bientôt → adapter only (Meta + Google).
 * No platform-specific branches here — adapters own Graph / Google Ads API.
 */
export async function routeWrite(ctx: WriteRouteContext): Promise<Record<string, unknown>> {
  if (!LIVE_WRITE_CONNECTORS.has(ctx.connector)) {
    throw new Error(
      `${ctx.connector} : bientôt disponible. Pour l'instant Meta Ads et Google Ads uniquement.`,
    );
  }

  const adapter = getAdapter(ctx.connector);
  const tokens = await ensureFreshTokens(ctx.connectionId, ctx.orgId, ctx.connector);
  let accountId =
    ctx.accountId ||
    (await resolveActiveAdAccountId(ctx.orgId, ctx.connector)) ||
    tokens.accountId ||
    "";

  if (ctx.connector === "google_ads") {
    accountId = accountId.replace(/\D/g, "");
  }

  if (!accountId) {
    throw new Error(`Compte ${ctx.connector} manquant — connectez un compte dans Connexions`);
  }

  // Resolve Meta page once for create paths that need it
  if (ctx.connector === "meta_ads" && !ctx.params.pageId) {
    const pageId = await resolveMetaPageId(ctx.orgId, undefined);
    if (pageId) ctx.params.pageId = pageId;
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
      const rawType = String(input.params.campaignType ?? input.params.type ?? "search").toLowerCase();
      const type =
        rawType.includes("pmax") || rawType.includes("performance")
          ? "pmax"
          : (input.params.campaignType ?? "search");
      if (
        (input.params.channel === "whatsapp" || input.params.channel === "messenger") &&
        !input.params.pageId
      ) {
        throw new Error(
          "pageId requis pour Messages WhatsApp / Messenger — choisissez une Page Facebook dans Connexions",
        );
      }
      const res = await adapter.createCampaign(tokens, accountId, {
        name: input.params.name,
        dailyBudget: input.params.dailyBudget,
        objective: input.params.objective,
        countries: input.params.countries,
        cities: input.params.cities,
        neighborhoods: input.params.neighborhoods,
        radiusKm: input.params.radiusKm,
        geoScope: input.params.geoScope,
        deviceTargeting: input.params.deviceTargeting,
        channel: input.params.channel,
        pageId: input.params.pageId,
        type: type as "search" | "pmax" | "traffic" | "leads" | "default",
        keywords: input.params.keywords,
        finalUrl: input.params.finalUrl,
        headlines: input.params.headlines,
        descriptions: input.params.descriptions,
      });
      return { campaignId: res.campaignId, status: "PAUSED", upstream: "orkestria", ...res.details };
    }
    case "update_budget": {
      if (!input.params.dailyBudget) throw new Error("dailyBudget requis");
      const entityId =
        input.connector === "meta_ads"
          ? (input.params.adSetId as string | undefined) || input.campaignId
          : input.campaignId;
      if (!entityId) throw new Error("campaignId (ou adSetId Meta) requis");
      await adapter.updateBudget(tokens, accountId, entityId, input.params.dailyBudget);
      return { campaignId: entityId, dailyBudget: input.params.dailyBudget, upstream: "orkestria" };
    }
    case "pause_campaign": {
      if (!input.campaignId) throw new Error("campaignId requis");
      await adapter.pauseCampaign(tokens, accountId, input.campaignId);
      return { campaignId: input.campaignId, status: "PAUSED", upstream: "orkestria" };
    }
    case "enable_campaign": {
      if (!input.campaignId) throw new Error("campaignId requis");
      await adapter.enableCampaign(tokens, accountId, input.campaignId);
      return { campaignId: input.campaignId, status: "ACTIVE", upstream: "orkestria" };
    }
    case "pause_ad_set": {
      if (!adapter.pauseAdSet) throw new Error(`pause_ad_set non supporté pour ${adapter.label}`);
      const adSetId = input.params.adSetId ?? input.campaignId;
      if (!adSetId) throw new Error("adSetId requis");
      await adapter.pauseAdSet(tokens, accountId, adSetId);
      return { adSetId, status: "PAUSED", upstream: "orkestria" };
    }
    case "enable_ad_set": {
      if (!adapter.enableAdSet) throw new Error(`enable_ad_set non supporté pour ${adapter.label}`);
      const adSetId = input.params.adSetId ?? input.campaignId;
      if (!adSetId) throw new Error("adSetId requis");
      await adapter.enableAdSet(tokens, accountId, adSetId);
      return { adSetId, status: "ACTIVE", upstream: "orkestria" };
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
      return { adSetId: res.adSetId, status: "PAUSED", upstream: "orkestria", ...res.details };
    }
    case "create_ad": {
      if (!adapter.createAd) throw new Error(`create_ad non supporté pour ${adapter.label}`);
      if (!input.params.adSetId || !input.params.name) throw new Error("adSetId et name requis");
      if (!input.params.pageId) {
        throw new Error(
          "pageId requis — enregistrez votre Page Facebook dans Connexions ou passez pageId",
        );
      }
      if (!input.params.imageUrl && !input.params.imageHash) {
        throw new Error("imageUrl ou imageHash requis pour créer une annonce Meta");
      }
      if (!input.params.linkUrl) throw new Error("linkUrl requis pour create_ad Meta");
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
      return { adId: res.adId, status: "PAUSED", upstream: "orkestria", ...res.details };
    }
    case "upload_creative": {
      if (!adapter.uploadCreative) throw new Error(`upload_creative non supporté pour ${adapter.label}`);
      if (input.params.file) {
        const { uploadMetaCreative } = await import("@/lib/platforms/meta-api");
        const up = await uploadMetaCreative(tokens.accessToken, accountId, {
          bytesBase64: input.params.file,
          name: input.params.name,
        });
        return { imageHash: up.imageHash, upstream: "orkestria" };
      }
      if (!input.params.imageUrl) throw new Error("imageUrl ou file requis");
      const res = await adapter.uploadCreative(tokens, accountId, {
        imageUrl: input.params.imageUrl,
        name: input.params.name,
      });
      return { imageHash: res.imageHash, creativeId: res.creativeId, upstream: "orkestria", ...res.details };
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
      return { audienceId: res.audienceId, upstream: "orkestria", ...res.details };
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
      return { count: res.count, upstream: "orkestria", ...res.details };
    }
    case "add_negative_keywords": {
      if (!adapter.addNegativeKeywords) throw new Error(`add_negative_keywords non supporté pour ${adapter.label}`);
      if (!input.campaignId || !input.params.keywords?.length) throw new Error("campaignId et keywords[] requis");
      const res = await adapter.addNegativeKeywords(tokens, accountId, {
        campaignId: input.campaignId,
        keywords: input.params.keywords,
      });
      return { count: res.count, upstream: "orkestria", ...res.details };
    }
    case "create_conversion": {
      if (!adapter.createConversion) throw new Error(`create_conversion non supporté pour ${adapter.label}`);
      if (!input.params.name) throw new Error("name requis");
      const res = await adapter.createConversion(tokens, accountId, {
        name: input.params.name,
        category: input.params.category,
      });
      return { conversionId: res.conversionId, upstream: "orkestria", ...res.details };
    }
    case "attach_audience": {
      if (!adapter.attachAudience) throw new Error(`attach_audience non supporté pour ${adapter.label}`);
      if (!input.params.audienceId) throw new Error("audienceId requis");
      const res = await adapter.attachAudience(tokens, accountId, {
        audienceId: input.params.audienceId,
        campaignId: input.campaignId,
        adSetId: input.params.adSetId,
      });
      return { ok: true, upstream: "orkestria", ...res.details };
    }
    case "pause_ad": {
      if (!adapter.pauseAd) throw new Error(`pause_ad non supporté pour ${adapter.label}`);
      if (!input.params.adId) throw new Error("adId requis");
      await adapter.pauseAd(tokens, accountId, input.params.adId);
      return { adId: input.params.adId, status: "PAUSED", upstream: "orkestria" };
    }
    case "activate_meta_chain": {
      if (!adapter.enableAd) throw new Error(`Activation ad non supportée pour ${adapter.label}`);
      const adId = input.params.adId as string;
      if (!adId) throw new Error("adId requis");
      await adapter.enableAd(tokens, accountId, adId);
      return { adId, status: "ACTIVE", upstream: "orkestria" };
    }
    case "launch_meta_brief":
      throw new Error(
        "launch_meta_brief : utilisez create_meta_campaign puis create_ad (création en pause).",
      );
  }
}
