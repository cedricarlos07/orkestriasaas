import { and, eq, like, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { spendTracking } from "@/db/schema/index";

/** Advertiser commission on Meta + Google ad spend — flat rate, no floor/ceiling/grace. */
export const COMMISSION_RATE = 0.08;

export type CommissionComputeInput = {
  /** Ad spend for the billing month (USD). */
  monthSpendUsd: number;
};

export type CommissionComputeResult = {
  monthSpendUsd: number;
  billableSpendUsd: number;
  rawCommissionUsd: number;
  commissionUsd: number;
};

export function computeCommission(input: CommissionComputeInput): CommissionComputeResult {
  const monthSpendUsd = Math.max(0, Number(input.monthSpendUsd) || 0);
  const billableSpendUsd = monthSpendUsd;
  const commissionUsd = round2(billableSpendUsd * COMMISSION_RATE);

  return {
    monthSpendUsd,
    billableSpendUsd,
    rawCommissionUsd: commissionUsd,
    commissionUsd,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Previous calendar month `YYYY-MM` (UTC). */
export function previousPeriod(from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

export async function sumSpendForPeriod(orgId: string, periodYYYYMM: string): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`coalesce(sum(${spendTracking.spend}), 0)` })
    .from(spendTracking)
    .where(and(eq(spendTracking.organizationId, orgId), like(spendTracking.day, `${periodYYYYMM}%`)));
  return Number(rows[0]?.total ?? 0);
}

export async function sumSpendBeforePeriod(orgId: string, periodYYYYMM: string): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`coalesce(sum(${spendTracking.spend}), 0)` })
    .from(spendTracking)
    .where(and(eq(spendTracking.organizationId, orgId), lt(spendTracking.day, `${periodYYYYMM}-01`)));
  return Number(rows[0]?.total ?? 0);
}

export async function getCommissionForOrg(
  orgId: string,
  periodYYYYMM = currentPeriod(),
): Promise<CommissionComputeResult & { period: string }> {
  const monthSpendUsd = await sumSpendForPeriod(orgId, periodYYYYMM);
  return {
    period: periodYYYYMM,
    ...computeCommission({ monthSpendUsd }),
  };
}
