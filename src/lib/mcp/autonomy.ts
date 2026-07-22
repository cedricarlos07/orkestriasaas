import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections, orgPolicies } from "@/db/schema/index";
import { getOrgPolicy, runWriteAction, updateOrgPolicy, type OrgPolicy } from "@/lib/mcp/policy-engine";
import { AD_CONNECTOR_IDS, type ConnectorId } from "@/lib/oauth/connectors";
import { getAdapter } from "@/lib/platforms/adapter";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";

export type AutonomyProposal = {
  connector: ConnectorId;
  campaignId: string;
  campaignName: string;
  action: "pause_campaign";
  reason: string;
  cpa: number | null;
  spend: number;
};

/**
 * One autonomy tick: scan snapshots, propose (or execute under policy) pauses for
 * campaigns with spend and zero conversions. Never creates campaigns.
 */
export async function runAutonomyTick(opts: {
  orgId: string;
  apiKeyId?: string;
  /** If true, only return proposals — never call runWriteAction live */
  forceDryRun?: boolean;
}): Promise<{ enabled: boolean; proposals: AutonomyProposal[]; outcomes: unknown[] }> {
  const policy = await getOrgPolicy(opts.orgId);
  if (!policy.autonomyEnabled) {
    return { enabled: false, proposals: [], outcomes: [] };
  }

  const rows = await db.select().from(connections).where(eq(connections.organizationId, opts.orgId));
  const connected = rows.filter(
    (r) => r.status === "connectée" && AD_CONNECTOR_IDS.includes(r.connector as ConnectorId),
  );

  const proposals: AutonomyProposal[] = [];
  for (const row of connected) {
    const connector = row.connector as ConnectorId;
    try {
      const tokens = await ensureFreshTokens(row.id, opts.orgId, connector);
      const accountId = tokens.accountId;
      if (!accountId) continue;
      const snapshot = await getAdapter(connector).fetchSnapshot(tokens, accountId);
      for (const c of snapshot.campaigns) {
        if (c.spend > 20 && c.conversions === 0 && String(c.status).toUpperCase().includes("ACTIVE")) {
          if (policy.protectedCampaignIds.includes(c.id)) continue;
          proposals.push({
            connector,
            campaignId: c.id,
            campaignName: c.name,
            action: "pause_campaign",
            reason: `${Math.round(c.spend)} ${c.currency} spent with 0 conversions`,
            cpa: c.cpa,
            spend: c.spend,
          });
        }
      }
    } catch {
      // skip platform errors
    }
  }

  const outcomes: unknown[] = [];
  const mode =
    opts.forceDryRun || policy.defaultMode === "dry_run"
      ? "dry_run"
      : policy.defaultMode === "approval"
        ? "approval"
        : "live";

  for (const p of proposals.slice(0, 5)) {
    outcomes.push(
      await runWriteAction({
        orgId: opts.orgId,
        apiKeyId: opts.apiKeyId,
        connector: p.connector,
        action: "pause_campaign",
        mode,
        campaignId: p.campaignId,
        params: {},
      }),
    );
  }

  await updateOrgPolicy(opts.orgId, {
    lastAutonomyAt: new Date().toISOString(),
    lastAutonomySummary: `${proposals.length} proposal(s), mode=${mode}`,
  });

  return { enabled: true, proposals, outcomes };
}

export async function runAutonomyTickForAllOrgs(opts?: {
  forceDryRun?: boolean;
}): Promise<{ orgs: number; ticks: { orgId: string; proposals: number }[] }> {
  const rows = await db.select({ organizationId: orgPolicies.organizationId, platformCaps: orgPolicies.platformCaps }).from(orgPolicies);
  const ticks: { orgId: string; proposals: number }[] = [];
  for (const row of rows) {
    const settings = (row.platformCaps as { __settings?: { autonomyEnabled?: boolean } } | null)?.__settings;
    if (!settings?.autonomyEnabled) continue;
    const result = await runAutonomyTick({
      orgId: row.organizationId,
      forceDryRun: opts?.forceDryRun,
    });
    ticks.push({ orgId: row.organizationId, proposals: result.proposals.length });
  }
  return { orgs: ticks.length, ticks };
}

export function withAutonomyFlag(
  platformCaps: OrgPolicy["platformCaps"],
  enabled: boolean,
): OrgPolicy["platformCaps"] {
  return {
    ...platformCaps,
    __settings: { ...(platformCaps as { __settings?: object }).__settings, autonomyEnabled: enabled },
  } as OrgPolicy["platformCaps"];
}
