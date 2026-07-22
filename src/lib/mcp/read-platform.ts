import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";
import { routeReadSnapshot } from "@/lib/mcp/execution-router";
import type { UnifiedAccountSnapshot } from "@/lib/unified-ad-schema";

export async function readPlatformSnapshot(opts: {
  orgId: string;
  connectionId: string;
  connector: ConnectorId;
  period?: string;
  accountId?: string;
}): Promise<{ snapshot: UnifiedAccountSnapshot; upstream: string }> {
  const { snapshot, upstream } = await routeReadSnapshot({
    orgId: opts.orgId,
    connector: opts.connector,
    connectionId: opts.connectionId,
    period: opts.period,
    accountId: opts.accountId,
  });
  return { snapshot, upstream };
}

export async function readSnapshotsForOrg(
  orgId: string,
  period?: string,
): Promise<UnifiedAccountSnapshot[]> {
  const conns = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, orgId))
    .then((rows) => rows.filter((c) => c.status === "connectée"));

  const snapshots: UnifiedAccountSnapshot[] = [];
  for (const conn of conns) {
    const connector = conn.connector as ConnectorId;
    if (!CONNECTORS[connector]) continue;
    try {
      const { snapshot } = await routeReadSnapshot({
        orgId,
        connector,
        connectionId: conn.id,
        period,
      });
      snapshots.push(snapshot);
    } catch {
      // skip failed connector
    }
  }
  return snapshots;
}
