import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessMemory, connections, organizationMetadata } from "@/db/schema/index";
import { recordSpend } from "@/lib/mcp/policy-engine";
import { fetchMetaAccountSpendForDay } from "@/lib/platforms/meta-api";
import { fetchGoogleAdsSpendForDay } from "@/lib/platforms/google-ads-api";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import { getMetaConnection } from "@/lib/platforms/meta-connection";

const LINKED_KEY = "linked_ad_accounts";

type LinkedAccount = {
  accountId: string;
  accountName?: string;
  connectionId?: string;
  connector?: string;
};

function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function linkedAccountsForOrg(orgId: string): Promise<LinkedAccount[]> {
  const rows = await db
    .select()
    .from(businessMemory)
    .where(and(eq(businessMemory.organizationId, orgId), eq(businessMemory.key, LINKED_KEY)))
    .limit(1);
  const value = (rows[0]?.value ?? {}) as { accounts?: LinkedAccount[] };
  return Array.isArray(value.accounts) ? value.accounts : [];
}

/** Sync Meta + Google spend for one org into spend_tracking (default: yesterday UTC). */
export async function syncOrgAdSpend(
  orgId: string,
  dayYYYYMMDD = yesterdayUTC(),
): Promise<{ recorded: number; errors: string[] }> {
  const errors: string[] = [];
  let recorded = 0;
  const linked = await linkedAccountsForOrg(orgId);

  const metaAccounts = linked.filter((a) => !a.connector || a.connector === "meta_ads");
  const googleAccounts = linked.filter((a) => a.connector === "google_ads");

  // Meta — prefer linked accounts; fall back to active OAuth account
  try {
    const meta = await getMetaConnection(orgId);
    if (meta) {
      const targets =
        metaAccounts.length > 0
          ? metaAccounts.map((a) => a.accountId)
          : meta.tokens.accountId
            ? [meta.tokens.accountId]
            : [];
      for (const accountId of targets) {
        try {
          const { spend, currency } = await fetchMetaAccountSpendForDay(
            meta.tokens.accessToken,
            accountId,
            dayYYYYMMDD,
          );
          await recordSpend({
            orgId,
            connector: "meta_ads",
            accountId,
            spend,
            currency,
            day: dayYYYYMMDD,
          });
          recorded += 1;
        } catch (e) {
          errors.push(`meta:${accountId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  } catch (e) {
    errors.push(`meta: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Google
  try {
    const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
    const googleConn = rows.find((c) => c.connector === "google_ads" && c.status === "connectée");
    if (googleConn?.encryptedTokens) {
      const tokens = await ensureFreshTokens(googleConn.id, orgId, "google_ads");
      const targets =
        googleAccounts.length > 0
          ? googleAccounts.map((a) => a.accountId)
          : tokens.accountId
            ? [tokens.accountId]
            : [];
      for (const accountId of targets) {
        try {
          const { spend, currency } = await fetchGoogleAdsSpendForDay(
            tokens.accessToken,
            accountId,
            dayYYYYMMDD,
          );
          await recordSpend({
            orgId,
            connector: "google_ads",
            accountId,
            spend,
            currency,
            day: dayYYYYMMDD,
          });
          recorded += 1;
        } catch (e) {
          errors.push(`google:${accountId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  } catch (e) {
    errors.push(`google: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Keep org metadata adSpend in sync (month-to-date approx via yesterday + existing — best effort)
  if (recorded > 0) {
    try {
      const { sumSpendForPeriod, currentPeriod } = await import("@/lib/billing/commission");
      const monthSpend = await sumSpendForPeriod(orgId, currentPeriod());
      await db
        .update(organizationMetadata)
        .set({ adSpend: String(monthSpend), updatedAt: new Date() })
        .where(eq(organizationMetadata.organizationId, orgId));
    } catch {
      /* ignore */
    }
  }

  return { recorded, errors };
}

/** Sync all orgs that have at least one OAuth connection. */
export async function syncAllOrgsAdSpend(dayYYYYMMDD = yesterdayUTC()) {
  const conns = await db.select({ organizationId: connections.organizationId }).from(connections);
  const orgIds = [...new Set(conns.map((c) => c.organizationId))];
  let recorded = 0;
  const errors: string[] = [];
  for (const orgId of orgIds) {
    const r = await syncOrgAdSpend(orgId, dayYYYYMMDD);
    recorded += r.recorded;
    for (const e of r.errors) errors.push(`${orgId}: ${e}`);
  }
  return { orgs: orgIds.length, recorded, errors, day: dayYYYYMMDD };
}
