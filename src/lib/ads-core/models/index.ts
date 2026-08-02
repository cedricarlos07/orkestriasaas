/**
 * Normalized ad models — port of Advertising Hub `core/models`.
 * Source: https://github.com/itallstartedwithaidea/advertising-hub (MIT)
 * Copyright (c) 2025 John Williams / It All Started With A Idea
 */

export type CampaignStatus = "active" | "paused" | "removed" | "draft";

export type CampaignType =
  | "search"
  | "shopping"
  | "display"
  | "video"
  | "social"
  | "performance_max"
  | "demand_gen"
  | "app"
  | "audio"
  | "programmatic"
  | "sponsored";

/** Hub `core/models/campaign.py` */
export type HubCampaign = {
  platform: string;
  name: string;
  campaignType?: CampaignType;
  status?: CampaignStatus;
  budgetDaily?: number;
  budgetLifetime?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  platformId?: string;
  platformData?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

/** Hub `core/models/ad_group.py` — Meta Ad Set maps here */
export type HubAdGroup = {
  platform: string;
  name: string;
  campaignId: string;
  status?: CampaignStatus;
  bidAmount?: number;
  bidStrategy?: string;
  targeting?: Record<string, unknown>;
  platformId?: string;
  platformData?: Record<string, unknown>;
};

/** Hub `core/models/ad.py` */
export type HubAd = {
  platform: string;
  name: string;
  adGroupId: string;
  status?: CampaignStatus;
  headlines?: string[];
  descriptions?: string[];
  finalUrl?: string;
  displayUrl?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  platformId?: string;
  platformData?: Record<string, unknown>;
};

export type AudienceType =
  | "first_party"
  | "lookalike"
  | "similar"
  | "in_market"
  | "affinity"
  | "custom_intent"
  | "retargeting"
  | "account_list";

/** Hub `core/models/audience.py` */
export type HubAudience = {
  platform: string;
  name: string;
  audienceType: AudienceType;
  size?: number;
  description?: string;
  platformId?: string;
  platformData?: Record<string, unknown>;
};

/**
 * Hub `core/models/metrics.py`
 * Cost = account currency. Rates = 0–1 (not percentages).
 */
export type NormalizedMetrics = {
  platform: string;
  date: string;
  campaignId?: string;
  adGroupId?: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
};

export function metricsCtr(m: NormalizedMetrics): number {
  return m.impressions > 0 ? m.clicks / m.impressions : 0;
}

export function metricsCpc(m: NormalizedMetrics): number {
  return m.clicks > 0 ? m.cost / m.clicks : 0;
}

export function metricsCpa(m: NormalizedMetrics): number {
  return m.conversions > 0 ? m.cost / m.conversions : 0;
}

export function metricsRoas(m: NormalizedMetrics): number {
  return m.cost > 0 ? m.conversionValue / m.cost : 0;
}

export function metricsConversionRate(m: NormalizedMetrics): number {
  return m.clicks > 0 ? m.conversions / m.clicks : 0;
}

/** Hub `core/models/report.py` */
export type CrossPlatformReport = {
  dateStart: string;
  dateEnd: string;
  platforms: string[];
  metricsByPlatform: Record<string, NormalizedMetrics[]>;
};

export function reportTotalSpend(r: CrossPlatformReport): number {
  return Object.values(r.metricsByPlatform)
    .flat()
    .reduce((s, m) => s + m.cost, 0);
}

export function reportTotalConversions(r: CrossPlatformReport): number {
  return Object.values(r.metricsByPlatform)
    .flat()
    .reduce((s, m) => s + m.conversions, 0);
}

export function reportBlendedCpa(r: CrossPlatformReport): number {
  const tc = reportTotalConversions(r);
  return tc > 0 ? reportTotalSpend(r) / tc : 0;
}
