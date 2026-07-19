export type MCPServerId = "google_ads_read" | "google_ads_write" | "meta_ads" | "tiktok_ads" | "ga4";

export type MCPMode = "read" | "write";

export type MCPCallInput = {
  server: MCPServerId;
  tool: string;
  orgId: string;
  connectionId: string;
  params?: Record<string, unknown>;
  mode: MCPMode;
  runId?: string;
};

export type UnifiedCampaign = {
  platform: string;
  id: string;
  name: string;
  status: string;
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpa: number | null;
  roas: number | null;
};

export type UnifiedAccountSnapshot = {
  platform: string;
  accountId: string;
  accountName: string;
  period: string;
  spend: number;
  currency: string;
  conversions: number;
  cpa: number | null;
  roas: number | null;
  campaigns: UnifiedCampaign[];
  issues: string[];
  opportunities: string[];
};

export type AuditSummary = {
  situation: string;
  problems: string[];
  opportunities: string[];
  firstAction: string;
  accounts: UnifiedAccountSnapshot[];
  totals: {
    spend: number;
    conversions: number;
    currency: string;
    cpa: number | null;
    roas: number | null;
  };
};

export type UnifiedAdSchema = {
  accounts: UnifiedAccountSnapshot[];
  generatedAt: string;
};

export function mergeSnapshots(accounts: UnifiedAccountSnapshot[]): UnifiedAdSchema {
  return { accounts, generatedAt: new Date().toISOString() };
}

export function buildAuditSummary(schema: UnifiedAdSchema): AuditSummary {
  const totals = schema.accounts.reduce(
    (acc, a) => ({
      spend: acc.spend + a.spend,
      conversions: acc.conversions + a.conversions,
      currency: a.currency || acc.currency,
    }),
    { spend: 0, conversions: 0, currency: "XOF" },
  );

  const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : null;
  const allIssues = schema.accounts.flatMap((a) => a.issues);
  const allOpps = schema.accounts.flatMap((a) => a.opportunities);

  const situation =
    schema.accounts.length === 0
      ? "Aucun compte publicitaire connecté. Reliez Meta, Google ou TikTok pour lancer une analyse."
      : `Vos campagnes tournent sur ${schema.accounts.length} plateforme(s). Dépense totale sur la période : ${formatMoney(totals.spend, totals.currency)} pour ${totals.conversions} conversion(s).`;

  return {
    situation,
    problems: allIssues.slice(0, 3),
    opportunities: allOpps.slice(0, 3),
    firstAction: pickFirstAction(allIssues, schema),
    accounts: schema.accounts,
    totals: { ...totals, cpa, roas: cpa ? (totals.conversions * 5000) / totals.spend : null },
  };
}

function formatMoney(n: number, currency: string) {
  return `${Math.round(n).toLocaleString("fr-FR")} ${currency}`;
}

function pickFirstAction(issues: string[], schema: UnifiedAdSchema): string {
  if (!schema.accounts.length) {
    return "Connectez au moins une plateforme publicitaire (Meta, Google, TikTok) depuis Connexions.";
  }
  if (issues.some((i) => i.toLowerCase().includes("whatsapp") || i.toLowerCase().includes("conversion"))) {
    return "Reliez le suivi WhatsApp ou GA4 pour mesurer les commandes réelles — vous verrez enfin votre rentabilité.";
  }
  if (!schema.accounts.some((a) => a.platform === "Google Analytics")) {
    return "Connectez Google Analytics 4 pour croiser vos dépenses publicitaires avec les ventes réelles.";
  }
  return "Consolidez le budget sur la campagne la plus rentable identifiée par l'audit.";
}
