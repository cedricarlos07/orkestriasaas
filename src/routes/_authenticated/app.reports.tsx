import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileBarChart, Users, Building2, Cog, Download, Calendar, FileText, Sparkles, ArrowRight, ArrowUpRight, ArrowDownRight, AlertTriangle, Wrench, TrendingUp, X, ChevronRight, Radio, Activity } from "lucide-react";
import { getProfitabilityReport } from "@/functions/business-memory";

export const Route = createFileRoute("/_authenticated/app/reports")({ component: Reports });

const TYPES = [
  { i: Users, t: "Dirigeant", d: "Dépenses, ventes, marge, problèmes, décisions.", tone: "from-[#ff8a3c] to-[#ff6c02]", halo: "bg-[#ff6c02]/20" },
  { i: FileBarChart, t: "Marketing", d: "Performances par plateforme, audiences, créations.", tone: "from-sky-400 to-sky-600", halo: "bg-sky-300/25" },
  { i: Building2, t: "Agence", d: "Résultats, travail effectué, optimisations, actions.", tone: "from-violet-400 to-violet-600", halo: "bg-violet-300/25" },
  { i: Cog, t: "Technique", d: "Métriques détaillées, tracking, événements, config.", tone: "from-emerald-400 to-emerald-600", halo: "bg-emerald-300/25" },
];

