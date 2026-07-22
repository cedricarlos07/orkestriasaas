import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { getOrgGoogleCustomerId, isAdloopServerConfigured } from "@/lib/mcp/adloop-org";
import { probeAdloopHealth } from "@/lib/mcp/clients/adloop";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import { getActiveOrgId } from "./context";

export const getGoogleSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);

  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  const googleConn = rows.find((r) => r.connector === "google_ads" && r.status === "connectée");

  let oauthConnected = false;
  let tokenError: string | undefined;
  if (googleConn) {
    try {
      await ensureFreshTokens(googleConn.id, orgId, "google_ads");
      oauthConnected = true;
    } catch (e) {
      tokenError = e instanceof Error ? e.message : "Token Google Ads invalide";
    }
  }

  const customerId = await getOrgGoogleCustomerId(orgId);
  const adloopConfigured = isAdloopServerConfigured();
  let adloopHealth: { ok: boolean; error?: string } = { ok: false, error: "AdLoop non configuré" };
  if (adloopConfigured) {
    const probe = await probeAdloopHealth();
    adloopHealth = { ok: probe.ok, error: probe.error };
  }

  return {
    oauthConnected,
    tokenError,
    account: googleConn?.externalAccount ?? null,
    customerId,
    adloopConfigured,
    adloopHealth,
    /** Google prêt si AdLoop self-hosted OK (OAuth optionnel pour cibler un compte client). */
    googleReady: adloopHealth.ok,
  };
});

/** @deprecated use getGoogleSetupStatus */
export const getAdloopLinkStatus = getGoogleSetupStatus;
