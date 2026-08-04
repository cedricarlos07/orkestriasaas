import { and, eq, like, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { spendTracking } from "@/db/schema/index";

/** Advertiser commission on Meta + Google ad spend. */
export const COMMISSION_RATE = 0.08;
export const COMMISSION_FLOOR_USD = 15;
export const COMMISSION_CEILING_USD = 400;
export const COMMISSION_GRACE_SPEND_USD = 100;

export type CommissionComputeInput = {
  /** Ad spend for the billing month (USD). */
  monthSpendUsd: number;
  /** Cumulative ad spend before this month (USD) — for grace. */
  lifetimeSpendBeforeMonthUsd: number;
};

export type CommissionComputeResult = {
  monthSpendUsd: number;
  graceRemainingUsd: number;
  billableSpendUsd: number;
  rawCommissionUsd: number;
  commissionUsd: number;
  inGrace: boolean;
  floored: boolean;
  capped: boolean;
};

export function computeCommission(input: CommissionComputeInput): CommissionComputeResult {
  const monthSpendUsd = Math.max(0, Number(input.monthSpendUsd) || 0);
  const before = Math.max(0, Number(input.lifetimeSpendBeforeMonthUsd) || 0);
  const graceUsed = Math.min(before, COMMISSION_GRACE_SPEND_USD);
  const graceRemainingUsd = Math.max(0, COMMISSION_GRACE_SPEND_USD - graceUsed);

  const coveredByGrace = Math.min(monthSpendUsd, graceRemainingUsd);
  const billableSpendUsd = Math.max(0, monthSpendUsd - coveredByGrace);
  const inGrace = billableSpendUsd <= 0;

  if (inGrace || monthSpendUsd <= 0) {
    return {
      monthSpendUsd,
      graceRemainingUsd: Math.max(0, graceRemainingUsd - coveredByGrace),
      billableSpendUsd: 0,
      rawCommissionUsd: 0,
      commissionUsd: 0,
      inGrace: monthSpendUsd > 0 ? true : graceRemainingUsd > 0,
      floored: false,
      capped: false,
    };
  }

  const rawCommissionUsd = billableSpendUsd * COMMISSION_RATE;
  let commissionUsd = rawCommissionUsd;
  let floored = false;
  let capped = false;

  if (commissionUsd < COMMISSION_FLOOR_USD) {
    commissionUsd = COMMISSION_FLOOR_USD;
    floored = true;
  }
  if (commissionUsd > COMMISSION_CEILING_USD) {
    commissionUsd = COMMISSION_CEILING_USD;
    capped = true;
  }

  return {
    monthSpendUsd,
    graceRemainingUsd: 0,
    billableSpendUsd,
    rawCommissionUsd: round2(rawCommissionUsd),
    commissionUsd: round2(commissionUsd),
    inGrace: false,
    floored,
    capped,
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
  const [monthSpendUsd, lifetimeSpendBeforeMonthUsd] = await Promise.all([
    sumSpendForPeriod(orgId, periodYYYYMM),
    sumSpendBeforePeriod(orgId, periodYYYYMM),
  ]);
  return {
    period: periodYYYYMM,
    ...computeCommission({ monthSpendUsd, lifetimeSpendBeforeMonthUsd }),
  };
}
