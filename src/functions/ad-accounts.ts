import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import { listAccessibleGoogleAdsCustomers } from "@/lib/platforms/google-ads-api";
import { listMetaAdAccounts } from "@/lib/platforms/meta-api";
import { listTikTokAdvertisers } from "@/lib/platforms/tiktok-api";
import { listGa4Properties } from "@/lib/platforms/ga4-api";
import { getActiveOrgId } from "./context";

export type AdAccountView = {
  id: string;
  connectionId: string;
  connector: ConnectorId;
  platform: string;
  name: string;
  masked: string;
  currency: string;
  timezone: string;
};

function maskId(id: string): string {
  const clean = id.replace(/\D/g, "");
  if (clean.length <= 4) return id;
  return `${id.slice(0, 4)}••••${clean.slice(-4)}`;
}

export const listAdAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const conns = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, orgId))
    .then((rows) => rows.filter((c) => c.status === "connectée" && c.encryptedTokens));

  const accounts: AdAccountView[] = [];

  for (const conn of conns) {
    const connector = conn.connector as ConnectorId;
    const cfg = CONNECTORS[connector];
    try {
      const tokens = await ensureFreshTokens(conn.id, orgId, connector);
      switch (connector) {
        case "google_ads": {
          const rows = await listAccessibleGoogleAdsCustomers(tokens.accessToken);
          for (const a of rows) {
            accounts.push({
              id: `${conn.id}:${a.id}`,
              connectionId: conn.id,
              connector,
              platform: cfg.label,
              name: a.name,
              masked: maskId(a.id),
              currency: "—",
              timezone: "—",
            });
          }
          break;
        }
        case "meta_ads": {
          const rows = await listMetaAdAccounts(tokens.accessToken);
          for (const a of rows) {
            accounts.push({
              id: `${conn.id}:${a.id}`,
              connectionId: conn.id,
              connector,
              platform: cfg.label,
              name: a.name,
              masked: maskId(a.id),
              currency: a.currency,
              timezone: "—",
            });
          }
          break;
        }
        case "tiktok_ads": {
          const appId = process.env.TIKTOK_APP_ID!;
          const secret = process.env.TIKTOK_APP_SECRET!;
          const rows = await listTikTokAdvertisers(tokens.accessToken, appId, secret);
          for (const a of rows) {
            accounts.push({
              id: `${conn.id}:${a.id}`,
              connectionId: conn.id,
              connector,
              platform: cfg.label,
              name: a.name,
              masked: maskId(a.id),
              currency: "USD",
              timezone: "—",
            });
          }
          break;
        }
        case "ga4": {
          const rows = await listGa4Properties(tokens.accessToken);
          for (const a of rows) {
            accounts.push({
              id: `${conn.id}:${a.id}`,
              connectionId: conn.id,
              connector,
              platform: cfg.label,
              name: a.name,
              masked: maskId(a.id),
              currency: "—",
              timezone: "—",
            });
          }
          break;
        }
      }
    } catch {
      // skip broken connection — user sees partial list
    }
  }

  return accounts;
});

export const selectAdAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { connectionId: string; accountId: string; accountName: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const rows = await db.select().from(connections).where(eq(connections.id, data.connectionId)).limit(1);
    const conn = rows[0];
    if (!conn || conn.organizationId !== orgId || !conn.encryptedTokens) throw new Error("Connexion introuvable");

    const { decryptTokens, encryptTokens } = await import("@/lib/crypto/tokens");
    const tokens = decryptTokens(conn.encryptedTokens);
    tokens.accountId = data.accountId;
    tokens.accountName = data.accountName;

    await db
      .update(connections)
      .set({
        encryptedTokens: encryptTokens(tokens),
        externalAccount: data.accountName,
        updatedAt: new Date(),
      })
      .where(eq(connections.id, data.connectionId));

    return { ok: true };
  });
