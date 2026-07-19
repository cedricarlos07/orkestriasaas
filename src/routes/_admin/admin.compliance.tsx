import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getComplianceEvents, getOrganizations, fmtRelative, logAudit, type ComplianceEvent } from "@/lib/admin-store";
import { Search, Filter, Download, FileText } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/compliance")({
  head: () => ({ meta: [{ title: "Audit & conformité — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: CompliancePage,
});

const KINDS = ["connexion", "modification_rôle", "accès_support", "changement_abonnement", "action_publicitaire", "modification_policy", "suspension", "export", "suppression", "changement_prompt", "activation_flag"];

function CompliancePage() {
  const events = useMemo(() => getComplianceEvents(), []);
  const orgs = useMemo(() => getOrganizations(), []);
  const [q, setQ] = useState("");
  const [org, setOrg] = useState("all");
  const [kind, setKind] = useState("all");
  const [risk, setRisk] = useState("all");
  const [platform, setPlatform] = useState("all");

  const rows = events.filter((e) => {
    if (org !== "all" && e.orgId !== org) return false;
    if (kind !== "all" && e.kind !== kind) return false;
    if (risk !== "all" && e.risk !== risk) return false;
    if (platform !== "all" && e.platform !== platform) return false;
    if (q && !e.actor.toLowerCase().includes(q.toLowerCase()) && !e.target.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const exportFn = (fmt: string) => {
    if (fmt === "csv") {
      const csv = ["id,at,actor,kind,target,risk,platform", ...rows.map((r) => `${r.id},${r.at},${r.actor},${r.kind},${r.target},${r.risk},${r.platform}`)].join("\n");
      download(`audit-${Date.now()}.csv`, csv, "text/csv");
    } else if (fmt === "json") {
      download(`audit-${Date.now()}.json`, JSON.stringify(rows, null, 2), "application/json");
    } else if (fmt === "pdf") {
      const w = window.open("", "_blank"); if (!w) return;
      w.document.write(`<html><head><title>Audit</title></head><body><h1>Audit Orkestria</h1><table border=1 cellpadding=6><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Cible</th><th>Risque</th></tr>${rows.map((r) => `<tr><td>${new Date(r.at).toLocaleString("fr-FR")}</td><td>${r.actor}</td><td>${r.kind}</td><td>${r.target}</td><td>${r.risk}</td></tr>`).join("")}</table></body></html>`);
      w.document.close(); w.print();
    }
    logAudit({ actor: "security_admin", action: `Export audit ${fmt.toUpperCase()}`, target: "compliance" });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Audit & conformité</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold">Historique immuable des actions sensibles</h1>
          <p className="mt-1 text-[13px] text-white/60">{events.length} événements — filtres et exports pour auditeurs externes.</p>
        </div>
        <div className="flex gap-1.5">
          <ExportBtn onClick={() => exportFn("csv")}>CSV</ExportBtn>
          <ExportBtn onClick={() => exportFn("json")}>JSON</ExportBtn>
          <ExportBtn onClick={() => exportFn("pdf")} primary>Rapport PDF</ExportBtn>
        </div>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-2 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-white/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Acteur, cible…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/40" />
          </div>
          <Sel value={org} onChange={setOrg} options={[["all", "Toutes orgs"], ...orgs.map((o) => [o.id, o.name] as [string, string])]} />
          <Sel value={kind} onChange={setKind} options={[["all", "Toutes actions"], ...KINDS.map((k) => [k, k.replace("_", " ")] as [string, string])]} />
          <Sel value={risk} onChange={setRisk} options={[["all", "Tous risques"], ["faible", "faible"], ["moyen", "moyen"], ["élevé", "élevé"]]} />
          <Sel value={platform} onChange={setPlatform} options={[["all", "Toutes plateformes"], ["Meta", "Meta"], ["Google", "Google"], ["TikTok", "TikTok"], ["Interne", "Interne"]]} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-[13px]">
          <thead className="bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-white/40">
            <tr><th className="px-4 py-3">Horodatage</th><th>Acteur</th><th>Action</th><th>Cible</th><th>Plateforme</th><th>Risque</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((r: ComplianceEvent) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-white/70">{fmtRelative(r.at)}</td>
                <td className="text-white/85">{r.actor}</td>
                <td className="text-white/90">{r.kind.replace("_", " ")}</td>
                <td className="text-white/70">{r.target}</td>
                <td className="text-white/60">{r.platform}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${r.risk === "élevé" ? "bg-rose-500/15 text-rose-300" : r.risk === "moyen" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>{r.risk}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function download(name: string, data: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none rounded-full border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-[12.5px] text-white/80 outline-none">{options.map(([v, l]) => <option key={v} value={v} className="bg-[#111114]">{l}</option>)}</select>
      <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
    </div>
  );
}
function ExportBtn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  const c = primary ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white" : "border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]";
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] ${c}`}>{primary ? <FileText className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />} {children}</button>;
}

import type React from "react";