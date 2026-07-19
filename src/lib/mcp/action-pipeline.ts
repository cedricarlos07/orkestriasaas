import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adActions, approvals, connections, globalPolicies, killSwitches } from "@/db/schema/index";
import { invokeMCP } from "@/lib/mcp/gateway";
import { getTool } from "@/lib/mcp/tool-registry";
import { uid } from "@/functions/utils";

export type ActionRisk = "low" | "medium" | "high";

export function classifyRisk(action: string): ActionRisk {
  if (/create|launch|new_campaign|expand_geo/i.test(action)) return "high";
  if (/budget|spend|bid/i.test(action)) return "medium";
  return "low";
}

export async function proposeAdAction(opts: {
  orgId: string;
  runId?: string;
  connector: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  const risk = classifyRisk(opts.action);
  const actionId = uid("act");
  await db.insert(adActions).values({
    id: actionId,
    organizationId: opts.orgId,
    runId: opts.runId ?? null,
    connector: opts.connector,
    action: opts.action,
    status: risk === "low" ? "auto_pending" : "pending_approval",
    before: opts.before ?? null,
    after: opts.after ?? null,
    createdAt: new Date(),
  });

  if (risk !== "low") {
    const approvalId = uid("appr");
    await db.insert(approvals).values({
      id: approvalId,
      organizationId: opts.orgId,
      actionId,
      track: risk,
      status: "pending",
      requiredApprovers: risk === "high" ? 2 : 1,
      expiresAt: new Date(Date.now() + 86400_000 * 3),
      createdAt: new Date(),
    });
    return { actionId, approvalId, requiresApproval: true, risk };
  }

  return { actionId, requiresApproval: false, risk };
}

export async function approveAction(orgId: string, approvalId: string, actorId: string) {
  const rows = await db.select().from(approvals).where(eq(approvals.id, approvalId)).limit(1);
  const appr = rows[0];
  if (!appr || appr.organizationId !== orgId) throw new Error("Not found");
  await db.update(approvals).set({ status: "approved" }).where(eq(approvals.id, approvalId));
  if (appr.actionId) {
    await db.update(adActions).set({ status: "approved" }).where(eq(adActions.id, appr.actionId));
    await executeAdAction(orgId, appr.actionId, actorId);
  }
  return { ok: true };
}

export async function rejectAction(orgId: string, approvalId: string) {
  const rows = await db.select().from(approvals).where(eq(approvals.id, approvalId)).limit(1);
  const appr = rows[0];
  if (!appr || appr.organizationId !== orgId) throw new Error("Not found");
  await db.update(approvals).set({ status: "rejected" }).where(eq(approvals.id, approvalId));
  if (appr.actionId) {
    await db.update(adActions).set({ status: "rejected" }).where(eq(adActions.id, appr.actionId));
  }
  return { ok: true };
}

export async function executeAdAction(orgId: string, actionId: string, _actorId: string) {
  const rows = await db.select().from(adActions).where(eq(adActions.id, actionId)).limit(1);
  const action = rows[0];
  if (!action || action.organizationId !== orgId) throw new Error("Not found");

  const tool = getTool(action.action);
  if (!tool || tool.mode !== "write") {
    await db.update(adActions).set({ status: "failed" }).where(eq(adActions.id, actionId));
    throw new Error("Action write non disponible ou tool inconnu");
  }

  const conn = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, orgId))
    .then((rows) => rows.find((c) => c.connector === action.connector && c.status === "connectée"));

  if (!conn) {
    await db.update(adActions).set({ status: "failed" }).where(eq(adActions.id, actionId));
    throw new Error("Aucune connexion active pour cette plateforme");
  }

  try {
    await invokeMCP({
      server: tool.server,
      tool: tool.name,
      orgId,
      connectionId: conn.id,
      mode: "write",
      params: (action.after as Record<string, unknown>) ?? {},
    });
    await db.update(adActions).set({ status: "executed" }).where(eq(adActions.id, actionId));
  } catch (e) {
    await db.update(adActions).set({ status: "failed" }).where(eq(adActions.id, actionId));
    throw e;
  }

  return { ok: true };
}

export async function canAutoExecute(orgId: string, connector: string): Promise<boolean> {
  const ks = await db.select().from(killSwitches).where(eq(killSwitches.key, `${connector}_write`)).limit(1);
  if (ks[0]?.active) return false;
  const pol = await db.select().from(globalPolicies).where(eq(globalPolicies.id, "default")).limit(1);
  const data = (pol[0]?.data ?? {}) as { autopilot?: boolean };
  return data.autopilot === true;
}
