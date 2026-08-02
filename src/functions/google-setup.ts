import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { resolveActiveAdAccountId } from "@/lib/mcp/resolve-ad-account";
import { hasOAuthCredentials } from "@/lib/oauth/connectors";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import { getActiveOrgId } from "./context";

export const getGoogleSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);

  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  const googleConn = rows.find((r) => r.connector === "google_ads" && r.status === "connectée");

  let oauthConnected = false;
  let tokenError: string | undefined;
  if (googleConn?.encryptedTokens) {
    try {
      await ensureFreshTokens(googleConn.id, orgId, "google_ads");
      oauthConnected = true;
    } catch (e) {
      tokenError = e instanceof Error ? e.message : "Token Google Ads invalide";
    }
  }

  const customerId = await resolveActiveAdAccountId(orgId, "google_ads");
  const oauthConfigured = hasOAuthCredentials("google_ads");
  const googleReady = oauthConnected && Boolean(customerId);

  return {
    oauthConnected,
    oauthConfigured,
    tokenError,
    account: oauthConnected ? (googleConn?.externalAccount ?? null) : null,
    customerId,
    googleReady,
  };
});
