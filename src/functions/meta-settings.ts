import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { buildAdkitEnv, adkitVerify } from "@/lib/mcp/adkit-bridge";
import {
  getOrgMetaPageId,
  resolveMetaPageId,
  setOrgMetaPageId,
  syncOrgMetaPageFromToken,
} from "@/lib/mcp/meta-org";
import { getMetaPageName, listMetaPages } from "@/lib/platforms/meta-api";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import { getActiveOrgId } from "./context";

export const getMetaSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  let pageId = await getOrgMetaPageId(orgId);

  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  const metaConn = rows.find((r) => r.connector === "meta_ads" && r.status === "connectée");

  let oauthConnected = false;
  let tokenError: string | undefined;
  let pageName: string | null = null;
  let availablePages: { id: string; name: string }[] = [];
  let automationHealth: { ok: boolean; error?: string } = { ok: false, error: "Meta non connecté" };

  if (metaConn?.encryptedTokens) {
    try {
      const tokens = await ensureFreshTokens(metaConn.id, orgId, "meta_ads");
      oauthConnected = true;
      const accountId = tokens.accountId ?? metaConn.externalAccount ?? undefined;

      try {
        availablePages = await listMetaPages(tokens.accessToken, accountId);
      } catch {
        availablePages = [];
      }

      if (!pageId) {
        const synced = await syncOrgMetaPageFromToken(orgId, tokens.accessToken, accountId).catch(() => null);
        if (synced) {
          pageId = synced.pageId;
          pageName = synced.pageName;
        } else if (availablePages[0]) {
          pageId = availablePages[0].id.replace(/\D/g, "") || availablePages[0].id;
          pageName = availablePages[0].name;
          await setOrgMetaPageId(orgId, pageId);
        }
      }

      if (pageId && !pageName) {
        pageName =
          availablePages.find((p) => p.id.replace(/\D/g, "") === pageId || p.id === pageId)?.name ??
          (await getMetaPageName(tokens.accessToken, pageId)) ??
          null;
      }

      try {
        const resolvedPageId = await resolveMetaPageId(orgId, pageId);
        const env = buildAdkitEnv({
          accessToken: tokens.accessToken,
          accountId: accountId ?? "",
          pageId: resolvedPageId ?? undefined,
          allowSpend: false,
        });
        await adkitVerify(env);
        automationHealth = { ok: true };
      } catch (e) {
        automationHealth = {
          ok: false,
          error: e instanceof Error ? e.message : "Vérification Meta échouée",
        };
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Vérification Meta échouée";
      if (!oauthConnected) tokenError = message;
      automationHealth = { ok: false, error: message };
    }
  }

  return {
    oauthConnected,
    tokenError,
    account: oauthConnected ? (metaConn?.externalAccount ?? null) : null,
    pageId,
    pageName,
    availablePages,
    /** @deprecated use automationHealth — kept for callers not yet updated */
    adkitHealth: automationHealth,
    automationHealth,
  };
});

export const setMetaPage = createServerFn({ method: "POST" })
  .inputValidator((data: { pageId: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const pageId = data.pageId.replace(/\D/g, "") || data.pageId.trim();
    if (!pageId) throw new Error("Page ID invalide");
    await setOrgMetaPageId(orgId, pageId);
    return getMetaSetupStatus();
  });
