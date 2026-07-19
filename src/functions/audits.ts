import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditFindings, auditRuns } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { runMultichannelAudit } from "@/lib/mcp/audit-runner";
import { getActiveOrgId } from "./context";
import { uid } from "./utils";

export const listAudits = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  return db.select().from(auditRuns).where(eq(auditRuns.organizationId, orgId)).orderBy(desc(auditRuns.startedAt));
});

export const getAudit = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const rows = await db.select().from(auditRuns).where(eq(auditRuns.id, data.id)).limit(1);
    const audit = rows[0];
    if (!audit || audit.organizationId !== orgId) throw new Error("Not found");
    const findings = await db.select().from(auditFindings).where(eq(auditFindings.auditId, data.id));
    return { ...audit, findings };
  });

export const startAudit = createServerFn({ method: "POST" })
  .inputValidator((data: { period?: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const id = uid("aud");
    const row = {
      id,
      organizationId: orgId,
      status: "running",
      stepIndex: 0,
      totalSteps: 5,
      period: data.period ?? "30 derniers jours",
      spend: "—",
      conv: 0,
      cpa: "—",
      roas: "—",
      startedAt: new Date(),
    };
    await db.insert(auditRuns).values(row);
    return row;
  });

export const completeAudit = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: string;
      spend?: string;
      conv?: number;
      cpa?: string;
      roas?: string;
      findings?: { label: string; kind: string }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const rows = await db.select().from(auditRuns).where(eq(auditRuns.id, data.id)).limit(1);
    if (!rows[0] || rows[0].organizationId !== orgId) throw new Error("Not found");
    await db
      .update(auditRuns)
      .set({
        status: "done",
        stepIndex: 5,
        spend: data.spend ?? rows[0].spend,
        conv: data.conv ?? rows[0].conv,
        cpa: data.cpa ?? rows[0].cpa,
        roas: data.roas ?? rows[0].roas,
        completedAt: new Date(),
      })
      .where(eq(auditRuns.id, data.id));
    if (data.findings?.length) {
      for (const f of data.findings) {
        await db.insert(auditFindings).values({ id: uid("af"), auditId: data.id, label: f.label, kind: f.kind });
      }
    }
    const findings = await db.select().from(auditFindings).where(eq(auditFindings.auditId, data.id));
    return { ...rows[0], findings };
  });

export const runMultichannelAuditFn = createServerFn({ method: "POST" })
  .inputValidator((data: { period?: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    return runMultichannelAudit({
      orgId,
      userId: session.user.id,
      period: data.period,
    });
  });

export const getLatestAuditSummary = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const rows = await db
    .select()
    .from(auditRuns)
    .where(eq(auditRuns.organizationId, orgId))
    .orderBy(desc(auditRuns.startedAt))
    .limit(1);
  const audit = rows[0];
  if (!audit) return null;
  const findings = await db.select().from(auditFindings).where(eq(auditFindings.auditId, audit.id));
  return { ...audit, findings, summary: audit.summary };
});
