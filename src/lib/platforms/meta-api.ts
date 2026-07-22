import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function listMetaPages(accessToken: string): Promise<{ id: string; name: string }[]> {
  const url = new URL(`${GRAPH}/me/accounts`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("limit", "50");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta pages: ${await res.text()}`);
  const data = (await res.json()) as { data?: { id: string; name: string }[] };
  return (data.data ?? []).map((p) => ({ id: p.id, name: p.name }));
}

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
  details?: Record<string, unknown>;
};

export async function createMetaCampaignOnly(
  accessToken: string,
  adAccountId: string,
  input: { name: string; objective?: string },
): Promise<{ campaignId: string }> {
  const act = actId(adAccountId);
  const campaignRes = await fetch(`${GRAPH}/${act}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: input.name,
      objective: input.objective ?? "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: "[]",
      access_token: accessToken,
    }),
  });
  if (!campaignRes.ok) throw new Error(`Meta create campaign: ${await campaignRes.text()}`);
  const campaign = (await campaignRes.json()) as { id?: string };
  if (!campaign.id) throw new Error("Meta create campaign: id manquant");
  return { campaignId: campaign.id };
}

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
      daily_budget: String(Math.max(100, Math.round(input.dailyBudget * 100))),
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

  return { campaignId: campaign.id, adSetId: adSet.id, details: { status: "PAUSED", maturity: "production" } };
}

function actId(adAccountId: string): string {
  return adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId.replace(/\D/g, "")}`;
}

/** Meta budgets live on ad sets — `entityId` is the ad set id. */
export async function updateMetaAdSetBudget(
  accessToken: string,
  adSetId: string,
  dailyBudget: number,
): Promise<void> {
  const res = await fetch(`${GRAPH}/${adSetId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      daily_budget: String(Math.max(100, Math.round(dailyBudget * 100))),
      access_token: accessToken,
    }),
  });
  if (!res.ok) throw new Error(`Meta ad set budget: ${await res.text()}`);
}

export async function createMetaAdSet(
  accessToken: string,
  adAccountId: string,
  input: {
    campaignId: string;
    name: string;
    dailyBudget: number;
    countries?: string[];
    optimizationGoal?: string;
  },
): Promise<{ adSetId: string }> {
  const targeting = JSON.stringify({
    geo_locations: { countries: input.countries?.length ? input.countries : ["CI"] },
  });
  const res = await fetch(`${GRAPH}/${actId(adAccountId)}/adsets`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: input.name,
      campaign_id: input.campaignId,
      daily_budget: String(Math.max(100, Math.round(input.dailyBudget * 100))),
      billing_event: "IMPRESSIONS",
      optimization_goal: input.optimizationGoal ?? "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting,
      status: "PAUSED",
      access_token: accessToken,
    }),
  });
  if (!res.ok) throw new Error(`Meta create ad set: ${await res.text()}`);
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Meta create ad set: id manquant");
  return { adSetId: data.id };
}

