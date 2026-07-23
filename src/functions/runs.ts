import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, runEvents } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { enforceQuotas, recordUsage } from "@/lib/quotas/enforce";
import { getActiveOrgId } from "./context";
import { uid } from "./utils";

export const listRuns = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const runs = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.organizationId, orgId))
    .orderBy(desc(agentRuns.createdAt));
  const withEvents = await Promise.all(
    runs.map(async (run) => {
      const events = await db
        .select()
        .from(runEvents)
        .where(eq(runEvents.runId, run.id))
        .orderBy(runEvents.createdAt);
      return { ...run, events };
    }),
  );
  return withEvents;
});

export const getRun = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const rows = await db.select().from(agentRuns).where(eq(agentRuns.id, data.id)).limit(1);
    const run = rows[0];
    if (!run || run.organizationId !== orgId) throw new Error("Not found");
    const events = await db
      .select()
      .from(runEvents)
      .where(eq(runEvents.runId, data.id))
      .orderBy(runEvents.createdAt);
    return { ...run, events };
  });

export const createRun = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { title: string; goal: string; skill?: string; tool?: string }) => data,
  )
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    await enforceQuotas({ orgId, kind: "agent_run" });
    const now = new Date();
    const id = uid("run");
    const row = {
      id,
      organizationId: orgId,
      userId: session.user.id,
      title: data.title,
      goal: data.goal,
      skill: data.skill ?? null,
      tool: data.tool ?? null,
      state: "received",
      idempotencyKey: uid("idem"),
      costUsd: "0",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(agentRuns).values(row);
    await recordUsage({ orgId, kind: "agent_run", meta: { runId: id, via: "createRun" } });
    await db.insert(runEvents).values({
      id: uid("ev"),
      runId: id,
      type: "run.started",
      payload: { goal: data.goal },
      createdAt: now,
    });
    return getRun({ data: { id } });
  });

export const appendRunEvent = createServerFn({ method: "POST" })
  .inputValidator((data: { runId: string; type: string; payload?: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const rows = await db.select().from(agentRuns).where(eq(agentRuns.id, data.runId)).limit(1);
    if (!rows[0] || rows[0].organizationId !== orgId) throw new Error("Not found");
    const ev = {
      id: uid("ev"),
      runId: data.runId,
      type: data.type,
      payload: data.payload ?? {},
      createdAt: new Date(),
    };
    await db.insert(runEvents).values(ev);
    await db.update(agentRuns).set({ updatedAt: new Date() }).where(eq(agentRuns.id, data.runId));
    return ev;
  });

export const updateRunState = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; state: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const rows = await db.select().from(agentRuns).where(eq(agentRuns.id, data.id)).limit(1);
    if (!rows[0] || rows[0].organizationId !== orgId) throw new Error("Not found");
    await db
      .update(agentRuns)
      .set({ state: data.state, updatedAt: new Date() })
      .where(eq(agentRuns.id, data.id));
    return getRun({ data: { id: data.id } });
  });
