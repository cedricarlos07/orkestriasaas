import type { PlanId } from "@/lib/pricing/plans";
import { ORKESTRIA_PLANS, type PlanQuotas } from "@/lib/pricing/plans";

/** Extended quotas: product + API rate limits. -1 = unlimited (soft safety still applies). */
export type RateQuotas = PlanQuotas & {
  apiPerMinute: number;
  apiPerHour: number;
  apiPerDay: number;
  mcpCallsPerMonth: number;
  llmCallsPerDay: number;
  writesPerHour: number;
};

const RATE_BY_PLAN: Record<PlanId, Omit<RateQuotas, keyof PlanQuotas>> = {
  solo: { apiPerMinute: 30, apiPerHour: 500, apiPerDay: 2_000, mcpCallsPerMonth: 2_000, llmCallsPerDay: 80, writesPerHour: 20 },
  business: { apiPerMinute: 60, apiPerHour: 2_000, apiPerDay: 8_000, mcpCallsPerMonth: 10_000, llmCallsPerDay: 300, writesPerHour: 60 },
  growth: { apiPerMinute: 120, apiPerHour: 5_000, apiPerDay: 20_000, mcpCallsPerMonth: 40_000, llmCallsPerDay: 800, writesPerHour: 120 },
  autopilot: { apiPerMinute: 180, apiPerHour: 10_000, apiPerDay: 40_000, mcpCallsPerMonth: 80_000, llmCallsPerDay: 1_500, writesPerHour: 200 },
  agency_start: { apiPerMinute: 90, apiPerHour: 3_000, apiPerDay: 12_000, mcpCallsPerMonth: 20_000, llmCallsPerDay: 500, writesPerHour: 80 },
  agency_growth: { apiPerMinute: 200, apiPerHour: 15_000, apiPerDay: 60_000, mcpCallsPerMonth: 120_000, llmCallsPerDay: 2_000, writesPerHour: 300 },
  agency_scale: { apiPerMinute: 400, apiPerHour: 40_000, apiPerDay: 150_000, mcpCallsPerMonth: 400_000, llmCallsPerDay: 5_000, writesPerHour: 600 },
  enterprise: { apiPerMinute: 600, apiPerHour: 100_000, apiPerDay: 400_000, mcpCallsPerMonth: -1, llmCallsPerDay: 15_000, writesPerHour: 1_200 },
};

/** Platform-wide hard caps (protect DeepSeek / infra). */
export const PLATFORM_RATE_LIMITS = {
  globalApiPerMinute: 2_000,
  globalLlmPerMinute: 120,
  globalDailyAiUsd: 300,
} as const;

export function getRateQuotas(planId: PlanId | string | null | undefined): RateQuotas {
  const id = (planId && planId in RATE_BY_PLAN ? planId : "solo") as PlanId;
  const plan = ORKESTRIA_PLANS.find((p) => p.id === id) ?? ORKESTRIA_PLANS[0];
  return { ...plan.quotas, ...RATE_BY_PLAN[id] };
}