export async function setMetaAdSetStatus(
  accessToken: string,
  adSetId: string,
  status: "PAUSED" | "ACTIVE",
): Promise<void> {
  const res = await fetch(`${GRAPH}/${adSetId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ status, access_token: accessToken }),
  });
  if (!res.ok) throw new Error(`Meta ad set status: ${await res.text()}`);
}

/** Upload image from URL and create a PAUSED link ad. */
export async function createMetaAd(
  accessToken: string,
  adAccountId: string,
  input: {
    adSetId: string;
    name: string;
    pageId: string;
    linkUrl: string;
    message?: string;
    headline?: string;
    imageUrl?: string;
    imageHash?: string;
  },
): Promise<{ adId: string; creativeId?: string; imageHash?: string }> {
  const account = actId(adAccountId);
  let imageHash = input.imageHash;

  if (!imageHash && input.imageUrl) {
    const imgRes = await fetch(`${GRAPH}/${account}/adimages`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        url: input.imageUrl,
        access_token: accessToken,
      }),
    });
    if (!imgRes.ok) throw new Error(`Meta ad image upload: ${await imgRes.text()}`);
    const imgData = (await imgRes.json()) as {
      images?: Record<string, { hash?: string }>;
    };
    imageHash = Object.values(imgData.images ?? {})[0]?.hash;
    if (!imageHash) throw new Error("Meta ad image: hash manquant");
  }

  if (!imageHash) throw new Error("imageUrl ou imageHash requis pour créer une annonce Meta");

  const objectStorySpec = JSON.stringify({
    page_id: input.pageId,
    link_data: {
      image_hash: imageHash,
      link: input.linkUrl,
      message: input.message ?? "",
      name: input.headline ?? input.name,
    },
  });

  const creativeRes = await fetch(`${GRAPH}/${account}/adcreatives`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: `${input.name} — creative`,
      object_story_spec: objectStorySpec,
      access_token: accessToken,
    }),
  });
  if (!creativeRes.ok) throw new Error(`Meta ad creative: ${await creativeRes.text()}`);
  const creative = (await creativeRes.json()) as { id?: string };
  if (!creative.id) throw new Error("Meta ad creative: id manquant");

  const adRes = await fetch(`${GRAPH}/${account}/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: input.name,
      adset_id: input.adSetId,
      creative: JSON.stringify({ creative_id: creative.id }),
      status: "PAUSED",
      access_token: accessToken,
    }),
  });
  if (!adRes.ok) throw new Error(`Meta create ad: ${await adRes.text()}`);
  const ad = (await adRes.json()) as { id?: string };
  if (!ad.id) throw new Error("Meta create ad: id manquant");
  return { adId: ad.id, creativeId: creative.id, imageHash };
}

export async function uploadMetaCreative(
  accessToken: string,
  adAccountId: string,
  input: { imageUrl: string; name?: string },
): Promise<{ imageHash: string }> {
  const res = await fetch(`${GRAPH}/${actId(adAccountId)}/adimages`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      url: input.imageUrl,
      name: input.name ?? "orkestria-upload",
      access_token: accessToken,
    }),
  });
  if (!res.ok) throw new Error(`Meta creative upload: ${await res.text()}`);
  const data = (await res.json()) as { images?: Record<string, { hash?: string }> };
  const hash = Object.values(data.images ?? {})[0]?.hash;
  if (!hash) throw new Error("Meta creative upload: hash manquant");
  return { imageHash: hash };
}

export async function createMetaCustomAudience(
  accessToken: string,
  adAccountId: string,
  input: { name: string; description?: string; subtype?: string; lookalikeRatio?: number; originAudienceId?: string; country?: string },
): Promise<{ audienceId: string }> {
  const account = actId(adAccountId);
  if (input.subtype === "LOOKALIKE" && input.originAudienceId) {
    const res = await fetch(`${GRAPH}/${account}/customaudiences`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        name: input.name,
        subtype: "LOOKALIKE",
        origin_audience_id: input.originAudienceId,
        lookalike_spec: JSON.stringify({
          type: "similarity",
          ratio: input.lookalikeRatio ?? 0.01,
          country: input.country ?? "CI",
        }),
        access_token: accessToken,
      }),
    });
    if (!res.ok) throw new Error(`Meta lookalike audience: ${await res.text()}`);
    const data = (await res.json()) as { id?: string };
    if (!data.id) throw new Error("Meta lookalike: id manquant");
    return { audienceId: data.id };
  }

  const res = await fetch(`${GRAPH}/${account}/customaudiences`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: input.name,
      description: input.description ?? "",
      subtype: input.subtype ?? "CUSTOM",
      customer_file_source: "USER_PROVIDED_ONLY",
      access_token: accessToken,
    }),
  });
  if (!res.ok) throw new Error(`Meta custom audience: ${await res.text()}`);
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Meta custom audience: id manquant");
  return { audienceId: data.id };
}

