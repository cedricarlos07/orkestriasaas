import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { isPipeboardConfigured, probePipeboardMcp } from "@/mastra/pipeboard-mcp";
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
  const pipeboardConfigured = isPipeboardConfigured();
  let pipeboardHealth: { ok: boolean; error?: string } = {
    ok: false,
    error: "PIPEBOARD_API_TOKEN non configuré",
  };
  if (pipeboardConfigured) {
    const probe = await probePipeboardMcp();
    pipeboardHealth = { ok: probe.ok, error: probe.error };
  }

  const oauthConfigured = hasOAuthCredentials("google_ads");
  const googleReady = oauthConnected && pipeboardConfigured && pipeboardHealth.ok;

  return {
    oauthConnected,
    oauthConfigured,
    tokenError,
    account: oauthConnected ? (googleConn?.externalAccount ?? null) : null,
    customerId,
    pipeboardConfigured,
    pipeboardHealth,
    /** @deprecated aliases for UI compatibility */
    adloopConfigured: pipeboardConfigured,
    adloopHealth: pipeboardHealth,
    agencyReady: pipeboardConfigured && pipeboardHealth.ok,
    googleReady,
  };
});

/** @deprecated use getGoogleSetupStatus */
export const getAdloopLinkStatus = getGoogleSetupStatus;
