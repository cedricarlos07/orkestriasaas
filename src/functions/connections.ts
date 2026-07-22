import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { CONNECTORS, hasOAuthCredentials, type ConnectorId } from "@/lib/oauth/connectors";
import { disconnectConnection, getAuthorizeRedirectAsync } from "@/lib/oauth/service";
import { getActiveOrgId } from "./context";

export type ConnectionView = {
  id: string;
  connector: ConnectorId;
  label: string;
  group: string;
  status: string;
  externalAccount: string | null;
  lastSync: string | null;
  scopes: string[];
  via: "oauth" | "unified" | "none";
};

function connectorConfigured(id: ConnectorId): boolean {
  return hasOAuthCredentials(id);
}

export const listConnections = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  return rows.map((r) => {
    const cfg = CONNECTORS[r.connector as ConnectorId];
    const via = r.encryptedTokens ? ("oauth" as const) : ("none" as const);
    return {
      id: r.id,
      connector: r.connector as ConnectorId,
      label: cfg?.label ?? r.connector,
      group: cfg?.group ?? "ads",
      status: r.status ?? "déconnectée",
      externalAccount: r.externalAccount,
      lastSync: r.lastSync?.toISOString() ?? null,
      scopes: (r.scopes as string[]) ?? [],
      via,
    } satisfies ConnectionView;
  });
});

export const getOAuthAuthorizeUrl = createServerFn({ method: "GET" })
  .inputValidator((data: { connector: ConnectorId }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const url = await getAuthorizeRedirectAsync(data.connector, orgId, session.user.id);
    return { url };
  });

export const disconnectPlatform = createServerFn({ method: "POST" })
  .inputValidator((data: { connectionId: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    await disconnectConnection(orgId, data.connectionId);
    return listConnections();
  });

export const disconnectConnectorPlatform = createServerFn({ method: "POST" })
  .inputValidator((data: { connector: ConnectorId }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
    const conn = rows.find((r) => r.connector === data.connector && r.status === "connectée");
    if (!conn) {
      throw new Error(`Aucune connexion ${CONNECTORS[data.connector]?.label ?? data.connector} active.`);
    }
    await disconnectConnection(orgId, conn.id);
    if (data.connector === "meta_ads") {
      const { setOrgMetaPageId } = await import("@/lib/mcp/meta-org");
      await setOrgMetaPageId(orgId, null);
    }
    return listConnections();
  });

export const listConnectionCatalog = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSession();
  return Object.values(CONNECTORS).map((c) => ({
    id: c.id,
    label: c.label,
    group: c.group,
    configured: connectorConfigured(c.id),
    connectMode: connectorConfigured(c.id)
      ? hasOAuthCredentials(c.id)
        ? ("oauth" as const)
        : ("unified" as const)
      : ("none" as const),
  }));
});
