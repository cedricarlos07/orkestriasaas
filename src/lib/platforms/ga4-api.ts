import type { UnifiedAccountSnapshot } from "@/lib/unified-ad-schema";

export async function listGa4Properties(accessToken: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GA4 account summaries: ${await res.text()}`);
  const data = (await res.json()) as {
    accountSummaries?: {
      propertySummaries?: { property?: string; displayName?: string }[];
    }[];
  };
  const props: { id: string; name: string }[] = [];
  for (const acc of data.accountSummaries ?? []) {
    for (const p of acc.propertySummaries ?? []) {
      if (!p.property) continue;
      props.push({
        id: p.property.replace("properties/", ""),
        name: p.displayName ?? p.property,
      });
    }
  }
  return props;
}

export async function fetchGa4Snapshot(
  accessToken: string,
  propertyId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
  const pid = propertyId.replace(/\D/g, "");
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      metrics: [
        { name: "sessions" },
        { name: "conversions" },
        { name: "totalRevenue" },
      ],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
    }),
  });
  if (!res.ok) throw new Error(`GA4 runReport: ${await res.text()}`);
  const data = (await res.json()) as {
    rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  };

  let conversions = 0;
  let revenue = 0;
  const channelBreakdown: string[] = [];

  for (const row of data.rows ?? []) {
    const channel = row.dimensionValues?.[0]?.value ?? "unknown";
    const conv = Number(row.metricValues?.[1]?.value ?? 0);
    const rev = Number(row.metricValues?.[2]?.value ?? 0);
    conversions += conv;
    revenue += rev;
    if (conv > 0) channelBreakdown.push(`${channel}: ${conv} conv.`);
  }

  const issues: string[] = [];
  const opportunities: string[] = [];
  if (conversions === 0) issues.push("GA4 ne remonte aucune conversion sur 30 jours");
  issues.push("Comparez GA4 aux plateformes ads pour détecter la double attribution");
  opportunities.push("Configurez un entonnoir GA4 pour mesurer WhatsApp → commande");

  return {
    platform: "Google Analytics",
    accountId: pid,
    accountName: `GA4 ${pid}`,
    period,
    spend: 0,
    currency: "USD",
    conversions,
    cpa: null,
    roas: revenue > 0 ? revenue : null,
    campaigns: [],
    issues,
    opportunities,
  };
}
