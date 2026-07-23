import { and, eq, gte, sql, count } from "drizzle-orm";
import { db } from "@/db";
import {
  agentRuns,
  chatMessages,
  chatThreads,
  organizationMetadata,
  quotaOverrides,
  usageEvents,
} from "@/db/schema/index";
import { getRateQuotas, PLATFORM_RATE_LIMITS, type RateQuotas } from "@/lib/quotas/config";
import type { PlanId } from "@/lib/pricing/plans";
import { uid } from "@/functions/utils";

export class QuotaError extends Error {
  status = 429;
  code: string;
  retryAfterSec?: number;
  constructor(message: string, code: string, retryAfterSec?: number) {
    super(message);
    this.name = "QuotaError";
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

type WindowKey = string;
const buckets = new Map<WindowKey, number[]>();

function prune(ts: number[], windowMs: number, now: number): number[] {
  const cut = now - windowMs;
  let i = 0;
  while (i < ts.length && ts[i]! < cut) i++;
  return i > 0 ? ts.slice(i) : ts;
}

function hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number; used: number } {
  if (limit < 0) return { ok: true, retryAfterSec: 0, used: 0 };
  const now = Date.now();
  const next = prune(buckets.get(key) ?? [], windowMs, now);
  if (next.length >= limit) {
    const oldest = next[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, next);
    return { ok: false, retryAfterSec, used: next.length };
  }
  next.push(now);
  buckets.set(key, next);
  return { ok: true, retryAfterSec: 0, used: next.length };
}

function monthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

function dayStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

async function loadOrgPlan(orgId: string): Promise<{
  planId: PlanId;
  quotas: RateQuotas;
  writeBlocked: boolean;
  status: string;
  extraPct: number;
}> {
  const meta = await db
    .select()
    .from(organizationMetadata)
    .where(eq(organizationMetadata.organizationId, orgId))
    .limit(1);
  const ov = await db
    .select()
    .from(quotaOverrides)
    .where(eq(quotaOverrides.organizationId, orgId))
    .limit(1);
  const planId = (meta[0]?.planId ?? "solo") as PlanId;
  const base = getRateQuotas(planId);
  const extraPct = ov[0]?.tempExtraPct ?? 0;
  const scale = (n: number) => (n < 0 ? n : Math.round(n * (1 + extraPct / 100)));
  return {
    planId,
    quotas: {
      ...base,
      runsPerMonth: scale(base.runsPerMonth),
      mcpCallsPerMonth: scale(base.mcpCallsPerMonth),
      apiPerDay: scale(base.apiPerDay),
      llmCallsPerDay: scale(base.llmCallsPerDay),
      aiBudgetUsdMonthly: scale(base.aiBudgetUsdMonthly),
    },
    writeBlocked: Boolean(meta[0]?.writeBlocked),
    status: meta[0]?.status ?? "active",
    extraPct,
  };
}

export type UsageKind = "mcp_call" | "agent_run" | "llm_call" | "write";

export async function recordUsage(opts: {
  orgId: string;
  kind: UsageKind;
  costUsd?: number;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(usageEvents).values({
      id: uid("ue"),
      organizationId: opts.orgId,
      kind: opts.kind,
      costUsd: String(opts.costUsd ?? 0),
      meta: opts.meta ?? {},
      createdAt: new Date(),
    });
  } catch (e) {
    console.warn("[quotas] recordUsage failed", e);
  }
}

async function countUsage(orgId: string, kind: UsageKind, since: Date): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.organizationId, orgId),
        eq(usageEvents.kind, kind),
        gte(usageEvents.createdAt, since),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

async function sumAiCostMonth(orgId: string): Promise<number> {
  const since = monthStart();
  const fromEvents = await db
    .select({ total: sql<string>`coalesce(sum(${usageEvents.costUsd}), 0)` })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.organizationId, orgId),
        eq(usageEvents.kind, "llm_call"),
        gte(usageEvents.createdAt, since),
      ),
    );
  const fromRuns = await db
    .select({ total: sql<string>`coalesce(sum(${agentRuns.costUsd}), 0)` })
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, orgId), gte(agentRuns.createdAt, since)));
  return Number(fromEvents[0]?.total ?? 0) + Number(fromRuns[0]?.total ?? 0);
}

