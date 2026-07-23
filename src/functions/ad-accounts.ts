import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessMemory, connections } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import { listAccessibleGoogleAdsCustomers } from "@/lib/platforms/google-ads-api";
import { listMetaAdAccounts } from "@/lib/platforms/meta-api";
import { listTikTokAdvertisers } from "@/lib/platforms/tiktok-api";
import { listGa4Properties } from "@/lib/platforms/ga4-api";
import { getQuotaStatus } from "@/lib/quotas/enforce";
import { getActiveOrgId } from "./context";
import { uid } from "./utils";

export type AdAccountView = {
  id: string;
  connectionId: string;
  connector: ConnectorId;
  platform: string;
  name: string;
  /** Platform account id (e.g. Meta act_… / numeric) */
  accountId: string;
  masked: string;
  currency: string;
  timezone: string;
};

export type LinkedAdAccount = {
  accountId: string;
  accountName: string;
  connectionId: string;
  connector: ConnectorId;
};

type LinkedStore = {
  accounts: LinkedAdAccount[];
  activeAccountId: string | null;
};

const LINKED_KEY = "linked_ad_accounts";

function maskId(id: string): string {
  const clean = id.replace(/\D/g, "");
  if (clean.length <= 4) return id;
  return `${id.slice(0, 4)}••••${clean.slice(-4)}`;
}

async function readLinked(orgId: string): Promise<LinkedStore> {
  const rows = await db
    .select()
    .from(businessMemory)
    .where(and(eq(businessMemory.organizationId, orgId), eq(businessMemory.key, LINKED_KEY)))
    .limit(1);
  const raw = (rows[0]?.value ?? {}) as Partial<LinkedStore>;
  return {
    accounts: Array.isArray(raw.accounts) ? (raw.accounts as LinkedAdAccount[]) : [],
    activeAccountId: raw.activeAccountId ?? null,
  };
}

async function writeLinked(orgId: string, store: LinkedStore) {
  const existing = await db
    .select()
    .from(businessMemory)
    .where(and(eq(businessMemory.organizationId, orgId), eq(businessMemory.key, LINKED_KEY)))
    .limit(1);
  const now = new Date();
  if (existing[0]) {
    await db
      .update(businessMemory)
      .set({ value: store, source: "user", updatedAt: now })
      .where(eq(businessMemory.id, existing[0].id));
  } else {
    await db.insert(businessMemory).values({
      id: uid("bm"),
      organizationId: orgId,
      key: LINKED_KEY,
      value: store,
      source: "user",
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function activateOnConnection(orgId: string, connectionId: string, accountId: string, accountName: string) {
  const rows = await db.select().from(connections).where(eq(connections.id, connectionId)).limit(1);
  const conn = rows[0];
  if (!conn || conn.organizationId !== orgId || !conn.encryptedTokens) {
    throw new Error("Connexion introuvable");
  }
  const { decryptTokens, encryptTokens } = await import("@/lib/crypto/tokens");
  const tokens = decryptTokens(conn.encryptedTokens);
  tokens.accountId = accountId;
  tokens.accountName = accountName;
  await db
    .update(connections)
    .set({
      encryptedTokens: encryptTokens(tokens),
      externalAccount: accountName,
      updatedAt: new Date(),
    })
    .where(eq(connections.id, connectionId));
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
              accountId: a.id,
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
              accountId: a.id,
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
              accountId: a.id,
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
              accountId: a.id,
              masked: maskId(a.id),
              currency: "—",
              timezone: "—",
            });
          }
          break;
        }
        default: {
          const { getAdapter } = await import("@/lib/platforms/adapter");
          const rows = await getAdapter(connector).listAccounts(tokens);
          for (const a of rows) {
            accounts.push({
              id: `${conn.id}:${a.id}`,
              connectionId: conn.id,
              connector,
              platform: cfg.label,
              name: a.name,
              accountId: a.id,
              masked: maskId(a.id),
              currency: a.currency ?? "—",
              timezone: "—",
            });
          }
          break;
        }
      }
    } catch {
      // skip broken connection
    }
  }

  return accounts;
});

export const listLinkedAdAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const [store, quotas] = await Promise.all([readLinked(orgId), getQuotaStatus(orgId)]);
  return {
    accounts: store.accounts,
    activeAccountId: store.activeAccountId,
    limit: quotas.quotas.adAccounts,
  };
});

export const selectAdAccount = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      connectionId: string;
      accountId: string;
      accountName: string;
      connector?: ConnectorId;
      link?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const quotas = await getQuotaStatus(orgId);
    const limit = quotas.quotas.adAccounts;
    const store = await readLinked(orgId);
    const already = store.accounts.some((a) => a.accountId === data.accountId);
    const shouldLink = data.link !== false;

    if (shouldLink && !already && limit >= 0 && store.accounts.length >= limit) {
      throw new Error(
        `Limite de ${limit} compte${limit > 1 ? "s" : ""} pubs atteinte pour votre plan. Passez à un plan supérieur.`,
      );
    }

    await activateOnConnection(orgId, data.connectionId, data.accountId, data.accountName);

    let accounts = store.accounts;
    if (shouldLink && !already) {
      const rows = await db.select().from(connections).where(eq(connections.id, data.connectionId)).limit(1);
      const connector = (data.connector ?? rows[0]?.connector ?? "meta_ads") as ConnectorId;
      accounts = [
        ...accounts,
        {
          accountId: data.accountId,
          accountName: data.accountName,
          connectionId: data.connectionId,
          connector,
        },
      ];
    } else if (already) {
      accounts = accounts.map((a) =>
        a.accountId === data.accountId ? { ...a, accountName: data.accountName, connectionId: data.connectionId } : a,
      );
    }

    await writeLinked(orgId, { accounts, activeAccountId: data.accountId });
    return { ok: true, linked: accounts.length, limit };
  });

export const unlinkAdAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const store = await readLinked(orgId);
    const accounts = store.accounts.filter((a) => a.accountId !== data.accountId);
    let activeAccountId = store.activeAccountId;
    if (activeAccountId === data.accountId) {
      activeAccountId = accounts[0]?.accountId ?? null;
      if (accounts[0]) {
        await activateOnConnection(
          orgId,
          accounts[0].connectionId,
          accounts[0].accountId,
          accounts[0].accountName,
        );
      }
    }
    await writeLinked(orgId, { accounts, activeAccountId });
    return { ok: true };
  });
