import { createServerFn } from "@tanstack/react-start";
import { ensureSession } from "@/lib/auth.functions";
import { getActiveOrgId, getUserProfile } from "./context";
import { getMetaConnection, isMetaLinked } from "@/lib/platforms/meta-connection";
import { fetchMetaAdsSnapshot } from "@/lib/platforms/meta-api";
import { isAdkitEnabled } from "@/lib/mcp/clients/adkit";
import { fetchAdkitAccountSnapshot } from "@/lib/mcp/adkit-bridge";
import { requireOrgAdkitProjectId } from "@/lib/mcp/adkit-org";
import { ADKIT_LINK_MARKER } from "@/lib/mcp/adkit-org";

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

  // Prefer unified MCP snapshot when AdKit is configured
  if (isAdkitEnabled()) {
    try {
      const linked = await isMetaLinked(orgId);
      if (!linked) {
        return empty("Connectez Meta Ads pour voir vos performances réelles.");
      }
      const projectId = await requireOrgAdkitProjectId(orgId);
      const meta = await getMetaConnection(orgId);
      const accountId =
        meta?.via === "oauth" && meta.tokens.accountId ? meta.tokens.accountId : undefined;
      const snapshot = await fetchAdkitAccountSnapshot({
        projectId,
        platform: "meta",
        accountId,
        period: "30 derniers jours",
      });

      const spend = snapshot.spend;
      const conv = snapshot.conversions;
      const cpa = snapshot.cpa;
      const currency = snapshot.currency === "USD" ? "$" : snapshot.currency === "EUR" ? "€" : " FCFA";
      const fmtMoney = (n: number) =>
        snapshot.currency === "XOF" || snapshot.currency === "XAF"
          ? `${Math.round(n).toLocaleString("fr-FR")} FCFA`
          : `${currency}${n.toFixed(0)}`;
      const activeCampaigns = snapshot.campaigns.filter((c) =>
        /ACTIVE|ENABLED|live/i.test(c.status),
      ).length;

      return {
        greeting,
        company,
        metaConnected: true,
        kpis: [
          {
            key: "spend",
            label: "Dépense (30j)",
            value: fmtMoney(spend),
            delta: "—",
            trend: "flat",
            deltaLabel: "Meta Ads",
          },
          {
            key: "results",
            label: "Conversions",
            value: String(conv),
            delta: "—",
            trend: conv > 0 ? "up" : "flat",
            deltaLabel: "30 jours",
          },
          {
            key: "cpa",
            label: "Coût / résultat",
            value: cpa != null ? fmtMoney(cpa) : "—",
            delta: "—",
            trend: "flat",
            deltaLabel: "Meta",
          },
          {
            key: "campaigns",
            label: "Campagnes actives",
            value: String(activeCampaigns),
            delta: String(snapshot.campaigns.length),
            trend: "flat",
            deltaLabel: "total compte",
          },
          {
            key: "account",
            label: "Compte",
            value: (snapshot.accountName || "Meta").slice(0, 18),
            delta: snapshot.currency,
            trend: "flat",
            deltaLabel: "devise",
          },
          {
            key: "issues",
            label: "Alertes audit",
            value: String(snapshot.issues.length),
            delta: String(snapshot.opportunities.length),
            trend: snapshot.issues.length ? "down" : "up",
            deltaLabel: "opportunités",
          },
        ],
        pendingApprovalsHint: "",
      };
    } catch {
      // fall through to direct Meta OAuth path
    }
  }

  const meta = await getMetaConnection(orgId).catch(() => null);
  if (!meta || meta.tokens.accessToken === ADKIT_LINK_MARKER) {
    return empty("Connectez Meta Ads pour voir vos performances réelles.");
  }

  const snapshot = await fetchMetaAdsSnapshot(
    meta.tokens.accessToken,
    meta.tokens.accountId!,
    "30 derniers jours",
  );

  const spend = snapshot.spend;
  const conv = snapshot.conversions;
  const cpa = snapshot.cpa;
  const currency = snapshot.currency === "USD" ? "$" : snapshot.currency === "EUR" ? "€" : " FCFA";
  const fmtMoney = (n: number) =>
    snapshot.currency === "XOF" || snapshot.currency === "XAF"
      ? `${Math.round(n).toLocaleString("fr-FR")} FCFA`
      : `${currency}${n.toFixed(0)}`;

  const activeCampaigns = snapshot.campaigns.filter((c) => c.status === "ACTIVE").length;

  return {
    greeting,
    company,
    metaConnected: true,
    kpis: [
      {
        key: "spend",
        label: "Dépense (30j)",
        value: fmtMoney(spend),
        delta: "—",
        trend: "flat",
        deltaLabel: "Meta Ads",
      },
      {
        key: "results",
        label: "Conversions",
        value: String(conv),
        delta: "—",
        trend: conv > 0 ? "up" : "flat",
        deltaLabel: "30 jours",
      },
      {
        key: "cpa",
        label: "Coût / résultat",
        value: cpa != null ? fmtMoney(cpa) : "—",
        delta: "—",
        trend: "flat",
        deltaLabel: "Meta",
      },
      {
        key: "campaigns",
        label: "Campagnes actives",
        value: String(activeCampaigns),
        delta: String(snapshot.campaigns.length),
        trend: "flat",
        deltaLabel: "total compte",
      },
      {
        key: "account",
        label: "Compte",
        value: snapshot.accountName.slice(0, 18),
        delta: snapshot.currency,
        trend: "flat",
        deltaLabel: "devise",
      },
      {
        key: "issues",
        label: "Alertes audit",
        value: String(snapshot.issues.length),
        delta: String(snapshot.opportunities.length),
        trend: snapshot.issues.length ? "down" : "up",
        deltaLabel: "opportunités",
      },
    ],
    pendingApprovalsHint: "",
  };
});
