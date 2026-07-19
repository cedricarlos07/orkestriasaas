import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { getFinanceReport, fmtMoney, fmtPct } from "@/lib/admin-store";
import { Landmark, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/finance")({
  head: () => ({ meta: [{ title: "Rapports financiers — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: FinancePage,
});

function FinancePage() {
  const r = useMemo(() => getFinanceReport(), []);
  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Rapports financiers</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Vue dirigeant</h1>
        <p className="mt-1 text-[13px] text-white/60">Revenus, marges et rentabilité par plan — calculés dynamiquement.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="MRR" value={fmtMoney(r.mrr)} icon={Landmark} />
        <Kpi label="ARR" value={fmtMoney(r.arr)} icon={Landmark} />
        <Kpi label="Marge brute" value={fmtPct(r.grossMargin, 0)} icon={TrendingUp} tone="ok" />
        <Kpi label="Churn mensuel" value={fmtPct(r.churn, 1)} icon={TrendingDown} tone="warn" />
        <Kpi label="LTV" value={fmtMoney(r.ltvXOF)} icon={TrendingUp} />
        <Kpi label="CAC" value={fmtMoney(r.cacXOF)} icon={TrendingDown} />
        <Kpi label="ARPU" value={fmtMoney(r.arpuXOF)} icon={Landmark} />
        <Kpi label="Coûts IA / Infra" value={`${r.aiCostsUSD} + ${r.infraCostsUSD} USD`} icon={TrendingDown} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <header className="border-b border-white/10 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Rentabilité par plan</p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-white/40">
              <tr><th className="px-5 py-3">Plan</th><th>Clients actifs</th><th>Revenu moyen</th><th>Coût moyen</th><th>Revenu total</th><th>Marge brute</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {r.revenueByPlan.map((p) => (
                <tr key={p.plan.id}>
                  <td className="px-5 py-2.5 text-white/90">{p.plan.name}</td>
                  <td className="text-white/70">{p.count}</td>
                  <td className="text-white/80">{fmtMoney(p.avgRevenue)}</td>
                  <td className="text-white/60">{fmtMoney(p.avgCost)}</td>
                  <td className="text-white/85">{fmtMoney(p.revenue)}</td>
                  <td className={p.margin >= 0.7 ? "text-emerald-300" : "text-amber-300"}>{fmtPct(p.margin, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <header className="border-b border-white/10 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Revenus par pays</p>
        </header>
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {r.revenueByCountry.map((c) => (
            <div key={c.country} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[12px] text-white/60">{c.country}</p>
              <p className="mt-1 font-display text-[16px] font-semibold">{fmtMoney(c.revenue)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11.5px] uppercase tracking-wider text-white/50">Impayés</p>
          <p className="mt-1 font-display text-[20px] font-semibold text-rose-300">{fmtMoney(r.unpaidXOF)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11.5px] uppercase tracking-wider text-white/50">Remboursements</p>
          <p className="mt-1 font-display text-[20px] font-semibold text-amber-300">{fmtMoney(r.refundsXOF)}</p>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone?: "ok" | "warn" }) {
  const c = tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-white/90";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[12px] text-white/60"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <p className={`mt-2 font-display text-[20px] font-semibold ${c}`}>{value}</p>
    </div>
  );
}

import type React from "react";