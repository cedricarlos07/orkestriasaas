import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function listMetaAdAccounts(accessToken: string): Promise<{ id: string; name: string; currency: string }[]> {
  const url = new URL(`${GRAPH}/me/adaccounts`);
  url.searchParams.set("fields", "id,name,currency,timezone_name,account_status");
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("limit", "50");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta ad accounts: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: { id: string; name: string; currency?: string; account_status?: number }[];
  };
  return (data.data ?? [])
    .filter((a) => a.account_status === 1 || a.account_status === undefined)
    .map((a) => ({ id: a.id, name: a.name, currency: a.currency ?? "USD" }));
}

export async function fetchMetaAdsSnapshot(
  accessToken: string,
  adAccountId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId.replace(/\D/g, "")}`;

  const insightsUrl = new URL(`${GRAPH}/${actId}/insights`);
  insightsUrl.searchParams.set("fields", "spend,impressions,clicks,actions,campaign_id,campaign_name");
  insightsUrl.searchParams.set("level", "campaign");
  insightsUrl.searchParams.set("date_preset", "last_30d");
  insightsUrl.searchParams.set("access_token", accessToken);

  const res = await fetch(insightsUrl);
  if (!res.ok) throw new Error(`Meta insights: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: {
      campaign_id?: string;
      campaign_name?: string;
      spend?: string;
      impressions?: string;
      clicks?: string;
      actions?: { action_type: string; value: string }[];
    }[];
  };

  const accountUrl = new URL(`${GRAPH}/${actId}`);
  accountUrl.searchParams.set("fields", "name,currency");
  accountUrl.searchParams.set("access_token", accessToken);
  const accRes = await fetch(accountUrl);
  const accData = accRes.ok ? ((await accRes.json()) as { name?: string; currency?: string }) : {};

  let spend = 0;
  let conversions = 0;
  const campaigns: UnifiedCampaign[] = [];
  const currency = accData.currency ?? "USD";

  for (const row of data.data ?? []) {
    const rowSpend = Number(row.spend ?? 0);
    const purchase = row.actions?.find((a) =>
      ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"].includes(a.action_type),
    );
    const conv = Number(purchase?.value ?? 0);
    spend += rowSpend;
    conversions += conv;
    const clicks = Number(row.clicks ?? 0);
    const impressions = Number(row.impressions ?? 0);
    campaigns.push({
      platform: "Meta Ads",
      id: row.campaign_id ?? "",
      name: row.campaign_name ?? "Campagne",
      status: "ACTIVE",
      spend: rowSpend,
      currency,
      impressions,
      clicks,
      conversions: conv,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpa: conv > 0 ? rowSpend / conv : null,
      roas: null,
    });
  }

  const issues: string[] = [];
  const opportunities: string[] = [];
  if (campaigns.some((c) => c.ctr > 0 && c.ctr < 0.8)) {
    issues.push("Au moins une campagne Meta a un CTR faible — créations ou audiences à revoir");
  }
  if (!conversions) issues.push("Meta ne remonte aucune conversion achat sur 30 jours — vérifiez le pixel");
  opportunities.push("Testez des audiences lookalike sur vos meilleurs clients Meta");

  return {
    platform: "Meta Ads",
    accountId: actId,
    accountName: accData.name ?? actId,
    period,
    spend,
    currency,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues,
    opportunities,
  };
}

export async function pauseMetaCampaign(accessToken: string, campaignId: string): Promise<void> {
  const url = new URL(`${GRAPH}/${campaignId}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ status: "PAUSED", access_token: accessToken }),
  });
  if (!res.ok) throw new Error(`Meta pause campaign: ${await res.text()}`);
}

export async function resumeMetaCampaign(accessToken: string, campaignId: string): Promise<void> {
  const url = new URL(`${GRAPH}/${campaignId}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ status: "ACTIVE", access_token: accessToken }),
  });
  if (!res.ok) throw new Error(`Meta activate campaign: ${await res.text()}`);
}

export type CreateMetaCampaignInput = {
  accessToken: string;
  adAccountId: string;
  name: string;
  dailyBudget: number;
  objective?: string;
  countries?: string[];
};

export type CreateMetaCampaignResult = {
  campaignId: string;
  adSetId: string;
};

export async function createMetaCampaignPaused(
  input: CreateMetaCampaignInput,
): Promise<CreateMetaCampaignResult> {
  const actId = input.adAccountId.startsWith("act_")
    ? input.adAccountId
    : `act_${input.adAccountId.replace(/\D/g, "")}`;

  const campaignRes = await fetch(`${GRAPH}/${actId}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: input.name,
      objective: input.objective ?? "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: "[]",
      access_token: input.accessToken,
    }),
  });
  if (!campaignRes.ok) throw new Error(`Meta create campaign: ${await campaignRes.text()}`);
  const campaign = (await campaignRes.json()) as { id?: string };
  if (!campaign.id) throw new Error("Meta create campaign: id manquant");

  const countries = input.countries?.length ? input.countries : ["CI"];
  const targeting = JSON.stringify({
    geo_locations: { countries },
  });

  const adSetRes = await fetch(`${GRAPH}/${actId}/adsets`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: `${input.name} — ensemble`,
      campaign_id: campaign.id,
      daily_budget: String(Math.max(1000, Math.round(input.dailyBudget))),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting,
      status: "PAUSED",
      access_token: input.accessToken,
    }),
  });
  if (!adSetRes.ok) throw new Error(`Meta create ad set: ${await adSetRes.text()}`);
  const adSet = (await adSetRes.json()) as { id?: string };
  if (!adSet.id) throw new Error("Meta create ad set: id manquant");

  return { campaignId: campaign.id, adSetId: adSet.id };
}
