import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, AlertTriangle, TrendingUp, Pause, Play, History, FileDown, ArrowRight, Stethoscope, Sparkles, ListChecks } from "lucide-react";
import { useAudits, type AuditRun } from "@/lib/audit-store";
import { printHtmlAsPdf } from "@/lib/print-pdf";

export const Route = createFileRoute("/_authenticated/app/audit")({ component: Audit });

const STEPS = [
  "Sélection de la période",
  "Lecture des comptes",
  "Normalisation des métriques",
  "Vérification du tracking",
  "Analyse des dépenses",
  "Analyse des conversions",
  "Analyse des créations",
  "Analyse des audiences",
  "Analyse des budgets",
  "Synthèse",
];

const FINAL_FINDINGS: { label: string; kind: "problem" | "opportunity" }[] = [];

function Audit() {
  const { current, completed, start, update } = useAudits();
  const [i, setI] = useState(current?.stepIndex ?? 0);
  const [running, setRunning] = useState(current?.status === "running");

  // Sync local step with the current run when it changes (e.g. after resume)
  useEffect(() => {
    if (current) setI(current.stepIndex);
  }, [current?.id]);

  useEffect(() => {
    if (!running || !current) return;
    if (i >= STEPS.length) {
      update(current.id, {
        status: "done",
        stepIndex: STEPS.length,
        completedAt: Date.now(),
        findings: FINAL_FINDINGS,
      });
      setRunning(false);
      return;
    }
    const t = setTimeout(() => {
      const next = i + 1;
      setI(next);
      update(current.id, { stepIndex: next });
    }, 450);
    return () => clearTimeout(t);
  }, [i, running, current?.id]);

  const done = i >= STEPS.length;

  const startNew = () => {
    const run = start(STEPS.length);
    setI(0);
    setRunning(true);
    // seed initial index via update
    update(run.id, { stepIndex: 0, status: "running" });
  };
  const pauseRun = () => {
    if (!current) return;
    update(current.id, { status: "paused", stepIndex: i });
    setRunning(false);
  };
  const resumeRun = () => {
    if (!current) return;
    update(current.id, { status: "running" });
    setRunning(true);
  };

  const previous = useMemo(() => completed[0], [completed]);
  const comparison = useMemo(() => {
    if (!done || !previous) return null;
    return buildComparison({
      before: previous,
      after: { spend: "425 000", conv: 102, cpa: "4 167", roas: "3,9x" },
    });
  }, [done, previous?.id]);

  const exportPdf = () => {
    const findings = FINAL_FINDINGS.map((f) =>
      `<li>${f.kind === "problem" ? "⚠︎" : "↑"} ${f.label}</li>`
    ).join("");
    const compareBlock = comparison ? `
      <div class="card">
        <h2>Avant / après vs ${previous!.period}</h2>
        ${comparison.rows.map((r) => `<div class="row"><span>${r.label}</span><span><b>${r.before}</b> → <b>${r.after}</b> <span class="muted">(${r.delta})</span></span></div>`).join("")}
      </div>` : "";
    printHtmlAsPdf("Audit publicitaire — Orkestria", `
      <span class="badge">Audit</span>
      <h1>Analyse des 30 derniers jours</h1>
      <p class="muted">Meta · Google · TikTok — synthèse en français simple.</p>
      <div class="card grid2">
        <div><h2>Dépenses</h2><p>425 000 FCFA</p></div>
        <div><h2>Conversions</h2><p>102</p></div>
        <div><h2>Coût par conversion</h2><p>4 167 FCFA</p></div>
        <div><h2>ROAS moyen</h2><p>3,9x</p></div>
      </div>
      <div class="card">
        <h2>Problèmes et opportunités</h2>
        <ul style="font-size:13px; line-height:1.6;">${findings}</ul>
      </div>
      ${compareBlock}
    `);
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[0_10px_24px_-10px_rgba(255,108,2,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]">
            <Stethoscope className="h-5 w-5" />
            <span className="absolute inset-0 -z-10 rounded-2xl bg-[#ff6c02]/40 blur-xl animate-[softPulse_2.4s_ease-in-out_infinite]" />
          </span>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Audit publicitaire</p>
            <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Analyse mes campagnes</h1>
            <p className="text-[13px] text-ink-soft">Sur les 30 derniers jours, tous canaux confondus.</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {current?.status === "paused" && (
            <button onClick={resumeRun} className="chip-ghost bg-surface-2">
              <Play className="h-4 w-4" /> Reprendre l'audit ({current.stepIndex}/{STEPS.length})
            </button>
          )}
          {running && !done && (
            <button onClick={pauseRun} className="chip-ghost bg-surface-2">
              <Pause className="h-4 w-4" /> Mettre en pause
            </button>
          )}
          {done && (
            <button onClick={exportPdf} className="chip-ghost bg-surface-2">
              <FileDown className="h-4 w-4" /> Exporter en PDF
            </button>
          )}
          <button onClick={startNew} className="btn-primary">
            {running && !done ? "Analyse en cours…" : done ? "Relancer l'audit" : "Lancer l'audit"}
          </button>
        </div>
      </header>

      {current?.status === "paused" && !running && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-3 text-[13px] text-amber-800">
          <span>Audit interrompu à l'étape « {STEPS[Math.min(current.stepIndex, STEPS.length - 1)]} ». Reprenez quand vous voulez.</span>
          <button onClick={resumeRun} className="chip-ghost bg-white">
            <Play className="h-3.5 w-3.5" /> Reprendre
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="card-soft card-hover relative overflow-hidden p-6">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-sky-300/25 blur-3xl" />
          <p className="mb-4 flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <ListChecks className="h-3.5 w-3.5" />
            </span>
            Étapes
          </p>
          <ol className="space-y-2 text-[14px]">
            {STEPS.map((s, idx) => (
              <li key={s} className="flex items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-white/60">
                {idx < i ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"><Check className="h-3 w-3" /></span>
                  : idx === i && running ? <Loader2 className="h-5 w-5 animate-spin text-[#ff6c02]" />
                  : <span className="h-5 w-5 rounded-full border border-line bg-white/70" />}
                <span className={idx <= i ? "text-ink font-medium" : "text-ink-soft"}>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="card-soft card-hover relative overflow-hidden p-6">
          <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[#ff6c02]/20 blur-3xl" />
          <p className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            Synthèse simplifiée
          </p>
          {!done ? (
            <p className="text-[14px] text-ink-soft">Lancez l'audit pour obtenir la synthèse en français simple.</p>
          ) : (
            <div className="space-y-3 text-[14px] leading-relaxed text-ink">
              <p>Vous avez dépensé <b>425 000 FCFA</b> sur les trente derniers jours.</p>
              <p>Deux campagnes génèrent <b>78 %</b> de vos ventes.</p>
              <p>Une campagne Meta a dépensé <b>63 000 FCFA</b> sans vente confirmée.</p>
              <p>Google génère moins de prospects, mais ils sont plus souvent transformés en clients.</p>
            </div>
          )}
        </div>
      </section>

      {done && (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card icon={AlertTriangle} tone="from-rose-400 to-rose-600" title="Problèmes détectés" items={[
            "Tracking WhatsApp partiellement cassé",
            "Meta « Menu Poulet » : 63 000 FCFA sans vente",
            "Créations Meta épuisées (fréquence 4,8)",
          ]} />
          <Card icon={TrendingUp} tone="from-emerald-400 to-emerald-600" title="Actions proposées" items={[
            "Arrêter la campagne Meta « Menu Poulet »",
            "Réduire le budget TikTok « Combo » de 30%",
            "Tester une nouvelle création verticale",
            "Corriger le tracking WhatsApp",
            "Déplacer 40 000 FCFA vers Google Search",
          ]} />
        </section>
      )}

      {done && comparison && (
        <section className="card-soft relative overflow-hidden p-6">
          <div aria-hidden className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-[#ff6c02]/15 blur-3xl" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wider text-[#ff6c02]">Comparatif avant / après</p>
              <p className="mt-1 text-[14px] text-ink">vs audit précédent — <b>{previous!.period}</b></p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {comparison.rows.map((r) => (
              <div key={r.label} className="relative overflow-hidden rounded-xl border border-white/60 bg-gradient-to-br from-white to-[#faf6ef] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_-12px_rgba(0,0,0,0.25)]">
                <p className="text-[11px] uppercase tracking-wider text-ink-soft">{r.label}</p>
                <p className="mt-2 font-display text-[18px] font-semibold text-ink">{r.after}</p>
                <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.positive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {r.delta}
                </span>
                <p className="mt-1 text-[11px] text-ink-soft">vs {r.before}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card-soft overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/60 bg-gradient-to-r from-white/80 to-[#faf6ef]/80 px-5 py-3">
          <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-ink-soft">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              <History className="h-3 w-3" />
            </span>
            Historique des analyses
          </p>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-ink-soft ring-1 ring-line/60">{completed.length} audit{completed.length > 1 ? "s" : ""} terminé{completed.length > 1 ? "s" : ""}</span>
        </div>
        <ul className="divide-y divide-line/60">
          {completed.length === 0 && (
            <li className="px-5 py-6 text-center text-[13px] text-ink-soft">Aucun audit enregistré pour l'instant.</li>
          )}
          {completed.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13px] transition hover:bg-white/70">
              <div>
                <p className="font-medium text-ink">{a.period}</p>
                <p className="text-[11px] text-ink-soft">
                  Terminé {a.completedAt ? new Date(a.completedAt).toLocaleDateString("fr-FR") : "—"} · {a.spend} FCFA · {a.conv} conv. · ROAS {a.roas}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-ink-soft">
                {a.findings.slice(0, 2).map((f) => (
                  <span key={f.label} className={`rounded-full px-2 py-0.5 ring-1 ${f.kind === "problem" ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>{f.label}</span>
                ))}
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({ icon: Icon, tone, title, items }: { icon: typeof Check; tone: string; title: string; items: string[] }) {
  return (
    <div className="card-soft card-hover relative overflow-hidden p-6">
      <div aria-hidden className={`pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl bg-gradient-to-br ${tone} opacity-20`} />
      <p className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-ink">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${tone} text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {title}
      </p>
      <ul className="space-y-2 text-[14px]">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 rounded-lg px-2 py-1 transition hover:bg-white/60">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br ${tone}`} />
            <span className="text-ink">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildComparison({ before, after }: {
  before: Pick<AuditRun, "spend" | "conv" | "cpa" | "roas">;
  after: { spend: string; conv: number; cpa: string; roas: string };
}) {
  const num = (s: string) => Number(String(s).replace(/\s|,/g, "").replace(/[^\d.]/g, "")) || 0;
  const delta = (b: number, a: number, higherIsBetter: boolean) => {
    if (!b) return { text: "—", positive: true };
    const pct = ((a - b) / b) * 100;
    const sign = pct >= 0 ? "+" : "";
    const positive = higherIsBetter ? pct >= 0 : pct <= 0;
    return { text: `${sign}${pct.toFixed(1)} %`, positive };
  };
  const spend = delta(num(before.spend), num(after.spend), false);
  const conv = delta(before.conv, after.conv, true);
  const cpa = delta(num(before.cpa), num(after.cpa), false);
  const roas = delta(num(before.roas), num(after.roas), true);
  return {
    rows: [
      { label: "Dépenses", before: `${before.spend} FCFA`, after: `${after.spend} FCFA`, delta: spend.text, positive: spend.positive },
      { label: "Conversions", before: `${before.conv}`, after: `${after.conv}`, delta: conv.text, positive: conv.positive },
      { label: "Coût / conv.", before: `${before.cpa} FCFA`, after: `${after.cpa} FCFA`, delta: cpa.text, positive: cpa.positive },
      { label: "ROAS", before: before.roas, after: after.roas, delta: roas.text, positive: roas.positive },
    ],
  };
}