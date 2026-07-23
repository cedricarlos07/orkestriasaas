import { createServerFn } from "@tanstack/react-start";
import { ensureSession } from "@/lib/auth.functions";
import { getActiveOrgId, getUserProfile } from "./context";
import { getMetaConnection } from "@/lib/platforms/meta-connection";
import { fetchMetaAdsSnapshot } from "@/lib/platforms/meta-api";

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
  const greeting = session.user.name ? `Bonjour ${session.user.name.split(" ")[0]} 👋` : "Bonjour 👋";

  const empty = (hint: string): DashboardData => ({
    greeting,
    company,
    metaConnected: false,
    kpis: [],
    pendingApprovalsHint: hint,
  });

  const meta = await getMetaConnection(orgId).catch(() => null);
  if (!meta) {
    return empty("Connectez Meta Ads pour voir vos performances réelles.");
  }

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
          key: "account",
          label: "Compte",
          value: (meta.tokens.accountName ?? meta.conn.externalAccount ?? "Lié").slice(0, 20),
          delta: "—",
          trend: "flat",
          deltaLabel: "connexion OK",
        },
      ],
      pendingApprovalsHint: "Les KPIs détaillés seront disponibles dès que Meta renverra les statistiques.",
    };
  }

  const spend = snapshot.spend;
  const conv = snapshot.conversions;
  const cpa = snapshot.cpa;
  const fmtMoney = (n: number) =>
    `$${Math.round(n).toLocaleString("en-US")}`;

  const activeCampaigns = snapshot.campaigns.filter((c) => c.status === "ACTIVE").length;

  const accountLabel =
    snapshot.accountName && !/^\d+$/.test(snapshot.accountName)
      ? snapshot.accountName
      : meta.tokens.accountName && !/^\d+$/.test(meta.tokens.accountName)
        ? meta.tokens.accountName
        : meta.conn.externalAccount && !/^\d+$/.test(meta.conn.externalAccount)
          ? meta.conn.externalAccount
          : "Compte lié";

  return {
    greeting,
    company,
    metaConnected: true,
    kpis: [
      {
        key: "spend",
        label: "Dépenses",
        value: fmtMoney(spend),
        delta: "—",
        trend: "flat",
        deltaLabel: "30 derniers jours",
      },
      {
        key: "results",
        label: "Conversions",
        value: String(conv),
        delta: "—",
        trend: "flat",
        deltaLabel: "30 derniers jours",
      },
      {
        key: "cpa",
        label: "CPA",
        value: cpa != null ? fmtMoney(cpa) : "—",
        delta: "—",
        trend: "flat",
        deltaLabel: "par conversion",
      },
      {
        key: "campaigns",
        label: "Actives",
        value: String(activeCampaigns),
        delta: String(snapshot.campaigns.length),
        trend: "flat",
        deltaLabel: `sur ${snapshot.campaigns.length} au total`,
      },
      {
        key: "account",
        label: "Compte",
        value: accountLabel.slice(0, 20),
        delta: snapshot.currency || "USD",
        trend: "flat",
        deltaLabel: "devise du compte",
      },
      {
        key: "issues",
        label: "Alertes",
        value: String(snapshot.issues.length),
        delta: String(snapshot.opportunities.length),
        trend: snapshot.issues.length ? "down" : "flat",
        deltaLabel:
          snapshot.opportunities.length > 0
            ? `${snapshot.opportunities.length} opportunité${snapshot.opportunities.length > 1 ? "s" : ""}`
            : "aucune opportunité",
      },
    ],
    pendingApprovalsHint: "",
  };
});
