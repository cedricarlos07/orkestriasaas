import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adActions, campaigns } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { getActiveOrgId } from "./context";
import { uid } from "./utils";
import { getMetaConnection, metaAdAccountId } from "@/lib/platforms/meta-connection";
import {
  createMetaCampaignPaused,
  fetchMetaAdsSnapshot,
  pauseMetaCampaign,
  resumeMetaCampaign,
} from "@/lib/platforms/meta-api";
import { classifyRisk } from "@/lib/mcp/action-pipeline";
import { countriesFromZone } from "@/lib/geo/countries-from-zone";
import { assertAdWritesAllowed } from "@/lib/mcp/write-gate";
import { enforceQuotas, recordUsage } from "@/lib/quotas/enforce";
import { requireOrgAdmin } from "./context";

/** Parse a USD (or major-unit) total from UI strings like "$250 · 7 jours" or "$400". */
function parseBudgetTotal(raw: string | undefined): number {
  if (!raw) return 0;
  const head = raw.split(/[·•|/]/)[0] ?? raw;
  const m = head.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

function parseDurationDays(raw: string | undefined): number {
  if (!raw) return 14;
  const m = raw.match(/(\d+)\s*j/i) ?? raw.match(/(\d+)/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 14;
}

/** Daily budget in major currency units. Meta min ~$1 — never invent a $1000 floor. */
function dailyBudgetFromTotal(total: number, days: number): number {
  if (total <= 0) throw new Error("Budget invalide — indiquez un montant (ex. $250 · 7 jours).");
  return Math.max(1, Math.round((total / days) * 100) / 100);
}

function mapMetaStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === "ACTIVE" || s === "ENABLED") return "live";
  if (s === "PAUSED" || s === "DISABLED") return "paused";
  return "draft";
}

export const listCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  return db.select().from(campaigns).where(eq(campaigns.organizationId, orgId));
});

export const syncCampaignsFromMeta = createServerFn({ method: "POST" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);

  const meta = await getMetaConnection(orgId).catch(() => null);
  if (!meta) return { synced: 0, via: "none" as const };

  const snapshot = await fetchMetaAdsSnapshot(
    meta.tokens.accessToken,
    meta.tokens.accountId!,
    "30 derniers jours",
  );
  const snapshotCampaigns = snapshot.campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    spend: c.spend,
    conversions: c.conversions,
    roas: c.roas,
  }));

  let synced = 0;
  const now = new Date();

  for (const c of snapshotCampaigns) {
    if (!c.id) continue;
    const all = await db.select().from(campaigns).where(eq(campaigns.organizationId, orgId));
    const existing = all.find((r) => r.externalId === c.id);

    const row = {
      name: c.name,
      channel: "Meta",
      status: mapMetaStatus(c.status),
      spend: String(Math.round(c.spend)),
      conv: c.conversions,
      roas: c.roas != null ? String(c.roas) : "—",
      externalId: c.id,
      connector: "meta_ads",
      updatedAt: now,
    };

    if (existing) {
      await db.update(campaigns).set(row).where(eq(campaigns.id, existing.id));
    } else {
      await db.insert(campaigns).values({
        id: uid("c"),
        organizationId: orgId,
        ...row,
        zone: null,
        budget: null,
        createdAt: now,
      });
    }
    synced++;
  }

  return { synced, via: "meta" as const };
});

export const createCampaign = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { name: string; channel: string; zone?: string; budget?: string }) => data,
  )
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const now = new Date();
    const row = {
      id: uid("c"),
      organizationId: orgId,
      name: data.name,
      channel: data.channel,
      status: "draft",
      spend: "0",
      conv: 0,
      roas: "—",
      zone: data.zone ?? null,
      budget: data.budget ?? null,
      externalId: null,
      connector: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(campaigns).values(row);
    return row;
  });

export type LaunchCampaignInput = {
  name: string;
  budget: string;
  duration: string;
  zone?: string;
  objective?: string;
};

