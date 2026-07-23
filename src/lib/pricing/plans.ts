import { formatPriceCents } from "./money";

export type PlanId =
  | "solo"
  | "business"
  | "growth"
  | "autopilot"
  | "agency_start"
  | "agency_growth"
  | "agency_scale"
  | "enterprise";

export type PlanAudience = "annonceur" | "agence" | "enterprise";

export type PlanQuotas = {
  runsPerMonth: number;
  aiBudgetUsdMonthly: number;
  brands: number;
  adAccounts: number;
  users: number;
  /** Optional rate fields persisted in DB quotas jsonb */
  apiPerMinute?: number;
  apiPerHour?: number;
  apiPerDay?: number;
  mcpCallsPerMonth?: number;
  llmCallsPerDay?: number;
  writesPerHour?: number;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  audience: PlanAudience;
  /** Monthly price in USD cents (e.g. 2900 = $29) */
  priceMonthlyCents: number;
  /** Yearly price in USD cents (~2 months free) */
  priceYearlyCents: number;
  quotas: PlanQuotas;
  orgs: number | "illimité";
  workspaces: number | "illimité";
  historyDays: number;
  automations: "aucune" | "basique" | "avancée" | "complète";
  autonomy: "conseil" | "assistée" | "supervisée" | "autopilot";
  support: string;
};

/** Single source of truth — all prices in USD cents. AI powered by DeepSeek V4 Flash. */
export const ORKESTRIA_PLANS: PlanDefinition[] = [
  {
    id: "solo",
    name: "Solo",
    audience: "annonceur",
    priceMonthlyCents: 2900,
    priceYearlyCents: 29000,
    quotas: { runsPerMonth: 40, aiBudgetUsdMonthly: 2, brands: 1, adAccounts: 1, users: 1 },
    orgs: 1,
    workspaces: 1,
    historyDays: 30,
    automations: "basique",
    autonomy: "assistée",
    support: "email 48h",
  },
  {
    id: "business",
    name: "Business",
    audience: "annonceur",
    priceMonthlyCents: 8900,
    priceYearlyCents: 89000,
    quotas: { runsPerMonth: 250, aiBudgetUsdMonthly: 8, brands: 3, adAccounts: 3, users: 3 },
    orgs: 1,
    workspaces: 2,
    historyDays: 90,
    automations: "avancée",
    autonomy: "supervisée",
    support: "email 24h",
  },
  {
    id: "growth",
    name: "Growth",
    audience: "annonceur",
    priceMonthlyCents: 14900,
    priceYearlyCents: 149000,
    quotas: { runsPerMonth: 800, aiBudgetUsdMonthly: 20, brands: 5, adAccounts: 8, users: 8 },
    orgs: 1,
    workspaces: 5,
    historyDays: 180,
    automations: "complète",
    autonomy: "supervisée",
    support: "chat 12h",
  },
  {
    id: "autopilot",
    name: "Autopilot",
    audience: "annonceur",
    priceMonthlyCents: 24900,
    priceYearlyCents: 249000,
    quotas: { runsPerMonth: 2000, aiBudgetUsdMonthly: 40, brands: 10, adAccounts: 15, users: 15 },
    orgs: 1,
    workspaces: 10,
    historyDays: 365,
    automations: "complète",
    autonomy: "autopilot",
    support: "chat 4h",
  },
  {
    id: "agency_start",
    name: "Agency Start",
    audience: "agence",
    priceMonthlyCents: 12900,
    priceYearlyCents: 129000,
    quotas: { runsPerMonth: 500, aiBudgetUsdMonthly: 25, brands: 5, adAccounts: 15, users: 5 },
    orgs: 5,
    workspaces: 10,
    historyDays: 180,
    automations: "basique",
    autonomy: "assistée",
    support: "email 24h",
  },
  {
    id: "agency_growth",
    name: "Agency Growth",
    audience: "agence",
    priceMonthlyCents: 29900,
    priceYearlyCents: 299000,
    quotas: { runsPerMonth: 3000, aiBudgetUsdMonthly: 80, brands: 15, adAccounts: 45, users: 15 },
    orgs: 15,
    workspaces: 30,
    historyDays: 365,
    automations: "avancée",
    autonomy: "supervisée",
    support: "chat 12h",
  },
  {
    id: "agency_scale",
    name: "Agency Scale",
    audience: "agence",
    priceMonthlyCents: 59900,
    priceYearlyCents: 599000,
    quotas: { runsPerMonth: 10000, aiBudgetUsdMonthly: 200, brands: 40, adAccounts: 999, users: 40 },
    orgs: 40,
    workspaces: "illimité",
    historyDays: 730,
    automations: "complète",
    autonomy: "autopilot",
    support: "CSM 4h",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience: "enterprise",
    priceMonthlyCents: 99900,
    priceYearlyCents: 999000,
    quotas: { runsPerMonth: -1, aiBudgetUsdMonthly: 500, brands: -1, adAccounts: -1, users: -1 },
    orgs: "illimité",
    workspaces: "illimité",
    historyDays: 1095,
    automations: "complète",
    autonomy: "autopilot",
    support: "SLA 24/7",
  },
];

