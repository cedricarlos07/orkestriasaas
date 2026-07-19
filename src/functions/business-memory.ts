import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvals, auditRuns, businessMemory } from "@/db/schema/index";
import type { AuditSummary } from "@/lib/unified-ad-schema";
import { ensureSession } from "@/lib/auth.functions";
import { getActiveOrgId } from "./context";
import { uid } from "./utils";

export const getBusinessMemory = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const rows = await db.select().from(businessMemory).where(eq(businessMemory.organizationId, orgId));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
});

export const setBusinessMemory = createServerFn({ method: "POST" })
  .inputValidator((data: { key: string; value: Record<string, unknown>; source?: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const existing = await db
      .select()
      .from(businessMemory)
      .where(and(eq(businessMemory.organizationId, orgId), eq(businessMemory.key, data.key)))
      .limit(1);
    const now = new Date();
    if (existing[0]) {
      await db
        .update(businessMemory)
        .set({ value: data.value, source: data.source ?? "user", updatedAt: now })
        .where(eq(businessMemory.id, existing[0].id));
    } else {
      await db.insert(businessMemory).values({
        id: uid("bm"),
        organizationId: orgId,
        key: data.key,
        value: data.value,
        source: data.source ?? "user",
        createdAt: now,
        updatedAt: now,
      });
    }
    return { ok: true };
  });

export const getProfitabilityReport = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const mem = await db.select().from(businessMemory).where(eq(businessMemory.organizationId, orgId));
  const goals = mem.find((m) => m.key === "commercial_goals")?.value as Record<string, unknown> | undefined;
  const margins = mem.find((m) => m.key === "margins")?.value as Record<string, unknown> | undefined;

  const latestAudit = await db
    .select()
    .from(auditRuns)
    .where(eq(auditRuns.organizationId, orgId))
    .orderBy(desc(auditRuns.startedAt))
    .limit(1);
  const auditSummary = latestAudit[0]?.summary as AuditSummary | null | undefined;

  const pendingRows = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.organizationId, orgId), eq(approvals.status, "pending")));

  const spend = auditSummary?.totals.spend ?? null;
  const conversions = auditSummary?.totals.conversions ?? null;
  const roas = auditSummary?.totals.roas ?? null;

  let summary: string;
  if (auditSummary?.accounts.length) {
    summary = `${auditSummary.situation} Dépense totale : ${Math.round(spend ?? 0).toLocaleString("fr-FR")} ${auditSummary.totals.currency}, ${conversions ?? 0} conversion(s) mesurée(s) sur les plateformes. Croisez avec GA4 pour la vérité terrain.`;
  } else {
    summary =
      "Aucun audit disponible. Connectez vos comptes via OAuth et lancez un audit multicanal depuis Orkestria.";
  }

  return {
    orgId,
    period: latestAudit[0]?.period ?? "30 derniers jours",
    spend: goals?.budget ?? spend,
    targetOrders: goals?.targetOrders ?? conversions,
    estimatedMargin: margins?.default ?? null,
    visibleRoas: roas,
    pendingDecisions: pendingRows.length,
    summary,
  };
});
