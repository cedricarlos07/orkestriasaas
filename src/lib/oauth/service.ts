import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections, oauthStates } from "@/db/schema/index";
import { encryptTokens, type TokenPayload } from "@/lib/crypto/tokens";
import {
  CONNECTORS,
  hasOAuthCredentials,
  oauthCallbackUrl,
  type ConnectorId,
} from "@/lib/oauth/connectors";
import { listAccessibleGoogleAdsCustomers } from "@/lib/platforms/google-ads-api";
import { listGa4Properties } from "@/lib/platforms/ga4-api";
import { listMetaAdAccounts } from "@/lib/platforms/meta-api";
import { listTikTokAdvertisers } from "@/lib/platforms/tiktok-api";
import { uid } from "@/functions/utils";

const STATE_TTL_MS = 15 * 60 * 1000;

export async function createOAuthState(orgId: string, userId: string, connector: ConnectorId): Promise<string> {
  const state = uid("oauth");
  const exp = new Date(Date.now() + STATE_TTL_MS);
  await db.insert(oauthStates).values({
    id: state,
    organizationId: orgId,
    userId,
    connector,
    expiresAt: exp,
    createdAt: new Date(),
  });
  return state;
}

export async function consumeOAuthState(state: string) {
  const rows = await db.select().from(oauthStates).where(eq(oauthStates.id, state)).limit(1);
  const row = rows[0];
  await db.delete(oauthStates).where(eq(oauthStates.id, state));
  if (!row || row.expiresAt < new Date()) throw new Error("État OAuth invalide ou expiré");
  return row;
}

export function buildAuthorizeUrl(connector: ConnectorId, state: string): string {
  if (!hasOAuthCredentials(connector)) {
    throw new Error(`OAuth ${CONNECTORS[connector].label} non configuré`);
  }
  const cfg = CONNECTORS[connector];
  const clientId = process.env[cfg.oauth.clientIdEnv]!;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthCallbackUrl(connector),
    response_type: "code",
    scope: cfg.oauth.scopes.join(cfg.oauth.scopeSeparator ?? " "),
    state,
    ...cfg.oauth.extraParams,
  });
  if (cfg.oauth.usePkce) {
    // Plain PKCE with the state as verifier: no extra storage needed.
    params.set("code_challenge", state);
    params.set("code_challenge_method", "plain");
  }
  return `${cfg.oauth.authorizeUrl}?${params.toString()}`;
}

