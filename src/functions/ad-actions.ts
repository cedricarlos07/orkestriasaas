import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { adActions, approvals } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { approveAction, proposeAdAction, rejectAction } from "@/lib/mcp/action-pipeline";
import { getActiveOrgId } from "./context";

export const listPendingApprovals = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const rows = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.organizationId, orgId), eq(approvals.status, "pending")));
  const withActions = await Promise.all(
    rows.map(async (a) => {
      const acts = a.actionId
        ? await db.select().from(adActions).where(eq(adActions.id, a.actionId)).limit(1)
        : [];
      return { ...a, action: acts[0] ?? null };
    }),
  );
  return withActions;
});

export const proposeAction = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      connector: string;
      action: string;
      runId?: string;
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    return proposeAdAction({ orgId, ...data });
  });

export const approveActionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { approvalId: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    return approveAction(orgId, data.approvalId, session.user.id);
  });

export const rejectActionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { approvalId: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    return rejectAction(orgId, data.approvalId);
  });

export const listAdActionsForOrg = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  return db.select().from(adActions).where(eq(adActions.organizationId, orgId)).orderBy(adActions.createdAt);
});
