import {
  BarChart3,
  FileText,
  Rocket,
  Users,
  Cog,
} from "lucide-react";
import type {
  CampaignObjective,
  CampaignWizardState,
  IntentKey,
  Thread,
  ToolCall,
} from "@/components/orkestria/types";

export const SUGGESTIONS: { t: string; prompt: string; i: typeof BarChart3; grad: string; ic: string; intent?: IntentKey }[] = [
  {
    t: "Analyse mes campagnes des 30 derniers jours",
    prompt:
      "Fais un audit publicitaire sur les 30 derniers jours. Utilise les comptes connectés, donne spend/CPA/ROAS, problèmes et 3 actions prioritaires.",
    i: BarChart3,
    grad: "from-[#fff1e2] via-[#ffe0c2] to-[#ffcf9c]",
    ic: "text-[#c94a00]",
    intent: "audit",
  },
  {
    t: "Fais le rapport de la semaine",
    prompt:
      "Prépare un rapport hebdomadaire dirigeant sur la semaine (7 derniers jours) : dépenses, résultats, CPA, ce qui marche / ce qui brûle le budget, prochaine action.",
    i: FileText,
    grad: "from-[#e6f7ee] via-[#c9edd8] to-[#a9e0bf]",
    ic: "text-[#0f7a3c]",
    intent: "report",
  },
  {
    t: "Lance une campagne pour mon nouveau menu",
    prompt:
      "Je veux lancer une campagne Meta pour mon nouveau menu. Vérifie d'abord la config, puis guide-moi (objectif, budget/j, pays, URL) et propose une création en pause.",
    i: Rocket,
    grad: "from-[#ffe6ee] via-[#ffc7d8] to-[#ffa3bd]",
    ic: "text-[#9e1e4a]",
    intent: "campaign",
  },
  {
    t: "Sponsoriser un post de ma Page",
    prompt:
      "Je veux sponsoriser un post déjà publié sur ma Page Facebook. Liste mes posts récents et guide-moi pour un boost en pause.",
    i: Users,
    grad: "from-[#f3e8ff] via-[#e4d4ff] to-[#d0b8ff]",
    ic: "text-[#5b21b6]",
  },
  {
    t: "Vérifier ma configuration V1",
    prompt:
      "Vérifie ma configuration V1 : Meta OAuth, Page Facebook, Google Ads, recherche concurrents. Dis clairement ce qui est prêt et ce qui manque.",
    i: Cog,
    grad: "from-[#f0f4ff] via-[#dce4ff] to-[#c2d0ff]",
    ic: "text-[#1b3a8a]",
  },
  {
    t: "Prépare un rapport dirigeant sur mes campagnes Meta",
    prompt:
      "Prépare un rapport dirigeant sur mes campagnes Meta (30 derniers jours) : chiffres clés, risques, opportunités, décision recommandée en 5 lignes max.",
    i: Users,
    grad: "from-[#f0e6ff] via-[#dcc7ff] to-[#c2a3ff]",
    ic: "text-[#4a2a9e]",
    intent: "report",
  },
];

export const BUSINESS_OPTIONS: { id: NonNullable<CampaignWizardState["businessType"]>; label: string }[] = [
  { id: "saas", label: "SaaS ou logiciel" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "local", label: "Service local" },
  { id: "media", label: "Média ou blog" },
  { id: "custom", label: "Décris l'offre et le pays cible" },
];

export const OBJECTIVE_OPTIONS: { id: CampaignObjective; label: string; brief: string }[] = [
  { id: "traffic", label: "Trafic vers un site ou lien", brief: "trafic" },
  { id: "leads", label: "Prospects (leads)", brief: "prospects" },
  { id: "sales", label: "Ventes", brief: "ventes" },
  { id: "whatsapp", label: "Messages WhatsApp", brief: "Messages WhatsApp" },
  { id: "messenger", label: "Messages Messenger", brief: "Messages Messenger" },
];

export const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: "FR", label: "France" },
  { code: "CI", label: "Côte d'Ivoire" },
  { code: "SN", label: "Sénégal" },
  { code: "MA", label: "Maroc" },
  { code: "BE", label: "Belgique" },
  { code: "CA", label: "Canada" },
];

export const BUDGET_CHIPS = [10, 15, 25, 50, 100];
export const RADIUS_CHIPS = [5, 10, 15, 25, 40];

export function emptyCampaignWizard(): CampaignWizardState {
  return {
    businessType: null,
    businessCustom: "",
    objective: null,
    countries: [],
    geoScope: "city",
    cityText: "",
    radiusKm: null,
    dailyBudget: null,
    detail: "",
    images: [],
  };
}

