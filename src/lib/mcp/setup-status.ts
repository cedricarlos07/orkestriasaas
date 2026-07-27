import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessMemory, connections } from "@/db/schema/index";
import { isPipeboardConfigured, probePipeboardMcp } from "@/mastra/pipeboard-mcp";
import { isMetaAdLibraryConfigured, probeMetaAdLibraryHealth } from "@/lib/platforms/meta-ad-library";
import { resolveMetaPageId, syncOrgMetaPageFromToken } from "@/lib/mcp/meta-org";
import { resolveActiveAdAccountId } from "@/lib/mcp/resolve-ad-account";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";

export type StackSetupStatus = {
  meta: {
    oauthConnected: boolean;
    account: string | null;
    accountName: string | null;
    pageId: string | null;
    pageName: string | null;
    pipeboardVerify: "ok" | "skipped" | "error";
    pipeboardError?: string;
    /** @deprecated use pipeboardVerify */
    adkitVerify: "ok" | "skipped" | "error";
    adkitError?: string;
  };
  google: {
    pipeboardConfigured: boolean;
    pipeboardHealth: "ok" | "skipped" | "error";
    pipeboardError?: string;
    oauthConnected: boolean;
    customerId: string | null;
    /** @deprecated */
    adloopConfigured: boolean;
    adloopHealth: "ok" | "skipped" | "error";
    adloopError?: string;
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
  readyForCampaign: boolean;
  readyForMeta: boolean;
  readyForGoogle: boolean;
  missingSteps: string[];
  memory: {
    mastraConfigured: boolean;
    mastraHealth: "ok" | "skipped" | "error";
    mastraError?: string;
    /** @deprecated */
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
  let pageName: string | null = null;
  let accountName: string | null = null;
  let accountId: string | null = metaConn?.externalAccount ?? null;
  const customerId = await resolveActiveAdAccountId(orgId, "google_ads");

  const missingSteps: string[] = [];

  let pipeboardVerify: StackSetupStatus["meta"]["pipeboardVerify"] = "skipped";
  let pipeboardError: string | undefined;

  if (metaConn?.encryptedTokens) {
    try {
      const tokens = await ensureFreshTokens(metaConn.id, orgId, "meta_ads");
      accountId = tokens.accountId ?? metaConn.externalAccount ?? accountId;
      accountName = tokens.accountName?.trim() || null;
      if (!pageId) {
        const synced = await syncOrgMetaPageFromToken(
          orgId,
          tokens.accessToken,
          tokens.accountId ?? metaConn.externalAccount ?? undefined,
        ).catch(() => null);
        if (synced) {
          pageId = synced.pageId;
          pageName = synced.pageName;
        }
      }
      if (pageId && !pageName) {
        const { getMetaPageName } = await import("@/lib/platforms/meta-api");
        pageName = (await getMetaPageName(tokens.accessToken, pageId).catch(() => null)) ?? null;
      }
      const active = await resolveActiveAdAccountId(orgId, "meta_ads");
      if (active) accountId = active;
      if (!accountName && accountId) {
        try {
          const mem = await db
            .select()
            .from(businessMemory)
            .where(
              and(
                eq(businessMemory.organizationId, orgId),
                eq(businessMemory.key, "linked_ad_accounts"),
              ),
            )
            .limit(1);
          const store = (mem[0]?.value ?? {}) as {
            accounts?: { accountId: string; accountName?: string }[];
          };
          const match = (store.accounts ?? []).find(
            (a) =>
              a.accountId === accountId ||
              a.accountId.replace(/^act_/, "") === String(accountId).replace(/^act_/, ""),
          );
          if (match?.accountName) accountName = match.accountName;
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      missingSteps.push("Reconnecter Meta Ads (jeton invalide)");
      pipeboardError = e instanceof Error ? e.message : "Token Meta invalide";
    }
  } else {
    missingSteps.push("Connecter Meta Ads");
  }

  if (metaConn && !pageId) {
    missingSteps.push("Aucune Page Facebook détectée — reconnectez Meta ou choisissez une Page");
  }

  const pipeboardConfigured = isPipeboardConfigured();
  let googlePipeboardHealth: StackSetupStatus["google"]["pipeboardHealth"] = "skipped";
  let googlePipeboardError: string | undefined;

  if (pipeboardConfigured) {
    const probe = await probePipeboardMcp();
    if (probe.ok) {
      pipeboardVerify = "ok";
      googlePipeboardHealth = "ok";
    } else {
      pipeboardVerify = "error";
      googlePipeboardHealth = "error";
      pipeboardError = probe.error ?? `meta=${probe.meta} google=${probe.google}`;
      googlePipeboardError = pipeboardError;
      missingSteps.push("Vérifier PIPEBOARD_API_TOKEN (Pipeboard MCP)");
    }
  } else {
    missingSteps.push("Configurer PIPEBOARD_API_TOKEN pour Meta/Google/TikTok/Snap/Reddit");
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
  const readyForGoogle = Boolean(googleConn?.encryptedTokens) && Boolean(customerId);
  const readyForCampaign = readyForMeta && pipeboardConfigured;

  const mastraOk = Boolean(process.env.DATABASE_URL?.trim() && process.env.DEEPSEEK_API_KEY?.trim());

  return {
    meta: {
      oauthConnected: Boolean(metaConn?.encryptedTokens),
      account: accountId ?? metaConn?.externalAccount ?? null,
      accountName,
      pageId,
      pageName,
      pipeboardVerify,
      pipeboardError,
      adkitVerify: pipeboardVerify,
      adkitError: pipeboardError,
    },
    google: {
      pipeboardConfigured,
      pipeboardHealth: googlePipeboardHealth,
      pipeboardError: googlePipeboardError,
      oauthConnected: Boolean(googleConn?.encryptedTokens),
      customerId,
      adloopConfigured: pipeboardConfigured,
      adloopHealth: googlePipeboardHealth,
      adloopError: googlePipeboardError,
    },
    research: {
      useproxyConfigured: false,
      useproxyHealth: "skipped",
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
      mastraConfigured: mastraOk,
      mastraHealth: mastraOk ? "ok" : "error",
      mastraError: mastraOk ? undefined : "DATABASE_URL ou DEEPSEEK_API_KEY manquant",
      mem0Configured: mastraOk,
      mem0Health: mastraOk ? "ok" : "error",
      mem0Error: mastraOk ? undefined : "Mastra Memory non prêt",
    },
  };
}
