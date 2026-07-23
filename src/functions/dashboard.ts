import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { ensureSession } from "@/lib/auth.functions";
import { getActiveOrgId, getUserProfile } from "./context";
import { getMetaConnection } from "@/lib/platforms/meta-connection";
import { fetchMetaAdsSnapshot } from "@/lib/platforms/meta-api";
import { getQuotaStatus } from "@/lib/quotas/enforce";
import { db } from "@/db";
import { businessMemory } from "@/db/schema/index";

export type DashboardKpi = {
  key: string;
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  deltaLabel: string;
};

export type DashboardData = {
  greeting: string;
  company: string;
  metaConnected: boolean;
  kpis: DashboardKpi[];
  pendingApprovalsHint: string;
};

export const getDashboardKpis = createServerFn({ method: "GET" }).handler(async (): Promise<DashboardData> => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const profile = await getUserProfile(session.user.id);
  const company = profile?.company ?? session.user.name ?? "votre entreprise";
  const greeting = session.user.name ? `Bonjour ${session.user.name.split(" ")[0]}` : "Bonjour";

  const empty = (hint: string): DashboardData => ({
    greeting,
    company,
    metaConnected: false,
    kpis: [],
    pendingApprovalsHint: hint,
  });

  const [meta, quotas, linkedRow] = await Promise.all([
    getMetaConnection(orgId).catch(() => null),
    getQuotaStatus(orgId).catch(() => null),
    db
      .select()
      .from(businessMemory)
      .where(and(eq(businessMemory.organizationId, orgId), eq(businessMemory.key, "linked_ad_accounts")))
      .limit(1)
      .catch(() => []),
  ]);

  if (!meta) {
    return empty("Connectez Meta Ads pour voir vos performances réelles.");
  }

  const adAccountLimit = quotas?.quotas.adAccounts ?? 1;
  const linkedList = Array.isArray((linkedRow[0]?.value as { accounts?: unknown })?.accounts)
    ? ((linkedRow[0]!.value as { accounts: unknown[] }).accounts)
    : [];
  const linkedAds = Math.max(linkedList.length, meta.tokens.accountId ? 1 : 0);
  const aiLeft = quotas?.remaining.aiBudgetUsd;
  const aiMax = quotas?.quotas.aiBudgetUsdMonthly ?? 0;

  let snapshot: Awaited<ReturnType<typeof fetchMetaAdsSnapshot>>;
  try {
    snapshot = await fetchMetaAdsSnapshot(
      meta.tokens.accessToken,
      meta.tokens.accountId!,
      "30 derniers jours",
    );
  } catch {
    return {
      greeting,
      company,
      metaConnected: true,
      kpis: [
        {
          key: "accounts",
          label: "Comptes pubs",
          value: adAccountLimit < 0 ? `${linkedAds}` : `${linkedAds} / ${adAccountLimit}`,
          delta: "—",
          trend: "flat",
          deltaLabel: "liés à Orkestria",
        },
        {
          key: "credits",
          label: "Crédit IA",
          value: aiLeft == null ? "Illimité" : `$${aiLeft.toFixed(0)}`,
          delta: "—",
          trend: "flat",
          deltaLabel: aiMax > 0 ? `restant ce mois (max $${aiMax})` : "selon votre plan",
        },
      ],
      pendingApprovalsHint: "Les chiffres Meta arriveront dès que le compte répond.",
    };
  }

  const spend = snapshot.spend;
  const conv = snapshot.conversions;
  const cpa = snapshot.cpa;
  const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const activeCampaigns = snapshot.campaigns.filter((c) => c.status === "ACTIVE").length;
  const totalCampaigns = snapshot.campaigns.length;

  return {
    greeting,
    company,
    metaConnected: true,
    kpis: [
      {
        key: "spend",
        label: "Dépenses pub",
        value: fmtMoney(spend),
        delta: "—",
        trend: "flat",
        deltaLabel: "sur les 30 derniers jours",
      },
      {
        key: "results",
        label: "Résultats",
        value: String(conv),
        delta: "—",
        trend: "flat",
        deltaLabel: "ventes ou actions suivies",
      },
      {
        key: "cpa",
        label: "Coût/résultat",
        value: cpa != null ? fmtMoney(cpa) : "—",
        delta: "—",
        trend: "flat",
        deltaLabel: conv > 0 ? "dépense ÷ résultats" : "pas encore de résultat",
      },
      {
        key: "campaigns",
        label: "Campagnes",
        value: String(activeCampaigns),
        delta: "—",
        trend: "flat",
        deltaLabel:
          totalCampaigns === 0
            ? "aucune sur le compte"
            : `${activeCampaigns} en cours · ${totalCampaigns} au total`,
      },
      {
        key: "accounts",
        label: "Comptes pubs",
        value: adAccountLimit < 0 ? `${linkedAds}` : `${linkedAds} / ${adAccountLimit}`,
        delta: "—",
        trend: "flat",
        deltaLabel: adAccountLimit < 0 ? "selon votre plan" : "utilisés / autorisés",
      },
      {
        key: "credits",
        label: "Crédit IA",
        value: aiLeft == null ? "Illimité" : `$${Math.max(0, aiLeft).toFixed(0)}`,
        delta: "—",
        trend: "flat",
        deltaLabel: aiMax > 0 ? `restant ce mois · plafond $${aiMax}` : "restant ce mois",
      },
    ],
    pendingApprovalsHint:
      snapshot.issues.length > 0
        ? `${snapshot.issues.length} point${snapshot.issues.length > 1 ? "s" : ""} à vérifier sur Meta.`
        : "",
  };
});
