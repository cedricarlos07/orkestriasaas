import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getApprovals, getOrganizations, fmtMoney, fmtDateShort, fmtPct, type ApprovalTrack } from "@/lib/admin-store";
import { Search, Filter, AlertTriangle, Clock } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/approvals")({
  head: () => ({ meta: [{ title: "Approbations — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: ApprovalsPage,
});

const TRACKS: ApprovalTrack[] = ["utilisateur", "agence", "client", "finance"];

function ApprovalsPage() {
  const approvals = getApprovals();
  const orgs = Object.fromEntries(getOrganizations().map((o) => [o.id, o.name]));
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("all");
  const [flag, setFlag] = useState("all"); // all | expirée | bloquée | montant_élevé | risque_critique

  const rows = useMemo(() => approvals.filter((a) => {
    if (track !== "all" && a.track !== track) return false;
    if (flag === "expirée" && a.status !== "expirée") return false;
    if (flag === "bloquée" && a.status !== "bloquée") return false;
    if (flag === "montant_élevé" && a.amount < 500_000) return false;
    if (flag === "risque_critique" && a.risk !== "élevé") return false;
    if (q && !a.label.toLowerCase().includes(q.toLowerCase()) && !(orgs[a.orgId] ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [approvals, q, track, flag, orgs]);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Approbations</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Actions en attente de validation</h1>
        <p className="mt-1 text-[13px] text-white/60">Vue centrale de toutes les décisions à prendre par les organisations.</p>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-2 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-white/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Action, organisation…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/40" />
          </div>
          <Sel value={track} onChange={setTrack} options={[["all", "Tous circuits"], ...TRACKS.map((t) => [t, `En attente ${t}`] as [string, string])]} />
          <Sel value={flag} onChange={setFlag} options={[["all", "Tous filtres"], ["expirée", "Expirées"], ["bloquée", "Bloquées"], ["montant_élevé", "Montant élevé"], ["risque_critique", "Risque critique"]]} />
        </div>
      </div>

      <div className="grid gap-3">
        {rows.map((a) => (
          <div key={a.id} className={`rounded-2xl border p-4 ${a.status === "bloquée" ? "border-rose-500/25 bg-rose-500/[0.05]" : a.status === "expirée" ? "border-amber-500/25 bg-amber-500/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-[15.5px] font-semibold">{a.label}</h3>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/70">{a.platform} · {a.campaign}</span>
                  <RiskChip r={a.risk} />
                </div>
                <p className="mt-1 text-[13px] text-white/70">{orgs[a.orgId]} · {a.reason}</p>
                <div className="mt-3 grid gap-2 text-[12.5px] sm:grid-cols-4">
                  <Field label="Montant">{fmtMoney(a.amount)}</Field>
                  <Field label="Impact estimé">{a.impactEstimated}</Field>
                  <Field label="Confiance">{fmtPct(a.confidence)}</Field>
                  <Field label="Expire le">{fmtDateShort(a.expiresAt)}</Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.requiredApprovers.map((r) => <span key={r} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/70">Requis : {r}</span>)}
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/70 capitalize">Circuit : {a.track}</span>
                </div>
                {a.issues.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {a.issues.map((i) => (
                      <li key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2 py-0.5 text-[11.5px] text-rose-300 mr-1.5"><AlertTriangle className="h-3 w-3" /> {i}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusChip s={a.status} />
                <span className="inline-flex items-center gap-1 text-[11px] text-white/50"><Clock className="h-3 w-3" /> {a.id}</span>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-white/50">Aucune approbation.</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[10.5px] uppercase tracking-wider text-white/40">{label}</p><p className="mt-0.5 text-white/90">{children}</p></div>;
}
function RiskChip({ r }: { r: string }) {
  const map: Record<string, string> = { faible: "bg-emerald-500/15 text-emerald-300", moyen: "bg-amber-500/15 text-amber-300", "élevé": "bg-rose-500/15 text-rose-300" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${map[r]}`}>Risque {r}</span>;
}
function StatusChip({ s }: { s: string }) {
  const map: Record<string, string> = { en_attente: "bg-amber-500/15 text-amber-300 border-amber-500/25", "expirée": "bg-rose-500/15 text-rose-300 border-rose-500/25", "bloquée": "bg-rose-500/15 text-rose-300 border-rose-500/25" };
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium capitalize ${map[s]}`}>{s.replace("_", " ")}</span>;
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