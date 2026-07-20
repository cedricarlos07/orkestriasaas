import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { encryptTokens, type TokenPayload } from "@/lib/crypto/tokens";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";
import { ADKIT_LINK_MARKER } from "@/lib/mcp/adkit-org";

export async function ensureFreshTokens(
  connectionId: string,
  orgId: string,
  connector: ConnectorId,
): Promise<TokenPayload> {
  const rows = await db.select().from(connections).where(eq(connections.id, connectionId)).limit(1);
  const conn = rows[0];
  if (!conn || conn.organizationId !== orgId || !conn.encryptedTokens) {
    throw new Error("Connexion introuvable ou tokens absents");
  }

  if (conn.encryptedTokens === ADKIT_LINK_MARKER) {
    return {
      accessToken: ADKIT_LINK_MARKER,
      accountName: conn.externalAccount ?? undefined,
    };
  }

  const { decryptTokens } = await import("@/lib/crypto/tokens");
  const tokens = decryptTokens(conn.encryptedTokens);

  const expiresSoon = tokens.expiresAt && tokens.expiresAt < Date.now() + 60_000;
  if (!expiresSoon || !tokens.refreshToken) return tokens;

  const refreshed = await refreshConnectorTokens(connector, tokens.refreshToken);
  const merged: TokenPayload = {
    ...tokens,
    ...refreshed,
    accountId: tokens.accountId,
    accountName: tokens.accountName,
  };

  await db
    .update(connections)
    .set({
      encryptedTokens: encryptTokens(merged),
      expiresAt: merged.expiresAt ? new Date(merged.expiresAt) : null,
      lastSync: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(connections.id, connectionId));

  return merged;
}

async function refreshConnectorTokens(
  connector: ConnectorId,
  refreshToken: string,
): Promise<Pick<TokenPayload, "accessToken" | "refreshToken" | "expiresAt">> {
  const cfg = CONNECTORS[connector];

  if (connector === "tiktok_ads") {
    const appId = process.env.TIKTOK_APP_ID!;
    const secret = process.env.TIKTOK_APP_SECRET!;
    const res = await fetch(cfg.oauth.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: appId,
        secret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`TikTok token refresh failed: ${await res.text()}`);
    const data = (await res.json()) as {
      data?: { access_token: string; refresh_token?: string; expires_in?: number };
    };
    const tok = data.data;
    if (!tok?.access_token) throw new Error("TikTok refresh: missing access_token");
    return {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? refreshToken,
      expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
    };
  }

  const clientId = process.env[cfg.oauth.clientIdEnv]!;
  const clientSecret = process.env[cfg.oauth.clientSecretEnv]!;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(cfg.oauth.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token refresh failed (${connector}): ${await res.text()}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}