export function composeCampaignWizardBrief(w: CampaignWizardState): string {
  const biz =
    w.businessType === "custom"
      ? w.businessCustom.trim() || "offre à préciser"
      : BUSINESS_OPTIONS.find((b) => b.id === w.businessType)?.label ?? "offre";
  const obj = OBJECTIVE_OPTIONS.find((o) => o.id === w.objective);
  const countryNames = w.countries
    .map((c) => COUNTRY_OPTIONS.find((x) => x.code === c)?.label ?? c)
    .join(", ");
  const countryCodes = w.countries.join(" ");
  const budget = w.dailyBudget && w.dailyBudget > 0 ? `${w.dailyBudget}/j` : "";

  let zone: string | null = null;
  if (w.geoScope === "country" && countryNames) {
    zone = `ciblage pays entier (${countryNames})`;
  } else if (w.cityText.trim()) {
    const city = w.cityText.trim();
    const radius =
      typeof w.radiusKm === "number"
        ? w.radiusKm === 0
          ? "ville entière (sans rayon)"
          : `rayon ${w.radiusKm} km`
        : null;
    zone = [`ville ${city}`, radius].filter(Boolean).join(", ");
  }

  const parts = [
    `Je veux lancer une campagne Meta`,
    `type d'offre : ${biz}`,
    obj ? `objectif ${obj.brief}` : null,
    countryNames ? `pays ${countryNames} ${countryCodes}` : null,
    zone,
    budget ? `budget ${budget}` : null,
    w.detail.trim() ? w.detail.trim() : null,
    w.images.length ? `${w.images.length} image(s) jointe(s) pour la créa` : null,
  ].filter(Boolean);
  return parts.join(" — ") + ".";
}

export const INTENT_META: Record<IntentKey, { label: string; icon: typeof BarChart3; scopes: string[]; detailPh: string; grad: string; compose: (scope: string, detail: string) => string }> = {
  audit: {
    label: "Audit publicitaire",
    icon: BarChart3,
    scopes: ["7 derniers jours", "30 derniers jours", "90 derniers jours"],
    detailPh: "Ex : concentre-toi sur Meta et le tracking",
    grad: "from-[#ff8a2b] to-[#ff5e00]",
    compose: (scope, detail) =>
      `Fais un audit publicitaire sur les ${scope}. Utilise les comptes connectés et donne spend, CPA, problèmes et 3 actions.` +
      (detail ? ` Précisions : ${detail}.` : ""),
  },
  report: {
    label: "Rapport hebdomadaire",
    icon: FileText,
    scopes: ["Cette semaine", "Semaine dernière", "Mois en cours"],
    detailPh: "Ex : format dirigeant, mettre en avant le CPA",
    grad: "from-[#2fbf6b] to-[#0f7a3c]",
    compose: (scope, detail) =>
      `Prépare un rapport dirigeant pour ${scope.toLowerCase()}. Chiffres réels, ce qui marche, ce qui brûle le budget, prochaine décision.` +
      (detail ? ` Précisions : ${detail}.` : ""),
  },
  campaign: {
    label: "Lancement de campagne",
    icon: Rocket,
    scopes: ["Notoriété", "Trafic", "Conversions / ventes"],
    detailPh: "Ex : nouveau menu, budget 50 USD/j, Côte d'Ivoire, URL",
    grad: "from-[#ff3d78] to-[#9e1e4a]",
    compose: (scope, detail) =>
      `Je veux lancer une campagne Meta. Objectif : ${scope}. Vérifie la config puis guide le brief (budget/j, pays, URL) et propose une création en pause.` +
      (detail ? ` Précisions : ${detail}.` : ""),
  },
};

export function detectIntent(t: string): IntentKey | null {
  const l = t.toLowerCase();
  if (l.includes("audit") || l.includes("analyse")) return "audit";
  if (l.includes("rapport")) return "report";
  if (l.includes("campagne") || l.includes("lance") || l.includes("lancer")) return "campaign";
  return null;
}

export function planTools(intent: IntentKey | null): ToolCall[] {
  if (intent === "audit")
    return [
      { name: "audit", label: "Lecture live des comptes publicitaires" },
      { name: "live_snapshots", label: "Normalisation spend / CPA / conversions" },
      { name: "diagnose", label: "Diagnostic et priorités" },
    ].map((t) => ({ ...t, status: "running" as const }));
  if (intent === "report")
    return [
      { name: "audit", label: "Extraction des résultats de la période" },
      { name: "live_snapshots", label: "Calcul des KPI dirigeant" },
      { name: "render_report", label: "Rédaction du rapport" },
    ].map((t) => ({ ...t, status: "running" as const }));
  if (intent === "campaign")
    return [
      { name: "validate_setup", label: "Vérification Meta + connexions" },
      { name: "brief", label: "Construction du brief campagne" },
      { name: "create_meta_campaign", label: "Proposition création en pause" },
    ].map((t) => ({ ...t, status: "running" as const }));
  return [
    { name: "validate_setup", label: "Analyse de la demande", status: "running" as const },
    { name: "lookup", label: "Lecture du contexte compte", status: "running" as const },
  ];
}

export function titleFromFirstUserMsg(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? t.slice(0, 42) + "…" : t;
}

export function threadType(t: Thread): IntentKey | null {
  for (const m of t.messages) {
    if (m.role !== "user") continue;
    const i = detectIntent(m.text);
    if (i) return i;
  }
  return null;
}

export function relevanceScore(t: Thread, q: string) {
  if (!q) return 0;
  const ql = q.toLowerCase();
  let score = 0;
  if (t.title.toLowerCase().includes(ql)) score += 10;
  for (const m of t.messages) {
    const idx = m.text.toLowerCase().indexOf(ql);
    if (idx !== -1) score += m.role === "user" ? 3 : 2;
  }
  return score;
}
