import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getOrganizations, PLANS, fmtMoney, fmtNum, fmtRelative, type OrgStatus, type OrgType, type RiskLevel } from "@/lib/admin-store";
import { StatusPill } from "./admin.index";
import { Search, Filter, Download } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/organizations")({
  head: () => ({ meta: [{ title: "Organisations — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: OrgsLayout,
});

function OrgsLayout() {
  const loc = useLocation();
  const showList = loc.pathname === "/admin/organizations" || loc.pathname === "/admin/organizations/";
  if (!showList) return <Outlet />;
  return <OrgsList />;
}

function OrgsList() {
  const orgs = getOrganizations();
  const [q, setQ] = useState("");
  const [type, setType] = useState<OrgType | "all">("all");
  const [status, setStatus] = useState<OrgStatus | "all">("all");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");

  const rows = useMemo(() => orgs.filter((o) =>
    (type === "all" || o.type === type) &&
    (status === "all" || o.status === status) &&
    (risk === "all" || o.risk === risk) &&
    (q === "" || o.name.toLowerCase().includes(q.toLowerCase()) || o.country.toLowerCase().includes(q.toLowerCase()))
  ), [orgs, q, type, status, risk]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Organisations</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold">Toutes les entreprises, agences et groupes</h1>
          <p className="mt-1 text-[13px] text-white/60">{rows.length} organisation{rows.length > 1 ? "s" : ""} · vue synthétique, données détaillées cloisonnées.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12.5px] hover:bg-white/[0.06]">
          <Download className="h-3.5 w-3.5" /> Exporter la liste
        </button>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-2 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-white/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, pays…)" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/40" />
          </div>
          <FilterSelect value={type} onChange={(v) => setType(v as any)} options={[["all", "Tous types"], ["entreprise", "Entreprise"], ["agence", "Agence"], ["groupe", "Groupe"]]} />
          <FilterSelect value={status} onChange={(v) => setStatus(v as any)} options={[["all", "Tous statuts"], ["active", "Active"], ["essai", "Essai"], ["suspendue", "Suspendue"], ["impayée", "Impayée"]]} />
          <FilterSelect value={risk} onChange={(v) => setRisk(v as any)} options={[["all", "Tous risques"], ["faible", "Faible"], ["moyen", "Moyen"], ["élevé", "Élevé"]]} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-[13px]">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-4 py-3">Nom</th><th>Type</th><th>Pays</th><th>Plan</th><th>Statut</th>
              <th>Membres</th><th>Comptes pub</th><th>Dépenses</th><th>IA ($)</th>
              <th>Inscrit</th><th>Activité</th><th>Risque</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3"><Link to="/admin/organizations/$id" params={{ id: o.id }} className="font-medium hover:text-[#ff8a3d]">{o.name}</Link></td>
                <td className="capitalize text-white/70">{o.type}</td>
                <td className="text-white/70">{o.country}</td>
                <td className="text-white/70">{PLANS.find((p) => p.id === o.plan)?.name}</td>
                <td><StatusPill s={o.status} /></td>
                <td className="text-white/70">{o.members}</td>
                <td className="text-white/70">{o.adAccounts}</td>
                <td className="text-white/80">{fmtMoney(o.adSpend, o.currency)}</td>
                <td className="text-white/70">{fmtNum(Math.round(o.aiSpend))}</td>
                <td className="text-white/50">{fmtRelative(o.createdAt)}</td>
                <td className="text-white/50">{fmtRelative(o.lastActive)}</td>
                <td><RiskPill r={o.risk} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-10 text-center text-white/50">Aucune organisation ne correspond à ces filtres.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
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

function RiskPill({ r }: { r: RiskLevel }) {
  const map: Record<string, string> = {
    "faible": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    "moyen": "bg-amber-500/15 text-amber-300 border-amber-500/25",
    "élevé": "bg-rose-500/15 text-rose-300 border-rose-500/25",
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[r]}`}>{r}</span>;
}
