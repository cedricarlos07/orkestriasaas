import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import type { ApiKeyContext } from "@/lib/mcp/api-keys";
import { requireScope } from "@/lib/mcp/api-keys";
import {
  getOrgPolicy,
  runWriteAction,
  type ExecutionMode,
  type WriteActionName,
} from "@/lib/mcp/policy-engine";
import {
  AD_CONNECTOR_IDS,
  CONNECTORS,
  hasOAuthCredentials,
  type ConnectorId,
} from "@/lib/oauth/connectors";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import { routeReadSnapshot } from "@/lib/mcp/execution-router";
import type { UnifiedAccountSnapshot } from "@/lib/unified-ad-schema";

/** Shared types + helpers for tool families. */

export type AgentToolContext = ApiKeyContext;

export type AgentTool = {
  name: string;
  description: string;
  family: "core" | "launch" | "optimize" | "create" | "measure" | "govern";
  inputSchema: Record<string, unknown>;
  handler: (ctx: AgentToolContext, args: Record<string, unknown>) => Promise<unknown>;
};

export const PLATFORM_ENUM = AD_CONNECTOR_IDS;

export const platformProp = {
  platform: {
    type: "string",
    enum: PLATFORM_ENUM,
    description: "Ad platform connector id (e.g. meta_ads, google_ads, linkedin_ads…)",
  },
};

export const modeProp = {
  mode: {
    type: "string",
    enum: ["dry_run", "approval", "live"],
    description: "Execution mode. Defaults to the workspace policy (dry_run unless changed). live requires the write scope.",
  },
};

export function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}
export function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export async function getConnectedRows(orgId: string) {
  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  return rows.filter((r) => r.status === "connectée" && r.connector !== "ga4");
}

export async function getTokensFor(orgId: string, connector: ConnectorId) {
  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  const conn = rows.find((c) => c.connector === connector && c.status === "connectée");
  if (conn) {
    const tokens = await ensureFreshTokens(conn.id, orgId, connector);
    return { conn, tokens };
  }
  if (!hasOAuthCredentials(connector)) {
    throw new Error(
      `${CONNECTORS[connector].label} : connexion non configurée (identifiants OAuth ${CONNECTORS[connector].oauth.clientIdEnv} absents côté serveur).`,
    );
  }
  throw new Error(`${CONNECTORS[connector].label} : aucun compte connecté dans ce workspace.`);
}

export async function fetchSnapshot(orgId: string, connector: ConnectorId, accountId?: string, period?: string) {
  const { conn, tokens } = await getTokensFor(orgId, connector);
  const { resolveActiveAdAccountId } = await import("@/lib/mcp/resolve-ad-account");
  const acct =
    accountId ??
    (await resolveActiveAdAccountId(orgId, connector)) ??
    tokens.accountId;
  if (!acct) {
    throw new Error(`${CONNECTORS[connector].label} : aucun compte publicitaire sélectionné.`);
  }
  const { snapshot } = await routeReadSnapshot({
    orgId,
    connector,
    connectionId: conn.id,
    accountId: acct,
    period,
  });
  return snapshot;
}

export async function fetchAllSnapshots(orgId: string, period?: string): Promise<UnifiedAccountSnapshot[]> {
  const rows = await getConnectedRows(orgId);
  const snapshots: UnifiedAccountSnapshot[] = [];
  for (const row of rows) {
    try {
      snapshots.push(await fetchSnapshot(orgId, row.connector as ConnectorId, undefined, period));
    } catch (e) {
      snapshots.push({
        platform: CONNECTORS[row.connector as ConnectorId]?.label ?? row.connector,
        accountId: row.externalAccount ?? "",
        accountName: row.externalAccount ?? row.connector,
        period: period ?? "30 derniers jours",
        spend: 0,
        currency: "USD",
        conversions: 0,
        cpa: null,
        roas: null,
        campaigns: [],
        issues: [e instanceof Error ? e.message : "Erreur de lecture"],
        opportunities: [],
      });
    }
  }
  return snapshots;
}

export const dryRunProp = {
  dry_run: {
    type: "boolean",
    description:
      "Default true (Synter-safe). Validates policy and returns confirm payload. Set false only after reviewing the dry-run diff.",
  },
};

export function writeTool(
  name: string,
  action: WriteActionName,
  description: string,
  family: AgentTool["family"],
  extraProps: Record<string, unknown>,
  required: string[],
  mapArgs: (args: Record<string, unknown>) => {
    campaignId?: string;
    accountId?: string;
    params: Record<string, unknown>;
  },
  fixedPlatform?: ConnectorId,
): AgentTool {
  return {
    name,
    description,
    family,
    inputSchema: {
      type: "object",
      properties: {
        ...(fixedPlatform ? {} : platformProp),
        ...dryRunProp,
        ...modeProp,
        ...extraProps,
      },
      required: fixedPlatform ? required : ["platform", ...required],
    },
    handler: async (ctx, args) => {
      const platform = (fixedPlatform ?? (args.platform as ConnectorId)) as ConnectorId;
      if (!platform) throw new Error("platform requis");

      const dryRun = args.dry_run !== false && args.dry_run !== "false";
      const policy = await getOrgPolicy(ctx.organizationId);

      let mode: ExecutionMode;
      if (dryRun) {
        mode = "dry_run";
      } else {
        const requested = str(args.mode) as ExecutionMode | undefined;
        if (requested === "dry_run") {
          return {
            status: "blocked",
            message: "dry_run=false with mode=dry_run is a no-op. Use mode=live or mode=approval.",
          };
        }
        if (policy.defaultMode === "dry_run") {
          return {
            status: "blocked",
            message:
              "Workspace policy is dry_run. An org admin must set_policy(defaultMode=approval|live) before confirming writes.",
          };
        }
        // Never skip the approval queue when org policy requires it.
        if (policy.defaultMode === "approval") {
          mode = "approval";
        } else {
          mode = requested === "approval" ? "approval" : "live";
        }
        if (mode === "live") requireScope(ctx, "write");
      }

      const mapped = mapArgs(args);
      return runWriteAction({
        orgId: ctx.organizationId,
        apiKeyId: ctx.keyId,
        connector: platform,
        action,
        mode,
        campaignId: mapped.campaignId,
        accountId: mapped.accountId,
        params: mapped.params,
      });
    },
  };
}
