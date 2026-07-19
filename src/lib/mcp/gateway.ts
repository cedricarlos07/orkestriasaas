import { eq } from "drizzle-orm";
import { db } from "@/db";
import { globalPolicies, killSwitches, mcpCalls, mcpStatusSnapshots, connections } from "@/db/schema/index";
import type { MCPCallInput } from "@/lib/unified-ad-schema";
import { getTool, MCP_SERVER_ENV } from "@/lib/mcp/tool-registry";
import {
  executePlatformWrite,
  readAccountSnapshot,
  type MCPClientContext,
} from "@/lib/mcp/clients/base";
import { isWriteEnabled, requireMcpOrDirectApi } from "@/lib/platforms/config";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import type { ConnectorId } from "@/lib/oauth/connectors";
import { uid } from "@/functions/utils";

export async function checkKillSwitch(server: string): Promise<boolean> {
  const key = server.includes("google")
    ? "google_write"
    : server.includes("meta")
      ? "meta_write"
      : server.includes("tiktok")
        ? "tiktok_write"
        : null;
  if (!key) return false;
  const rows = await db.select().from(killSwitches).where(eq(killSwitches.key, key)).limit(1);
  return rows[0]?.active ?? false;
}

export async function checkPolicy(orgId: string, mode: "read" | "write"): Promise<void> {
  if (mode === "write" && !isWriteEnabled()) {
    throw new Error("Écriture désactivée. Définissez MCP_WRITE_ENABLED=true dans .env.local");
  }
  const rows = await db.select().from(globalPolicies).where(eq(globalPolicies.id, "default")).limit(1);
  const data = (rows[0]?.data ?? {}) as { writeBlocked?: boolean };
  if (mode === "write" && data.writeBlocked) throw new Error("Écriture bloquée par la politique globale.");
}

export async function invokeMCP(call: MCPCallInput): Promise<{ result: unknown; latencyMs: number; fromMcp: boolean }> {
  const toolDef = getTool(call.tool);
  if (!toolDef) throw new Error(`Tool inconnu : ${call.tool}`);
  if (toolDef.server !== call.server) throw new Error("Tool/server mismatch");

  await checkPolicy(call.orgId, call.mode);
  if (call.mode === "write") {
    const blocked = await checkKillSwitch(call.server);
    if (blocked) throw new Error("Kill switch actif pour cette plateforme.");
  }

  requireMcpOrDirectApi(call.server);

  const connRows = await db
    .select()
    .from(connections)
    .where(eq(connections.id, call.connectionId))
    .limit(1);
  const conn = connRows[0];
  if (!conn || conn.organizationId !== call.orgId) throw new Error("Connexion introuvable");
  const connector = conn.connector as ConnectorId;

  const tokens = await ensureFreshTokens(call.connectionId, call.orgId, connector);

  const envKey = MCP_SERVER_ENV[call.server];
  const mcpUrl = process.env[envKey]?.trim() || undefined;

  const ctx: MCPClientContext = {
    server: call.server,
    connectionId: call.connectionId,
    tokens,
    period: (call.params?.period as string) ?? "30 derniers jours",
  };

  const start = Date.now();
  let status = "ok";
  let error: string | null = null;
  let result: unknown;
  let fromMcp = false;

  try {
    if (call.mode === "write") {
      await executePlatformWrite(call.server, call.tool, tokens, call.params ?? {});
      if (mcpUrl) {
        const { invokeMcpHttp } = await import("@/lib/mcp/clients/base");
        const writeRes = await invokeMcpHttp(mcpUrl, call.tool, call.params ?? {}, tokens);
        if (!writeRes.ok) throw new Error(writeRes.error ?? "Échec MCP write");
        result = writeRes.data;
        fromMcp = true;
      } else {
        result = { ok: true, tool: call.tool, server: call.server };
      }
    } else {
      const read = await readAccountSnapshot(ctx, mcpUrl, call.tool);
      result = read.fromMcp ? read.snapshot : read.snapshot;
      fromMcp = read.fromMcp;
    }
  } catch (e) {
    status = "error";
    error = e instanceof Error ? e.message : "MCP error";
    throw e;
  } finally {
    const latencyMs = Date.now() - start;
    await db.insert(mcpCalls).values({
      id: uid("mcp"),
      organizationId: call.orgId,
      runId: call.runId ?? null,
      connectionId: call.connectionId,
      server: call.server,
      tool: call.tool,
      mode: call.mode,
      status,
      latencyMs,
      error,
      params: call.params ?? {},
      result: result ? (result as object) : null,
      createdAt: new Date(),
    });
  }

  return { result, latencyMs: Date.now() - start, fromMcp };
}

export async function probeMcpHealth(): Promise<void> {
  const services = [
    { serviceId: "google_ads_mcp", label: "Google Ads", env: "MCP_GOOGLE_ADS_READ_URL", needsDevToken: true },
    { serviceId: "meta_mcp", label: "Meta Ads", env: "MCP_META_ADS_URL", needsDevToken: false },
    { serviceId: "tiktok_mcp", label: "TikTok Ads", env: "MCP_TIKTOK_ADS_URL", needsDevToken: false },
    { serviceId: "ga4_mcp", label: "GA4", env: "MCP_GA4_URL", needsDevToken: false },
  ];

  for (const s of services) {
    const url = process.env[s.env]?.trim();
    let status = "ok";
    let latency = 0;

    if (url) {
      const start = Date.now();
      try {
        const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000) });
        latency = Date.now() - start;
        if (!res.ok) status = "degradé";
      } catch {
        status = "degradé";
        latency = 5000;
      }
    } else if (s.needsDevToken && !process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
      status = "degradé";
    } else if (s.serviceId === "meta_mcp" && !process.env.META_APP_ID) {
      status = "degradé";
    }

    const existing = await db
      .select()
      .from(mcpStatusSnapshots)
      .where(eq(mcpStatusSnapshots.serviceId, s.serviceId))
      .limit(1);
    const row = {
      serviceId: s.serviceId,
      label: s.label,
      status,
      latency,
      uptime: status === "ok" ? "99.9" : "95.0",
      errorRate: status === "degradé" ? "2.0" : "0",
      calls24h: 0,
      data: { url: url ?? null, mode: url ? "mcp_sidecar" : "direct_api" },
      updatedAt: new Date(),
    };
    if (existing[0]) {
      await db.update(mcpStatusSnapshots).set(row).where(eq(mcpStatusSnapshots.serviceId, s.serviceId));
    } else {
      await db.insert(mcpStatusSnapshots).values({ id: `mcp_${s.serviceId}`, ...row });
    }
  }
}
