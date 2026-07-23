import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getPlatformIncidents, savePlatformIncidents, fmtRelative, fmtMoney, logAudit, type PlatformIncident, type IncidentSev, type IncidentStatus } from "@/lib/admin-store";
import { AlertOctagon, Check } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/incidents")({
  head: () => ({ meta: [{ title: "Incidents — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: IncidentsPage,
});

const FLOW: IncidentStatus[] = ["détecté", "classifié", "kill_switch", "communiqué", "en_correction", "vérification", "résolu"];
const SEV_COLOR: Record<IncidentSev, string> = {
  "SEV-1": "border-rose-500/30 bg-rose-500/[0.08] text-rose-200",
  "SEV-2": "border-amber-500/30 bg-amber-500/[0.08] text-amber-200",
  "SEV-3": "border-yellow-500/25 bg-yellow-500/[0.06] text-yellow-200",
  "SEV-4": "border-white/15 bg-white/[0.05] text-white/70",
};

function IncidentsPage() {
  const [tick, setTick] = useState(0);
  const incidents = useMemo(() => getPlatformIncidents(), [tick]);
  const [sev, setSev] = useState<string>("all");

  const rows = incidents.filter((i) => sev === "all" || i.severity === sev);

  const advance = (i: PlatformIncident) => {
    const idx = FLOW.indexOf(i.status);
    const next = FLOW[Math.min(FLOW.length - 1, idx + 1)];
    const list = incidents.map((x) => x.id === i.id ? { ...x, status: next, resolvedAt: next === "résolu" ? new Date().toISOString() : x.resolvedAt } : x);
    savePlatformIncidents(list);
    logAudit({ actor: "operations_admin", action: `Incident ${i.id} → ${next}`, target: i.id });
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Incidents</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Problèmes techniques globaux</h1>
        <p className="mt-1 text-[13px] text-white/60">Classifiez, communiquez, corrigez et documentez.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {["all", "SEV-1", "SEV-2", "SEV-3", "SEV-4"].map((s) => (
          <button key={s} onClick={() => setSev(s)} className={`rounded-full border px-3 py-1 text-[12px] ${sev === s ? "border-[#ff8a3d] bg-[#ff8a3d]/10 text-[#ff8a3d]" : "border-white/10 bg-white/[0.04] text-white/70"}`}>{s === "all" ? "Tous" : s}</button>
        ))}
      </div>

      <FlowDiagram />

      <div className="grid gap-3">
        {rows.map((i) => (
          <div key={i.id} className={`rounded-2xl border p-4 ${SEV_COLOR[i.severity]}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SEV_COLOR[i.severity]}`}>{i.severity}</span>
                  <h3 className="font-display text-[15.5px] font-semibold text-white">{i.title}</h3>
                </div>
                <p className="mt-1 text-[12.5px] text-white/70">{i.id} · débuté {fmtRelative(i.startedAt)} {i.resolvedAt && `· résolu ${fmtRelative(i.resolvedAt)}`}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-0.5 text-[11.5px] font-medium capitalize text-white">{i.status.replace("_", " ")}</span>
                {i.status !== "résolu" && (
                  <button onClick={() => advance(i)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] px-3 py-1.5 text-[12px] font-medium text-white">
                    Avancer <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Services">{i.services.join(", ")}</Field>
              <Field label="Organisations touchées">{i.orgIdsAffected.length}</Field>
              <Field label="Actions exécutées">{i.actionsExecuted}</Field>
              <Field label="Dépenses concernées">{fmtMoney(i.potentialSpendUsd)}</Field>
              <Field label="Cause">{i.cause}</Field>
              <Field label="Résolution">{i.resolution}</Field>
              <Field label="Préventif">{i.preventive.join(", ")}</Field>
              <Field label="Post-mortem">{i.postMortem ?? "à publier"}</Field>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-white/50">Aucun incident.</p>}
      </div>
    </div>
  );
}

function FlowDiagram() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5"><AlertOctagon className="h-3.5 w-3.5" /> Flow incident standard</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
        {FLOW.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 capitalize text-white/80">{s.replace("_", " ")}</span>
            {i < FLOW.length - 1 && <span className="text-white/30">→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[10.5px] uppercase tracking-wider text-white/40">{label}</p><p className="mt-0.5 text-white/90">{children}</p></div>;
}

import type React from "react";