export function getPlan(id: PlanId): PlanDefinition | undefined {
  return ORKESTRIA_PLANS.find((p) => p.id === id);
}

export function planPriceMonthly(id: PlanId): number {
  return getPlan(id)?.priceMonthlyCents ?? 0;
}

/** DB seed shape — price fields in USD cents + rate quotas */
export function plansForDbSeed() {
  // Lazy import avoided — rate fields live in @/lib/quotas/config
  const rates: Record<string, Record<string, number>> = {
    solo: { apiPerMinute: 30, apiPerHour: 500, apiPerDay: 2000, mcpCallsPerMonth: 2000, llmCallsPerDay: 80, writesPerHour: 20 },
    business: { apiPerMinute: 60, apiPerHour: 2000, apiPerDay: 8000, mcpCallsPerMonth: 10000, llmCallsPerDay: 300, writesPerHour: 60 },
    growth: { apiPerMinute: 120, apiPerHour: 5000, apiPerDay: 20000, mcpCallsPerMonth: 40000, llmCallsPerDay: 800, writesPerHour: 120 },
    autopilot: { apiPerMinute: 180, apiPerHour: 10000, apiPerDay: 40000, mcpCallsPerMonth: 80000, llmCallsPerDay: 1500, writesPerHour: 200 },
    agency_start: { apiPerMinute: 90, apiPerHour: 3000, apiPerDay: 12000, mcpCallsPerMonth: 20000, llmCallsPerDay: 500, writesPerHour: 80 },
    agency_growth: { apiPerMinute: 200, apiPerHour: 15000, apiPerDay: 60000, mcpCallsPerMonth: 120000, llmCallsPerDay: 2000, writesPerHour: 300 },
    agency_scale: { apiPerMinute: 400, apiPerHour: 40000, apiPerDay: 150000, mcpCallsPerMonth: 400000, llmCallsPerDay: 5000, writesPerHour: 600 },
    enterprise: { apiPerMinute: 600, apiPerHour: 100000, apiPerDay: 400000, mcpCallsPerMonth: -1, llmCallsPerDay: 15000, writesPerHour: 1200 },
  };
  return ORKESTRIA_PLANS.map((p) => ({
    id: p.id,
    name: p.name,
    audience: p.audience,
    priceMonthly: p.priceMonthlyCents,
    priceYearly: p.priceYearlyCents,
    quotas: {
      runsPerMonth: p.quotas.runsPerMonth,
      aiBudgetUsdMonthly: p.quotas.aiBudgetUsdMonthly,
      brands: p.quotas.brands,
      adAccounts: p.quotas.adAccounts,
      users: p.quotas.users,
      ...(rates[p.id] ?? rates.solo),
    },
  }));
}

/** Landing page cards (subset) */
export type LandingPlan = {
  id: string;
  name: string;
  price: string;
  tag: string;
  text: string;
  features: string[];
  cta: string;
  kpis: { label: string; value: string }[];
};

export const LANDING_PLANS: LandingPlan[] = [
  {
    id: "solo",
    name: "Solo",
    price: formatPriceCents(2900),
    tag: "Pour démarrer",
    text: "Une marque, un objectif. Idéal pour lancer vos premières campagnes en 15 minutes.",
    features: ["1 marque · 40 runs/mois", "Meta + Google + TikTok", "Alertes budget & performance", "Support email 48 h"],
    cta: "Commencer",
    kpis: [
      { label: "Marques", value: "1" },
      { label: "Runs", value: "40/mo" },
      { label: "Support", value: "48 h" },
    ],
  },
  {
    id: "business",
    name: "Business",
    price: formatPriceCents(8900),
    tag: "Le plus choisi",
    text: "Pour scaler sans embaucher. Automations avancées et rapports hebdo.",
    features: ["3 marques · 250 runs/mois", "Automations avancées", "Rapports hebdo par email", "Support prioritaire 24 h"],
    cta: "Commencer",
    kpis: [
      { label: "Marques", value: "3" },
      { label: "Runs", value: "250/mo" },
      { label: "Support", value: "24 h" },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: formatPriceCents(14900),
    tag: "Scale-up",
    text: "Multi-marques, automations complètes et pilotage supervisé.",
    features: ["5 marques · 800 runs/mois", "Autopilot supervisé", "Historique 6 mois", "Chat support 12 h"],
    cta: "Commencer",
    kpis: [
      { label: "Marques", value: "5" },
      { label: "Runs", value: "800/mo" },
      { label: "Support", value: "12 h" },
    ],
  },
];

/** Platform-wide AI spend caps (DeepSeek) */
export const AI_PLATFORM_LIMITS = {
  dailyGlobalUsd: 300,
  defaultPerOrgUsd: 8,
} as const;
