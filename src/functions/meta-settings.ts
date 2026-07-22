import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { buildAdkitEnv, adkitVerify } from "@/lib/mcp/adkit-bridge";
import { getOrgMetaPageId, resolveMetaPageId, setOrgMetaPageId } from "@/lib/mcp/meta-org";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import { getActiveOrgId } from "./context";

export const getMetaSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const pageId = await getOrgMetaPageId(orgId);

  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  const metaConn = rows.find((r) => r.connector === "meta_ads" && r.status === "connectée");

  let oauthConnected = false;
  let tokenError: string | undefined;
  let automationHealth: { ok: boolean; error?: string } = { ok: false, error: "Meta non connecté" };

  if (metaConn) {
    try {
      const tokens = await ensureFreshTokens(metaConn.id, orgId, "meta_ads");
      oauthConnected = true;
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
    /** @deprecated use automationHealth — kept for callers not yet updated */
    adkitHealth: automationHealth,
    automationHealth,
  };
});

export const saveMetaPageId = createServerFn({ method: "POST" })
  .inputValidator((data: { pageId: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const pageId = data.pageId.trim();
    if (!/^\d+$/.test(pageId)) {
      throw new Error("Page ID Meta invalide — attendu un identifiant numérique (ex. depuis Business Manager)");
    }
    await setOrgMetaPageId(orgId, pageId);
    return { ok: true, pageId };
  });

export const clearMetaPageId = createServerFn({ method: "POST" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  await setOrgMetaPageId(orgId, null);
  return { ok: true };
});
