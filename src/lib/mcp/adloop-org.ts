import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { isAdloopEnabled, probeAdloopHealth } from "@/lib/mcp/clients/adloop";

/** Synthetic connection id when Google is served via AdLoop MCC (no per-org OAuth). */
export const ADLOOP_CONNECTION_ID = "adloop";

export function isAdloopConnection(connectionId: string): boolean {
  return connectionId === ADLOOP_CONNECTION_ID;
}

/** Google Ads customer ID linked via OAuth (digits only). */
export async function getOrgGoogleCustomerId(orgId: string): Promise<string | null> {
  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  const conn = rows.find((r) => r.connector === "google_ads" && r.status === "connectée");
  const raw = conn?.externalAccount?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits || null;
}

export async function isGoogleAdsOAuthLinked(orgId: string): Promise<boolean> {
  return Boolean(await getOrgGoogleCustomerId(orgId));
}

export function isAdloopServerConfigured(): boolean {
  return isAdloopEnabled();
}

export async function isAdloopHealthy(): Promise<boolean> {
  if (!isAdloopServerConfigured()) return false;
  const probe = await probeAdloopHealth();
  return probe.ok;
}

export function syntheticAdloopConnection(orgId: string) {
  return {
    id: ADLOOP_CONNECTION_ID,
    organizationId: orgId,
    connector: "google_ads",
    status: "connectée",
    lastSync: null,
    calls24h: 0,
    errorRate: "0",
    scopes: [],
    encryptedTokens: null,
    externalAccount: null,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
