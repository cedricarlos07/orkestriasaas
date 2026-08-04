import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

const GRAPH = "https://graph.facebook.com/v21.0";

async function fetchGraphPages(url: URL): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id: string; name: string }[]; error?: unknown };
    if (data.error) return [];
    return (data.data ?? []).map((p) => ({ id: String(p.id), name: p.name || String(p.id) }));
  } catch {
    return [];
  }
}

export async function getMetaPageName(accessToken: string, pageId: string): Promise<string | null> {
  const id = pageId.replace(/\D/g, "") || pageId;
  try {
    const url = new URL(`${GRAPH}/${id}`);
    url.searchParams.set("fields", "id,name");
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string; name?: string };
    return data.name ?? null;
  } catch {
    return null;
  }
}

/** Account-level spend for a single calendar day (YYYY-MM-DD). */
export async function fetchMetaAccountSpendForDay(
  accessToken: string,
  adAccountId: string,
  dayYYYYMMDD: string,
): Promise<{ spend: number; currency: string }> {
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId.replace(/\D/g, "")}`;
  const insightsUrl = new URL(`${GRAPH}/${actId}/insights`);
  insightsUrl.searchParams.set("fields", "spend");
  insightsUrl.searchParams.set("level", "account");
  insightsUrl.searchParams.set(
    "time_range",
    JSON.stringify({ since: dayYYYYMMDD, until: dayYYYYMMDD }),
  );
  insightsUrl.searchParams.set("access_token", accessToken);

  const accountUrl = new URL(`${GRAPH}/${actId}`);
  accountUrl.searchParams.set("fields", "currency");
  accountUrl.searchParams.set("access_token", accessToken);

  const [insightsRes, accRes] = await Promise.all([fetch(insightsUrl), fetch(accountUrl)]);
  if (!insightsRes.ok) throw new Error(`Meta day insights: ${await insightsRes.text()}`);
  const insights = (await insightsRes.json()) as { data?: { spend?: string }[] };
  const spend = Number(insights.data?.[0]?.spend ?? 0);
  let currency = "USD";
  if (accRes.ok) {
    const acc = (await accRes.json()) as { currency?: string };
    if (acc.currency) currency = acc.currency;
  }
  return { spend, currency };
}

/**
 * Pages usable for Meta ads.
 * Personal /me/accounts is often empty for Business Manager assets — also probe
 * promote_pages + BM owned_pages + client_pages.
 */
export async function listMetaPages(
  accessToken: string,
  adAccountId?: string,
): Promise<{ id: string; name: string }[]> {
  const seen = new Set<string>();
  const pages: { id: string; name: string }[] = [];
  const add = (list: { id: string; name: string }[]) => {
    for (const p of list) {
      const id = String(p.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      pages.push({ id, name: p.name || id });
    }
  };

  const meAccounts = new URL(`${GRAPH}/me/accounts`);
  meAccounts.searchParams.set("fields", "id,name");
  meAccounts.searchParams.set("access_token", accessToken);
  meAccounts.searchParams.set("limit", "50");
  add(await fetchGraphPages(meAccounts));

  const actIds = new Set<string>();
  if (adAccountId) {
    const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId.replace(/\D/g, "")}`;
    if (actId.replace(/\D/g, "")) actIds.add(actId);
  }

  // Pages often live on the ad account (BM), not on /me/accounts
  try {
    const actsUrl = new URL(`${GRAPH}/me/adaccounts`);
    actsUrl.searchParams.set("fields", "id");
    actsUrl.searchParams.set("access_token", accessToken);
    actsUrl.searchParams.set("limit", "25");
    const actsRes = await fetch(actsUrl);
    if (actsRes.ok) {
      const actsData = (await actsRes.json()) as { data?: { id: string }[] };
      for (const a of actsData.data ?? []) {
        const id = String(a.id);
        const act = id.startsWith("act_") ? id : `act_${id.replace(/\D/g, "")}`;
        if (act.replace(/\D/g, "")) actIds.add(act);
      }
    }
  } catch {
    /* ignore */
  }

  const promoteLists = await Promise.all(
    [...actIds].slice(0, 12).map(async (actId) => {
      const promote = new URL(`${GRAPH}/${actId}/promote_pages`);
      promote.searchParams.set("fields", "id,name");
      promote.searchParams.set("access_token", accessToken);
      promote.searchParams.set("limit", "50");
      return fetchGraphPages(promote);
    }),
  );
  for (const list of promoteLists) add(list);

  const businesses = new URL(`${GRAPH}/me/businesses`);
  businesses.searchParams.set("fields", "id,name");
  businesses.searchParams.set("access_token", accessToken);
  businesses.searchParams.set("limit", "10");
  const bizRes = await fetch(businesses).catch(() => null);
  if (bizRes?.ok) {
    const bizData = (await bizRes.json()) as { data?: { id: string }[] };
    for (const biz of (bizData.data ?? []).slice(0, 5)) {
      for (const edge of ["owned_pages", "client_pages"] as const) {
        const url = new URL(`${GRAPH}/${biz.id}/${edge}`);
        url.searchParams.set("fields", "id,name");
        url.searchParams.set("access_token", accessToken);
        url.searchParams.set("limit", "50");
        add(await fetchGraphPages(url));
      }
    }
  }

  return pages;
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

  const accountUrl = new URL(`${GRAPH}/${actId}`);
  accountUrl.searchParams.set("fields", "name,currency");
  accountUrl.searchParams.set("access_token", accessToken);

  const campaignsUrl = new URL(`${GRAPH}/${actId}/campaigns`);
  campaignsUrl.searchParams.set("fields", "id,name,status,effective_status,objective");
  campaignsUrl.searchParams.set("limit", "50");
  campaignsUrl.searchParams.set("access_token", accessToken);

  const insightsUrl = new URL(`${GRAPH}/${actId}/insights`);
  insightsUrl.searchParams.set("fields", "spend,impressions,clicks,actions,campaign_id,campaign_name");
  insightsUrl.searchParams.set("level", "campaign");
  insightsUrl.searchParams.set("date_preset", "last_30d");
  insightsUrl.searchParams.set("access_token", accessToken);

  const [accRes, campsRes, insightsRes] = await Promise.all([
    fetch(accountUrl),
    fetch(campaignsUrl),
    fetch(insightsUrl),
  ]);

  if (!campsRes.ok) throw new Error(`Meta campaigns: ${await campsRes.text()}`);
  if (!insightsRes.ok) throw new Error(`Meta insights: ${await insightsRes.text()}`);

  const accData = accRes.ok ? ((await accRes.json()) as { name?: string; currency?: string }) : {};
  const campsData = (await campsRes.json()) as {
    data?: { id: string; name?: string; status?: string; effective_status?: string; objective?: string }[];
  };
  const insightsData = (await insightsRes.json()) as {
    data?: {
      campaign_id?: string;
      campaign_name?: string;
      spend?: string;
      impressions?: string;
      clicks?: string;
      actions?: { action_type: string; value: string }[];
    }[];
  };

  const currency = accData.currency ?? "USD";
  const metricsById = new Map<
    string,
    { spend: number; impressions: number; clicks: number; conversions: number; name?: string }
  >();

  for (const row of insightsData.data ?? []) {
    const id = row.campaign_id ?? "";
    if (!id) continue;
    const purchase = row.actions?.find((a) =>
      ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"].includes(a.action_type),
    );
    metricsById.set(id, {
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      conversions: Number(purchase?.value ?? 0),
      name: row.campaign_name,
    });
  }

  const campaigns: UnifiedCampaign[] = [];
  let spend = 0;
  let conversions = 0;
  const seen = new Set<string>();

  for (const c of campsData.data ?? []) {
    seen.add(c.id);
    const m = metricsById.get(c.id);
    const rowSpend = m?.spend ?? 0;
    const conv = m?.conversions ?? 0;
    const impressions = m?.impressions ?? 0;
    const clicks = m?.clicks ?? 0;
    spend += rowSpend;
    conversions += conv;
    campaigns.push({
      platform: "Meta Ads",
      id: c.id,
      name: c.name ?? m?.name ?? "Campagne",
      status: c.effective_status ?? c.status ?? "UNKNOWN",
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

  // Insights-only rows (deleted campaigns that still spent)
  for (const [id, m] of metricsById) {
    if (seen.has(id)) continue;
    spend += m.spend;
    conversions += m.conversions;
    campaigns.push({
      platform: "Meta Ads",
      id,
      name: m.name ?? "Campagne",
      status: "UNKNOWN",
      spend: m.spend,
      currency,
      impressions: m.impressions,
      clicks: m.clicks,
      conversions: m.conversions,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
      cpa: m.conversions > 0 ? m.spend / m.conversions : null,
      roas: null,
    });
  }

  campaigns.sort((a, b) => b.spend - a.spend);

  const issues: string[] = [];
  const opportunities: string[] = [];
  if (!campaigns.length) {
    issues.push("Aucune campagne sur ce compte Meta — créez un premier funnel en pause.");
    opportunities.push("Lancez un test trafic/leads avec budget journalier modeste (10–20 €/j) en pause d'abord.");
  } else {
    const active = campaigns.filter((c) => /ACTIVE|ENABLED/i.test(c.status));
    const paused = campaigns.filter((c) => /PAUSED/i.test(c.status));
    if (spend === 0 && active.length) {
      issues.push(
        `${active.length} campagne(s) ACTIVE sans dépense sur 30 jours — delivery / paiement / audience à vérifier.`,
      );
    }
    if (spend === 0 && !active.length && paused.length) {
      issues.push(`${paused.length} campagne(s) en pause — aucune diffusion actuellement.`);
    }
    if (spend > 0 && !conversions) {
      issues.push("Dépenses sans conversion achat sur 30 jours — vérifiez le pixel / événement Purchase.");
    }
    if (campaigns.some((c) => c.impressions > 1000 && c.ctr > 0 && c.ctr < 0.8)) {
      issues.push("Au moins une campagne Meta a un CTR faible — créations ou audiences à revoir.");
    }
    if (paused.length && spend > 0) {
      opportunities.push("Réactivez ou archivez les campagnes en pause pour clarifier le compte.");
    }
    opportunities.push("Testez des audiences lookalike sur vos meilleurs clients Meta.");
  }

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
  cities?: string[];
  neighborhoods?: string[];
  radiusKm?: number;
  geoScope?: "country_wide" | "city";
  deviceTargeting?: "mobile" | "all";
  channel?: "website" | "whatsapp" | "messenger";
  pageId?: string;
};

export type CreateMetaCampaignResult = {
  campaignId: string;
  adSetId: string;
  details?: Record<string, unknown>;
};

async function searchMetaGeoKey(
  accessToken: string,
  query: string,
): Promise<{ key: string; type: string } | null> {
  try {
    const url = new URL(`${GRAPH}/search`);
    url.searchParams.set("type", "adgeolocation");
    url.searchParams.set("q", query);
    url.searchParams.set("location_types", '["city","neighborhood","subcity","region"]');
    url.searchParams.set("limit", "5");
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: Array<{ key?: string; type?: string; name?: string }>;
    };
    const first = data.data?.[0];
    if (!first?.key) return null;
    return { key: String(first.key), type: String(first.type ?? "city").toLowerCase() };
  } catch {
    return null;
  }
}

export async function searchMetaGeoLocations(
  accessToken: string,
  query: string,
): Promise<Array<{ key: string; name: string; type: string; country_code?: string }>> {
  const url = new URL(`${GRAPH}/search`);
  url.searchParams.set("type", "adgeolocation");
  url.searchParams.set("q", query);
  url.searchParams.set("location_types", '["country","region","city","neighborhood","subcity"]');
  url.searchParams.set("limit", "15");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta geo search: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: Array<{ key?: string; name?: string; type?: string; country_code?: string }>;
  };
  return (data.data ?? []).map((r) => ({
    key: String(r.key ?? ""),
    name: String(r.name ?? r.key ?? ""),
    type: String(r.type ?? ""),
    country_code: r.country_code,
  }));
}

