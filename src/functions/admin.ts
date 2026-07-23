import { createServerFn } from "@tanstack/react-start";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adActions,
  adminAuditLog,
  agentRuns,
  aiLimits,
  approvals,
  complianceEvents,
  connections,
  creativeTemplates,
  featureFlags,
  globalPolicies,
  incidents,
  invoices,
  killSwitches,
  mcpStatusSnapshots,
  member,
  modelRoutes,
  orchestratorPrompts,
  organization,
  organizationMetadata,
  platformIncidents,
  plans,
  providerCosts,
  quotaOverrides,
  skills,
  subscriptions,
  supportTickets,
  systemSettings,
  user,
  userProfiles,
} from "@/db/schema/index";
import { ensureSuperAdmin } from "@/lib/auth.functions";
import { uid } from "./utils";

async function logAdmin(action: string, target?: string, details?: Record<string, unknown>, actorId?: string) {
  await db.insert(adminAuditLog).values({
    id: uid("alog"),
    actorId: actorId ?? null,
    action,
    target: target ?? null,
    details: details ?? {},
    createdAt: new Date(),
  });
}

export const getGlobalKPIs = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  const [orgCount] = await db.select({ count: sql<number>`count(*)` }).from(organization);
  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(user);
  const [runCount] = await db.select({ count: sql<number>`count(*)` }).from(agentRuns);
  const [pendingApprovals] = await db
    .select({ count: sql<number>`count(*)` })
    .from(approvals)
    .where(eq(approvals.status, "pending"));
  const invoiceRows = await db.select().from(invoices);
  const aiCostRows = await db.select().from(providerCosts);
  const aiCostTotal = aiCostRows.reduce((s, r) => s + Number(r.costUsd ?? 0), 0);
  const mrr = invoiceRows.filter((i) => i.status === "payée").reduce((s, i) => s + Number(i.amount), 0);
  return {
    orgs: Number(orgCount?.count ?? 0),
    users: Number(userCount?.count ?? 0),
    runs: Number(runCount?.count ?? 0),
    pendingApprovals: Number(pendingApprovals?.count ?? 0),
    mrr,
    aiCostTotal,
  };
});

export const listOrganizations = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  const orgs = await db.select().from(organization).orderBy(desc(organization.createdAt));
  const meta = await db.select().from(organizationMetadata);
  const metaMap = new Map(meta.map((m) => [m.organizationId, m]));
  const members = await db.select().from(member);
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.organizationId, (counts.get(m.organizationId) ?? 0) + 1);
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    type: metaMap.get(o.id)?.type ?? "entreprise",
    country: metaMap.get(o.id)?.country ?? "—",
    plan: metaMap.get(o.id)?.planId ?? "solo",
    status: metaMap.get(o.id)?.status ?? "active",
    members: counts.get(o.id) ?? 0,
    adAccounts: 0,
    adSpend: Number(metaMap.get(o.id)?.adSpend ?? 0),
    aiSpend: Number(metaMap.get(o.id)?.aiSpend ?? 0),
    createdAt: o.createdAt?.toISOString() ?? "",
    lastActive: o.createdAt?.toISOString() ?? "",
    risk: "faible",
    sector: metaMap.get(o.id)?.sector ?? "—",
    currency: metaMap.get(o.id)?.currency ?? "USD",
    timezone: metaMap.get(o.id)?.timezone ?? "Africa/Abidjan",
    language: metaMap.get(o.id)?.language ?? "fr",
    renewsAt: "",
    accountManager: "—",
    health: metaMap.get(o.id)?.health ?? "ok",
    workspaces: 1,
    autopilot: metaMap.get(o.id)?.autopilot ?? false,
    writeBlocked: metaMap.get(o.id)?.writeBlocked ?? false,
  }));
});