const TYPE_STYLE: Record<string, string> = {
  Dirigeant: "bg-orange-50 text-[#ff6c02] ring-orange-200",
  Marketing: "bg-sky-50 text-sky-700 ring-sky-200",
  Agence: "bg-violet-50 text-violet-700 ring-violet-200",
  Technique: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const REPORTS = [
  { title: "Semaine du 14 juillet", type: "Dirigeant", date: "Il y a 2 jours" },
  { title: "Bilan Juin 2026", type: "Marketing", date: "Il y a 3 semaines" },
  { title: "Rapport client — Velvet Studio", type: "Agence", date: "Il y a 5 jours" },
  { title: "Audit tracking WhatsApp", type: "Technique", date: "Il y a 1 mois" },
];

type PeriodKey = "current_week" | "previous_week" | "current_month" | "previous_month" | "june_2026" | "may_2026";

const PERIODS: { key: PeriodKey; label: string; metrics: { spend: number; conv: number; cpa: number; roas: number } }[] = [
  { key: "current_week", label: "Semaine du 14 juillet", metrics: { spend: 182000, conv: 96, cpa: 1895, roas: 4.1 } },
  { key: "previous_week", label: "Semaine du 7 juillet", metrics: { spend: 168000, conv: 84, cpa: 2000, roas: 3.7 } },
  { key: "current_month", label: "Juillet 2026 (à date)", metrics: { spend: 425000, conv: 218, cpa: 1949, roas: 3.9 } },
  { key: "previous_month", label: "Juin 2026", metrics: { spend: 402000, conv: 196, cpa: 2051, roas: 3.6 } },
  { key: "june_2026", label: "Juin 2026", metrics: { spend: 402000, conv: 196, cpa: 2051, roas: 3.6 } },
  { key: "may_2026", label: "Mai 2026", metrics: { spend: 380000, conv: 172, cpa: 2209, roas: 3.4 } },
];

type Insight = {
  id: string;
  severity: "critical" | "warning" | "info";
  icon: typeof AlertTriangle;
  title: string;
  summary: string;
  causes: string[];
  actions: { label: string; impact: string }[];
  evidence: { label: string; value: string }[];
};

const INSIGHTS: Insight[] = [
  {
    id: "creative-fatigue",
    severity: "warning",
    icon: Activity,
    title: "Création TikTok « Combo » fatiguée",
    summary: "La vidéo perd en performance : les impressions montent, les conversions descendent.",
    causes: [
      "Fréquence moyenne 4,6 sur audience « Cocody 25-34 »",
      "CTR en baisse de 32 % sur les 7 derniers jours",
      "CPA en hausse de +38 % vs semaine précédente",
      "Audience saturée : 78 % de reach cumulé sur 30 jours",
    ],
    actions: [
      { label: "Rafraîchir avec 3 variantes verticales générées", impact: "CTR estimé +25 %" },
      { label: "Réduire le budget de 30 % le temps du refresh", impact: "Économie 12 000 FCFA / jour" },
      { label: "Élargir l'audience à Abidjan 25-44", impact: "Reach +180 %" },
    ],
    evidence: [
      { label: "Fréquence", value: "4,6" },
      { label: "CTR 7j", value: "0,82 %" },
      { label: "CPA 7j", value: "2 640 FCFA" },
      { label: "Reach cumulé", value: "78 %" },
    ],
  },
  {
    id: "tracking-whatsapp",
    severity: "critical",
    icon: Wrench,
    title: "Tracking WhatsApp partiellement cassé",
    summary: "34 % des conversations WhatsApp ne sont pas attribuées à leur campagne d'origine.",
    causes: [
      "Paramètres UTM manquants sur 3 boutons Click-to-WhatsApp Meta",
      "Redirection intermédiaire qui casse le referrer sur mobile",
      "Événement `whatsapp_lead` non déclenché depuis TikTok",
    ],
    actions: [
      { label: "Régénérer les liens Click-to-WhatsApp avec UTM standardisés", impact: "Attribution +30 pts" },
      { label: "Ajouter l'événement `whatsapp_lead` côté TikTok Pixel", impact: "Attribution TikTok restaurée" },
      { label: "Supprimer la redirection intermédiaire", impact: "Referrer préservé sur iOS" },
    ],
    evidence: [
      { label: "Conversations non attribuées", value: "34 %" },
      { label: "Écart Meta", value: "-22 conv." },
      { label: "Écart TikTok", value: "-11 conv." },
      { label: "Depuis", value: "24 juin" },
    ],
  },
  {
    id: "google-search-underfunded",
    severity: "info",
    icon: TrendingUp,
    title: "Google Search sous-financé",
    summary: "Le meilleur ROAS de votre compte tourne à 40 % de son budget cible.",
    causes: [
      "Budget quotidien plafonné à 8 000 FCFA sur 3 groupes d'annonces",
      "Taux d'impression perdu (budget) : 62 %",
      "Enchères manuelles au lieu de tCPA",
    ],
    actions: [
      { label: "Basculer sur tCPA 4 500 FCFA", impact: "Volume estimé +45 %" },
      { label: "Déplacer 40 000 FCFA depuis TikTok vers Google", impact: "ROAS global +0,4x" },
      { label: "Ajouter 12 mots-clés long-tail commerciaux", impact: "Impressions +30 %" },
    ],
    evidence: [
      { label: "ROAS Google", value: "5,6x" },
      { label: "Taux impression perdu", value: "62 %" },
      { label: "Budget saturé", value: "6 / 8 jours" },
      { label: "CPA", value: "1 240 FCFA" },
    ],
  },
];

function Reports() {
  const [aKey, setAKey] = useState<PeriodKey>("current_week");
  const [bKey, setBKey] = useState<PeriodKey>("previous_week");
  const [openInsightId, setOpenInsightId] = useState<string | null>(null);
  const { data: execReport } = useQuery({
    queryKey: ["profitability-report"],
    queryFn: () => getProfitabilityReport(),
  });

  const a = useMemo(() => PERIODS.find((p) => p.key === aKey)!, [aKey]);
  const b = useMemo(() => PERIODS.find((p) => p.key === bKey)!, [bKey]);
  const openInsight = useMemo(() => INSIGHTS.find((i) => i.id === openInsightId) ?? null, [openInsightId]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[0_10px_24px_-10px_rgba(255,108,2,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]">
            <FileBarChart className="h-5 w-5" />
            <span className="absolute inset-0 -z-10 rounded-2xl bg-[#ff6c02]/40 blur-xl animate-[softPulse_2.4s_ease-in-out_infinite]" />
          </span>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Rapports</p>
            <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Rapports disponibles et programmés</h1>
          </div>
        </div>
        <button className="btn-primary"><Calendar className="h-4 w-4" /> Programmer un rapport</button>
      </header>

      {execReport && (
        <section className="card-soft border border-[#ff6c02]/20 bg-gradient-to-r from-[#fff8f0] to-white p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">Rapport dirigeant · {execReport.period}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink">{execReport.summary}</p>
              {(execReport.spend || execReport.targetOrders) && (
                <p className="mt-2 text-[13px] text-ink-soft">
                  {execReport.spend ? `Budget cible : ${execReport.spend}` : null}
                  {execReport.targetOrders ? ` · Objectif commandes : ${execReport.targetOrders}` : null}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TYPES.map((t) => (
          <button key={t.t} className="card-soft card-hover relative overflow-hidden p-4 text-left">
            <div aria-hidden className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl ${t.halo}`} />
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${t.tone} text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_14px_-8px_rgba(0,0,0,0.35)]`}>
              <t.i className="h-4 w-4" />
            </span>
            <p className="mt-3 font-display font-semibold text-ink">{t.t}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{t.d}</p>
          </button>
        ))}
      </section>

      <PeriodCompare a={a} b={b} aKey={aKey} bKey={bKey} onA={setAKey} onB={setBKey} />

      <InsightsGrid onOpen={setOpenInsightId} />

      <section className="card-soft overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/60 bg-gradient-to-r from-white/80 to-[#faf6ef]/80 px-5 py-3">
          <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-ink-soft">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              <FileText className="h-3 w-3" />
            </span>
            Récents
          </p>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-ink-soft ring-1 ring-line/60">{REPORTS.length} rapports</span>
        </div>
        <ul className="divide-y divide-line/60">
          {REPORTS.map((r) => (
            <li key={r.title} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-white/70">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-white to-[#faf6ef] text-ink-soft ring-1 ring-line/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[14px] font-medium text-ink">{r.title}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-soft">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TYPE_STYLE[r.type] ?? "bg-surface-2 text-ink-soft ring-line/60"}`}>{r.type}</span>
                    {r.date}
                  </p>
                </div>
              </div>
              <button className="chip-ghost"><Download className="h-4 w-4" /> Télécharger</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#141414] via-[#1a1410] to-[#0d0d0d] p-6 text-white shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#ff6c02]/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-[#ff8a3c]/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }} />
        <div className="relative">
          <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-[#ffb079]">
            <Sparkles className="h-3.5 w-3.5" /> Aperçu simplifié
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-white/90">
            Cette semaine, vous avez dépensé <b className="text-white">182 000 FCFA</b> et obtenu <b className="text-white">96 conversations WhatsApp</b>. Le coût moyen est de <b className="text-white">1 895 FCFA</b> par conversation, soit une amélioration de <b className="text-emerald-300">14 %</b>. Meta génère davantage de commandes confirmées. TikTok apporte plus de visibilité, mais une vidéo commence à fatiguer.
          </p>
        </div>
      </section>

      {openInsight && <InsightDrawer insight={openInsight} onClose={() => setOpenInsightId(null)} />}
    </div>
  );
}

// -------- Period comparison --------

function PeriodCompare({ a, b, aKey, bKey, onA, onB }: {
  a: (typeof PERIODS)[number]; b: (typeof PERIODS)[number];
  aKey: PeriodKey; bKey: PeriodKey;
  onA: (k: PeriodKey) => void; onB: (k: PeriodKey) => void;
}) {
  const rows = [
    { key: "roas", label: "ROAS", a: a.metrics.roas, b: b.metrics.roas, fmt: (n: number) => `${n.toFixed(1)}x`, higherIsBetter: true },
    { key: "cpa", label: "Coût / conv.", a: a.metrics.cpa, b: b.metrics.cpa, fmt: (n: number) => `${n.toLocaleString("fr-FR")} FCFA`, higherIsBetter: false },
    { key: "conv", label: "Conversions", a: a.metrics.conv, b: b.metrics.conv, fmt: (n: number) => `${n}`, higherIsBetter: true },
    { key: "spend", label: "Dépenses", a: a.metrics.spend, b: b.metrics.spend, fmt: (n: number) => `${n.toLocaleString("fr-FR")} FCFA`, higherIsBetter: false },
  ];
  return (
    <section className="card-soft relative overflow-hidden p-6">
      <div aria-hidden className="pointer-events-none absolute -top-16 -left-16 h-40 w-40 rounded-full bg-[#ff6c02]/15 blur-3xl" />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_18px_-10px_rgba(255,108,2,0.7)]">
            <ArrowRight className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wider text-[#ff6c02]">Comparer deux périodes</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">Choisissez A et B pour voir les deltas côté ROAS, CPA, conversions et dépenses.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelect value={aKey} onChange={onA} tone="orange" />
          <span className="text-ink-soft">vs</span>
          <PeriodSelect value={bKey} onChange={onB} tone="slate" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {rows.map((r) => {
          const delta = r.a - r.b;
          const pct = r.b === 0 ? 0 : (delta / r.b) * 100;
          const positive = r.higherIsBetter ? delta >= 0 : delta <= 0;
          const Arrow = delta >= 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <div key={r.key} className="relative overflow-hidden rounded-xl border border-white/60 bg-gradient-to-br from-white to-[#faf6ef] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_-12px_rgba(0,0,0,0.25)]">
              <p className="text-[11px] uppercase tracking-wider text-ink-soft">{r.label}</p>
              <p className="mt-2 font-display text-[20px] font-semibold text-ink">{r.fmt(r.a)}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">vs <span className="font-medium text-ink/80">{r.fmt(r.b)}</span></p>
              <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${positive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                <Arrow className="h-3 w-3" />
                {delta >= 0 ? "+" : ""}{pct.toFixed(1)} %
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PeriodSelect({ value, onChange, tone }: { value: PeriodKey; onChange: (k: PeriodKey) => void; tone: "orange" | "slate" }) {
  const toneCls = tone === "orange"
    ? "border-[#ff6c02]/30 bg-orange-50 text-[#ff6c02]"
    : "border-slate-300 bg-white text-ink";
  return (
    <label className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${toneCls}`}>
      <Calendar className="h-3.5 w-3.5" />
      <select value={value} onChange={(e) => onChange(e.target.value as PeriodKey)} className="bg-transparent outline-none">
        {PERIODS.map((p) => (
          <option key={p.key} value={p.key} className="text-ink">{p.label}</option>
        ))}
      </select>
    </label>
  );
}

// -------- Insights (drill-down) --------

const SEVERITY: Record<Insight["severity"], { chip: string; halo: string; dot: string; label: string }> = {
  critical: { chip: "bg-rose-100 text-rose-700 ring-rose-200", halo: "bg-rose-400/20", dot: "bg-rose-500", label: "Critique" },
  warning: { chip: "bg-amber-100 text-amber-800 ring-amber-200", halo: "bg-amber-400/20", dot: "bg-amber-500", label: "À surveiller" },
  info: { chip: "bg-emerald-100 text-emerald-700 ring-emerald-200", halo: "bg-emerald-400/20", dot: "bg-emerald-500", label: "Opportunité" },
};

function InsightsGrid({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
          <Radio className="h-3.5 w-3.5" />
        </span>
        <div>
          <p className="text-[12px] font-medium uppercase tracking-wider text-ink-soft">Insights détectés</p>
          <p className="text-[13px] text-ink-soft">Cliquez un insight pour explorer les causes et les actions proposées.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {INSIGHTS.map((it) => {
          const s = SEVERITY[it.severity];
          return (
            <button
              key={it.id}
              onClick={() => onOpen(it.id)}
              className="card-soft card-hover group relative overflow-hidden p-5 text-left"
            >
              <div aria-hidden className={`pointer-events-none absolute -top-14 -right-14 h-36 w-36 rounded-full blur-3xl ${s.halo}`} />
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-white to-[#faf6ef] text-ink ring-1 ring-line/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <it.icon className="h-4 w-4" />
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
                </span>
              </div>
              <p className="mt-3 font-display text-[15px] font-semibold text-ink">{it.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft line-clamp-2">{it.summary}</p>
              <div className="mt-4 flex items-center justify-between text-[12px] text-ink-soft">
                <span>{it.causes.length} causes · {it.actions.length} actions</span>
                <span className="inline-flex items-center gap-1 font-medium text-[#ff6c02] transition group-hover:translate-x-0.5">
                  Explorer <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function InsightDrawer({ insight, onClose }: { insight: Insight; onClose: () => void }) {
  const s = SEVERITY[insight.severity];
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={insight.title}>
      <button aria-label="Fermer" onClick={onClose} className="flex-1 bg-black/40 backdrop-blur-sm animate-[fadeInUp_.15s_ease-out]" />
      <aside className="relative flex h-full w-full max-w-[520px] flex-col overflow-y-auto bg-gradient-to-b from-white to-[#faf6ef] shadow-[-30px_0_60px_-30px_rgba(0,0,0,0.4)] animate-[fadeInUp_.25s_ease-out]">
        <div aria-hidden className={`pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl ${s.halo}`} />
        <header className="relative flex items-start justify-between gap-3 border-b border-line/60 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-white to-[#faf6ef] text-ink ring-1 ring-line/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <insight.icon className="h-5 w-5" />
            </span>
            <div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
              </span>
              <h2 className="mt-1 font-display text-[18px] font-semibold text-ink">{insight.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{insight.summary}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="rounded-full p-1.5 text-ink-soft transition hover:bg-white hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative space-y-5 p-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Preuves</p>
            <div className="grid grid-cols-2 gap-2">
              {insight.evidence.map((e) => (
                <div key={e.label} className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <p className="text-[11px] uppercase tracking-wider text-ink-soft">{e.label}</p>
                  <p className="mt-1 font-display text-[15px] font-semibold text-ink">{e.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Causes principales
            </p>
            <ul className="space-y-2">
              {insight.causes.map((c) => (
                <li key={c} className="flex items-start gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-[13px] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Actions proposées
            </p>
            <ul className="space-y-2">
              {insight.actions.map((a) => (
                <li key={a.label} className="flex items-start justify-between gap-3 rounded-xl border border-white/60 bg-gradient-to-br from-white to-[#faf6ef] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div>
                    <p className="text-[13px] font-medium text-ink">{a.label}</p>
                    <p className="mt-0.5 text-[11px] text-emerald-700">{a.impact}</p>
                  </div>
                  <button className="chip-ghost shrink-0"><ChevronRight className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="mt-auto border-t border-line/60 bg-white/70 p-4">
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="chip-ghost">Fermer</button>
            <button className="btn-primary"><Sparkles className="h-4 w-4" /> Demander à Orkestria</button>
          </div>
        </footer>
      </aside>
    </div>
  );
}