import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, ShieldAlert, Zap, Bot, ArrowRight, Lock, Sparkles, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/automations")({ component: Automations });

const RULES: { name: string; scope: string; on: boolean }[] = [];

const ALERTS: { level: string; icon: typeof AlertTriangle; tone: string; text: string; action: string }[] = [];

const LEVELS = [
  { id: 0, t: "Observation", d: "Lecture et rapports uniquement.", grad: "from-slate-100 to-white", accent: "text-slate-600" },
  { id: 1, t: "Recommandation", d: "Orkestria propose, n'exécute rien.", grad: "from-sky-50 to-white", accent: "text-sky-600" },
  { id: 2, t: "Exécution approuvée", d: "Chaque action nécessite votre validation.", grad: "from-[#fff1e2] to-white", accent: "text-[#ff6c02]" },
  { id: 3, t: "Autonomie encadrée", d: "Exécute certaines actions dans vos limites.", grad: "from-violet-50 to-white", accent: "text-violet-600" },
  { id: 4, t: "Autopilot", d: "Optimise en continu selon votre politique.", grad: "from-emerald-50 to-white", accent: "text-emerald-600" },
] as const;

const POLICY_QUESTIONS: { id: string; q: string; opts: string[] }[] = [
  { id: "auto_pause", q: "Orkestria peut-elle arrêter une campagne qui dépense sans vendre ?", opts: ["Oui automatiquement", "Me demander avant", "Non"] },
  { id: "budget_up", q: "Peut-elle augmenter un budget qui performe ?", opts: ["Oui jusqu'à +10%", "Me demander avant", "Non"] },
  { id: "launch", q: "Peut-elle lancer une nouvelle campagne toute seule ?", opts: ["Oui", "Me demander avant", "Non"] },
  { id: "creatives", q: "Peut-elle publier de nouvelles créations ?", opts: ["Oui", "Me demander avant", "Non"] },
];

const PROTECTED = [
  "Augmenter le budget mensuel global",
  "Changer la devise",
  "Modifier la facturation",
  "Ajouter un moyen de paiement",
  "Supprimer définitivement une campagne",
  "Connecter ou déconnecter un compte publicitaire",
  "Dépasser un plafond contractuel",
];

