import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { buildAdkitEnv, adkitVerify } from "@/lib/mcp/adkit-bridge";
import { getOrgMetaPageId, resolveMetaPageId, syncOrgMetaPageFromToken } from "@/lib/mcp/meta-org";
import { listMetaPages } from "@/lib/platforms/meta-api";
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
  let automationHealth: { ok: boolean; error?: string } = { ok: false, error: "Meta non connecté" };

  if (metaConn) {
    try {
      const tokens = await ensureFreshTokens(metaConn.id, orgId, "meta_ads");
      oauthConnected = true;

      if (!pageId) {
        const synced = await syncOrgMetaPageFromToken(orgId, tokens.accessToken);
        if (synced) {
          pageId = synced.pageId;
          pageName = synced.pageName;
        }
      }

      if (pageId && !pageName) {
        try {
          const pages = await listMetaPages(tokens.accessToken);
          pageName = pages.find((p) => p.id.replace(/\D/g, "") === pageId || p.id === pageId)?.name ?? null;
        } catch {
          /* non-blocking */
        }
      }

      const resolvedPageId = await resolveMetaPageId(orgId, pageId);
      const env = buildAdkitEnv({
        accessToken: tokens.accessToken,
        accountId: tokens.accountId ?? metaConn.externalAccount ?? "",
        pageId: resolvedPageId ?? undefined,
        allowSpend: false,
      });
      await adkitVerify(env);
      automationHealth = { ok: true };
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
    /** @deprecated use automationHealth — kept for callers not yet updated */
    adkitHealth: automationHealth,
    automationHealth,
  };
});
