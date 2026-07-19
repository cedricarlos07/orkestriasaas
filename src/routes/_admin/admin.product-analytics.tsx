import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getProductFunnel, getProductKPIs } from "@/lib/admin-store";
import { BarChart3, Users, Zap } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/product-analytics")({
  head: () => ({ meta: [{ title: "Analytics produit — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: ProductAnalyticsPage,
});

function ProductAnalyticsPage() {
  const funnel = useMemo(() => getProductFunnel(), []);
  const k = useMemo(() => getProductKPIs(), []);
  const [seg, setSeg] = useState("all");
  const max = funnel[0].n;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Analytics produit</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Utilisation d'Orkestria</h1>
        <p className="mt-1 text-[13px] text-white/60">Funnel, activation, rétention et segmentation.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11.5px] uppercase tracking-wider text-white/50">Segmentation</p>
        {[["all", "Toutes"], ["country", "Pays"], ["sector", "Secteur"], ["plan", "Abonnement"], ["type", "Entreprise/Agence"], ["budget", "Budget"], ["platform", "Plateforme"]].map(([id, l]) => (
          <button key={id} onClick={() => setSeg(id)} className={`rounded-full border px-3 py-1 text-[12px] ${seg === id ? "border-[#ff8a3d] bg-[#ff8a3d]/10 text-[#ff8a3d]" : "border-white/10 bg-white/[0.04] text-white/70"}`}>{l}</button>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Funnel d'activation</p>
        <div className="mt-4 space-y-2">
          {funnel.map((s, i) => {
            const pct = s.n / max;
            const conv = i === 0 ? 1 : s.n / funnel[i - 1].n;
            return (
              <div key={s.label}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-white/85">{s.label}</span>
                  <span className="text-white/60">{s.n.toLocaleString("fr-FR")} <span className="text-white/40">({(pct * 100).toFixed(0)} % · conv {(conv * 100).toFixed(0)} %)</span></span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/[0.04]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#ff8a2b] to-[#ff5e00]" style={{ width: `${pct * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Taux d'activation" value={`${(k.activationRate * 100).toFixed(0)} %`} />
        <Kpi label="Time to value" value={`${k.timeToValueMin} min`} />
        <Kpi label="Essai → Payant" value={`${(k.trialToPaid * 100).toFixed(0)} %`} />
        <Kpi label="Rétention M3" value={`${(k.retentionM3 * 100).toFixed(0)} %`} />
        <Kpi label="Churn mensuel" value={`${(k.churnMonthly * 100).toFixed(1)} %`} tone="warn" />
        <Kpi label="Upgrade" value={`${(k.upgradeRate * 100).toFixed(0)} %`} />
        <Kpi label="Usage Autopilot" value={`${(k.autopilotUsage * 100).toFixed(0)} %`} />
        <Kpi label="Taux d'approbation" value={`${(k.approvalRate * 100).toFixed(0)} %`} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Fonctionnalités les plus utilisées</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {k.topFeatures.map((f, i) => (
            <span key={f} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12.5px] text-white/80">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[#ff8a3d]/20 text-[10px] font-semibold text-[#ff8a3d]">{i + 1}</span>{f}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-white/50">Nombre moyen de comptes connectés : <span className="text-white/85">{k.avgAccounts.toFixed(1)}</span></p>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  const c = tone === "warn" ? "text-amber-300" : "text-white/90";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[12px] text-white/60"><BarChart3 className="h-3.5 w-3.5" /> {label}</div>
      <p className={`mt-2 font-display text-[22px] font-semibold ${c}`}>{value}</p>
    </div>
  );
}