import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getFlags, saveFlags, logAudit, fmtRelative, type FeatureFlag, type FlagTarget } from "@/lib/admin-store";
import { Flag, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/flags")({
  head: () => ({ meta: [{ title: "Feature flags — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: FlagsPage,
});

const TARGET_TYPES: FlagTarget["type"][] = ["all", "country", "plan", "org", "user", "percent", "env"];

function FlagsPage() {
  const [tick, setTick] = useState(0);
  const flags = useMemo(() => getFlags(), [tick]);

  const patch = (id: string, p: Partial<FeatureFlag>) => {
    const list = flags.map((f) => f.id === id ? { ...f, ...p, updatedAt: new Date().toISOString() } : f);
    saveFlags(list);
    setTick((t) => t + 1);
  };

  const toggle = (f: FeatureFlag) => {
    patch(f.id, { enabled: !f.enabled });
    logAudit({ actor: "product_admin", action: `Flag ${!f.enabled ? "activé" : "désactivé"} : ${f.name}`, target: f.id });
  };
  const setRollout = (f: FeatureFlag, r: number) => {
    patch(f.id, { rollout: r });
    logAudit({ actor: "product_admin", action: `Rollout ${f.name} : ${r} %`, target: f.id });
  };
  const addTarget = (f: FeatureFlag) => patch(f.id, { targets: [...f.targets, { type: "country", value: "Sénégal" }] });
  const removeTarget = (f: FeatureFlag, i: number) => patch(f.id, { targets: f.targets.filter((_, k) => k !== i) });
  const updateTarget = (f: FeatureFlag, i: number, t: FlagTarget) => patch(f.id, { targets: f.targets.map((x, k) => k === i ? t : x) });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Feature flags</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Déploiement progressif des fonctionnalités</h1>
        <p className="mt-1 text-[13px] text-white/60">Évitez de livrer une fonctionnalité risquée à tous les utilisateurs d'un coup.</p>
      </header>

      <div className="grid gap-3">
        {flags.map((f) => (
          <div key={f.id} className={`rounded-2xl border p-4 ${f.enabled ? "border-white/10 bg-white/[0.03]" : "border-white/10 bg-white/[0.015]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06]"><Flag className="h-4 w-4 text-[#ff8a3d]" /></span>
                  <div>
                    <h3 className="font-display text-[15.5px] font-semibold">{f.name}</h3>
                    <p className="text-[12.5px] text-white/60">{f.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/70">env : {f.env}</span>
                <button onClick={() => toggle(f)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px]">
                  {f.enabled ? <ToggleRight className="h-4 w-4 text-emerald-300" /> : <ToggleLeft className="h-4 w-4 text-white/50" />}
                  {f.enabled ? "Activé" : "Désactivé"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr]">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/50">Rollout</p>
                <div className="mt-2 flex items-center gap-2">
                  <input type="range" min={0} max={100} value={f.rollout} onChange={(e) => setRollout(f, Number(e.target.value))} className="flex-1 accent-[#ff6c02]" />
                  <span className="w-10 text-right text-[12px] text-white/80">{f.rollout} %</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full bg-gradient-to-r from-[#ff8a2b] to-[#ff5e00]" style={{ width: `${f.rollout}%` }} /></div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-white/50">Ciblage</p>
                  <button onClick={() => addTarget(f)} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11.5px]"><Plus className="h-3 w-3" /> Ajouter</button>
                </div>
                <div className="mt-2 space-y-1.5">
                  {f.targets.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-1.5">
                      <select value={t.type} onChange={(e) => updateTarget(f, i, { ...t, type: e.target.value as FlagTarget["type"] })}
                        className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px]">
                        {TARGET_TYPES.map((tt) => <option key={tt} value={tt} className="bg-[#111114]">{tt}</option>)}
                      </select>
                      {t.type === "percent" ? (
                        <input type="number" min={0} max={100} value={t.percent ?? 0} onChange={(e) => updateTarget(f, i, { ...t, percent: Number(e.target.value) })}
                          className="w-24 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px]" />
                      ) : t.type === "all" ? (
                        <span className="text-[12px] text-white/60">tous les utilisateurs</span>
                      ) : (
                        <input value={t.value ?? ""} onChange={(e) => updateTarget(f, i, { ...t, value: e.target.value })}
                          placeholder={t.type === "country" ? "Sénégal" : t.type === "plan" ? "growth" : t.type === "env" ? "staging" : "id"}
                          className="flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px]" />
                      )}
                      <button onClick={() => removeTarget(f, i)} className="rounded-md p-1 text-white/50 hover:bg-white/[0.06] hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-white/40">Mis à jour {fmtRelative(f.updatedAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}