async function exchangeCode(connector: ConnectorId, code: string, state?: string): Promise<TokenPayload> {
  if (!hasOAuthCredentials(connector)) {
    throw new Error(`OAuth ${CONNECTORS[connector].label} non configuré`);
  }
  const cfg = CONNECTORS[connector];
  const clientId = process.env[cfg.oauth.clientIdEnv]!;
  const clientSecret = process.env[cfg.oauth.clientSecretEnv]!;

  if (connector === "tiktok_ads") {
    const res = await fetch(cfg.oauth.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: clientId,
        secret: clientSecret,
        auth_code: code,
      }),
    });
    if (!res.ok) throw new Error(`TikTok token exchange: ${await res.text()}`);
    const data = (await res.json()) as {
      data?: { access_token: string; refresh_token?: string; expires_in?: number };
    };
    const tok = data.data;
    if (!tok?.access_token) throw new Error("TikTok: access_token manquant");
    return {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
      scopes: cfg.oauth.scopes,
    };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: oauthCallbackUrl(connector),
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (cfg.oauth.tokenAuth === "basic") {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    if (cfg.oauth.usePkce) body.set("client_id", clientId);
  } else {
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  }
  if (cfg.oauth.usePkce && state) body.set("code_verifier", state);

  const res = await fetch(cfg.oauth.tokenUrl, {
    method: "POST",
    headers,
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  let accessToken = data.access_token;

  if (connector === "meta_ads") {
    const longLived = await fetch(
      `${cfg.oauth.tokenUrl}?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${accessToken}`,
    );
    if (longLived.ok) {
      const ll = (await longLived.json()) as { access_token?: string; expires_in?: number };
      if (ll.access_token) {
        accessToken = ll.access_token;
        data.expires_in = ll.expires_in;
      }
    }
  }

  return {
    accessToken,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    scopes: cfg.oauth.scopes,
  };
}

async function resolvePrimaryAccount(connector: ConnectorId, tokens: TokenPayload): Promise<{ accountId: string; accountName: string }> {
  switch (connector) {
    case "google_ads": {
      const accounts = await listAccessibleGoogleAdsCustomers(tokens.accessToken);
      if (!accounts.length) throw new Error("Aucun compte Google Ads accessible avec ce token");
      return { accountId: accounts[0].id, accountName: accounts[0].name };
    }
    case "meta_ads": {
      const accounts = await listMetaAdAccounts(tokens.accessToken);
      if (!accounts.length) throw new Error("Aucun compte Meta Ads accessible");
      return { accountId: accounts[0].id, accountName: accounts[0].name };
    }
    case "tiktok_ads": {
      const appId = process.env.TIKTOK_APP_ID!;
      const secret = process.env.TIKTOK_APP_SECRET!;
      const accounts = await listTikTokAdvertisers(tokens.accessToken, appId, secret);
      if (!accounts.length) throw new Error("Aucun advertiser TikTok accessible");
      return { accountId: accounts[0].id, accountName: accounts[0].name };
    }
    case "ga4": {
      const props = await listGa4Properties(tokens.accessToken);
      if (!props.length) throw new Error("Aucune propriété GA4 accessible");
      return { accountId: props[0].id, accountName: props[0].name };
    }
    default: {
      const { getAdapter } = await import("@/lib/platforms/adapter");
      const accounts = await getAdapter(connector).listAccounts(tokens);
      if (!accounts.length) throw new Error(`Aucun compte ${CONNECTORS[connector].label} accessible`);
      return { accountId: accounts[0].id, accountName: accounts[0].name };
    }
  }
}

export async function upsertConnection(
  orgId: string,
  connector: ConnectorId,
  tokens: TokenPayload,
  externalAccount?: string,
) {
  const existing = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, orgId))
    .then((rows) => rows.find((r) => r.connector === connector));

  const now = new Date();
  const row = {
    connector,
    status: "connectée",
    lastSync: now,
    encryptedTokens: encryptTokens(tokens),
    externalAccount: externalAccount ?? tokens.accountName ?? `${connector} account`,
    scopes: tokens.scopes ?? CONNECTORS[connector].oauth.scopes,
    expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
    updatedAt: now,
  };

  if (existing) {
    await db.update(connections).set(row).where(eq(connections.id, existing.id));
    return existing.id;
  }

  const id = uid("conn");
  await db.insert(connections).values({
    id,
    organizationId: orgId,
    ...row,
    calls24h: 0,
    errorRate: "0",
    createdAt: now,
  });
  return id;
}

export async function handleOAuthCallback(connector: ConnectorId, code: string, state: string) {
  const row = await consumeOAuthState(state);
  if (row.connector && row.connector !== connector) {
    throw new Error("État OAuth ne correspond pas au connecteur");
  }
  const orgId = row.organizationId;
  const tokens = await exchangeCode(connector, code, state);
  const account = await resolvePrimaryAccount(connector, tokens);
  tokens.accountId = account.accountId;
  tokens.accountName = account.accountName;
  await upsertConnection(orgId, connector, tokens, account.accountName);

  if (connector === "meta_ads") {
    const { syncOrgMetaPageFromToken } = await import("@/lib/mcp/meta-org");
    await syncOrgMetaPageFromToken(orgId, tokens.accessToken, tokens.accountId).catch(() => null);
  }

  return orgId;
}

export async function getAuthorizeRedirectAsync(connector: ConnectorId, orgId: string, userId: string): Promise<string> {
  if (!hasOAuthCredentials(connector)) {
    throw new Error(
      `OAuth ${CONNECTORS[connector].label} non configuré. Ajoutez les credentials dans .env.local`,
    );
  }
  const state = await createOAuthState(orgId, userId, connector);
  return buildAuthorizeUrl(connector, state);
}

export async function disconnectConnection(orgId: string, connectionId: string) {
  const rows = await db.select().from(connections).where(eq(connections.id, connectionId)).limit(1);
  const conn = rows[0];
  if (!conn || conn.organizationId !== orgId) throw new Error("Not found");
  await db
    .update(connections)
    .set({ status: "déconnectée", encryptedTokens: null, updatedAt: new Date() })
    .where(eq(connections.id, connectionId));
}

export async function getConnectionTokens(connectionId: string, orgId: string): Promise<TokenPayload | null> {
  const rows = await db.select().from(connections).where(eq(connections.id, connectionId)).limit(1);
  const conn = rows[0];
  if (!conn || conn.organizationId !== orgId || !conn.encryptedTokens) return null;
  const { decryptTokens } = await import("@/lib/crypto/tokens");
  return decryptTokens(conn.encryptedTokens);
}
