import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  getUsage, getOrganizations, getMetricDefs, patchQuotaOverride, getQuotaOverrides,
  logAudit, fmtNum, fmtMoney, planLabel, type UsageMetricId,
} from "@/lib/admin-store";
import { Search, AlertTriangle, TrendingUp, Gauge, ShieldOff, ArrowUpCircle, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/usage")({
  head: () => ({ meta: [{ title: "Plans, quotas & consommation — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: UsagePage,
});

function UsagePage() {
  const [tick, setTick] = useState(0);
  const usage = useMemo(() => getUsage(), []);
  const orgs = useMemo(() => Object.fromEntries(getOrganizations().map((o) => [o.id, o])), []);
  const overrides = useMemo(() => getQuotaOverrides(), [tick]);
  const [q, setQ] = useState("");
  const [flag, setFlag] = useState<"all" | "close" | "over" | "abuse" | "cost">("all");
  const [metric, setMetric] = useState<UsageMetricId | "all">("all");

  const rows = useMemo(() => usage.filter((u) => {
    const org = orgs[u.orgId];
    if (!org) return false;
    if (q && !org.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (flag === "close" && !u.metrics.some((m) => m.used > m.quota * 0.85 && m.used <= m.quota)) return false;
    if (flag === "over" && !u.metrics.some((m) => m.used > m.quota)) return false;
    if (flag === "abuse" && u.anomalies.length === 0) return false;
    if (flag === "cost" && u.monthlyCostUsd * 100 <= u.planCostUsdCents) return false;
    return true;
  }), [usage, orgs, q, flag]);

  const totals = useMemo(() => {
    const t = { close: 0, over: 0, abuse: 0, costOver: 0 };
    usage.forEach((u) => {
      if (u.metrics.some((m) => m.used > m.quota * 0.85 && m.used <= m.quota)) t.close++;
      if (u.metrics.some((m) => m.used > m.quota)) t.over++;
      if (u.anomalies.length > 0) t.abuse++;
      if (u.monthlyCostUsd * 100 > u.planCostUsdCents) t.costOver++;
    });
    return t;
  }, [usage]);

  const grantQuota = (orgId: string) => {
    patchQuotaOverride(orgId, { tempExtraPct: 20 });
    logAudit({ actor: "super_admin", action: "Quota temporaire +20 %", target: orgId, reason: "Consommation proche de la limite" });
    setTick((t) => t + 1);
  };
  const limitWorkspace = (orgId: string) => {
    patchQuotaOverride(orgId, { workspaceLimited: true });
    logAudit({ actor: "super_admin", action: "Workspace limité", target: orgId });
    setTick((t) => t + 1);
  };
  const disableCostly = (orgId: string) => {
    patchQuotaOverride(orgId, { disabledFeatures: ["rendu_video", "poster_render_hd"] });
    logAudit({ actor: "super_admin", action: "Fonctionnalités coûteuses désactivées", target: orgId });
    setTick((t) => t + 1);
  };
  const changeRoute = (orgId: string) => {
    patchQuotaOverride(orgId, { modelRoute: "économique" });
    logAudit({ actor: "super_admin", action: "Routage modèle → économique", target: orgId });
    setTick((t) => t + 1);
  };
  const upsell = (orgId: string) => {
    patchQuotaOverride(orgId, { upsellSuggested: true });
    logAudit({ actor: "super_admin", action: "Montée en gamme proposée", target: orgId });
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Plans, quotas & consommation</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Usage réel par organisation</h1>
        <p className="mt-1 text-[13px] text-white/60">Séparé de la facturation. Suivez la consommation, détectez les abus et agissez.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Gauge} label="Proches de la limite" value={totals.close} tone="warn" />
        <Kpi icon={AlertTriangle} label="Quota dépassé" value={totals.over} tone="danger" />
        <Kpi icon={TrendingUp} label="Consommation anormale" value={totals.abuse} tone="warn" />
        <Kpi icon={ArrowUpCircle} label="Coût > abonnement" value={totals.costOver} tone="danger" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-2 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-white/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Organisation…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/40" />
          </div>
          <Sel value={flag} onChange={(v) => setFlag(v as typeof flag)} options={[["all", "Toutes"], ["close", "Proches limite"], ["over", "Dépassements"], ["abuse", "Abus détectés"], ["cost", "Coût > plan"]]} />
          <Sel value={metric} onChange={(v) => setMetric(v as typeof metric)} options={[["all", "Toutes métriques"], ...getMetricDefs().map((m) => [m.id, m.label] as [string, string])]} />
        </div>
      </div>

      <div className="grid gap-3">
        {rows.map((u) => {
          const org = orgs[u.orgId];
          const ov = overrides[u.orgId];
          const metrics = metric === "all" ? u.metrics : u.metrics.filter((m) => m.id === metric);
          const costOver = u.monthlyCostUsd * 100 > u.planCostUsdCents;
          return (
            <div key={u.orgId} className={`rounded-2xl border p-4 ${costOver ? "border-rose-500/25 bg-rose-500/[0.04]" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-[15.5px] font-semibold">{org.name}</h3>
                  <p className="text-[12.5px] text-white/60">{planLabel(org.plan)} · {org.country} · {org.workspaces} workspaces</p>
                </div>
                <div className="text-right text-[12.5px]">
                  <p className="text-white/50">Coût IA mensuel (DeepSeek)</p>
                  <p className={`font-medium ${costOver ? "text-rose-300" : "text-white/90"}`}>{fmtMoney(u.monthlyCostUsd)} <span className="text-white/40">/ {fmtMoney(u.planCostUsdCents, "plan")}</span></p>
                </div>
              </div>

              {u.anomalies.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {u.anomalies.map((a) => (
                    <li key={a} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300"><AlertTriangle className="h-3 w-3" /> {a}</li>
                  ))}
                </ul>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.map((m) => {
                  const pct = m.quota > 0 ? Math.min(1.2, m.used / m.quota) : 0;
                  const over = m.used > m.quota;
                  const close = !over && pct > 0.85;
                  return (
                    <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-white/70">{m.label}</span>
                        <span className={over ? "text-rose-300" : close ? "text-amber-300" : "text-white/60"}>{fmtNum(m.used)} / {fmtNum(m.quota)} {m.unit}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className={`h-full rounded-full ${over ? "bg-rose-400" : close ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {ov && (
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-white/60">
                  {ov.tempExtraPct && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-300">+{ov.tempExtraPct} % quota temporaire</span>}
                  {ov.workspaceLimited && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300">Workspace limité</span>}
                  {ov.disabledFeatures && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-300">Fonctions désactivées : {ov.disabledFeatures.join(", ")}</span>}
                  {ov.modelRoute && <span className="rounded-full bg-white/[0.06] px-2 py-0.5">Routage : {ov.modelRoute}</span>}
                  {ov.upsellSuggested && <span className="rounded-full bg-[#ff8a3d]/15 px-2 py-0.5 text-[#ff8a3d]">Upsell proposé</span>}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Btn onClick={() => grantQuota(u.orgId)} icon={ArrowUpCircle}>Quota +20 %</Btn>
                <Btn onClick={() => limitWorkspace(u.orgId)} icon={ShieldOff}>Limiter workspace</Btn>
                <Btn onClick={() => disableCostly(u.orgId)} icon={ShieldOff} danger>Désactiver fonctions coûteuses</Btn>
                <Btn onClick={() => changeRoute(u.orgId)} icon={Wand2}>Routage économique</Btn>
                <Btn onClick={() => upsell(u.orgId)} icon={TrendingUp} primary>Proposer montée en gamme</Btn>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-white/50">Aucun résultat.</p>}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: "warn" | "danger" }) {
  const c = tone === "warn" ? "text-amber-300" : "text-rose-300";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] ${c}`}><Icon className="h-4 w-4" /></span>
        <p className="text-[12px] text-white/60">{label}</p>
      </div>
      <p className="mt-2 font-display text-[24px] font-semibold">{value}</p>
    </div>
  );
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[12.5px] text-white/80 outline-none hover:bg-white/[0.06]">
      {options.map(([v, l]) => <option key={v} value={v} className="bg-[#111114]">{l}</option>)}
    </select>
  );
}
function Btn({ children, onClick, icon: Icon, danger, primary }: { children: React.ReactNode; onClick: () => void; icon: React.ComponentType<{ className?: string }>; danger?: boolean; primary?: boolean }) {
  const c = primary
    ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white"
    : danger
    ? "border border-rose-500/25 bg-rose-500/[0.06] text-rose-200 hover:bg-rose-500/[0.12]"
    : "border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]";
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] ${c}`}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

import type React from "react";