async function countRunsMonth(orgId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, orgId), gte(agentRuns.createdAt, monthStart())));
  return Number(rows[0]?.n ?? 0);
}

async function countChatLlmToday(orgId: string): Promise<number> {
  // Approximate: user messages today in org threads (= LLM turns)
  const since = dayStart();
  const rows = await db
    .select({ n: count() })
    .from(chatMessages)
    .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
    .where(
      and(
        eq(chatThreads.organizationId, orgId),
        eq(chatMessages.role, "user"),
        gte(chatMessages.createdAt, since),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

export type EnforceOpts = {
  orgId: string;
  kind: UsageKind;
  /** Estimated LLM cost for this call (USD). */
  costUsd?: number;
  /** Tool name for write classification. */
  tool?: string;
};

/**
 * Check rate + monthly quotas. Throws QuotaError (429) when exceeded.
 * Call before the expensive work; call recordUsage after success.
 */
export async function enforceQuotas(opts: EnforceOpts): Promise<{
  planId: PlanId;
  quotas: RateQuotas;
  headers: Record<string, string>;
}> {
  const org = await loadOrgPlan(opts.orgId);
  if (org.writeBlocked || org.status === "impayée" || org.status === "suspendue") {
    throw new QuotaError(
      "Compte bloqué (impayé ou suspendu). Régularisez la facturation pour continuer.",
      "billing_blocked",
    );
  }

  const q = org.quotas;
  const orgId = opts.orgId;

  // Platform global
  const gApi = hit("global:api", PLATFORM_RATE_LIMITS.globalApiPerMinute, 60_000);
  if (!gApi.ok) {
    throw new QuotaError("Rate limit global atteint. Réessayez dans quelques secondes.", "global_rate", gApi.retryAfterSec);
  }
  if (opts.kind === "llm_call") {
    const gLlm = hit("global:llm", PLATFORM_RATE_LIMITS.globalLlmPerMinute, 60_000);
    if (!gLlm.ok) {
      throw new QuotaError("Rate limit IA global atteint.", "global_llm_rate", gLlm.retryAfterSec);
    }
  }

  // Per-org sliding windows
  const checks: { key: string; limit: number; windowMs: number; code: string; label: string }[] = [
    { key: `${orgId}:api:m`, limit: q.apiPerMinute, windowMs: 60_000, code: "api_per_minute", label: "appels / minute" },
    { key: `${orgId}:api:h`, limit: q.apiPerHour, windowMs: 3_600_000, code: "api_per_hour", label: "appels / heure" },
    { key: `${orgId}:api:d`, limit: q.apiPerDay, windowMs: 86_400_000, code: "api_per_day", label: "appels / jour" },
  ];
  if (opts.kind === "write") {
    checks.push({
      key: `${orgId}:write:h`,
      limit: q.writesPerHour,
      windowMs: 3_600_000,
      code: "writes_per_hour",
      label: "écritures / heure",
    });
  }
  if (opts.kind === "llm_call") {
    checks.push({
      key: `${orgId}:llm:m`,
      limit: Math.max(10, Math.floor(q.apiPerMinute / 2)),
      windowMs: 60_000,
      code: "llm_per_minute",
      label: "appels IA / minute",
    });
  }

  for (const c of checks) {
    const r = hit(c.key, c.limit, c.windowMs);
    if (!r.ok) {
      throw new QuotaError(
        `Quota ${c.label} dépassé (plan ${org.planId}). Réessayez dans ~${r.retryAfterSec}s ou passez à un plan supérieur.`,
        c.code,
        r.retryAfterSec,
      );
    }
  }

  // Durable monthly / daily
  if (opts.kind === "mcp_call" && q.mcpCallsPerMonth >= 0) {
    const used = await countUsage(orgId, "mcp_call", monthStart());
    if (used >= q.mcpCallsPerMonth) {
      throw new QuotaError(
        `Quota MCP mensuel atteint (${used}/${q.mcpCallsPerMonth}). Upgradez votre plan.`,
        "mcp_monthly",
      );
    }
  }

  if (opts.kind === "agent_run" && q.runsPerMonth >= 0) {
    const used = await countRunsMonth(orgId);
    if (used >= q.runsPerMonth) {
      throw new QuotaError(
        `Quota de runs mensuel atteint (${used}/${q.runsPerMonth}). Upgradez votre plan.`,
        "runs_monthly",
      );
    }
  }

  if (opts.kind === "llm_call" && q.llmCallsPerDay >= 0) {
    const fromEvents = await countUsage(orgId, "llm_call", dayStart());
    const fromChat = await countChatLlmToday(orgId);
    const used = Math.max(fromEvents, fromChat);
    if (used >= q.llmCallsPerDay) {
      throw new QuotaError(
        `Quota IA journalier atteint (${used}/${q.llmCallsPerDay}). Réessayez demain ou upgradez.`,
        "llm_daily",
      );
    }
  }

  if ((opts.kind === "llm_call" || opts.costUsd) && q.aiBudgetUsdMonthly >= 0) {
    const spent = await sumAiCostMonth(orgId);
    const next = spent + (opts.costUsd ?? 0.002);
    if (next > q.aiBudgetUsdMonthly) {
      throw new QuotaError(
        `Budget IA mensuel dépassé ($${spent.toFixed(2)} / $${q.aiBudgetUsdMonthly}). Upgradez votre plan.`,
        "ai_budget",
      );
    }
  }

  return {
    planId: org.planId,
    quotas: q,
    headers: {
      "X-RateLimit-Plan": org.planId,
      "X-RateLimit-Limit-Minute": String(q.apiPerMinute),
      "X-RateLimit-Limit-Hour": String(q.apiPerHour),
    },
  };
}

export async function getQuotaStatus(orgId: string) {
  const org = await loadOrgPlan(orgId);
  const q = org.quotas;
  const [mcpMonth, runsMonth, llmDay, aiSpend] = await Promise.all([
    countUsage(orgId, "mcp_call", monthStart()),
    countRunsMonth(orgId),
    countUsage(orgId, "llm_call", dayStart()),
    sumAiCostMonth(orgId),
  ]);
  return {
    planId: org.planId,
    status: org.status,
    writeBlocked: org.writeBlocked,
    extraPct: org.extraPct,
    quotas: q,
    usage: {
      mcpCallsMonth: mcpMonth,
      runsMonth,
      llmCallsDay: llmDay,
      aiSpendUsdMonth: aiSpend,
    },
    remaining: {
      mcpCallsMonth: q.mcpCallsPerMonth < 0 ? null : Math.max(0, q.mcpCallsPerMonth - mcpMonth),
      runsMonth: q.runsPerMonth < 0 ? null : Math.max(0, q.runsPerMonth - runsMonth),
      llmCallsDay: q.llmCallsPerDay < 0 ? null : Math.max(0, q.llmCallsPerDay - llmDay),
      aiBudgetUsd: q.aiBudgetUsdMonthly < 0 ? null : Math.max(0, q.aiBudgetUsdMonthly - aiSpend),
    },
  };
}

const WRITE_TOOLS = new Set([
  "execute",
  "approve_action",
  "create_campaign",
  "create_search_campaign",
  "create_pmax_campaign",
  "create_meta_campaign",
  "create_ad_set",
  "create_ad",
  "update_budget",
  "pause_campaign",
  "enable_campaign",
  "pause_ad_set",
  "enable_ad_set",
  "pause_ad",
  "launch_meta_brief",
  "activate_meta_campaign",
  "upload_creative",
  "autonomy_tick",
  "set_policy",
]);

export function classifyTool(toolName: string): UsageKind {
  if (WRITE_TOOLS.has(toolName)) return "write";
  return "mcp_call";
}
