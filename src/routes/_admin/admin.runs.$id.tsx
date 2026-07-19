import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getRun, updateRun, getOrganization, logAudit, fmtRelative } from "@/lib/admin-store";
import { ArrowLeft, StopCircle, RotateCw, RefreshCw, XCircle, AlertOctagon, LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/runs/$id")({
  head: () => ({ meta: [{ title: "Run — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: RunDetail,
});

function RunDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [tick, setTick] = useState(0);
  const run = getRun(id);
  if (!run) return <div className="text-white/60">Run introuvable.</div>;
  const org = getOrganization(run.orgId);

  const doAction = (action: string, patch: Parameters<typeof updateRun>[1] = {}) => {
    updateRun(run.id, patch);
    logAudit({ actor: "super_admin", action, target: run.id });
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-5">
      <Link to="/admin/runs" className="inline-flex items-center gap-2 text-[13px] text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" /> Tous les runs</Link>
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Run {run.id}</p>
        <h1 className="mt-1 font-display text-[24px] font-semibold">{run.goal}</h1>
        <p className="mt-1 text-[13px] text-white/60">{org?.name} · {run.user} · lancé {fmtRelative(run.startedAt)}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Plan opérationnel">
          <ol className="space-y-1.5 text-[13px] text-white/80">
            {run.plan.map((p, i) => <li key={i} className="flex gap-2"><span className="text-white/40">{i + 1}.</span> {p}</li>)}
          </ol>
        </Panel>
        <Panel title="Compétences & outils appelés">
          <div className="flex flex-wrap gap-1.5">
            {run.toolsCalled.map((t) => <span key={t} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11.5px] text-white/70">{t}</span>)}
          </div>
        </Panel>
        <Panel title="Événements (streaming)">
          <ul className="space-y-2">
            {run.events.map((e, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg bg-white/[0.02] p-2.5">
                <span className="rounded-full bg-[#ff8a3d]/20 px-2 py-0.5 text-[10.5px] font-semibold uppercase text-[#ff8a3d]">{e.kind}</span>
                <span className="flex-1 text-[12.5px] text-white/80">{e.message}</span>
                <span className="text-[11px] text-white/40">{fmtRelative(e.at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Décisions produites">
          <ul className="list-disc space-y-1 pl-4 text-[13px] text-white/80">{run.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </Panel>
        <Panel title="Approbations">
          <ul className="list-disc space-y-1 pl-4 text-[13px] text-white/80">{run.approvals.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </Panel>
        <Panel title="Erreurs">
          {run.errors.length === 0 ? <p className="text-[13px] text-white/50">Aucune erreur.</p> : <ul className="list-disc space-y-1 pl-4 text-[13px] text-rose-300">{run.errors.map((d, i) => <li key={i}>{d}</li>)}</ul>}
        </Panel>
        <Panel title="Vérifications finales">
          <ul className="list-disc space-y-1 pl-4 text-[13px] text-white/80">{run.verifications.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </Panel>
        <Panel title="Actions Super Admin">
          <div className="grid gap-2 sm:grid-cols-2">
            <AB icon={StopCircle} label="Arrêter le run" onClick={() => doAction("Arrêt du run", { state: "annulé" })} />
            <AB icon={RotateCw} label="Reprendre" onClick={() => doAction("Reprise du run", { state: "exécution" })} />
            <AB icon={RefreshCw} label="Relancer une étape" onClick={() => doAction("Relance d'étape", {})} />
            <AB icon={XCircle} label="Annuler actions restantes" danger onClick={() => doAction("Annulation actions restantes", { state: "partiellement_terminé" })} />
            <AB icon={AlertOctagon} label="Marquer comme incident" danger onClick={() => doAction("Marqué comme incident", {})} />
            <AB icon={LifeBuoy} label="Transmettre au support" onClick={() => doAction("Transmis au support technique", {})} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
function AB({ icon: Icon, label, onClick, danger }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12.5px] ${danger ? "border-rose-500/25 bg-rose-500/[0.06] text-rose-200 hover:bg-rose-500/[0.12]" : "border-white/10 bg-white/[0.04] text-white/90 hover:bg-white/[0.08]"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

import type React from "react";