function Automations() {
  const [rules, setRules] = useState(RULES);
  const [level, setLevel] = useState<number>(2);
  const [policy, setPolicy] = useState<Record<string, string>>({ auto_pause: "Me demander avant", budget_up: "Me demander avant", launch: "Non", creatives: "Me demander avant" });

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white shadow-[0_10px_30px_-10px_rgba(255,108,2,0.6)]">
          <ShieldCheck className="h-5 w-5" />
          <span className="absolute inset-0 animate-ping rounded-2xl bg-[#ff6c02]/20" />
        </span>
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Optimisation continue · Ads Guardian</p>
          <h1 className="mt-0.5 font-display text-[26px] font-semibold text-ink">Automatisations</h1>
          <p className="text-[13px] text-ink-soft">Règles de protection, niveau d'autonomie et alertes en temps réel.</p>
        </div>
      </header>

      <section className="card-soft rounded-2xl p-6">
        <p className="mb-4 flex items-center gap-2 font-display text-[16px] font-semibold text-ink">
          <Bot className="h-4 w-4 text-[#ff6c02]" /> Niveau d'autonomie
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {LEVELS.map((o) => {
            const active = level === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setLevel(o.id)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${o.grad} p-3 text-left ring-1 transition ${
                  active ? "ring-2 ring-[#ff6c02] shadow-[0_12px_28px_-14px_rgba(255,108,2,0.5)] -translate-y-0.5" : "ring-line/60 hover:-translate-y-0.5 hover:ring-ink/30 hover:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.2)]"
                }`}
              >
                <span className={`inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-line/60 ${o.accent}`}>Niveau {o.id}</span>
                <p className="mt-2 text-[13px] font-semibold text-ink">{o.t}</p>
                <p className="mt-1 text-[11px] text-ink-soft">{o.d}</p>
                {active && <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#ff6c02]/25 blur-2xl" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card-soft rounded-2xl p-6">
        <p className="mb-1 flex items-center gap-2 font-display text-[16px] font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-[#ff6c02]" /> Ce qu'Orkestria peut faire toute seule
        </p>
        <p className="mb-4 text-[13px] text-ink-soft">Réglages simples — aucune ligne de configuration à écrire.</p>
        <ul className="space-y-4">
          {POLICY_QUESTIONS.map((q) => (
            <li key={q.id} className="rounded-xl bg-gradient-to-br from-white to-[#fff9f2] p-4 ring-1 ring-line/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <p className="text-[13px] font-medium text-ink">{q.q}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {q.opts.map((o) => (
                  <button
                    key={o}
                    onClick={() => setPolicy((p) => ({ ...p, [q.id]: o }))}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 transition ${
                      policy[q.id] === o
                        ? "bg-gradient-to-br from-ink to-ink/80 text-white ring-ink shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)]"
                        : "bg-white/80 text-ink-soft ring-line/70 backdrop-blur hover:text-ink hover:ring-ink/30"
                    }`}
                  >{o}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card-soft rounded-2xl p-6">
          <p className="mb-4 flex items-center gap-2 font-display text-[16px] font-semibold text-ink">
            <ShieldCheck className="h-4 w-4 text-[#ff6c02]" /> Règles de protection
          </p>
          <ul className="space-y-2">
            {rules.length === 0 ? (
              <li className="rounded-xl bg-white/60 px-3 py-6 text-center text-[13px] text-ink-soft ring-1 ring-line/60">
                Aucune règle active. Ajoutez une protection quand vous serez prêt.
              </li>
            ) : (
              rules.map((r, i) => (
              <li key={r.name} className={`flex items-center justify-between gap-4 rounded-xl px-3 py-3 ring-1 transition ${r.on ? "bg-gradient-to-br from-[#fff6ec] to-white ring-[#ff6c02]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" : "bg-white/60 ring-line/60"}`}>
                <div>
                  <p className="text-[14px] font-medium text-ink">{r.name}</p>
                  <p className="text-[12px] text-ink-soft">{r.scope}</p>
                </div>
                <button
                  onClick={() => setRules((rs) => rs.map((x, j) => j === i ? { ...x, on: !x.on } : x))}
                  aria-pressed={r.on}
                  className={`relative h-6 w-11 rounded-full transition ${r.on ? "bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] shadow-[0_6px_14px_-6px_rgba(255,108,2,0.6)]" : "bg-line"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.2)] transition ${r.on ? "left-5" : "left-0.5"}`} />
                </button>
              </li>
              ))
            )}
          </ul>
          <button className="chip-ghost mt-4"><Zap className="h-4 w-4" /> Ajouter une règle</button>
        </div>

        <div className="card-soft rounded-2xl p-6">
          <p className="mb-4 flex items-center gap-2 font-display text-[16px] font-semibold text-ink">
            <ShieldAlert className="h-4 w-4 text-[#ff6c02]" /> Alertes Guardian
          </p>
          <ul className="space-y-3">
            {ALERTS.length === 0 ? (
              <li className="rounded-xl bg-white/60 p-4 text-center text-[13px] text-ink-soft ring-1 ring-line/60">
                Aucune alerte — les alertes Guardian apparaîtront ici sur données réelles.
              </li>
            ) : (
              ALERTS.map((a) => {
              const [gradFrom, gradTo, ring, text, dot] = a.tone.split(" ");
              const Icon = a.icon;
              return (
                <li key={a.text} className={`rounded-xl bg-gradient-to-br ${gradFrom} ${gradTo} p-3 ring-1 ${ring} shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]`}>
                  <div className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${dot}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${text}`}>{a.level}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-ink">{a.text}</p>
                  <button className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[12px] font-medium text-[#ff6c02] ring-1 ring-[#ff6c02]/20 backdrop-blur transition hover:bg-white hover:ring-[#ff6c02]/40">
                    {a.action} <ArrowRight className="h-3 w-3" />
                  </button>
                </li>
              );
              })
            )}
          </ul>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink via-[#141414] to-[#0b0b0b] p-6 text-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/5">
        <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-[#ff6c02]/40 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }} />
        <div className="relative flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white shadow-[0_8px_20px_-8px_rgba(255,108,2,0.6)]">
            <Lock className="h-3.5 w-3.5" />
          </span>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Actions toujours protégées</p>
        </div>
        <p className="relative mt-2 text-[13px] leading-relaxed text-white/85">Même en Autopilot, ces actions nécessitent toujours votre autorisation.</p>
        <ul className="relative mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROTECTED.map((p) => (
            <li key={p} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[13px] text-white/90 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">
              <Lock className="h-3.5 w-3.5 text-[#ff8a3d]" /> {p}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}