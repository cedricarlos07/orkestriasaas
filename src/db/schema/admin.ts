import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { agentRuns, connections } from "./app";

// ─── Admin / platform domain ──────────────────────────────────────────────────

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  audience: text("audience").notNull(),
  priceMonthly: integer("price_monthly").notNull(),
  priceYearly: integer("price_yearly").notNull(),
  quotas: jsonb("quotas").notNull(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    status: text("status").default("active"),
    renewsAt: timestamp("renews_at"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    billingInterval: text("billing_interval"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("subscriptions_org_id_idx").on(t.organizationId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("USD"),
    status: text("status").default("en_attente"),
    method: text("method"),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
  },
  (t) => [index("invoices_org_id_idx").on(t.organizationId)],
);

export const adActions = pgTable(
  "ad_actions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    connector: text("connector").notNull(),
    action: text("action").notNull(),
    status: text("status").default("pending"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("ad_actions_org_id_idx").on(t.organizationId)],
);

export const approvals = pgTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actionId: text("action_id").references(() => adActions.id, { onDelete: "cascade" }),
    track: text("track"),
    status: text("status").default("pending"),
    requiredApprovers: integer("required_approvers").default(1),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("approvals_org_id_idx").on(t.organizationId)],
);

export const incidents = pgTable("incidents", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  severity: text("severity").default("info"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const platformIncidents = pgTable("platform_incidents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  severity: text("severity").default("SEV-3"),
  status: text("status").default("ouvert"),
  description: text("description"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const featureFlags = pgTable("feature_flags", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  enabled: boolean("enabled").default(false),
  rolloutPct: integer("rollout_pct").default(0),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const killSwitches = pgTable("kill_switches", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  active: boolean("active").default(false),
  reason: text("reason"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const globalPolicies = pgTable("global_policies", {
  id: text("id").primaryKey().default("default"),
  data: jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const modelRoutes = pgTable("model_routes", {
  id: text("id").primaryKey(),
  skill: text("skill").notNull(),
  model: text("model").notNull(),
  priority: integer("priority").default(0),
  active: boolean("active").default(true),
});

export const aiLimits = pgTable("ai_limits", {
  id: text("id").primaryKey().default("default"),
  dailyGlobalUsd: numeric("daily_global_usd", { precision: 10, scale: 2 }).default("500"),
  perOrgUsd: numeric("per_org_usd", { precision: 10, scale: 2 }).default("8"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    status: text("status").default("ouvert"),
    priority: text("priority").default("normale"),
    body: text("body"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("support_tickets_org_id_idx").on(t.organizationId)],
);

export const adminAuditLog = pgTable("admin_audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: text("target"),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const systemSettings = pgTable("system_settings", {
  id: text("id").primaryKey().default("default"),
  data: jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quotaOverrides = pgTable("quota_overrides", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  tempExtraPct: integer("temp_extra_pct").default(0),
  disabledFeatures: jsonb("disabled_features").default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orchestratorPrompts = pgTable("orchestrator_prompts", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  content: text("content").notNull(),
  version: integer("version").default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const creativeTemplates = pgTable("creative_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel"),
  content: jsonb("content").default({}),
  active: boolean("active").default(true),
});

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  config: jsonb("config").default({}),
  active: boolean("active").default(true),
});

export const mcpStatusSnapshots = pgTable("mcp_status_snapshots", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull(),
  label: text("label").notNull(),
  status: text("status").default("ok"),
  latency: integer("latency").default(0),
  uptime: numeric("uptime", { precision: 5, scale: 2 }).default("99.9"),
  errorRate: numeric("error_rate", { precision: 5, scale: 2 }).default("0"),
  calls24h: integer("calls_24h").default(0),
  data: jsonb("data").default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const complianceEvents = pgTable("compliance_events", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  severity: text("severity").default("info"),
  message: text("message").notNull(),
  orgId: text("org_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const providerCosts = pgTable("provider_costs", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  model: text("model"),
  costUsd: numeric("cost_usd", { precision: 12, scale: 4 }).default("0"),
  tokens: integer("tokens").default(0),
  period: text("period"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mcpCalls = pgTable(
  "mcp_calls",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    connectionId: text("connection_id").references(() => connections.id, { onDelete: "set null" }),
    server: text("server").notNull(),
    tool: text("tool").notNull(),
    mode: text("mode").default("read").notNull(),
    status: text("status").default("ok").notNull(),
    latencyMs: integer("latency_ms").default(0),
    error: text("error"),
    params: jsonb("params").default({}),
    result: jsonb("result"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("mcp_calls_org_id_idx").on(t.organizationId),
    index("mcp_calls_run_id_idx").on(t.runId),
  ],
);

export const businessMemory = pgTable(
  "business_memory",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull().default({}),
    source: text("source").default("user"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("business_memory_org_key_idx").on(t.organizationId, t.key)],
);

