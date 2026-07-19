import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getAdActions, getOrganizations, updateAdAction, logAudit, fmtMoney, fmtRelative, type AdActionStatus } from "@/lib/admin-store";
import { Search, Filter, ShieldOff, XCircle, RotateCcw, RefreshCw, Lock, AlertOctagon } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/actions")({
  head: () => ({ meta: [{ title: "Actions publicitaires — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: ActionsPage,
});

const STATUSES: AdActionStatus[] = ["proposée", "approuvée", "refusée", "en_cours", "exécutée", "vérifiée", "échouée", "annulée", "rollback"];

function ActionsPage() {
  const [tick, setTick] = useState(0);
  const actions = useMemo(() => getAdActions(), [tick]);
  const orgs = Object.fromEntries(getOrganizations().map((o) => [o.id, o.name]));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [st, setSt] = useState("all");

  const rows = useMemo(() => actions.filter((a) =>
    (cat === "all" || a.category === cat) &&
    (st === "all" || a.status === st) &&
    (q === "" || a.campaign.toLowerCase().includes(q.toLowerCase()) || (orgs[a.orgId] ?? "").toLowerCase().includes(q.toLowerCase()))
  ), [actions, q, cat, st, orgs]);

  const patch = (id: string, action: string, status: AdActionStatus) => {
    updateAdAction(id, { status });
    logAudit({ actor: "super_admin", action, target: id });
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Actions publicitaires</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Mutations proposées et exécutées</h1>
        <p className="mt-1 text-[13px] text-white/60">Le Super Admin n'approuve pas les dépenses d'un client à sa place, sauf procédure d'urgence.</p>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-2 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-white/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Campagne, organisation…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/40" />
          </div>
          <Sel value={cat} onChange={setCat} options={[["all", "Toutes catégories"], ["création_campagne", "Création campagne"], ["modification_budget", "Modif. budget"], ["pause", "Pause"], ["activation", "Activation"], ["création_annonce", "Création annonce"], ["changement_audience", "Chgmt audience"], ["ajout_mots_clés", "Ajout mots-clés"], ["réallocation_budget", "Réallocation"], ["remplacement_création", "Remplacement créa"]]} />
          <Sel value={st} onChange={setSt} options={[["all", "Tous statuts"], ...STATUSES.map((s) => [s, s.replace("_", " ")] as [string, string])]} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-[13px]">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-white/40">
            <tr><th className="px-4 py-3">Quand</th><th>Organisation</th><th>Plateforme</th><th>Campagne</th><th>Catégorie</th><th>Avant → Après</th><th>Montant</th><th>Initiateur</th><th>Policy</th><th>Approb.</th><th>Vérif.</th><th>Statut</th><th className="text-right pr-4">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-white/[0.03] align-top">
                <td className="px-4 py-2.5 text-white/60">{fmtRelative(a.at)}</td>
                <td className="font-medium">{orgs[a.orgId]}</td>
                <td className="text-white/70">{a.platform}</td>
                <td className="text-white/80">{a.campaign}</td>
                <td className="text-white/70 text-[11.5px] capitalize">{a.category.replace("_", " ")}</td>
                <td className="text-white/70 text-[12px]"><span className="text-white/50">{a.before}</span> → <span>{a.after}</span></td>
                <td className="text-white/80">{a.amount ? fmtMoney(a.amount) : "—"}</td>
                <td className="text-white/70 text-[12px]">{a.initiator}</td>
                <td className="text-white/60 text-[11.5px]">{a.policy}</td>
                <td className="text-white/60 text-[12px]">{a.approver ?? "—"}</td>
                <td><Tag t={a.verification === "ok" ? "ok" : a.verification === "échouée" ? "err" : "warn"}>{a.verification}</Tag></td>
                <td><StatusChip s={a.status} /></td>
                <td className="pr-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <IconBtn title="Bloquer" onClick={() => patch(a.id, "Action bloquée", "refusée")}><Lock className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Annuler" onClick={() => patch(a.id, "Action annulée", "annulée")}><XCircle className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Nouvelle vérification" onClick={() => patch(a.id, "Vérification forcée", a.status)}><RefreshCw className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Rollback" onClick={() => patch(a.id, "Rollback déclenché", "rollback")}><RotateCcw className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Lecture seule" onClick={() => patch(a.id, "Org placée en lecture seule", a.status)}><ShieldOff className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Ouvrir incident" onClick={() => patch(a.id, "Incident ouvert", a.status)} danger><AlertOctagon className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={13} className="px-4 py-10 text-center text-white/50">Aucune action.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusChip({ s }: { s: AdActionStatus }) {
  const map: Record<string, string> = {
    "proposée": "bg-white/[0.06] text-white/70 border-white/10",
    "approuvée": "bg-blue-500/15 text-blue-300 border-blue-500/25",
    "refusée": "bg-rose-500/15 text-rose-300 border-rose-500/25",
    "en_cours": "bg-amber-500/15 text-amber-300 border-amber-500/25",
    "exécutée": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    "vérifiée": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    "échouée": "bg-rose-500/15 text-rose-300 border-rose-500/25",
    "annulée": "bg-white/[0.06] text-white/50 border-white/10",
    "rollback": "bg-violet-500/15 text-violet-300 border-violet-500/25",
  };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[s]}`}>{s.replace("_", " ")}</span>;
}
function Tag({ t, children }: { t: "ok" | "warn" | "err"; children: React.ReactNode }) {
  const c = t === "ok" ? "bg-emerald-500/15 text-emerald-300" : t === "err" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${c}`}>{children}</span>;
}
function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return <button title={title} onClick={onClick} className={`grid h-7 w-7 place-items-center rounded-lg ${danger ? "text-rose-300 hover:bg-rose-500/15" : "text-white/60 hover:bg-white/[0.08] hover:text-white"}`}>{children}</button>;
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none rounded-full border border-white/10 bg-white/[0.04] py-2 pl-8 pr-8 text-[12.5px] text-white/80 outline-none hover:bg-white/[0.06]">
        {options.map(([v, l]) => <option key={v} value={v} className="bg-[#111114]">{l}</option>)}
      </select>
      <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
    </div>
  );
}

import type React from "react";