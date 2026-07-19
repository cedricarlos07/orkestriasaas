import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { POLICY_TEMPLATES, getGlobalPolicy, saveGlobalPolicy, logAudit, fmtMoney } from "@/lib/admin-store";
import { Shield, Check, Save, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/policies")({
  head: () => ({ meta: [{ title: "Policies & autonomie — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: PoliciesPage,
});

function PoliciesPage() {
  const [policy, setPolicy] = useState(getGlobalPolicy());
  const [saved, setSaved] = useState(false);

  const save = () => {
    saveGlobalPolicy(policy);
    logAudit({ actor: "super_admin", action: "Mise à jour policies globales", target: "global" });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const addToList = (key: "forbiddenActions" | "alwaysApprove" | "regulatedSectors" | "rollbackRules", value: string) => {
    if (!value.trim()) return;
    setPolicy({ ...policy, [key]: [...policy[key], value.trim()] });
  };
  const removeFromList = (key: "forbiddenActions" | "alwaysApprove" | "regulatedSectors" | "rollbackRules", i: number) => {
    setPolicy({ ...policy, [key]: policy[key].filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Policies & autonomie</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold">Règles globales de la plateforme</h1>
          <p className="mt-1 text-[13px] text-white/60">Une organisation peut être plus stricte, jamais moins stricte que ces règles.</p>
        </div>
        <button onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] px-4 py-2 text-[13px] font-medium text-white shadow-[0_6px_20px_-6px_rgba(255,108,2,0.7)]">
          <Save className="h-4 w-4" /> {saved ? "Enregistré ✓" : "Enregistrer les règles"}
        </button>
      </header>

      <section>
        <h2 className="mb-3 font-display text-[17px] font-semibold">Modèles d'autonomie disponibles</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {POLICY_TEMPLATES.map((t) => (
            <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-[#ff8a3d]" /><h3 className="font-display text-[15px] font-semibold">{t.name}</h3></div>
              <p className="mt-1 text-[12.5px] text-white/60">{t.description}</p>
              <ul className="mt-3 space-y-1">{t.features.map((f) => <li key={f} className="flex items-start gap-1.5 text-[12.5px] text-white/80"><Check className="mt-0.5 h-3 w-3 text-emerald-400" /> {f}</li>)}</ul>
              <p className="mt-3 rounded-lg bg-white/[0.04] px-2 py-1.5 text-[11.5px] text-white/60">{t.caps}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Limites financières">
          <NumField label="Plafond journalier par offre (XOF)" value={policy.maxDailyBudgetXOF} onChange={(v) => setPolicy({ ...policy, maxDailyBudgetXOF: v })} />
          <p className="text-[11px] text-white/40">Actuel : {fmtMoney(policy.maxDailyBudgetXOF)}</p>
          <NumField label="Plafond mensuel (XOF)" value={policy.monthlySpendCapXOF} onChange={(v) => setPolicy({ ...policy, monthlySpendCapXOF: v })} />
          <p className="text-[11px] text-white/40">Actuel : {fmtMoney(policy.monthlySpendCapXOF)}</p>
        </Card>

        <ListCard title="Actions interdites globalement" items={policy.forbiddenActions} onAdd={(v) => addToList("forbiddenActions", v)} onRemove={(i) => removeFromList("forbiddenActions", i)} placeholder="Ex. Ciblage < 18 ans" />
        <ListCard title="Toujours nécessitent une approbation" items={policy.alwaysApprove} onAdd={(v) => addToList("alwaysApprove", v)} onRemove={(i) => removeFromList("alwaysApprove", i)} placeholder="Ex. Modification budget > 20%" />
        <ListCard title="Secteurs réglementés" items={policy.regulatedSectors} onAdd={(v) => addToList("regulatedSectors", v)} onRemove={(i) => removeFromList("regulatedSectors", i)} placeholder="Ex. Santé" />
        <ListCard title="Règles de rollback" items={policy.rollbackRules} onAdd={(v) => addToList("rollbackRules", v)} onRemove={(i) => removeFromList("rollbackRules", i)} placeholder="Ex. Rollback auto si CPA x2 en 24 h" />

        <Card title="Règles par pays">
          <ul className="space-y-2">
            {policy.countryRules.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                <div className="text-[12.5px]"><span className="font-medium">{c.country}</span> <span className="text-white/60">— {c.rule}</span></div>
                <button onClick={() => setPolicy({ ...policy, countryRules: policy.countryRules.filter((_, j) => j !== i) })} className="text-white/40 hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
          <CountryAdd onAdd={(country, rule) => setPolicy({ ...policy, countryRules: [...policy.countryRules, { country, rule }] })} />
        </Card>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{title}</p><div className="mt-3 space-y-2.5">{children}</div></div>;
}
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <label className="block"><span className="mb-1 block text-[12px] text-white/70">{label}</span><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] outline-none" /></label>;
}
function ListCard({ title, items, onAdd, onRemove, placeholder }: { title: string; items: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <Card title={title}>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
            <span className="text-[12.5px] text-white/80">{it}</span>
            <button onClick={() => onRemove(i)} className="text-white/40 hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] outline-none" />
        <button onClick={() => { onAdd(v); setV(""); }} className="rounded-lg bg-white/[0.08] px-3 text-[12.5px] hover:bg-white/[0.12]"><Plus className="h-3.5 w-3.5" /></button>
      </div>
    </Card>
  );
}
function CountryAdd({ onAdd }: { onAdd: (country: string, rule: string) => void }) {
  const [c, setC] = useState(""); const [r, setR] = useState("");
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
      <input value={c} onChange={(e) => setC(e.target.value)} placeholder="Pays" className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px]" />
      <input value={r} onChange={(e) => setR(e.target.value)} placeholder="Règle" className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px]" />
      <button onClick={() => { if (c && r) { onAdd(c, r); setC(""); setR(""); } }} className="rounded-lg bg-white/[0.08] px-3 text-[12.5px] hover:bg-white/[0.12]"><Plus className="h-3.5 w-3.5" /></button>
    </div>
  );
}

import type React from "react";