import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessMemory, connections } from "@/db/schema/index";
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
    tokenError?: string;
  };
  google: {
    oauthConnected: boolean;
    customerId: string | null;
  };
  research: {
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
  let metaTokenError: string | undefined;

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
      metaTokenError = e instanceof Error ? e.message : "Token Meta invalide";
    }
  } else {
    missingSteps.push("Connecter Meta Ads");
  }

  if (metaConn && !pageId) {
    missingSteps.push("Aucune Page Facebook détectée — reconnectez Meta ou choisissez une Page");
  }

  if (googleConn?.encryptedTokens && !customerId) {
    missingSteps.push("Choisir un compte Google Ads client dans Connexions");
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

  const readyForMeta = Boolean(metaConn?.encryptedTokens) && Boolean(pageId) && !metaTokenError;
  const readyForGoogle = Boolean(googleConn?.encryptedTokens) && Boolean(customerId);
  const readyForCampaign = readyForMeta;

  const mastraOk = Boolean(process.env.DATABASE_URL?.trim() && process.env.DEEPSEEK_API_KEY?.trim());

  return {
    meta: {
      oauthConnected: Boolean(metaConn?.encryptedTokens),
      account: accountId ?? metaConn?.externalAccount ?? null,
      accountName,
      pageId,
      pageName,
      tokenError: metaTokenError,
    },
    google: {
      oauthConnected: Boolean(googleConn?.encryptedTokens),
      customerId,
    },
    research: {
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
    },
  };
}
