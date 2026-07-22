import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import {
  actionRuns,
  adActions,
  approvals,
  connections,
  killSwitches,
  orgPolicies,
  spendTracking,
} from "@/db/schema/index";
import type { ConnectorId } from "@/lib/oauth/connectors";
import { CONNECTORS, hasOAuthCredentials } from "@/lib/oauth/connectors";
import { getAdapter } from "@/lib/platforms/adapter";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import { uid } from "@/functions/utils";

export type ExecutionMode = "dry_run" | "approval" | "live";

export type OrgPolicy = {
  defaultMode: ExecutionMode;
  dailySpendCap: number | null;
  monthlySpendCap: number | null;
  maxBudgetChangePct: number;
  protectedCampaignIds: string[];
  platformCaps: Record<string, { daily?: number; monthly?: number }>;
  autonomyEnabled: boolean;
  lastAutonomyAt: string | null;
  lastAutonomySummary: string | null;
};

type OrgSettings = {
  autonomyEnabled?: boolean;
  lastAutonomyAt?: string;
  lastAutonomySummary?: string;
};

const DEFAULT_POLICY: OrgPolicy = {
  defaultMode: "dry_run",
  dailySpendCap: null,
  monthlySpendCap: null,
  maxBudgetChangePct: 50,
  protectedCampaignIds: [],
  platformCaps: {},
  autonomyEnabled: false,
  lastAutonomyAt: null,
  lastAutonomySummary: null,
};

export async function getOrgPolicy(orgId: string): Promise<OrgPolicy> {
  const rows = await db.select().from(orgPolicies).where(eq(orgPolicies.organizationId, orgId)).limit(1);
  const row = rows[0];
  if (!row) return DEFAULT_POLICY;
  const rawCaps = (row.platformCaps ?? {}) as Record<string, unknown>;
  const settings = rawCaps.__settings as OrgSettings | undefined;
  const cleanCaps = { ...rawCaps };
  delete cleanCaps.__settings;
  return {
    defaultMode: (row.defaultMode as ExecutionMode) ?? "dry_run",
    dailySpendCap: row.dailySpendCap !== null ? Number(row.dailySpendCap) : null,
    monthlySpendCap: row.monthlySpendCap !== null ? Number(row.monthlySpendCap) : null,
    maxBudgetChangePct: row.maxBudgetChangePct ?? 50,
    protectedCampaignIds: (row.protectedCampaignIds as string[]) ?? [],
    platformCaps: cleanCaps as OrgPolicy["platformCaps"],
    autonomyEnabled: Boolean(settings?.autonomyEnabled),
    lastAutonomyAt: settings?.lastAutonomyAt ?? null,
    lastAutonomySummary: settings?.lastAutonomySummary ?? null,
  };
}

