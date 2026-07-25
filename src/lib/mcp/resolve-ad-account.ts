import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessMemory } from "@/db/schema/index";
import type { ConnectorId } from "@/lib/oauth/connectors";

const LINKED_KEY = "linked_ad_accounts";

type LinkedStore = {
  accounts?: {
    accountId: string;
    accountName?: string;
    connectionId?: string;
    connector?: string;
  }[];
  activeAccountId?: string | null;
};

/**
 * Prefer the user-selected active ad account from business_memory over the
 * connection's default token accountId (which often stays on the first Meta act).
 */
export async function resolveActiveAdAccountId(
  orgId: string,
  connector: ConnectorId,
): Promise<string | null> {
  const rows = await db
    .select()
    .from(businessMemory)
    .where(and(eq(businessMemory.organizationId, orgId), eq(businessMemory.key, LINKED_KEY)))
    .limit(1);
  const store = (rows[0]?.value ?? {}) as LinkedStore;
  const active = store.activeAccountId?.trim();
  if (active) {
    const match = (store.accounts ?? []).find(
      (a) =>
        a.accountId === active ||
        a.accountId.replace(/^act_/, "") === active.replace(/^act_/, ""),
    );
    if (!match || !match.connector || match.connector === connector) {
      return active.startsWith("act_") || connector !== "meta_ads"
        ? active
        : connector === "meta_ads"
          ? `act_${active.replace(/\D/g, "")}`
          : active;
    }
  }
  const first = (store.accounts ?? []).find((a) => !a.connector || a.connector === connector);
  return first?.accountId ?? null;
}
