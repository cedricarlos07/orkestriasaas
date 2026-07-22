import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

const API = "https://adsapi.snapchat.com/v1";

function headers(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

export async function listSnapchatAdAccounts(
  accessToken: string,
): Promise<{ id: string; name: string; currency: string }[]> {
  const meRes = await fetch(`${API}/me/organizations`, { headers: headers(accessToken) });
  if (!meRes.ok) throw new Error(`Snapchat organizations: ${await meRes.text()}`);
  const meData = (await meRes.json()) as {
    organizations?: { organization?: { id: string } }[];
  };
  const orgId = meData.organizations?.[0]?.organization?.id;
  if (!orgId) return [];

  const res = await fetch(`${API}/organizations/${orgId}/adaccounts`, { headers: headers(accessToken) });
  if (!res.ok) throw new Error(`Snapchat ad accounts: ${await res.text()}`);
  const data = (await res.json()) as {
    adaccounts?: { adaccount?: { id: string; name: string; currency?: string } }[];
  };
  return (data.adaccounts ?? [])
    .map((a) => a.adaccount)
    .filter(Boolean)
    .map((a) => ({ id: a!.id, name: a!.name, currency: a!.currency ?? "USD" }));
}

export async function fetchSnapchatSnapshot(
  accessToken: string,
  adAccountId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
  const campRes = await fetch(`${API}/adaccounts/${adAccountId}/campaigns`, { headers: headers(accessToken) });
  if (!campRes.ok) throw new Error(`Snapchat campaigns: ${await campRes.text()}`);
  const campData = (await campRes.json()) as {
    campaigns?: { campaign?: { id: string; name: string; status: string } }[];
  };
  const camps = (campData.campaigns ?? []).map((c) => c.campaign).filter(Boolean) as {
    id: string;
    name: string;
    status: string;
  }[];

  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 19) + "Z";

  let spend = 0;
  let conversions = 0;
  const campaigns: UnifiedCampaign[] = [];

  for (const c of camps) {
    let m = { spend: 0, impressions: 0, swipes: 0, conversions: 0 };
    try {
      const statsRes = await fetch(
        `${API}/campaigns/${c.id}/stats?granularity=TOTAL&fields=spend,impressions,swipes,conversion_purchases&start_time=${encodeURIComponent(iso(start))}&end_time=${encodeURIComponent(iso(end))}`,
        { headers: headers(accessToken) },
      );
      if (statsRes.ok) {
        const stats = (await statsRes.json()) as {
          total_stats?: { total_stat?: { stats?: { spend?: number; impressions?: number; swipes?: number; conversion_purchases?: number } } }[];
        };
        const s = stats.total_stats?.[0]?.total_stat?.stats;
        if (s) {
          m = {
            // Snapchat returns spend in micro-currency
            spend: Number(s.spend ?? 0) / 1_000_000,
            impressions: Number(s.impressions ?? 0),
            swipes: Number(s.swipes ?? 0),
            conversions: Number(s.conversion_purchases ?? 0),
          };
        }
      }
    } catch {
      // stats can fail per-campaign; keep zeros
    }
    spend += m.spend;
    conversions += m.conversions;
    campaigns.push({
      platform: "Snapchat Ads",
      id: c.id,
      name: c.name,
      status: c.status,
      spend: m.spend,
      currency: "USD",
      impressions: m.impressions,
      clicks: m.swipes,
      conversions: m.conversions,
      ctr: m.impressions > 0 ? (m.swipes / m.impressions) * 100 : 0,
      cpa: m.conversions > 0 ? m.spend / m.conversions : null,
      roas: null,
    });
  }

  const issues: string[] = [];
  if (!conversions) issues.push("Aucune conversion Snapchat sur 30 jours — vérifiez le Snap Pixel");

  return {
    platform: "Snapchat Ads",
    accountId: adAccountId,
    accountName: `Snapchat ${adAccountId}`,
    period,
    spend,
    currency: "USD",
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues,
    opportunities: ["Les formats AR Lens performent bien auprès des 18-24 ans"],
  };
}