export async function searchMetaInterests(
  accessToken: string,
  query: string,
  type = "adinterest",
): Promise<Array<{ id: string; name: string; audience_size?: number }>> {
  const url = new URL(`${GRAPH}/search`);
  url.searchParams.set("type", type);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "20");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta interest search: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: Array<{ id?: string; name?: string; audience_size?: number; audience_size_lower_bound?: number }>;
  };
  return (data.data ?? []).map((r) => ({
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    audience_size: r.audience_size ?? r.audience_size_lower_bound,
  }));
}

export async function estimateMetaAudience(
  accessToken: string,
  adAccountId: string,
  targeting: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = new URL(`${GRAPH}/${actId(adAccountId)}/reachestimate`);
  url.searchParams.set("targeting_spec", JSON.stringify(targeting));
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta reachestimate: ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function listMetaAdSets(
  accessToken: string,
  adAccountId: string,
  opts?: { campaignId?: string },
): Promise<Array<{ id: string; name: string; status: string; campaign_id?: string; daily_budget?: string }>> {
  const params = new URLSearchParams({
    fields: "id,name,status,campaign_id,daily_budget",
    limit: "50",
    access_token: accessToken,
  });
  if (opts?.campaignId) {
    params.set("filtering", JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: opts.campaignId }]));
  }
  const res = await fetch(`${GRAPH}/${actId(adAccountId)}/adsets?${params}`);
  if (!res.ok) throw new Error(`Meta list adsets: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: Array<{ id: string; name: string; status: string; campaign_id?: string; daily_budget?: string }>;
  };
  return data.data ?? [];
}

export async function listMetaAds(
  accessToken: string,
  adAccountId: string,
  opts?: { campaignId?: string; adSetId?: string },
): Promise<Array<{ id: string; name: string; status: string; adset_id?: string; campaign_id?: string }>> {
  const params = new URLSearchParams({
    fields: "id,name,status,adset_id,campaign_id",
    limit: "50",
    access_token: accessToken,
  });
  const filtering: Array<{ field: string; operator: string; value: string }> = [];
  if (opts?.campaignId) filtering.push({ field: "campaign.id", operator: "EQUAL", value: opts.campaignId });
  if (opts?.adSetId) filtering.push({ field: "adset.id", operator: "EQUAL", value: opts.adSetId });
  if (filtering.length) params.set("filtering", JSON.stringify(filtering));
  const res = await fetch(`${GRAPH}/${actId(adAccountId)}/ads?${params}`);
  if (!res.ok) throw new Error(`Meta list ads: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: Array<{ id: string; name: string; status: string; adset_id?: string; campaign_id?: string }>;
  };
  return data.data ?? [];
}