export async function listMetaPixels(
  accessToken: string,
  adAccountId: string,
): Promise<{ id: string; name: string; status?: string; category?: string }[]> {
  const res = await fetch(
    `${GRAPH}/${actId(adAccountId)}/adspixels?fields=id,name,is_unavailable&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!res.ok) throw new Error(`Meta list pixels: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: { id: string; name: string; is_unavailable?: boolean }[];
  };
  return (data.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.is_unavailable ? "unavailable" : "active",
    category: "pixel",
  }));
}

export async function diagnoseMetaTracking(
  accessToken: string,
  adAccountId: string,
): Promise<{ ok: boolean; conversions?: number; issues: string[] }> {
  const issues: string[] = [];
  const pixels = await listMetaPixels(accessToken, adAccountId);
  if (!pixels.length) issues.push("Aucun pixel Meta sur ce compte publicitaire");
  const unavailable = pixels.filter((p) => p.status === "unavailable");
  if (unavailable.length) issues.push(`${unavailable.length} pixel(s) indisponible(s)`);
  return { ok: issues.length === 0, conversions: pixels.length, issues };
}

export async function listMetaAdImages(
  accessToken: string,
  adAccountId: string,
): Promise<{ id: string; name: string; status?: string }[]> {
  const res = await fetch(
    `${GRAPH}/${actId(adAccountId)}/adimages?fields=hash,name,status&limit=50&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!res.ok) throw new Error(`Meta list creatives: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: { hash?: string; name?: string; status?: string }[];
  };
  return (data.data ?? []).map((i) => ({
    id: i.hash ?? "",
    name: i.name ?? i.hash ?? "",
    status: i.status,
  }));
}

export async function attachMetaAudienceToAdSet(
  accessToken: string,
  adSetId: string,
  audienceId: string,
): Promise<{ ok: true }> {
  const getRes = await fetch(
    `${GRAPH}/${adSetId}?fields=targeting&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!getRes.ok) throw new Error(`Meta get ad set targeting: ${await getRes.text()}`);
  const current = (await getRes.json()) as {
    targeting?: Record<string, unknown> & { custom_audiences?: { id: string }[] };
  };
  const targeting = { ...(current.targeting ?? {}) };
  const existing = Array.isArray(targeting.custom_audiences) ? targeting.custom_audiences : [];
  if (!existing.some((a) => a.id === audienceId)) {
    targeting.custom_audiences = [...existing, { id: audienceId }];
  }
  const res = await fetch(`${GRAPH}/${adSetId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      targeting: JSON.stringify(targeting),
      access_token: accessToken,
    }),
  });
  if (!res.ok) throw new Error(`Meta attach audience: ${await res.text()}`);
  return { ok: true };
}

export async function listMetaAdsInsights(
  accessToken: string,
  adAccountId: string,
): Promise<{ id: string; name: string; spend: number; impressions: number; clicks: number; ctr: number }[]> {
  const res = await fetch(
    `${GRAPH}/${actId(adAccountId)}/insights?level=ad&fields=ad_id,ad_name,spend,impressions,clicks,ctr&date_preset=last_30d&limit=50&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!res.ok) throw new Error(`Meta ad insights: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: {
      ad_id?: string;
      ad_name?: string;
      spend?: string;
      impressions?: string;
      clicks?: string;
      ctr?: string;
    }[];
  };
  return (data.data ?? []).map((r) => ({
    id: r.ad_id ?? "",
    name: r.ad_name ?? "",
    spend: Number(r.spend ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    ctr: Number(r.ctr ?? 0),
  }));
}

export async function setMetaAdStatus(
  accessToken: string,
  adId: string,
  status: "PAUSED" | "ACTIVE",
): Promise<void> {
  const res = await fetch(`${GRAPH}/${adId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ status, access_token: accessToken }),
  });
  if (!res.ok) throw new Error(`Meta ad status: ${await res.text()}`);
}
