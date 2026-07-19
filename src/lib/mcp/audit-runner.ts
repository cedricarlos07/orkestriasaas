import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditFindings, auditRuns, connections, runEvents, agentRuns } from "@/db/schema/index";
import { invokeMCP } from "@/lib/mcp/gateway";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";
import {
  buildAuditSummary,
  mergeSnapshots,
  type UnifiedAccountSnapshot,
} from "@/lib/unified-ad-schema";
import { uid } from "@/functions/utils";

const CONNECTOR_TOOLS: Record<ConnectorId, { server: "google_ads_read" | "meta_ads" | "tiktok_ads" | "ga4"; tool: string }> = {
  google_ads: { server: "google_ads_read", tool: "account_diagnostics" },
  meta_ads: { server: "meta_ads", tool: "campaign_insights" },
  tiktok_ads: { server: "tiktok_ads", tool: "campaign_report" },
  ga4: { server: "ga4", tool: "conversion_report" },
};

export async function runMultichannelAudit(opts: {
  orgId: string;
  userId: string;
  period?: string;
  runId?: string;
}): Promise<{ auditId: string; runId: string; summary: ReturnType<typeof buildAuditSummary> }> {
  const period = opts.period ?? "30 derniers jours";
  const conns = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, opts.orgId))
    .then((rows) => rows.filter((c) => c.status === "connectée"));

  let runId = opts.runId;
  if (!runId) {
    runId = uid("run");
    const now = new Date();
    await db.insert(agentRuns).values({
      id: runId,
      organizationId: opts.orgId,
      userId: opts.userId,
      title: "Audit multicanal",
      goal: `Analyse des comptes — ${period}`,
      skill: "analysis",
      tool: "audit",
      state: "collecting_data",
      idempotencyKey: uid("idem"),
      costUsd: "0",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runEvents).values({
      id: uid("ev"),
      runId,
      type: "run.started",
      payload: { goal: `Audit ${period}` },
      createdAt: now,
    });
  }

  const emit = async (type: string, payload: Record<string, unknown>) => {
    await db.insert(runEvents).values({
      id: uid("ev"),
      runId: runId!,
      type,
      payload,
      createdAt: new Date(),
    });
  };

  await emit("step.started", { step: "connect_accounts", label: "Lecture des comptes publicitaires" });

  const snapshots: UnifiedAccountSnapshot[] = [];

  if (conns.length === 0) {
    throw new Error("Aucune connexion publicitaire active. Connectez Meta, Google, TikTok ou GA4 depuis Connexions.");
  }

  for (const conn of conns) {
    const connector = conn.connector as ConnectorId;
    const cfg = CONNECTOR_TOOLS[connector];
    if (!cfg) continue;

    await emit("step.started", { step: cfg.tool, label: CONNECTORS[connector]?.label ?? connector });

    const { result } = await invokeMCP({
      server: cfg.server,
      tool: cfg.tool,
      orgId: opts.orgId,
      connectionId: conn.id,
      mode: "read",
      runId,
      params: { period },
    });

    snapshots.push(result as UnifiedAccountSnapshot);
    await emit("step.completed", { step: cfg.tool, platform: CONNECTORS[connector]?.label });
  }

  await emit("step.started", { step: "normalize", label: "Normalisation des données" });
  const schema = mergeSnapshots(snapshots);
  const summary = buildAuditSummary(schema);

  const auditId = uid("aud");
  await db.insert(auditRuns).values({
    id: auditId,
    organizationId: opts.orgId,
    status: "done",
    stepIndex: 5,
    totalSteps: 5,
    period,
    spend: `${Math.round(summary.totals.spend).toLocaleString("fr-FR")} ${summary.totals.currency}`,
    conv: summary.totals.conversions,
    cpa: summary.totals.cpa ? `${Math.round(summary.totals.cpa).toLocaleString("fr-FR")}` : "—",
    roas: summary.totals.roas ? summary.totals.roas.toFixed(2) : "—",
    summary,
    runId,
    startedAt: new Date(),
    completedAt: new Date(),
  });

  for (const p of summary.problems) {
    await db.insert(auditFindings).values({ id: uid("af"), auditId, label: p, kind: "problem" });
  }
  for (const o of summary.opportunities) {
    await db.insert(auditFindings).values({ id: uid("af"), auditId, label: o, kind: "opportunity" });
  }
  await db.insert(auditFindings).values({ id: uid("af"), auditId, label: summary.situation, kind: "situation" });
  await db.insert(auditFindings).values({ id: uid("af"), auditId, label: summary.firstAction, kind: "action" });

  await db.update(agentRuns).set({ state: "completed", updatedAt: new Date() }).where(eq(agentRuns.id, runId));
  await emit("message.delta", { text: summary.situation });
  await emit("run.completed", { auditId });

  return { auditId, runId, summary };
}
