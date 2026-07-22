import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  aiLimits,
  availabilityConfig,
  featureFlags,
  globalPolicies,
  killSwitches,
  mcpStatusSnapshots,
  plans,
  systemSettings,
  user,
} from "./schema/index";

config({ path: ".env.local" });

const PLANS_SEED = [
  { id: "solo", name: "Solo", audience: "annonceur", priceMonthly: 9000, priceYearly: 90000, quotas: { runsPerMonth: 30 } },
  { id: "business", name: "Business", audience: "annonceur", priceMonthly: 29000, priceYearly: 290000, quotas: { runsPerMonth: 200 } },
  { id: "growth", name: "Growth", audience: "annonceur", priceMonthly: 59000, priceYearly: 590000, quotas: { runsPerMonth: 1000 } },
  { id: "autopilot", name: "Autopilot", audience: "annonceur", priceMonthly: 119000, priceYearly: 1190000, quotas: { runsPerMonth: -1 } },
  { id: "agency_start", name: "Agency Start", audience: "agence", priceMonthly: 79000, priceYearly: 790000, quotas: { runsPerMonth: 500 } },
  { id: "agency_growth", name: "Agency Growth", audience: "agence", priceMonthly: 189000, priceYearly: 1890000, quotas: { runsPerMonth: 3000 } },
  { id: "agency_scale", name: "Agency Scale", audience: "agence", priceMonthly: 389000, priceYearly: 3890000, quotas: { runsPerMonth: -1 } },
  { id: "enterprise", name: "Enterprise", audience: "enterprise", priceMonthly: 990000, priceYearly: 9900000, quotas: { runsPerMonth: -1 } },
];

const MCP_SEED = [
  { serviceId: "meta_mcp", label: "Meta MCP", status: "ok", latency: 120, uptime: "99.9", errorRate: "0.1", calls24h: 4200 },
  { serviceId: "google_ads_mcp", label: "Google Ads MCP", status: "ok", latency: 95, uptime: "99.8", errorRate: "0.2", calls24h: 3100 },
  { serviceId: "tiktok_mcp", label: "TikTok MCP", status: "dégradé", latency: 280, uptime: "98.5", errorRate: "1.2", calls24h: 890 },
  { serviceId: "database", label: "Database", status: "ok", latency: 12, uptime: "99.99", errorRate: "0", calls24h: 50000 },
];

async function seed() {
  console.log("Seeding Orkestria database...");

  for (const p of PLANS_SEED) {
    const ex = await db.select().from(plans).where(eq(plans.id, p.id)).limit(1);
    if (!ex[0]) await db.insert(plans).values(p);
  }

  for (const m of MCP_SEED) {
    const ex = await db.select().from(mcpStatusSnapshots).where(eq(mcpStatusSnapshots.serviceId, m.serviceId)).limit(1);
    if (!ex[0]) {
      await db.insert(mcpStatusSnapshots).values({
        id: `mcp_${m.serviceId}`,
        ...m,
        data: {},
        updatedAt: new Date(),
      });
    }
  }

  const flags = [
    { id: "ff_autopilot", key: "autopilot_v2", enabled: true, rolloutPct: 100, description: "Autopilot v2" },
    { id: "ff_audit_ai", key: "audit_ai", enabled: true, rolloutPct: 80, description: "Audit IA enrichi" },
  ];
  for (const f of flags) {
    const ex = await db.select().from(featureFlags).where(eq(featureFlags.id, f.id)).limit(1);
    if (!ex[0]) await db.insert(featureFlags).values({ ...f, updatedAt: new Date() });
  }

  const kills = [
    { id: "ks_meta_write", key: "meta_write", active: false, reason: "Maintenance" },
    { id: "ks_autopilot", key: "autopilot_global", active: false, reason: "—" },
  ];
  for (const k of kills) {
    const ex = await db.select().from(killSwitches).where(eq(killSwitches.id, k.id)).limit(1);
    if (!ex[0]) await db.insert(killSwitches).values({ ...k, updatedAt: new Date() });
  }

  const gp = await db.select().from(globalPolicies).where(eq(globalPolicies.id, "default")).limit(1);
  if (!gp[0]) await db.insert(globalPolicies).values({ id: "default", data: { maxDailySpend: 500000 }, updatedAt: new Date() });

  const ai = await db.select().from(aiLimits).where(eq(aiLimits.id, "default")).limit(1);
  if (!ai[0]) await db.insert(aiLimits).values({ id: "default", dailyGlobalUsd: "500", perOrgUsd: "50", updatedAt: new Date() });

  const ss = await db.select().from(systemSettings).where(eq(systemSettings.id, "default")).limit(1);
  if (!ss[0]) await db.insert(systemSettings).values({ id: "default", data: { maintenance: false }, updatedAt: new Date() });

  const bc = await db.select().from(availabilityConfig).where(eq(availabilityConfig.id, "default")).limit(1);
  if (!bc[0]) {
    await db.insert(availabilityConfig).values({
      id: "default",
      timezone: "Africa/Abidjan",
      durationMin: 30,
      bufferMin: 10,
      workingDays: [1, 2, 3, 4, 5],
      startHour: 9,
      endHour: 18,
      updatedAt: new Date(),
    });
  }

  // Promote seed super admin if user exists
  const admins = ["admin@orkestria.io", "super@orkestria.io"];
  for (const email of admins) {
    const rows = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if (rows[0]) {
      await db.update(user).set({ role: "super_admin" }).where(eq(user.id, rows[0].id));
      console.log(`Promoted ${email} to super_admin`);
    }
  }

  const { seedOrchestratorDefaults } = await import("@/lib/mcp/orchestrator");
  await seedOrchestratorDefaults();

  const { probeMcpHealth } = await import("@/lib/mcp/mcp-health");
  await probeMcpHealth();

  console.log("Seed complete.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