async function buildNativeGeoLocations(
  accessToken: string,
  input: Pick<
    CreateMetaCampaignInput,
    "countries" | "cities" | "neighborhoods" | "radiusKm" | "geoScope"
  >,
): Promise<Record<string, unknown>> {
  const countries = (input.countries ?? []).map((c) => c.toUpperCase());
  if (input.geoScope === "country_wide" || (!input.cities?.length && !input.neighborhoods?.length)) {
    return { countries: countries.length ? countries : ["CI"] };
  }

  const queries = [...(input.neighborhoods ?? []), ...(input.cities ?? [])];
  const cityEntries: Array<Record<string, unknown>> = [];
  for (const q of queries.slice(0, 5)) {
    const hit = await searchMetaGeoKey(accessToken, q);
    if (!hit) continue;
    const entry: Record<string, unknown> = { key: hit.key };
    if (
      typeof input.radiusKm === "number" &&
      input.radiusKm > 0 &&
      /city|neighborhood|subcity/.test(hit.type)
    ) {
      entry.radius = input.radiusKm;
      entry.distance_unit = "kilometer";
    }
    cityEntries.push(entry);
  }
  if (cityEntries.length) return { cities: cityEntries };
  return { countries: countries.length ? countries : ["CI"] };
}

/**
 * Proprietary Meta campaign+adset creation (PAUSED) — Graph API native.
 * Supports website traffic and Click-to-WhatsApp / Messenger.
 */
