export type MCPServerId =
  | "google_ads_read"
  | "google_ads_write"
  | "meta_ads"
  | "linkedin_ads"
  | "tiktok_ads"
  | "snapchat_ads"
  | "reddit_ads"
  | "microsoft_ads"
  | "x_ads"
  | "amazon_ads"
  | "pinterest_ads"
  | "ga4";

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
    { spend: 0, conversions: 0, currency: "USD" },
  );

  const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : null;
  const allIssues = schema.accounts.flatMap((a) => a.issues);
  const allOpps = schema.accounts.flatMap((a) => a.opportunities);
  const emptyAccounts = schema.accounts.filter((a) => a.campaigns.length === 0 && a.spend === 0);
  const named = schema.accounts
    .map((a) => a.accountName || a.accountId)
    .filter(Boolean)
    .slice(0, 2);

  let situation: string;
  if (schema.accounts.length === 0) {
    situation =
      "Aucun compte publicitaire connecté. Reliez Meta depuis Connexions pour lancer une analyse.";
  } else if (emptyAccounts.length === schema.accounts.length) {
    situation =
      `Compte${named.length ? ` ${named.join(", ")}` : ""} connecté, mais **aucune campagne** et **0 dépense** sur la période. ` +
      `Ce n'est pas un problème de tracking — le compte est vide. Prochaine étape : créer une première campagne en pause.`;
  } else {
    situation = `Sur ${schema.accounts.length} plateforme(s) : ${formatMoney(totals.spend, totals.currency)} dépensés, ${totals.conversions} conversion(s)${cpa != null ? `, CPA ~${Math.round(cpa)} ${totals.currency}` : ""}.`;
  }

  const problems =
    emptyAccounts.length === schema.accounts.length && schema.accounts.length > 0
      ? [
          "Aucune campagne active ni en pause sur le compte connecté — rien à optimiser tant qu'une première pub n'existe pas.",
          ...allIssues.slice(0, 2),
        ]
      : allIssues.slice(0, 3);

  const opportunities =
    emptyAccounts.length === schema.accounts.length && schema.accounts.length > 0
      ? [
          "Créer une campagne Meta en pause (objectif leads ou ventes, 1 pays, 1 offre) puis valider avant activation.",
        ]
      : allOpps.slice(0, 3);

  return {
    situation,
    problems,
    opportunities,
    firstAction: pickFirstAction(problems, schema),
    accounts: schema.accounts,
    totals: { ...totals, cpa, roas: null },
  };
}

function formatMoney(n: number, currency: string) {
  return `${Math.round(n).toLocaleString("fr-FR")} ${currency}`;
}

function pickFirstAction(issues: string[], schema: UnifiedAdSchema): string {
  if (!schema.accounts.length) {
    return "Connectez Meta Ads depuis Connexions, puis choisissez la Page Facebook.";
  }
  const empty = schema.accounts.every((a) => a.campaigns.length === 0 && a.spend === 0);
  if (empty) {
    return "Donnez-moi : produit/offre, pays, budget/jour et URL — je prépare une campagne Meta en pause.";
  }
  if (issues.some((i) => i.toLowerCase().includes("whatsapp") || i.toLowerCase().includes("conversion"))) {
    return "Reliez le suivi des conversions (Pixel / GA4) pour mesurer les ventes réelles.";
  }
  return "Consolidez le budget sur la campagne la plus rentable identifiée par l'audit.";
}