async function setSnapchatCampaignStatus(
  accessToken: string,
  campaignId: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  const getRes = await fetch(`${API}/campaigns/${campaignId}`, { headers: headers(accessToken) });
  if (!getRes.ok) throw new Error(`Snapchat get campaign: ${await getRes.text()}`);
  const getData = (await getRes.json()) as {
    campaigns?: { campaign?: Record<string, unknown> }[];
  };
  const campaign = getData.campaigns?.[0]?.campaign;
  if (!campaign) throw new Error("Campagne Snapchat introuvable");

  const adAccountId = campaign.ad_account_id as string;
  const res = await fetch(`${API}/adaccounts/${adAccountId}/campaigns`, {
    method: "PUT",
    headers: headers(accessToken),
    body: JSON.stringify({ campaigns: [{ ...campaign, status }] }),
  });
  if (!res.ok) throw new Error(`Snapchat update status: ${await res.text()}`);
}

export async function pauseSnapchatCampaign(accessToken: string, campaignId: string) {
  await setSnapchatCampaignStatus(accessToken, campaignId, "PAUSED");
}

export async function enableSnapchatCampaign(accessToken: string, campaignId: string) {
  await setSnapchatCampaignStatus(accessToken, campaignId, "ACTIVE");
}

export async function updateSnapchatCampaignBudget(
  accessToken: string,
  campaignId: string,
  dailyBudgetMicro: number,
): Promise<void> {
  const getRes = await fetch(`${API}/campaigns/${campaignId}`, { headers: headers(accessToken) });
  if (!getRes.ok) throw new Error(`Snapchat get campaign: ${await getRes.text()}`);
  const getData = (await getRes.json()) as {
    campaigns?: { campaign?: Record<string, unknown> }[];
  };
  const campaign = getData.campaigns?.[0]?.campaign;
  if (!campaign) throw new Error("Campagne Snapchat introuvable");

  const adAccountId = campaign.ad_account_id as string;
  const res = await fetch(`${API}/adaccounts/${adAccountId}/campaigns`, {
    method: "PUT",
    headers: headers(accessToken),
    body: JSON.stringify({ campaigns: [{ ...campaign, daily_budget_micro: dailyBudgetMicro }] }),
  });
  if (!res.ok) throw new Error(`Snapchat budget update: ${await res.text()}`);
}

export async function createSnapchatCampaignPaused(
  accessToken: string,
  adAccountId: string,
  input: { name: string; dailyBudget: number },
): Promise<{ campaignId: string; details: Record<string, unknown> }> {
  const dailyBudgetMicro = Math.round(Math.max(1, input.dailyBudget) * 1_000_000);
  const res = await fetch(`${API}/adaccounts/${adAccountId}/campaigns`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      campaigns: [
        {
          name: input.name.slice(0, 375),
          ad_account_id: adAccountId,
          status: "PAUSED",
          daily_budget_micro: dailyBudgetMicro,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Snapchat create campaign: ${await res.text()}`);
  const data = (await res.json()) as { campaigns?: { campaign?: { id?: string } }[] };
  const campaignId = data.campaigns?.[0]?.campaign?.id;
  if (!campaignId) throw new Error("Snapchat create campaign: id manquant");
  return {
    campaignId,
    details: { status: "PAUSED", note: "Campagne Snapchat créée en PAUSED" },
  };
}

export async function createSnapchatAudience(
  accessToken: string,
  adAccountId: string,
  input: { name: string; description?: string },
): Promise<{ audienceId: string }> {
  const res = await fetch(`${API}/adaccounts/${adAccountId}/segments`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      segments: [
        {
          name: input.name.slice(0, 375),
          description: input.description ?? "Orkestria audience",
          source_type: "FIRST_PARTY",
          ad_account_id: adAccountId,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Snapchat create audience: ${await res.text()}`);
  const data = (await res.json()) as { segments?: { segment?: { id?: string } }[] };
  const audienceId = data.segments?.[0]?.segment?.id;
  if (!audienceId) throw new Error("Snapchat create audience: id manquant");
  return { audienceId };
}
