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

// ─── App domain ───────────────────────────────────────────────────────────────

export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  appRole: text("app_role").notNull(), // client | agency
  company: text("company").notNull(),
  sector: text("sector"),
  size: text("size"),
  country: text("country"),
  language: text("language").default("fr"),
  currency: text("currency").default("USD"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationMetadata = pgTable("organization_metadata", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  type: text("type").default("entreprise"),
  planId: text("plan_id").default("solo"),
  status: text("status").default("active"),
  sector: text("sector"),
  country: text("country"),
  currency: text("currency").default("USD"),
  timezone: text("timezone").default("Africa/Abidjan"),
  language: text("language").default("fr"),
  health: text("health").default("ok"),
  autopilot: boolean("autopilot").default(false),
  writeBlocked: boolean("write_blocked").default(false),
  /** Facebook Page ID for Meta ad creatives (Graph API). */
  metaPageId: text("meta_page_id"),
  /** Stripe Billing (live) */
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  billingInterval: text("billing_interval"),
  adSpend: numeric("ad_spend", { precision: 14, scale: 2 }).default("0"),
  aiSpend: numeric("ai_spend", { precision: 14, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const onboardingSessions = pgTable("onboarding_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default({}),
  step: integer("step").default(0),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaigns = pgTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    channel: text("channel").notNull(),
    status: text("status").default("draft").notNull(),
    spend: text("spend").default("0"),
    conv: integer("conv").default(0),
    roas: text("roas").default("—"),
    zone: text("zone"),
    budget: text("budget"),
    externalId: text("external_id"),
    connector: text("connector"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("campaigns_org_id_idx").on(t.organizationId)],
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    goal: text("goal").notNull(),
    skill: text("skill"),
    tool: text("tool"),
    state: text("state").default("received").notNull(),
    idempotencyKey: text("idempotency_key"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 4 }).default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("agent_runs_org_id_idx").on(t.organizationId)],
);

export const runEvents = pgTable(
  "run_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("run_events_run_id_idx").on(t.runId)],
);

export const auditRuns = pgTable(
  "audit_runs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    status: text("status").default("running").notNull(),
    stepIndex: integer("step_index").default(0),
    totalSteps: integer("total_steps").default(5),
    period: text("period"),
    spend: text("spend"),
    conv: integer("conv"),
    cpa: text("cpa"),
    roas: text("roas"),
    summary: jsonb("summary"),
    runId: text("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [index("audit_runs_org_id_idx").on(t.organizationId)],
);

export const auditFindings = pgTable("audit_findings", {
  id: text("id").primaryKey(),
  auditId: text("audit_id")
    .notNull()
    .references(() => auditRuns.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  kind: text("kind").notNull(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    read: boolean("read").default(false),
    emailSent: boolean("email_sent").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("notifications_org_id_idx").on(t.organizationId)],
);

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").default("Nouvelle conversation"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("chat_threads_org_id_idx").on(t.organizationId)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    text: text("text").notNull(),
    tools: jsonb("tools"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("chat_messages_thread_id_idx").on(t.threadId)],
);

export const contactSubmissions = pgTable("contact_submissions", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  context: jsonb("context").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const availabilityConfig = pgTable("availability_config", {
  id: text("id").primaryKey().default("default"),
  timezone: text("timezone").default("Africa/Abidjan"),
  durationMin: integer("duration_min").default(30),
  bufferMin: integer("buffer_min").default(10),
  workingDays: jsonb("working_days").default([1, 2, 3, 4, 5]),
  startHour: integer("start_hour").default(9),
  endHour: integer("end_hour").default(18),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  topic: text("topic").notNull(),
  message: text("message"),
  startIso: timestamp("start_iso").notNull(),
  endIso: timestamp("end_iso").notNull(),
  status: text("status").default("confirmed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const connections = pgTable(
  "connections",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    connector: text("connector").notNull(),
    status: text("status").default("déconnectée"),
    lastSync: timestamp("last_sync"),
    calls24h: integer("calls_24h").default(0),
    errorRate: numeric("error_rate", { precision: 5, scale: 2 }).default("0"),
    scopes: jsonb("scopes").default([]),
    encryptedTokens: text("encrypted_tokens"),
    externalAccount: text("external_account"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("connections_org_id_idx").on(t.organizationId)],
);

