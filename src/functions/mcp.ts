import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { mcpCalls, mcpStatusSnapshots } from "@/db/schema/index";
import { ensureSession, ensureSuperAdmin } from "@/lib/auth.functions";
import { probeMcpHealth } from "@/lib/mcp/gateway";
import { MCP_CAPABILITIES, MCP_TOOL_REGISTRY } from "@/lib/mcp/tool-registry";
import { getActiveOrgId } from "./context";

export const listMcpTools = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSession();
  return MCP_TOOL_REGISTRY;
});

export const listMcpCapabilities = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSession();
  return MCP_CAPABILITIES;
});

export const refreshMcpHealth = createServerFn({ method: "POST" }).handler(async () => {
  await ensureSuperAdmin();
  await probeMcpHealth();
  return listMcpStatusesAdmin();
});

export const listMcpStatusesAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSuperAdmin();
  const rows = await db.select().from(mcpStatusSnapshots).orderBy(desc(mcpStatusSnapshots.updatedAt));
  return rows.map((s) => ({
    id: s.serviceId,
    label: s.label,
    status: s.status,
    latency: s.latency ?? 0,
    uptime: Number(s.uptime ?? 99.9),
    errorRate: Number(s.errorRate ?? 0),
    calls24h: s.calls24h ?? 0,
    tools: (s.data as { tools?: string[] })?.tools ?? [],
    updatedAt: s.updatedAt.getTime(),
    data: s.data,
  }));
});

export const listMcpCalls = createServerFn({ method: "GET" })
  .inputValidator((data: { limit?: number }) => data)
  .handler(async ({ data }) => {
    await ensureSuperAdmin();
    const limit = data.limit ?? 50;
    return db.select().from(mcpCalls).orderBy(desc(mcpCalls.createdAt)).limit(limit);
  });

export const listOrgMcpCalls = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  return db
    .select()
    .from(mcpCalls)
    .where(eq(mcpCalls.organizationId, orgId))
    .orderBy(desc(mcpCalls.createdAt))
    .limit(20);
});
