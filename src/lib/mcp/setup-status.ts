import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { buildAdkitEnv, adkitVerify } from "@/lib/mcp/adkit-bridge";
import { getOrgGoogleCustomerId, isAdloopServerConfigured } from "@/lib/mcp/adloop-org";
import { probeAdloopHealth } from "@/lib/mcp/clients/adloop";
import { isMetaAdLibraryConfigured, probeMetaAdLibraryHealth } from "@/lib/platforms/meta-ad-library";
import { resolveMetaPageId, syncOrgMetaPageFromToken } from "@/lib/mcp/meta-org";
import { isMem0Configured, probeMem0Health } from "@/lib/mcp/mem0-bridge";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";

export type StackSetupStatus = {
  meta: {
    oauthConnected: boolean;
    account: string | null;
    pageId: string | null;
    adkitVerify: "ok" | "skipped" | "error";
    adkitError?: string;
  };
  google: {
    adloopConfigured: boolean;
    adloopHealth: "ok" | "skipped" | "error";
    adloopError?: string;
    oauthConnected: boolean;
    customerId: string | null;
  };
  research: {
    useproxyConfigured: boolean;
    useproxyHealth: "ok" | "skipped" | "error";
    useproxyError?: string;
    adsLibraryConfigured: boolean;
    adsLibraryHealth: "ok" | "skipped" | "error";
    adsLibraryError?: string;
    url: string;
  };
  /** Meta campaigns can launch when Meta OAuth + Page are ready (adkit preferred but not blocking). */
  readyForCampaign: boolean;
  readyForMeta: boolean;
  readyForGoogle: boolean;
  missingSteps: string[];
  memory: {
    mem0Configured: boolean;
    mem0Health: "ok" | "skipped" | "error";
    mem0Error?: string;
  };
};

export async function getStackSetupStatus(orgId: string): Promise<StackSetupStatus> {
  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  const metaConn = rows.find((r) => r.connector === "meta_ads" && r.status === "connectée");
  const googleConn = rows.find((r) => r.connector === "google_ads" && r.status === "connectée");
  let pageId = await resolveMetaPageId(orgId, null);
  const customerId = await getOrgGoogleCustomerId(orgId);

  const missingSteps: string[] = [];

  let adkitVerify: StackSetupStatus["meta"]["adkitVerify"] = "skipped";
  let adkitError: string | undefined;
  if (metaConn?.encryptedTokens) {
    try {
      const tokens = await ensureFreshTokens(metaConn.id, orgId, "meta_ads");
      if (!pageId) {
        const synced = await syncOrgMetaPageFromToken(
          orgId,
          tokens.accessToken,
          tokens.accountId ?? metaConn.externalAccount ?? undefined,
        ).catch(() => null);
        if (synced) pageId = synced.pageId;
      }
      try {
        const env = buildAdkitEnv({
          accessToken: tokens.accessToken,
          accountId: tokens.accountId ?? metaConn.externalAccount ?? "",
          pageId: pageId ?? undefined,
          allowSpend: false,
        });
        await adkitVerify(env);
        adkitVerify = "ok";
      } catch (e) {
        adkitVerify = "error";
        adkitError = e instanceof Error ? e.message : "Vérification automatisation Meta échouée";
      }
    } catch (e) {
      adkitVerify = "error";
      adkitError = e instanceof Error ? e.message : "Token Meta invalide";
      missingSteps.push("Reconnecter Meta Ads (jeton invalide)");
    }
  } else {
    missingSteps.push("Connecter Meta Ads");
  }

  if (metaConn && !pageId) {
    missingSteps.push("Aucune Page Facebook détectée — reconnectez Meta ou choisissez une Page");
  }

  const adloopConfigured = isAdloopServerConfigured();
  let adloopHealth: StackSetupStatus["google"]["adloopHealth"] = "skipped";
  let adloopError: string | undefined;
  if (adloopConfigured) {
    const probe = await probeAdloopHealth();
    if (probe.ok) adloopHealth = "ok";
    else {
      adloopHealth = "error";
      adloopError = probe.error;
    }
  }

  const adsLibraryConfigured = isMetaAdLibraryConfigured();
  let adsLibraryHealth: StackSetupStatus["research"]["adsLibraryHealth"] = "skipped";
  let adsLibraryError: string | undefined;
  if (adsLibraryConfigured) {
    const probe = await probeMetaAdLibraryHealth();
    if (probe.ok) adsLibraryHealth = "ok";
    else {
      adsLibraryHealth = "error";
      adsLibraryError = probe.error;
    }
  }

  const readyForMeta = Boolean(metaConn?.encryptedTokens) && Boolean(pageId);
  const readyForGoogle = adloopConfigured && adloopHealth === "ok";
  /** Campaign launch in product is Meta-first — do not block on Google/AdLoop. */
  const readyForCampaign = readyForMeta;

  const mem0Configured = isMem0Configured();
  let mem0Health: StackSetupStatus["memory"]["mem0Health"] = "skipped";
  let mem0Error: string | undefined;
  if (mem0Configured) {
    const probe = await probeMem0Health();
    if (probe.ok) mem0Health = "ok";
    else {
      mem0Health = "error";
      mem0Error = probe.error;
    }
  }

  return {
    meta: {
      oauthConnected: Boolean(metaConn?.encryptedTokens),
      account: metaConn?.externalAccount ?? null,
      pageId,
      adkitVerify,
      adkitError,
    },
    google: {
      adloopConfigured,
      adloopHealth,
      adloopError,
      oauthConnected: Boolean(googleConn),
      customerId,
    },
    research: {
      useproxyConfigured: adsLibraryConfigured,
      useproxyHealth: adsLibraryHealth,
      useproxyError: adsLibraryError,
      adsLibraryConfigured,
      adsLibraryHealth,
      adsLibraryError,
      url: "graph.facebook.com/ads_archive",
    },
    readyForCampaign,
    readyForMeta,
    readyForGoogle,
    missingSteps,
    memory: {
      mem0Configured,
      mem0Health,
      mem0Error,
    },
  };
}