export const listPlatformUsers = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  const users = await db.select().from(user).orderBy(desc(user.createdAt));
  const profiles = await db.select().from(userProfiles);
  const profileMap = new Map(profiles.map((p) => [p.userId, p]));
  const members = await db.select().from(member);
  const orgByUser = new Map(members.map((m) => [m.userId, m]));
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: "",
    orgId: orgByUser.get(u.id)?.organizationId ?? "",
    role: orgByUser.get(u.id)?.role ?? "member",
    country: profileMap.get(u.id)?.country ?? "—",
    status: u.banned ? "suspendu" : "actif",
    twoFA: false,
    lastLogin: u.updatedAt?.toISOString() ?? "",
    device: "—",
    consumption: 0,
    incidents: 0,
  }));
});

export const listInvoices = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  const rows = await db.select().from(invoices).orderBy(desc(invoices.issuedAt));
  return rows.map((i) => ({
    id: i.id,
    orgId: i.organizationId,
    amount: Number(i.amount),
    currency: i.currency ?? "USD",
    status: i.status,
    method: i.method ?? "carte",
    issuedAt: i.issuedAt.toISOString(),
  }));
});

export const listConnections = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(connections).orderBy(desc(connections.updatedAt));
});

export const listAdminRuns = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt));
});

export const listAdActions = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(adActions).orderBy(desc(adActions.createdAt));
});

export const listApprovals = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(approvals).orderBy(desc(approvals.createdAt));
});

export const listIncidents = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(incidents).orderBy(desc(incidents.createdAt));
});

export const listPlatformIncidents = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(platformIncidents).orderBy(desc(platformIncidents.startedAt));
});

export const listMCPStatuses = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(mcpStatusSnapshots).orderBy(desc(mcpStatusSnapshots.updatedAt));
});

export const listFeatureFlags = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(featureFlags);
});

export const updateFeatureFlag = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; enabled: boolean }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSuperAdmin();
    await db
      .update(featureFlags)
      .set({ enabled: data.enabled, updatedAt: new Date() })
      .where(eq(featureFlags.id, data.id));
    await logAdmin("flag.update", data.id, data, session.user.id);
    return { ok: true };
  });

export const listKillSwitches = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(killSwitches);
});

export const toggleKillSwitch = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSuperAdmin();
    await db.update(killSwitches).set({ active: data.active, updatedAt: new Date() }).where(eq(killSwitches.id, data.id));
    await logAdmin("kill.toggle", data.id, data, session.user.id);
    return { ok: true };
  });

export const getGlobalPolicy = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  const rows = await db.select().from(globalPolicies).where(eq(globalPolicies.id, "default")).limit(1);
  return rows[0]?.data ?? {};
});

export const saveGlobalPolicy = createServerFn({ method: "POST" })
  .inputValidator((data: { data: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSuperAdmin();
    const row = { id: "default" as const, data: data.data, updatedAt: new Date() };
    const ex = await db.select().from(globalPolicies).where(eq(globalPolicies.id, "default")).limit(1);
    if (ex[0]) await db.update(globalPolicies).set(row).where(eq(globalPolicies.id, "default"));
    else await db.insert(globalPolicies).values(row);
    await logAdmin("policy.save", "default", {}, session.user.id);
    return row.data;
  });

export const listModelRoutes = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(modelRoutes);
});

export const getAiLimits = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  const rows = await db.select().from(aiLimits).where(eq(aiLimits.id, "default")).limit(1);
  return rows[0] ?? { dailyGlobalUsd: "500", perOrgUsd: "50" };
});

export const listSupportTickets = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
});

export const listAdminAuditLog = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(200);
});

export const getSystemSettings = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.id, "default")).limit(1);
  return rows[0]?.data ?? {};
});

export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(plans);
});

export const listSkills = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(skills);
});

export const listOrchestratorPrompts = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(orchestratorPrompts);
});

export const listCreativeTemplates = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(creativeTemplates);
});

export const listComplianceEvents = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(complianceEvents).orderBy(desc(complianceEvents.createdAt));
});

export const listProviderCosts = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(providerCosts).orderBy(desc(providerCosts.createdAt));
});

export const listQuotaOverrides = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(quotaOverrides);
});

export const listSubscriptions = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  return db.select().from(subscriptions);
});