export const launchCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: LaunchCampaignInput) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    await requireOrgAdmin(session, orgId);
    await assertAdWritesAllowed(orgId);
    await enforceQuotas({ orgId, kind: "write", tool: "launch_campaign" });
    const meta = await getMetaConnection(orgId);
    if (!meta) {
      throw new Error("Connectez Meta Ads et sélectionnez un compte publicitaire avant de lancer une campagne.");
    }

    const total = parseBudgetTotal(data.budget);
    const days = parseDurationDays(data.duration);
    const dailyBudget = dailyBudgetFromTotal(total, days);

    const actionId = uid("act");
    const risk = classifyRisk("create_campaign");
    await db.insert(adActions).values({
      id: actionId,
      organizationId: orgId,
      connector: "meta_ads",
      action: "create_campaign",
      status: "executing",
      before: null,
      after: { name: data.name, dailyBudget, zone: data.zone },
      createdAt: new Date(),
    });

    let externalId: string;
    try {
      const result = await createMetaCampaignPaused({
        accessToken: meta.tokens.accessToken,
        adAccountId: metaAdAccountId(meta.tokens),
        name: data.name,
        dailyBudget,
        objective: data.objective ?? "OUTCOME_TRAFFIC",
        countries: countriesFromZone(data.zone),
      });
      externalId = result.campaignId;
      await db
        .update(adActions)
        .set({
          status: "executed",
          after: { ...data, dailyBudget, campaignId: externalId, adSetId: result.adSetId, via: "meta" },
        })
        .where(eq(adActions.id, actionId));
    } catch (e) {
      await db.update(adActions).set({ status: "failed" }).where(eq(adActions.id, actionId));
      throw e;
    }

    const now = new Date();
    const row = {
      id: uid("c"),
      organizationId: orgId,
      name: data.name,
      channel: "Meta",
      status: "paused",
      spend: "0",
      conv: 0,
      roas: "—",
      zone: data.zone ?? null,
      budget: data.budget,
      externalId,
      connector: "meta_ads",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(campaigns).values(row);
    await recordUsage({ orgId, kind: "write", meta: { tool: "launch_campaign" } });

    return {
      campaign: row,
      externalId,
      dailyBudget,
      risk,
      via: "meta" as const,
      message: "Campagne créée sur Meta en pause — activez-la quand vous êtes prêt.",
    };
  });

export const updateCampaignStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const rows = await db.select().from(campaigns).where(eq(campaigns.id, data.id)).limit(1);
    const campaign = rows[0];
    if (!campaign || campaign.organizationId !== orgId) throw new Error("Not found");

    const touchesMeta =
      Boolean(campaign.externalId) &&
      campaign.connector === "meta_ads" &&
      !campaign.externalId!.startsWith("draft:");

    if (touchesMeta || data.status === "live") {
      await requireOrgAdmin(session, orgId);
      await assertAdWritesAllowed(orgId);
      if (data.status === "live") {
        await enforceQuotas({ orgId, kind: "write", tool: "activate_campaign" });
      }
    }

    if (touchesMeta) {
      const meta = await getMetaConnection(orgId).catch(() => null);
      if (!meta) {
        throw new Error("Sélectionnez un compte publicitaire Meta dans Connexions.");
      }
      if (data.status === "paused" || data.status === "draft") {
        await pauseMetaCampaign(meta.tokens.accessToken, campaign.externalId!);
      } else if (data.status === "live") {
        await resumeMetaCampaign(meta.tokens.accessToken, campaign.externalId!);
      }
    }

    await db
      .update(campaigns)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(campaigns.id, data.id));

    if (data.status === "live") {
      await recordUsage({ orgId, kind: "write", meta: { tool: "activate_campaign" } });
    }

    const updated = await db.select().from(campaigns).where(eq(campaigns.id, data.id)).limit(1);
    return updated[0]!;
  });

export const duplicateCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const rows = await db.select().from(campaigns).where(eq(campaigns.id, data.id)).limit(1);
    const src = rows[0];
    if (!src || src.organizationId !== orgId) throw new Error("Not found");
    const now = new Date();
    const copy = {
      ...src,
      id: uid("c"),
      name: `${src.name} (copie)`,
      status: "draft",
      externalId: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(campaigns).values(copy);
    return copy;
  });
