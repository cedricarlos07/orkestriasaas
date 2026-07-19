import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  getProviderCosts, getModelRoutes, saveModelRoutes, getAiLimits, saveAiLimits,
  getUsage, getOrganizations, planLabel, logAudit, fmtNum, type ModelRoute,
} from "@/lib/admin-store";
import { Coins, TrendingUp, AlertTriangle, Save, Router as RouterIcon, Gauge } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/costs")({
  head: () => ({ meta: [{ title: "Coûts IA & fournisseurs — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: CostsPage,
});

const MODEL_OPTIONS = ["économique", "standard", "avancé", "avancé + règles", "multimodal"];

function CostsPage() {
  const providers = useMemo(() => getProviderCosts(), []);
  const usage = useMemo(() => getUsage(), []);
  const orgs = useMemo(() => getOrganizations(), []);
  const [routes, setRoutes] = useState<ModelRoute[]>(() => getModelRoutes());
  const [limits, setLimits] = useState(() => getAiLimits());

  const totalCost = providers.reduce((s, p) => s + p.costUSD, 0);
  const errorProviders = providers.filter((p) => p.errorRate > 0.01);

  const perOrg = useMemo(() => {
    return orgs.map((o) => {
      const u = usage.find((x) => x.orgId === o.id);
      const cost = u ? u.monthlyCostXOF / 600 : 0; // approximatif USD
      const revenue = o.aiSpend;
      const margin = revenue - cost;
      return { org: o, cost, revenue, margin };
    }).sort((a, b) => b.cost - a.cost).slice(0, 8);
  }, [orgs, usage]);

  const setRoute = (id: string, model: string) => setRoutes((r) => r.map((x) => x.id === id ? { ...x, model } : x));
  const saveRoutes = () => { saveModelRoutes(routes); logAudit({ actor: "super_admin", action: "Routage modèles mis à jour", target: "ai_routing" }); };
  const saveLim = () => { saveAiLimits(limits); logAudit({ actor: "super_admin", action: "Limites IA mises à jour", target: "ai_limits" }); };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Coûts IA & fournisseurs</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Protégez la marge d'Orkestria</h1>
        <p className="mt-1 text-[13px] text-white/60">Vue consolidée des coûts par fournisseur, routage de modèles et limites globales.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Coins} label="Coût IA total (30 j)" value={`${totalCost.toFixed(0)} USD`} />
        <Kpi icon={TrendingUp} label="Modèle le + utilisé" value="gemini-2.5-flash" />
        <Kpi icon={AlertTriangle} label="Fournisseurs en erreur" value={String(errorProviders.length)} tone="warn" />
        <Kpi icon={Gauge} label="Budget IA / jour" value={`${limits.dailyGlobalUSD} USD`} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <header className="border-b border-white/10 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Fournisseurs suivis</p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-white/40">
              <tr><th className="px-5 py-3">Fournisseur</th><th>Coût (USD)</th><th>Appels</th><th>Erreurs</th><th>Modèle principal</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {providers.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2.5 text-white/90">{p.label}</td>
                  <td className="text-white/80">{p.costUSD.toFixed(2)}</td>
                  <td className="text-white/70">{fmtNum(p.calls)}</td>
                  <td className={p.errorRate > 0.01 ? "text-amber-300" : "text-white/60"}>{(p.errorRate * 100).toFixed(2)} %</td>
                  <td className="text-white/70">{p.topModel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <header className="border-b border-white/10 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Top 8 organisations par coût IA</p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-white/40">
              <tr><th className="px-5 py-3">Organisation</th><th>Plan</th><th>Coût IA (USD)</th><th>Facturé (USD)</th><th>Marge brute</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {perOrg.map(({ org, cost, revenue, margin }) => (
                <tr key={org.id}>
                  <td className="px-5 py-2.5 text-white/90">{org.name}</td>
                  <td className="text-white/70">{planLabel(org.plan)}</td>
                  <td className="text-white/80">{cost.toFixed(2)}</td>
                  <td className="text-white/80">{revenue.toFixed(0)}</td>
                  <td className={margin < 0 ? "text-rose-300" : "text-emerald-300"}>{margin.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Routage des modèles</p>
            <h2 className="mt-1 font-display text-[17px] font-semibold">Assignez le bon modèle à chaque tâche</h2>
          </div>
          <button onClick={saveRoutes} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] px-3 py-1.5 text-[12.5px] font-medium text-white"><Save className="h-3.5 w-3.5" /> Enregistrer</button>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {routes.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{r.label}</p>
                <p className="text-[11.5px] text-white/50">{r.note}</p>
              </div>
              <select value={r.model} onChange={(e) => setRoute(r.id, e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12.5px] outline-none">
                {MODEL_OPTIONS.map((m) => <option key={m} value={m} className="bg-[#111114]">{m}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Limites IA</p>
            <h2 className="mt-1 font-display text-[17px] font-semibold">Plafonds de sécurité</h2>
          </div>
          <button onClick={saveLim} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] px-3 py-1.5 text-[12.5px] font-medium text-white"><Save className="h-3.5 w-3.5" /> Enregistrer</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Num label="Budget IA journalier global (USD)" value={limits.dailyGlobalUSD} onChange={(v) => setLimits({ ...limits, dailyGlobalUSD: v })} />
          <Num label="Budget par organisation / j (USD)" value={limits.perOrgUSD} onChange={(v) => setLimits({ ...limits, perOrgUSD: v })} />
          <Num label="Coût maximal d'un run (USD)" value={limits.maxRunUSD} onChange={(v) => setLimits({ ...limits, maxRunUSD: v })} step={0.1} />
          <Num label="Itérations agentiques max" value={limits.maxAgentIterations} onChange={(v) => setLimits({ ...limits, maxAgentIterations: v })} />
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: "warn" }) {
  const c = tone === "warn" ? "text-amber-300" : "text-white/70";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] ${c}`}><Icon className="h-4 w-4" /></span>
        <p className="text-[12px] text-white/60">{label}</p>
      </div>
      <p className="mt-2 font-display text-[20px] font-semibold">{value}</p>
    </div>
  );
}
function Num({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-white/50">{label}</span>
      <input type="number" step={step ?? 1} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] outline-none" />
    </label>
  );
}

import type React from "react";
// Router import placeholder to satisfy lucide alias usage
export const _unused = RouterIcon;