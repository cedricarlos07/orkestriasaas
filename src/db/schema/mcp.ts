import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

// ─── Orkestria MCP (agent access) ────────────────────────────────────────────

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    /** Displayable prefix, e.g. "ork_a1b2c3…" — the full key is never stored. */
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    scopes: jsonb("scopes").notNull().default(["read"]),
    lastUsedAt: timestamp("last_used_at"),
    /** Null = never expires (legacy keys). New keys get a bounded lifetime. */
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("api_keys_org_id_idx").on(t.organizationId)],
);

export const orgPolicies = pgTable("org_policies", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  /** dry_run | approval | live */
  defaultMode: text("default_mode").default("dry_run").notNull(),
  dailySpendCap: numeric("daily_spend_cap", { precision: 14, scale: 2 }),
  monthlySpendCap: numeric("monthly_spend_cap", { precision: 14, scale: 2 }),
  maxBudgetChangePct: integer("max_budget_change_pct").default(50),
  protectedCampaignIds: jsonb("protected_campaign_ids").notNull().default([]),
  /** Per-connector caps: { meta_ads: { daily: 100000, monthly: 2000000 } } */
  platformCaps: jsonb("platform_caps").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const actionRuns = pgTable(
  "action_runs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    apiKeyId: text("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
    connector: text("connector"),
    tool: text("tool").notNull(),
    /** read | dry_run | approval | live */
    mode: text("mode").notNull(),
    /** ok | error | pending_approval | blocked */
    status: text("status").notNull(),
    params: jsonb("params").default({}),
    result: jsonb("result"),
    error: text("error"),
    approvalId: text("approval_id"),
    latencyMs: integer("latency_ms").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("action_runs_org_id_idx").on(t.organizationId),
    index("action_runs_created_idx").on(t.createdAt),
  ],
);

export const spendTracking = pgTable(
  "spend_tracking",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    connector: text("connector").notNull(),
    accountId: text("account_id"),
    /** YYYY-MM-DD */
    day: text("day").notNull(),
    spend: numeric("spend", { precision: 14, scale: 2 }).notNull().default("0"),
    currency: text("currency").default("USD"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("spend_tracking_org_day_idx").on(t.organizationId, t.connector, t.day)],
);

export const oauthStates = pgTable(
  "oauth_states",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    connector: text("connector").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("oauth_states_expires_idx").on(t.expiresAt)],
);

/** Durable usage counters for quotas (MCP / LLM / writes). */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).default("0"),
    meta: jsonb("meta").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("usage_events_org_created_idx").on(t.organizationId, t.createdAt),
    index("usage_events_org_kind_idx").on(t.organizationId, t.kind),
  ],
);

/**
 * Durable fixed-window rate limit counters. Survives restarts and is shared
 * across workers, unlike the in-process buckets used for plan quotas.
 * `bucket` is an opaque key such as `ip:1.2.3.4:auth_signin` or `key:<id>:mcp`.
 */
/** App-level fixed-window rate limits (distinct from Better Auth `rateLimit` table). */
export const appRateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").notNull(),
    /** Start of the fixed window (epoch seconds, aligned on windowSec). */
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.bucket, t.windowStart] }),
    index("rate_limits_expires_idx").on(t.expiresAt),
  ],
);
