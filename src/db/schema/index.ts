import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, integer, jsonb, numeric } from "drizzle-orm/pg-core";

// ─── Better Auth core ───────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: text("role").default("user"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  activeOrganizationId: text("active_organization_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Better Auth organization plugin ─────────────────────────────────────────

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("member_org_id_idx").on(t.organizationId),
    index("member_user_id_idx").on(t.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("invitation_org_id_idx").on(t.organizationId)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, { fields: [member.organizationId], references: [organization.id] }),
  user: one(user, { fields: [member.userId], references: [user.id] }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, { fields: [invitation.organizationId], references: [organization.id] }),
  inviter: one(user, { fields: [invitation.inviterId], references: [user.id] }),
}));

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
  /** Legacy column — unused after AdLoop Cloud removal. */
  adloopApiKeyEncrypted: text("adloop_api_key_encrypted"),
  /** Facebook Page ID for Meta ad creatives (adkit). */
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
