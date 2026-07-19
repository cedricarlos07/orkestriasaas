import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  getSkills, saveSkills, getOrchestratorPrompts, saveOrchestratorPrompts,
  logAudit, fmtRelative, type Skill,
} from "@/lib/admin-store";
import { Sparkles, PlayCircle, GitCompare, Rocket, Undo2, ToggleLeft, ToggleRight, Save, History } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/prompts")({
  head: () => ({ meta: [{ title: "Prompts & Skills — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: PromptsPage,
});

function PromptsPage() {
  const [tick, setTick] = useState(0);
  const skills = useMemo(() => getSkills(), [tick]);
  const orch = useMemo(() => getOrchestratorPrompts(), [tick]);
  const [selected, setSelected] = useState<Skill>(skills[0]);
  const [orchContent, setOrchContent] = useState(orch.find((o) => o.active)?.content ?? "");
  const [compareA, setCompareA] = useState(selected.versions[0]?.version);
  const [compareB, setCompareB] = useState(selected.versions[1]?.version ?? selected.versions[0]?.version);

  const refresh = () => setTick((t) => t + 1);
  const patch = (skill: Skill) => {
    const list = skills.map((s) => s.id === skill.id ? skill : s);
    saveSkills(list);
    setSelected(skill);
    refresh();
  };
  const toggleSkill = (s: Skill) => {
    const upd = { ...s, enabled: !s.enabled };
    patch(upd);
    logAudit({ actor: "product_admin", action: `Skill ${upd.enabled ? "activée" : "désactivée"} : ${s.name}`, target: s.id });
  };
  const deployVersion = (v: string) => {
    const upd = { ...selected, versions: selected.versions.map((x) => ({ ...x, active: x.version === v, deployedPct: x.version === v ? 100 : 0 })) };
    patch(upd);
    logAudit({ actor: "product_admin", action: `Déploiement ${selected.name} ${v}`, target: selected.id });
  };
  const restoreVersion = (v: string) => {
    deployVersion(v);
    logAudit({ actor: "product_admin", action: `Restauration ${selected.name} ${v}`, target: selected.id });
  };
  const testSandbox = () => logAudit({ actor: "product_admin", action: `Test sandbox lancé : ${selected.name}`, target: selected.id });

  const saveOrch = () => {
    const list = orch.map((o) => o.active ? { ...o, content: orchContent } : o);
    saveOrchestratorPrompts(list);
    logAudit({ actor: "product_admin", action: "Prompt orchestrateur mis à jour", target: "orchestrator" });
    refresh();
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Prompt & Skill management</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Contrôle produit & IA</h1>
        <p className="mt-1 text-[13px] text-white/60">Réservé aux équipes produit et IA — versions, tests, comparaisons, déploiement progressif.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Prompt système — orchestrateur</p>
            <h2 className="mt-1 font-display text-[17px] font-semibold">Version active {orch.find((o) => o.active)?.version}</h2>
          </div>
          <button onClick={saveOrch} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] px-3 py-1.5 text-[12.5px] font-medium"><Save className="h-3.5 w-3.5" /> Enregistrer</button>
        </div>
        <textarea value={orchContent} onChange={(e) => setOrchContent(e.target.value)} rows={5}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] p-3 font-mono text-[12.5px] outline-none" />
        <div className="mt-3 flex flex-wrap gap-2 text-[11.5px] text-white/60">
          {orch.map((o) => (
            <span key={o.version} className={`rounded-full border px-2 py-0.5 ${o.active ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.04]"}`}>
              {o.version} · {o.model} · {o.deployedPct}%
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Skills</p>
          <ul className="space-y-1">
            {skills.map((s) => (
              <li key={s.id}>
                <button onClick={() => { setSelected(s); setCompareA(s.versions[0]?.version); setCompareB(s.versions[1]?.version ?? s.versions[0]?.version); }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] ${selected.id === s.id ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/[0.05]"}`}>
                  <span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[#ff8a3d]" /> {s.name}</span>
                  <span className={`h-2 w-2 rounded-full ${s.enabled ? "bg-emerald-400" : "bg-white/30"}`} />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-[18px] font-semibold">{selected.name}</h3>
                <p className="text-[13px] text-white/60">{selected.description}</p>
              </div>
              <button onClick={() => toggleSkill(selected)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px]">
                {selected.enabled ? <ToggleRight className="h-4 w-4 text-emerald-300" /> : <ToggleLeft className="h-4 w-4 text-white/50" />}
                {selected.enabled ? "Activée" : "Désactivée"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Prompt système"><textarea value={selected.systemPrompt} onChange={(e) => patch({ ...selected, systemPrompt: e.target.value })} rows={4} className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-2.5 font-mono text-[12px] outline-none" /></Field>
              <Field label="Schéma de sortie"><textarea value={selected.outputSchema} onChange={(e) => patch({ ...selected, outputSchema: e.target.value })} rows={4} className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-2.5 font-mono text-[12px] outline-none" /></Field>
              <Field label="Règles de tool calling"><textarea value={selected.toolRules} onChange={(e) => patch({ ...selected, toolRules: e.target.value })} rows={3} className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-2.5 font-mono text-[12px] outline-none" /></Field>
              <Field label="Politique de sécurité"><textarea value={selected.safetyPolicy} onChange={(e) => patch({ ...selected, safetyPolicy: e.target.value })} rows={3} className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-2.5 font-mono text-[12px] outline-none" /></Field>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Info label="Outils autorisés">{selected.allowedTools.join(", ")}</Info>
              <Info label="Exemples">{selected.examples.length || "—"}</Info>
              <Info label="Tests">
                {selected.tests.map((t) => <span key={t.name} className={`mr-1 rounded-full px-2 py-0.5 text-[11px] ${t.status === "ok" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{t.status === "ok" ? "✓" : "✗"} {t.name}</span>)}
              </Info>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Btn onClick={testSandbox} icon={PlayCircle}>Tester en sandbox</Btn>
              <Btn onClick={() => logAudit({ actor: "product_admin", action: `Comparaison ${compareA} vs ${compareB}`, target: selected.id })} icon={GitCompare}>Comparer {compareA} ↔ {compareB}</Btn>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Versions</p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-wider text-white/40">
                  <tr><th className="py-2">Version</th><th>Modèle</th><th>Déploiement</th><th>Succès</th><th>Latence</th><th>Date</th><th>Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {selected.versions.map((v) => (
                    <tr key={v.version}>
                      <td className="py-2 font-medium">{v.version} {v.active && <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">active</span>}</td>
                      <td className="text-white/70">{v.model}</td>
                      <td className="text-white/70">{v.deployedPct} %</td>
                      <td className="text-white/70">{(v.successRate * 100).toFixed(0)} %</td>
                      <td className="text-white/70">{v.avgLatencyMs} ms</td>
                      <td className="text-white/50">{fmtRelative(v.createdAt)}</td>
                      <td className="space-x-1.5">
                        {!v.active && <button onClick={() => deployVersion(v.version)} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11.5px] hover:bg-white/[0.08] inline-flex items-center gap-1"><Rocket className="h-3 w-3" /> Déployer</button>}
                        {!v.active && <button onClick={() => restoreVersion(v.version)} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11.5px] hover:bg-white/[0.08] inline-flex items-center gap-1"><Undo2 className="h-3 w-3" /> Restaurer</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-white/60">
              <span>Comparer :</span>
              <select value={compareA} onChange={(e) => setCompareA(e.target.value)} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px]">{selected.versions.map((v) => <option key={v.version} value={v.version} className="bg-[#111114]">{v.version}</option>)}</select>
              <span>↔</span>
              <select value={compareB} onChange={(e) => setCompareB(e.target.value)} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px]">{selected.versions.map((v) => <option key={v.version} value={v.version} className="bg-[#111114]">{v.version}</option>)}</select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[11px] uppercase tracking-wider text-white/50">{label}</span><div className="mt-1">{children}</div></label>;
}
function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5"><p className="text-[10.5px] uppercase tracking-wider text-white/40">{label}</p><p className="mt-1 text-[12.5px] text-white/85">{children}</p></div>;
}
function Btn({ children, onClick, icon: Icon }: { children: React.ReactNode; onClick: () => void; icon: React.ComponentType<{ className?: string }> }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] hover:bg-white/[0.08]"><Icon className="h-3.5 w-3.5" /> {children}</button>;
}

import type React from "react";