export async function updateOrgPolicy(orgId: string, patch: Partial<OrgPolicy>): Promise<OrgPolicy> {
  const existing = await db.select().from(orgPolicies).where(eq(orgPolicies.organizationId, orgId)).limit(1);
  const current = await getOrgPolicy(orgId);
  let platformCaps = patch.platformCaps ?? current.platformCaps;
  const settingsTouched =
    patch.autonomyEnabled !== undefined ||
    patch.lastAutonomyAt !== undefined ||
    patch.lastAutonomySummary !== undefined;
  if (settingsTouched) {
    platformCaps = {
      ...platformCaps,
      __settings: {
        autonomyEnabled: patch.autonomyEnabled ?? current.autonomyEnabled,
        lastAutonomyAt: patch.lastAutonomyAt ?? current.lastAutonomyAt ?? undefined,
        lastAutonomySummary: patch.lastAutonomySummary ?? current.lastAutonomySummary ?? undefined,
      },
    } as OrgPolicy["platformCaps"];
  }
  const values = {
    defaultMode: patch.defaultMode,
    dailySpendCap: patch.dailySpendCap !== undefined ? (patch.dailySpendCap === null ? null : String(patch.dailySpendCap)) : undefined,
    monthlySpendCap: patch.monthlySpendCap !== undefined ? (patch.monthlySpendCap === null ? null : String(patch.monthlySpendCap)) : undefined,
    maxBudgetChangePct: patch.maxBudgetChangePct,
    protectedCampaignIds: patch.protectedCampaignIds,
    platformCaps: patch.platformCaps !== undefined || settingsTouched ? platformCaps : undefined,
    updatedAt: new Date(),
  };
  const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
  if (existing[0]) {
    await db.update(orgPolicies).set(clean).where(eq(orgPolicies.organizationId, orgId));
  } else {
    await db.insert(orgPolicies).values({
      organizationId: orgId,
      defaultMode: patch.defaultMode ?? "dry_run",
      dailySpendCap: patch.dailySpendCap != null ? String(patch.dailySpendCap) : null,
      monthlySpendCap: patch.monthlySpendCap != null ? String(patch.monthlySpendCap) : null,
      maxBudgetChangePct: patch.maxBudgetChangePct ?? 50,
      protectedCampaignIds: patch.protectedCampaignIds ?? [],
      platformCaps: platformCaps ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return getOrgPolicy(orgId);
}

// ─── Write actions ────────────────────────────────────────────────────────────

export type WriteActionName =
  | "create_campaign"
  | "update_budget"
  | "pause_campaign"
  | "enable_campaign"
  | "pause_ad_set"
  | "enable_ad_set"
  | "create_ad_set"
  | "create_ad"
  | "upload_creative"
  | "create_audience"
  | "add_keywords"
  | "add_negative_keywords"
  | "create_conversion"
  | "attach_audience"
  | "pause_ad";

export const WRITE_ACTION_NAMES: WriteActionName[] = [
  "create_campaign",
  "update_budget",
  "pause_campaign",
  "enable_campaign",
  "pause_ad_set",
  "enable_ad_set",
  "create_ad_set",
  "create_ad",
  "upload_creative",
  "create_audience",
  "add_keywords",
  "add_negative_keywords",
  "create_conversion",
  "attach_audience",
  "pause_ad",
];

export type WriteActionInput = {
  orgId: string;
  apiKeyId?: string;
  connector: ConnectorId;
  action: WriteActionName;
  campaignId?: string;
  accountId?: string;
  /** Requested mode; policy can force approval. Defaults to org policy default. */
  mode?: ExecutionMode;
  params: {
    name?: string;
    dailyBudget?: number;
    objective?: string;
    countries?: string[];
    currentDailyBudget?: number;
    adSetId?: string;
    adGroupId?: string;
    pageId?: string;
    linkUrl?: string;
    message?: string;
    headline?: string;
    imageUrl?: string;
    imageHash?: string;
    description?: string;
    subtype?: string;
    lookalikeRatio?: number;
    originAudienceId?: string;
    country?: string;
    optimizationGoal?: string;
    keywords?: { text: string; matchType?: string; bid?: number }[];
    campaignType?: "search" | "pmax" | "traffic" | "leads" | "default";
    finalUrl?: string;
    headlines?: string[];
    descriptions?: string[];
    category?: string;
    audienceId?: string;
    adId?: string;
  };
};

export type WriteActionOutcome = {
  status: "dry_run" | "pending_approval" | "executed" | "blocked";
  mode: ExecutionMode;
  actionId?: string;
  approvalId?: string;
  diff: Record<string, unknown>;
  message: string;
  result?: Record<string, unknown>;
};

async function resolveConnection(orgId: string, connector: ConnectorId) {
  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  const conn = rows.find((c) => c.connector === connector && c.status === "connectée");
  if (!conn) {
    if (!hasOAuthCredentials(connector)) {
      throw new Error(
        `Connexion ${CONNECTORS[connector].label} non configurée : les identifiants OAuth (${CONNECTORS[connector].oauth.clientIdEnv}) ne sont pas définis côté serveur.`,
      );
    }
    throw new Error(
      `Aucun compte ${CONNECTORS[connector].label} connecté. Connectez-le depuis le dashboard Orkestria (Connexions).`,
    );
  }
  return conn;
}

async function checkSpendCaps(orgId: string, connector: ConnectorId, policy: OrgPolicy): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const dayRows = await db
    .select()
    .from(spendTracking)
    .where(and(eq(spendTracking.organizationId, orgId), eq(spendTracking.day, today)));
  const monthRows = await db
    .select()
    .from(spendTracking)
    .where(and(eq(spendTracking.organizationId, orgId), like(spendTracking.day, `${month}%`)));

  const dailyTotal = dayRows.reduce((s, r) => s + Number(r.spend), 0);
  const monthlyTotal = monthRows.reduce((s, r) => s + Number(r.spend), 0);
  const dailyConnector = dayRows.filter((r) => r.connector === connector).reduce((s, r) => s + Number(r.spend), 0);
  const monthlyConnector = monthRows.filter((r) => r.connector === connector).reduce((s, r) => s + Number(r.spend), 0);

  if (policy.dailySpendCap !== null && dailyTotal >= policy.dailySpendCap) {
    return `Spend cap journalier atteint (${dailyTotal} ≥ ${policy.dailySpendCap})`;
  }
  if (policy.monthlySpendCap !== null && monthlyTotal >= policy.monthlySpendCap) {
    return `Spend cap mensuel atteint (${monthlyTotal} ≥ ${policy.monthlySpendCap})`;
  }
  const caps = policy.platformCaps[connector];
  if (caps?.daily !== undefined && dailyConnector >= caps.daily) {
    return `Spend cap journalier ${CONNECTORS[connector].label} atteint`;
  }
  if (caps?.monthly !== undefined && monthlyConnector >= caps.monthly) {
    return `Spend cap mensuel ${CONNECTORS[connector].label} atteint`;
  }
  return null;
}

function buildDiff(input: WriteActionInput): Record<string, unknown> {
  switch (input.action) {
    case "create_campaign":
      return {
        action: "create_campaign",
        platform: input.connector,
        name: input.params.name,
        dailyBudget: input.params.dailyBudget,
        objective: input.params.objective ?? null,
        countries: input.params.countries ?? null,
        campaignType: input.params.campaignType ?? "default",
        finalUrl: input.params.finalUrl ?? null,
        keywords: input.params.keywords ?? null,
        note: "La campagne sera créée en PAUSE / DRAFT quand la plateforme le permet",
      };
    case "update_budget":
      return {
        action: "update_budget",
        platform: input.connector,
        campaignId: input.campaignId,
        before: input.params.currentDailyBudget ?? "inconnu",
        after: input.params.dailyBudget,
        note: input.connector === "meta_ads" ? "Meta: campaignId = ad set id" : undefined,
      };
    case "pause_campaign":
      return { action: "pause_campaign", platform: input.connector, campaignId: input.campaignId, before: "ACTIVE", after: "PAUSED" };
    case "enable_campaign":
      return { action: "enable_campaign", platform: input.connector, campaignId: input.campaignId, before: "PAUSED", after: "ACTIVE" };
    case "pause_ad_set":
      return {
        action: "pause_ad_set",
        platform: input.connector,
        adSetId: input.params.adSetId ?? input.campaignId,
        before: "ACTIVE",
        after: "PAUSED",
      };
    case "enable_ad_set":
      return {
        action: "enable_ad_set",
        platform: input.connector,
        adSetId: input.params.adSetId ?? input.campaignId,
        before: "PAUSED",
        after: "ACTIVE",
      };
    case "create_ad_set":
      return {
        action: "create_ad_set",
        platform: input.connector,
        campaignId: input.campaignId,
        name: input.params.name,
        dailyBudget: input.params.dailyBudget,
        countries: input.params.countries ?? null,
      };
    case "create_ad":
      return {
        action: "create_ad",
        platform: input.connector,
        adSetId: input.params.adSetId,
        name: input.params.name,
        pageId: input.params.pageId,
        linkUrl: input.params.linkUrl,
        imageUrl: input.params.imageUrl ?? null,
        imageHash: input.params.imageHash ?? null,
      };
    case "upload_creative":
      return {
        action: "upload_creative",
        platform: input.connector,
        imageUrl: input.params.imageUrl,
        name: input.params.name ?? null,
      };
    case "create_audience":
      return {
        action: "create_audience",
        platform: input.connector,
        name: input.params.name,
        subtype: input.params.subtype ?? "CUSTOM",
        originAudienceId: input.params.originAudienceId ?? null,
      };
    case "add_keywords":
      return {
        action: "add_keywords",
        platform: input.connector,
        adGroupId: input.params.adGroupId,
        keywords: input.params.keywords,
      };
    case "add_negative_keywords":
      return {
        action: "add_negative_keywords",
        platform: input.connector,
        campaignId: input.campaignId,
        keywords: input.params.keywords,
      };
    case "create_conversion":
      return {
        action: "create_conversion",
        platform: input.connector,
        name: input.params.name,
        category: input.params.category ?? null,
      };
    case "attach_audience":
      return {
        action: "attach_audience",
        platform: input.connector,
        audienceId: input.params.audienceId,
        campaignId: input.campaignId ?? null,
        adSetId: input.params.adSetId ?? null,
      };
    case "pause_ad":
      return {
        action: "pause_ad",
        platform: input.connector,
        adId: input.params.adId,
        before: "ACTIVE",
        after: "PAUSED",
      };
  }
}

async function logRun(opts: {
  orgId: string;
  apiKeyId?: string;
  connector: string;
  tool: string;
  mode: string;
  status: string;
  params: Record<string, unknown>;
  result?: unknown;
  error?: string;
  approvalId?: string;
  latencyMs?: number;
}): Promise<string> {
  const id = uid("run");
  await db.insert(actionRuns).values({
    id,
    organizationId: opts.orgId,
    apiKeyId: opts.apiKeyId ?? null,
    connector: opts.connector,
    tool: opts.tool,
    mode: opts.mode,
    status: opts.status,
    params: opts.params,
    result: opts.result ? (opts.result as object) : null,
    error: opts.error ?? null,
    approvalId: opts.approvalId ?? null,
    latencyMs: opts.latencyMs ?? 0,
    createdAt: new Date(),
  });
  return id;
}

export async function logReadRun(opts: {
  orgId: string;
  apiKeyId?: string;
  connector?: string;
  tool: string;
  params: Record<string, unknown>;
  status: "ok" | "error";
  error?: string;
  latencyMs: number;
}): Promise<void> {
  await logRun({
    orgId: opts.orgId,
    apiKeyId: opts.apiKeyId,
    connector: opts.connector ?? "",
    tool: opts.tool,
    mode: "read",
    status: opts.status,
    params: opts.params,
    error: opts.error,
    latencyMs: opts.latencyMs,
  });
}

/**
 * Central pipeline for every write: validate → resolve connection → policy check
 * → dry-run diff / approval queue / live execution. Everything is logged.
 */
export async function runWriteAction(input: WriteActionInput): Promise<WriteActionOutcome> {
  const start = Date.now();
  const policy = await getOrgPolicy(input.orgId);
  const diff = buildDiff(input);

  const mode: ExecutionMode = input.mode ?? policy.defaultMode;

  // Kill switch (admin-level, per platform family)
  const ksKey = `${input.connector.replace(/_ads$/, "")}_write`;
  const ks = await db.select().from(killSwitches).where(eq(killSwitches.key, ksKey)).limit(1);
  if (ks[0]?.active) {
    await logRun({
      orgId: input.orgId, apiKeyId: input.apiKeyId, connector: input.connector, tool: input.action,
      mode, status: "blocked", params: diff, error: "Kill switch actif",
    });
    return { status: "blocked", mode, diff, message: `Écritures ${CONNECTORS[input.connector].label} désactivées par l'administrateur (kill switch).` };
  }

  // Protected campaigns
  if (input.campaignId && policy.protectedCampaignIds.includes(input.campaignId)) {
    await logRun({
      orgId: input.orgId, apiKeyId: input.apiKeyId, connector: input.connector, tool: input.action,
      mode, status: "blocked", params: diff, error: "Campagne protégée",
    });
    return { status: "blocked", mode, diff, message: `La campagne ${input.campaignId} est protégée par la policy du workspace.` };
  }

  // Budget change guardrail
  if (
    input.action === "update_budget" &&
    input.params.currentDailyBudget &&
    input.params.dailyBudget &&
    policy.maxBudgetChangePct > 0
  ) {
    const pct = ((input.params.dailyBudget - input.params.currentDailyBudget) / input.params.currentDailyBudget) * 100;
    if (pct > policy.maxBudgetChangePct) {
      await logRun({
        orgId: input.orgId, apiKeyId: input.apiKeyId, connector: input.connector, tool: input.action,
        mode, status: "blocked", params: diff, error: `Hausse de budget ${Math.round(pct)}% > ${policy.maxBudgetChangePct}%`,
      });
      return {
        status: "blocked", mode, diff,
        message: `Hausse de budget de ${Math.round(pct)} % refusée : la policy limite à +${policy.maxBudgetChangePct} %. Passez par une approbation ou ajustez la policy.`,
      };
    }
  }

  // Spend caps (only block spend-increasing actions)
  if (
    input.action === "create_campaign" ||
    input.action === "update_budget" ||
    input.action === "enable_campaign" ||
    input.action === "create_ad_set" ||
    input.action === "create_ad"
  ) {
    const capError = await checkSpendCaps(input.orgId, input.connector, policy);
    if (capError) {
      await logRun({
        orgId: input.orgId, apiKeyId: input.apiKeyId, connector: input.connector, tool: input.action,
        mode, status: "blocked", params: diff, error: capError,
      });
      return { status: "blocked", mode, diff, message: `${capError}. Action refusée par la policy.` };
    }
  }

  // Resolve connection early so dry runs report real connectivity problems.
  const conn = await resolveConnection(input.orgId, input.connector);
  const accountId = input.accountId ?? "";

  if (mode === "dry_run") {
    await logRun({
      orgId: input.orgId, apiKeyId: input.apiKeyId, connector: input.connector, tool: input.action,
      mode: "dry_run", status: "ok", params: diff, result: { wouldExecute: true }, latencyMs: Date.now() - start,
    });
    return {
      status: "dry_run",
      mode,
      diff,
      message:
        "Dry run : aucune modification effectuée. Relancez execute avec dry_run=false (ou mode « live » / « approval ») pour appliquer.",
      result: {
        next_step: "Re-call execute with dry_run=false",
        confirm: {
          action: input.action,
          platform: input.connector,
          campaignId: input.campaignId,
          accountId: input.accountId,
          params: input.params,
          dry_run: false,
        },
      },
    };
  }

  if (mode === "approval") {
    const actionId = uid("act");
    await db.insert(adActions).values({
      id: actionId,
      organizationId: input.orgId,
      connector: input.connector,
      action: input.action,
      status: "pending_approval",
      before: (diff.before as object) ?? null,
      after: diff,
      createdAt: new Date(),
    });
    const approvalId = uid("appr");
    await db.insert(approvals).values({
      id: approvalId,
      organizationId: input.orgId,
      actionId,
      track: "mcp",
      status: "pending",
      requiredApprovers: 1,
      expiresAt: new Date(Date.now() + 3 * 86400_000),
      createdAt: new Date(),
    });
    await logRun({
      orgId: input.orgId, apiKeyId: input.apiKeyId, connector: input.connector, tool: input.action,
      mode: "approval", status: "pending_approval", params: diff, approvalId, latencyMs: Date.now() - start,
    });
    return {
      status: "pending_approval", mode, diff, approvalId, actionId,
      message: `Action en attente d'approbation (id: ${approvalId}). Un membre du workspace doit l'approuver depuis le dashboard ou via approve_action.`,
    };
  }

  // live
  const result = await executeWrite(input, conn.id, accountId);
  await logRun({
    orgId: input.orgId, apiKeyId: input.apiKeyId, connector: input.connector, tool: input.action,
    mode: "live", status: "ok", params: diff, result, latencyMs: Date.now() - start,
  });
  return { status: "executed", mode, diff, result, message: "Action exécutée sur la plateforme." };
}

async function executeWrite(
  input: WriteActionInput,
  connectionId: string,
  accountIdOverride: string,
): Promise<Record<string, unknown>> {
  const adapter = getAdapter(input.connector);
  const tokens = await ensureFreshTokens(connectionId, input.orgId, input.connector);
  const accountId = accountIdOverride || tokens.accountId || "";

  switch (input.action) {
    case "create_campaign": {
      if (!adapter.createCampaign) {
        throw new Error(`Création de campagne non supportée pour ${adapter.label} — créez-la dans la console puis pilotez-la ici.`);
      }
      if (!input.params.name || !input.params.dailyBudget) throw new Error("name et dailyBudget requis");
      const res = await adapter.createCampaign(tokens, accountId, {
        name: input.params.name,
        dailyBudget: input.params.dailyBudget,
        objective: input.params.objective,
        countries: input.params.countries,
        type: input.params.campaignType,
        keywords: input.params.keywords,
        finalUrl: input.params.finalUrl,
        headlines: input.params.headlines,
        descriptions: input.params.descriptions,
      });
      return { campaignId: res.campaignId, ...res.details };
    }
    case "update_budget": {
      if (!input.campaignId || !input.params.dailyBudget) throw new Error("campaignId et dailyBudget requis");
      await adapter.updateBudget(tokens, accountId, input.campaignId, input.params.dailyBudget);
      return { campaignId: input.campaignId, dailyBudget: input.params.dailyBudget };
    }
    case "pause_campaign": {
      if (!input.campaignId) throw new Error("campaignId requis");
      await adapter.pauseCampaign(tokens, accountId, input.campaignId);
      return { campaignId: input.campaignId, status: "PAUSED" };
    }
    case "enable_campaign": {
      if (!input.campaignId) throw new Error("campaignId requis");
      await adapter.enableCampaign(tokens, accountId, input.campaignId);
      return { campaignId: input.campaignId, status: "ACTIVE" };
    }
    case "pause_ad_set": {
      if (!adapter.pauseAdSet) throw new Error(`pause_ad_set non supporté pour ${adapter.label}`);
      const adSetId = input.params.adSetId ?? input.campaignId;
      if (!adSetId) throw new Error("adSetId requis");
      await adapter.pauseAdSet(tokens, accountId, adSetId);
      return { adSetId, status: "PAUSED" };
    }
    case "enable_ad_set": {
      if (!adapter.enableAdSet) throw new Error(`enable_ad_set non supporté pour ${adapter.label}`);
      const adSetId = input.params.adSetId ?? input.campaignId;
      if (!adSetId) throw new Error("adSetId requis");
      await adapter.enableAdSet(tokens, accountId, adSetId);
      return { adSetId, status: "ACTIVE" };
    }
    case "create_ad_set": {
      if (!adapter.createAdSet) throw new Error(`create_ad_set non supporté pour ${adapter.label}`);
      if (!input.campaignId || !input.params.name || !input.params.dailyBudget) {
        throw new Error("campaignId, name et dailyBudget requis");
      }
      const res = await adapter.createAdSet(tokens, accountId, {
        campaignId: input.campaignId,
        name: input.params.name,
        dailyBudget: input.params.dailyBudget,
        countries: input.params.countries,
        optimizationGoal: input.params.optimizationGoal,
      });
      return { adSetId: res.adSetId, ...res.details };
    }
    case "create_ad": {
      if (!adapter.createAd) throw new Error(`create_ad non supporté pour ${adapter.label}`);
      if (!input.params.adSetId || !input.params.name) throw new Error("adSetId et name requis");
      const res = await adapter.createAd(tokens, accountId, {
        adSetId: input.params.adSetId,
        name: input.params.name,
        pageId: input.params.pageId,
        linkUrl: input.params.linkUrl,
        message: input.params.message,
        headline: input.params.headline,
        imageUrl: input.params.imageUrl,
        imageHash: input.params.imageHash,
      });
      return { adId: res.adId, ...res.details };
    }
    case "upload_creative": {
      if (!adapter.uploadCreative) throw new Error(`upload_creative non supporté pour ${adapter.label}`);
      if (!input.params.imageUrl) throw new Error("imageUrl requis");
      const res = await adapter.uploadCreative(tokens, accountId, {
        imageUrl: input.params.imageUrl,
        name: input.params.name,
      });
      return { imageHash: res.imageHash, creativeId: res.creativeId, ...res.details };
    }
    case "create_audience": {
      if (!adapter.createAudience) throw new Error(`create_audience non supporté pour ${adapter.label}`);
      if (!input.params.name) throw new Error("name requis");
      const res = await adapter.createAudience(tokens, accountId, {
        name: input.params.name,
        description: input.params.description,
        subtype: input.params.subtype,
        lookalikeRatio: input.params.lookalikeRatio,
        originAudienceId: input.params.originAudienceId,
        country: input.params.country,
      });
      return { audienceId: res.audienceId, ...res.details };
    }
    case "add_keywords": {
      if (!adapter.addKeywords) throw new Error(`add_keywords non supporté pour ${adapter.label}`);
      if (!input.params.adGroupId || !input.params.keywords?.length) {
        throw new Error("adGroupId et keywords[] requis");
      }
      const res = await adapter.addKeywords(tokens, accountId, {
        adGroupId: input.params.adGroupId,
        keywords: input.params.keywords,
      });
      return { count: res.count, ...res.details };
    }
    case "add_negative_keywords": {
      if (!adapter.addNegativeKeywords) throw new Error(`add_negative_keywords non supporté pour ${adapter.label}`);
      if (!input.campaignId || !input.params.keywords?.length) throw new Error("campaignId et keywords[] requis");
      const res = await adapter.addNegativeKeywords(tokens, accountId, {
        campaignId: input.campaignId,
        keywords: input.params.keywords,
      });
      return { count: res.count, ...res.details };
    }
    case "create_conversion": {
      if (!adapter.createConversion) throw new Error(`create_conversion non supporté pour ${adapter.label}`);
      if (!input.params.name) throw new Error("name requis");
      const res = await adapter.createConversion(tokens, accountId, {
        name: input.params.name,
        category: input.params.category,
      });
      return { conversionId: res.conversionId, ...res.details };
    }
    case "attach_audience": {
      if (!adapter.attachAudience) throw new Error(`attach_audience non supporté pour ${adapter.label}`);
      if (!input.params.audienceId) throw new Error("audienceId requis");
      const res = await adapter.attachAudience(tokens, accountId, {
        audienceId: input.params.audienceId,
        campaignId: input.campaignId,
        adSetId: input.params.adSetId,
      });
      return { ok: true, ...res.details };
    }
    case "pause_ad": {
      if (!adapter.pauseAd) throw new Error(`pause_ad non supporté pour ${adapter.label}`);
      if (!input.params.adId) throw new Error("adId requis");
      await adapter.pauseAd(tokens, accountId, input.params.adId);
      return { adId: input.params.adId, status: "PAUSED" };
    }
  }
}

/** Approve a pending MCP action then execute it live. */
export async function approveAndExecute(orgId: string, approvalId: string): Promise<WriteActionOutcome> {
  const rows = await db.select().from(approvals).where(eq(approvals.id, approvalId)).limit(1);
  const appr = rows[0];
  if (!appr || appr.organizationId !== orgId) throw new Error("Approbation introuvable");
  if (appr.status !== "pending") throw new Error(`Approbation déjà traitée (statut : ${appr.status})`);

  const actRows = appr.actionId
    ? await db.select().from(adActions).where(eq(adActions.id, appr.actionId)).limit(1)
    : [];
  const act = actRows[0];
  if (!act) throw new Error("Action liée introuvable");

  const after = (act.after ?? {}) as Record<string, unknown>;
  const input: WriteActionInput = {
    orgId,
    connector: act.connector as ConnectorId,
    action: act.action as WriteActionName,
    campaignId: (after.campaignId as string) ?? undefined,
    accountId: (after.accountId as string) ?? undefined,
    mode: "live",
    params: {
      name: (after.name as string) ?? undefined,
      dailyBudget: (after.after as number) ?? (after.dailyBudget as number) ?? undefined,
      objective: (after.objective as string) ?? undefined,
      countries: (after.countries as string[]) ?? undefined,
      adSetId: (after.adSetId as string) ?? undefined,
      adGroupId: (after.adGroupId as string) ?? undefined,
      pageId: (after.pageId as string) ?? undefined,
      linkUrl: (after.linkUrl as string) ?? undefined,
      message: (after.message as string) ?? undefined,
      headline: (after.headline as string) ?? undefined,
      imageUrl: (after.imageUrl as string) ?? undefined,
      imageHash: (after.imageHash as string) ?? undefined,
      description: (after.description as string) ?? undefined,
      subtype: (after.subtype as string) ?? undefined,
      lookalikeRatio: (after.lookalikeRatio as number) ?? undefined,
      originAudienceId: (after.originAudienceId as string) ?? undefined,
      country: (after.country as string) ?? undefined,
      optimizationGoal: (after.optimizationGoal as string) ?? undefined,
      keywords: (after.keywords as { text: string; matchType?: string; bid?: number }[]) ?? undefined,
      campaignType: (after.campaignType as WriteActionInput["params"]["campaignType"]) ?? undefined,
      finalUrl: (after.finalUrl as string) ?? undefined,
      headlines: (after.headlines as string[]) ?? undefined,
      descriptions: (after.descriptions as string[]) ?? undefined,
      category: (after.category as string) ?? undefined,
    },
  };

  await db.update(approvals).set({ status: "approved" }).where(eq(approvals.id, approvalId));
  try {
    const outcome = await runWriteAction(input);
    await db.update(adActions).set({ status: "executed" }).where(eq(adActions.id, act.id));
    return outcome;
  } catch (e) {
    await db.update(adActions).set({ status: "failed" }).where(eq(adActions.id, act.id));
    throw e;
  }
}

export async function rejectPendingAction(orgId: string, approvalId: string): Promise<void> {
  const rows = await db.select().from(approvals).where(eq(approvals.id, approvalId)).limit(1);
  const appr = rows[0];
  if (!appr || appr.organizationId !== orgId) throw new Error("Approbation introuvable");
  await db.update(approvals).set({ status: "rejected" }).where(eq(approvals.id, approvalId));
  if (appr.actionId) {
    await db.update(adActions).set({ status: "rejected" }).where(eq(adActions.id, appr.actionId));
  }
}

export async function recordSpend(opts: {
  orgId: string;
  connector: string;
  accountId?: string;
  spend: number;
  currency?: string;
}): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(spendTracking)
    .where(
      and(
        eq(spendTracking.organizationId, opts.orgId),
        eq(spendTracking.connector, opts.connector),
        eq(spendTracking.day, day),
      ),
    )
    .limit(1);
  if (rows[0]) {
    await db
      .update(spendTracking)
      .set({ spend: String(opts.spend), updatedAt: new Date() })
      .where(eq(spendTracking.id, rows[0].id));
  } else {
    await db.insert(spendTracking).values({
      id: uid("spend"),
      organizationId: opts.orgId,
      connector: opts.connector,
      accountId: opts.accountId ?? null,
      day,
      spend: String(opts.spend),
      currency: opts.currency ?? "USD",
      updatedAt: new Date(),
    });
  }
}
