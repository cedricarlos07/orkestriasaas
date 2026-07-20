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
import { isAdkitEnabled } from "@/lib/mcp/clients/adkit";
import {
  adkitManage,
  fetchAdkitAccountSnapshot,
  mapMetaObjective,
  toAdkitDailyBudget,
} from "@/lib/mcp/adkit-bridge";
import { requireOrgAdkitProjectId } from "@/lib/mcp/adkit-org";
import { isWriteEnabled } from "@/lib/platforms/config";

function parseFcfaAmount(raw: string | undefined): number {
  if (!raw) return 0;
  return parseInt(raw.replace(/[^\d]/g, ""), 10) || 0;
}

function parseDurationDays(raw: string | undefined): number {
  if (!raw) return 14;
  const m = raw.match(/(\d+)/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 14;
}

function mapMetaStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === "ACTIVE" || s === "ENABLED") return "live";
  if (s === "PAUSED" || s === "DISABLED") return "paused";
  return "draft";
}

function extractCampaignId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  for (const key of ["campaignId", "id", "externalId"] as const) {
    if (typeof p[key] === "string" && p[key]) return p[key] as string;
  }
  if (Array.isArray(p.campaigns) && p.campaigns[0]) return extractCampaignId(p.campaigns[0]);
  if (p.draft) return extractCampaignId(p.draft);
  if (p.result) return extractCampaignId(p.result);
  if (p.data) return extractCampaignId(p.data);
  if (p.published) return extractCampaignId(p.published);
  return null;
}

export const listCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  return db.select().from(campaigns).where(eq(campaigns.organizationId, orgId));
});

export const syncCampaignsFromMeta = createServerFn({ method: "POST" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);

  let snapshotCampaigns: {
    id: string;
    name: string;
    status: string;
    spend: number;
    conversions: number;
    roas: number | null;
  }[] = [];

  if (isAdkitEnabled()) {
    try {
      const projectId = await requireOrgAdkitProjectId(orgId);
      const meta = await getMetaConnection(orgId);
      const snapshot = await fetchAdkitAccountSnapshot({
        projectId,
        platform: "meta",
        accountId: meta?.tokens.accountId ? metaAdAccountId(meta.tokens) : undefined,
        period: "30 derniers jours",
      });
      snapshotCampaigns = snapshot.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        spend: c.spend,
        conversions: c.conversions,
        roas: c.roas,
      }));
    } catch {
      // fall through to direct Meta
    }
  }

  if (!snapshotCampaigns.length) {
    const meta = await getMetaConnection(orgId);
    if (!meta) return { synced: 0, via: "none" as const };
    const snapshot = await fetchMetaAdsSnapshot(
      meta.tokens.accessToken,
      meta.tokens.accountId!,
      "30 derniers jours",
    );
    snapshotCampaigns = snapshot.campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      spend: c.spend,
      conversions: c.conversions,
      roas: c.roas,
    }));
  }

  let synced = 0;
  const now = new Date();
  const via = isAdkitEnabled() ? ("adkit" as const) : ("meta" as const);

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

  return { synced, via };
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
    const meta = await getMetaConnection(orgId);
    if (!meta && !isAdkitEnabled()) {
      throw new Error("Connectez Meta Ads avant de lancer une campagne.");
    }

    const total = parseFcfaAmount(data.budget);
    const days = parseDurationDays(data.duration);
    const dailyBudget = Math.max(1000, Math.round(total / days));

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
    let via: "adkit" | "meta" = "meta";
    try {
      if (isAdkitEnabled()) {
        via = "adkit";
        const projectId = await requireOrgAdkitProjectId(orgId);
        const accountId = meta ? metaAdAccountId(meta.tokens) : undefined;
        const daily = toAdkitDailyBudget(dailyBudget);
        const result = await adkitManage(projectId, {
          platform: "meta",
          entity: "campaigns",
          action: "create",
          accountId,
          params: {
            name: data.name,
            objective: mapMetaObjective(data.objective),
            status: "paused",
            budget: { daily },
          },
          publish: isWriteEnabled(),
        });
        externalId = extractCampaignId(result) ?? `adkit-draft:${actionId}`;
        await db
          .update(adActions)
          .set({
            status: "executed",
            after: { ...data, dailyBudget, dailyBudgetAdkit: daily, campaignId: externalId, via, raw: result },
          })
          .where(eq(adActions.id, actionId));
      } else {
        const result = await createMetaCampaignPaused({
          accessToken: meta!.tokens.accessToken,
          adAccountId: metaAdAccountId(meta!.tokens),
          name: data.name,
          dailyBudget,
          objective: data.objective ?? "OUTCOME_TRAFFIC",
          countries: ["CI"],
        });
        externalId = result.campaignId;
        await db
          .update(adActions)
          .set({
            status: "executed",
            after: { ...data, dailyBudget, campaignId: externalId, adSetId: result.adSetId, via },
          })
          .where(eq(adActions.id, actionId));
      }
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

    return {
      campaign: row,
      externalId,
      dailyBudget,
      risk,
      via,
      message:
        via === "adkit"
          ? isWriteEnabled()
            ? "Campagne créée via AdKit (pause sur Meta)."
            : "Draft AdKit créé (MCP_WRITE_ENABLED=false — non publié sur Meta)."
          : "Campagne créée sur Meta en pause — activez-la quand vous êtes prêt.",
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

    if (campaign.externalId && campaign.connector === "meta_ads" && !campaign.externalId.startsWith("draft:")) {
      if (isAdkitEnabled()) {
        const projectId = await requireOrgAdkitProjectId(orgId);
        const meta = await getMetaConnection(orgId);
        const status = data.status === "live" ? "active" : "paused";
        await adkitManage(projectId, {
          platform: "meta",
          entity: "campaigns",
          action: "update",
          accountId: meta ? metaAdAccountId(meta.tokens) : undefined,
          id: campaign.externalId,
          params: { id: campaign.externalId, status },
          publish: isWriteEnabled(),
        });
      } else {
        const meta = await getMetaConnection(orgId);
        if (meta) {
          if (data.status === "paused" || data.status === "draft") {
            await pauseMetaCampaign(meta.tokens.accessToken, campaign.externalId);
          } else if (data.status === "live") {
            await resumeMetaCampaign(meta.tokens.accessToken, campaign.externalId);
          }
        }
      }
    }

    await db
      .update(campaigns)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(campaigns.id, data.id));

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
