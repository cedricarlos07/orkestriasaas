import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getRuns, getOrganizations, fmtRelative, type RunState } from "@/lib/admin-store";
import { Zap, Search, Filter } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/runs")({
  head: () => ({ meta: [{ title: "Agent Runs — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: RunsPage,
});

const STATES: RunState[] = ["planification", "collecte", "attente_utilisateur", "attente_approbation", "exécution", "vérification", "terminé", "partiellement_terminé", "échoué", "annulé"];

function RunsPage() {
  const runs = getRuns();
  const orgs = Object.fromEntries(getOrganizations().map((o) => [o.id, o.name]));
  const [q, setQ] = useState("");
  const [state, setState] = useState<string>("all");
  const [risk, setRisk] = useState<string>("all");

  const rows = useMemo(() => runs.filter((r) =>
    (state === "all" || r.state === state) &&
    (risk === "all" || r.risk === risk) &&
    (q === "" || r.goal.toLowerCase().includes(q.toLowerCase()) || (orgs[r.orgId] ?? "").toLowerCase().includes(q.toLowerCase()) || r.user.toLowerCase().includes(q.toLowerCase()))
  ), [runs, q, state, risk, orgs]);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Agent Runs</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Workflows exécutés par Orkestria</h1>
        <p className="mt-1 text-[13px] text-white/60">Trace opérationnelle structurée. Le raisonnement privé du modèle n'est pas exposé.</p>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-2 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-white/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Objectif, organisation, utilisateur…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/40" />
          </div>
          <Sel value={state} onChange={setState} options={[["all", "Tous états"], ...STATES.map((s) => [s, s.replace("_", " ")] as [string, string])]} />
          <Sel value={risk} onChange={setRisk} options={[["all", "Tous risques"], ["faible", "Faible"], ["moyen", "Moyen"], ["élevé", "Élevé"]]} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-[13px]">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-white/40">
            <tr><th className="px-4 py-3">Run</th><th>Objectif</th><th>Organisation</th><th>Utilisateur</th><th>État</th><th>Durée</th><th>Modèle</th><th>Outils</th><th>Actions</th><th>Coût</th><th>Risque</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-2.5"><Link to="/admin/runs/$id" params={{ id: r.id }} className="font-mono text-[12px] text-[#ff8a3d] hover:underline">{r.id}</Link></td>
                <td className="max-w-[220px] truncate">{r.goal}</td>
                <td className="text-white/70">{orgs[r.orgId]}</td>
                <td className="text-white/70">{r.user}</td>
                <td><StateChip s={r.state} /></td>
                <td className="text-white/70">{r.durationSec}s</td>
                <td className="text-white/50 text-[11.5px]">{r.model}</td>
                <td className="text-white/50 text-[11.5px]">{r.toolsCalled.length}</td>
                <td className="text-white/80">{r.actions}</td>
                <td className="text-white/80">${r.costUSD.toFixed(2)}</td>
                <td><RiskChip r={r.risk} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-white/50">Aucun run.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StateChip({ s }: { s: RunState }) {
  const map: Partial<Record<RunState, string>> = {
    "terminé": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    "exécution": "bg-blue-500/15 text-blue-300 border-blue-500/25",
    "planification": "bg-white/[0.06] text-white/70 border-white/10",
    "collecte": "bg-white/[0.06] text-white/70 border-white/10",
    "attente_utilisateur": "bg-amber-500/15 text-amber-300 border-amber-500/25",
    "attente_approbation": "bg-amber-500/15 text-amber-300 border-amber-500/25",
    "vérification": "bg-violet-500/15 text-violet-300 border-violet-500/25",
    "partiellement_terminé": "bg-amber-500/15 text-amber-300 border-amber-500/25",
    "échoué": "bg-rose-500/15 text-rose-300 border-rose-500/25",
    "annulé": "bg-white/[0.06] text-white/50 border-white/10",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[s]}`}><Zap className="h-3 w-3" /> {s.replace("_", " ")}</span>;
}
function RiskChip({ r }: { r: string }) {
  const map: Record<string, string> = { faible: "bg-emerald-500/15 text-emerald-300", moyen: "bg-amber-500/15 text-amber-300", "élevé": "bg-rose-500/15 text-rose-300" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${map[r]}`}>{r}</span>;
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-white/10 bg-white/[0.04] py-2 pl-8 pr-8 text-[12.5px] text-white/80 outline-none hover:bg-white/[0.06]">
        {options.map(([v, l]) => <option key={v} value={v} className="bg-[#111114]">{l}</option>)}
      </select>
      <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
    </div>
  );
}