import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { actionRuns, adActions, approvals } from "@/db/schema/index";
import { ensureSession } from "@/lib/auth.functions";
import { createApiKey, listApiKeys, revokeApiKey, type ApiKeyScope } from "@/lib/mcp/api-keys";
import {
  approveAndExecute,
  getOrgPolicy,
  rejectPendingAction,
  updateOrgPolicy,
  type ExecutionMode,
} from "@/lib/mcp/policy-engine";
import { getActiveOrgId } from "./context";

// ─── API keys ─────────────────────────────────────────────────────────────────

export const listMcpApiKeys = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const rows = await listApiKeys(orgId);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    scopes: (r.scopes as string[]) ?? [],
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
});

export const createMcpApiKey = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; scopes: ApiKeyScope[] }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const scopes = data.scopes.length ? data.scopes : (["read"] as ApiKeyScope[]);
    return createApiKey({
      organizationId: orgId,
      userId: session.user.id,
      name: data.name || "Clé MCP",
      scopes,
    });
  });

export const revokeMcpApiKey = createServerFn({ method: "POST" })
  .inputValidator((data: { keyId: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    await revokeApiKey(orgId, data.keyId);
    return { ok: true };
  });

// ─── Policies ─────────────────────────────────────────────────────────────────

export const getMcpPolicy = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  return getOrgPolicy(orgId);
});

export const updateMcpPolicy = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      defaultMode?: ExecutionMode;
      dailySpendCap?: number | null;
      monthlySpendCap?: number | null;
      maxBudgetChangePct?: number;
      protectedCampaignIds?: string[];
      autonomyEnabled?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    return updateOrgPolicy(orgId, data);
  });

// ─── Approvals ────────────────────────────────────────────────────────────────

export const listMcpApprovals = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const rows = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.organizationId, orgId), eq(approvals.status, "pending")))
    .orderBy(desc(approvals.createdAt));
  return Promise.all(
    rows.map(async (a) => {
      const acts = a.actionId
        ? await db.select().from(adActions).where(eq(adActions.id, a.actionId)).limit(1)
        : [];
      return {
        approvalId: a.id,
        createdAt: a.createdAt.toISOString(),
        expiresAt: a.expiresAt?.toISOString() ?? null,
        connector: acts[0]?.connector ?? null,
        action: acts[0]?.action ?? null,
        diffJson: acts[0]?.after ? JSON.stringify(acts[0].after, null, 2) : null,
      };
    }),
  );
});

export const approveMcpAction = createServerFn({ method: "POST" })
  .inputValidator((data: { approvalId: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const outcome = await approveAndExecute(orgId, data.approvalId);
    return { status: outcome.status, message: outcome.message };
  });

export const rejectMcpAction = createServerFn({ method: "POST" })
  .inputValidator((data: { approvalId: string }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    await rejectPendingAction(orgId, data.approvalId);
    return { ok: true };
  });

// ─── Audit ────────────────────────────────────────────────────────────────────

export const listMcpActionRuns = createServerFn({ method: "GET" })
  .inputValidator((data: { limit?: number }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const rows = await db
      .select()
      .from(actionRuns)
      .where(eq(actionRuns.organizationId, orgId))
      .orderBy(desc(actionRuns.createdAt))
      .limit(Math.min(data.limit ?? 100, 300));
    return rows.map((r) => ({
      id: r.id,
      tool: r.tool,
      connector: r.connector,
      mode: r.mode,
      status: r.status,
      error: r.error,
      latencyMs: r.latencyMs ?? 0,
      createdAt: r.createdAt.toISOString(),
    }));
  });

export const listMcpSkills = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSession();
  const { listSkills } = await import("@/lib/mcp/skills");
  return listSkills();
});

export const runMcpAutonomyTick = createServerFn({ method: "POST" })
  .inputValidator((data: { forceDryRun?: boolean }) => data)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const orgId = await getActiveOrgId(session);
    const { runAutonomyTick } = await import("@/lib/mcp/autonomy");
    return runAutonomyTick({ orgId, forceDryRun: data.forceDryRun !== false });
  });