export async function createMetaCampaignPaused(
  input: CreateMetaCampaignInput,
): Promise<CreateMetaCampaignResult> {
  const act = actId(input.adAccountId);
  const channel = input.channel ?? "website";
  const isMessaging = channel === "whatsapp" || channel === "messenger";

  let objective = input.objective ?? "OUTCOME_TRAFFIC";
  if (isMessaging) {
    objective =
      objective.startsWith("OUTCOME_") && objective !== "OUTCOME_TRAFFIC"
        ? objective
        : "OUTCOME_ENGAGEMENT";
  }

  const campaignBody: Record<string, string> = {
    name: input.name,
    objective,
    status: "PAUSED",
    special_ad_categories: "[]",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    access_token: input.accessToken,
  };
  // Messaging: budget on ad set only (avoid CBO double-budget)
  if (!isMessaging) {
    campaignBody.daily_budget = String(Math.max(100, Math.round(input.dailyBudget * 100)));
  }

  const campaignRes = await fetch(`${GRAPH}/${act}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(campaignBody),
  });
  if (!campaignRes.ok) throw new Error(`Meta create campaign: ${await campaignRes.text()}`);
  const campaign = (await campaignRes.json()) as { id?: string };
  if (!campaign.id) throw new Error("Meta create campaign: id manquant");

  const geo = await buildNativeGeoLocations(input.accessToken, input);
  const targeting: Record<string, unknown> = {
    geo_locations: geo,
    targeting_automation: { advantage_audience: 0 },
  };
  if (input.deviceTargeting === "mobile") {
    targeting.device_platforms = ["mobile"];
  }

  const adsetBody: Record<string, string> = {
    name: `${input.name} — Ad set`,
    campaign_id: campaign.id,
    daily_budget: String(Math.max(100, Math.round(input.dailyBudget * 100))),
    billing_event: "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: JSON.stringify(targeting),
    status: "PAUSED",
    access_token: input.accessToken,
  };

  if (isMessaging) {
    if (!input.pageId) {
      throw new Error("pageId requis pour Messages WhatsApp / Messenger");
    }
    adsetBody.destination_type = channel === "whatsapp" ? "WHATSAPP" : "MESSENGER";
    adsetBody.optimization_goal = "CONVERSATIONS";
    adsetBody.promoted_object = JSON.stringify({ page_id: input.pageId });
  } else {
    adsetBody.optimization_goal =
      objective === "OUTCOME_LEADS"
        ? "LEAD_GENERATION"
        : objective === "OUTCOME_SALES"
          ? "OFFSITE_CONVERSIONS"
          : "LINK_CLICKS";
    adsetBody.destination_type = "WEBSITE";
  }

  const adSetRes = await fetch(`${GRAPH}/${act}/adsets`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(adsetBody),
  });
  if (!adSetRes.ok) throw new Error(`Meta create ad set: ${await adSetRes.text()}`);
  const adSet = (await adSetRes.json()) as { id?: string };
  if (!adSet.id) throw new Error("Meta create ad set: id manquant");

  return {
    campaignId: campaign.id,
    adSetId: adSet.id,
    details: {
      status: "PAUSED",
      upstream: "orkestria",
      channel,
      objective,
      geo,
    },
  };
}

function actId(adAccountId: string): string {
  return adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId.replace(/\D/g, "")}`;
}

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
    geo_locations: { countries: input.countries?.length ? input.countries : ["US"] },
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
  input: { imageUrl?: string; bytesBase64?: string; name?: string },
): Promise<{ imageHash: string }> {
  const body = new URLSearchParams({
    name: input.name ?? "orkestria-upload",
    access_token: accessToken,
  });
  if (input.bytesBase64) {
    const raw = input.bytesBase64.includes(",")
      ? input.bytesBase64.split(",", 2)[1]!
      : input.bytesBase64;
    body.set("bytes", raw);
  } else if (input.imageUrl) {
    body.set("url", input.imageUrl);
  } else {
    throw new Error("imageUrl ou bytesBase64 requis");
  }
  const res = await fetch(`${GRAPH}/${actId(adAccountId)}/adimages`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
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
          country: input.country ?? "US",
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

export type MetaPagePost = {
  id: string;
  /** Same as id when already pageId_postId; used as object_story_id for boost. */
  objectStoryId: string;
  message: string;
  createdTime: string;
  permalinkUrl?: string;
  fullPicture?: string;
  type?: string;
};

/** Recent published posts on a Page — for "boost existing post" UX. */
export async function listMetaPagePosts(
  accessToken: string,
  pageId: string,
  limit = 12,
): Promise<MetaPagePost[]> {
  const id = pageId.replace(/\D/g, "") || pageId;
  const fields = "id,message,created_time,permalink_url,full_picture,status_type";
  const url = new URL(`${GRAPH}/${id}/published_posts`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 25)));
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  if (!res.ok) {
    // Fallback: /feed often works when published_posts is restricted
    const feed = new URL(`${GRAPH}/${id}/feed`);
    feed.searchParams.set("fields", fields);
    feed.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 25)));
    feed.searchParams.set("access_token", accessToken);
    const feedRes = await fetch(feed);
    if (!feedRes.ok) throw new Error(`Meta page posts: ${await res.text()}`);
    return mapPagePosts(await feedRes.json(), id);
  }
  return mapPagePosts(await res.json(), id);
}

function mapPagePosts(data: unknown, pageId: string): MetaPagePost[] {
  const rows = (data as { data?: Record<string, unknown>[] }).data ?? [];
  return rows.map((r) => {
    const rawId = String(r.id ?? "");
    const objectStoryId = rawId.includes("_") ? rawId : `${pageId}_${rawId}`;
    return {
      id: rawId,
      objectStoryId,
      message: String(r.message ?? "").slice(0, 280) || "(sans texte)",
      createdTime: String(r.created_time ?? ""),
      permalinkUrl: r.permalink_url ? String(r.permalink_url) : undefined,
      fullPicture: r.full_picture ? String(r.full_picture) : undefined,
      type: r.status_type ? String(r.status_type) : undefined,
    };
  });
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
