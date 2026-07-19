import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAgentRuns,
  STATE_LABELS,
  STATE_FLOW,
  type RunState,
} from "@/lib/agent-runs-store";
import { useNotifications } from "@/lib/notifications-store";
import { useNotificationsPush } from "@/lib/agent-runs-store";
import {
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Fingerprint,
  Radio,
  Eye,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/runs/$id")({
  head: () => ({ meta: [{ title: "Run — Orkestria" }] }),
  component: RunDetail,
});

function RunDetail() {
  const { id } = useParams({ from: "/app/runs/$id" });
  const { list, setState, appendEvent } = useAgentRuns();
  const qc = useQueryClient();
  const { push } = useNotificationsPush();
  const r = useMemo(() => list.find((x) => x.id === id), [list, id]);
  const [streaming, setStreaming] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => () => { esRef.current?.close(); }, []);

  const subscribeStream = () => {
    if (streaming || !r) return;
    setStreaming(true);
    esRef.current?.close();
    const es = new EventSource(`/api/runs/${r.id}/stream`);
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { type: string; ts?: number; nextState?: RunState; label?: string; text?: string };
        void qc.invalidateQueries({ queryKey: ["agent-runs"] });
        if (data.type === "run.completed") {
          es.close();
          setStreaming(false);
        }
      } catch {
        // ignore parse errors
      }
    };
    es.onerror = () => {
      es.close();
      setStreaming(false);
    };
  };

  if (!r) {
    return (
      <div className="mx-auto max-w-[900px]">
        <div className="rounded-2xl border border-line/70 bg-white p-10 text-center">
          <p className="text-[14px] text-ink-soft">Ce run est introuvable.</p>
          <Link to="/app/runs" className="mt-4 inline-flex chip-ghost">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
        </div>
      </div>
    );
  }

  const stepIndex = Math.max(0, STATE_FLOW.indexOf(r.state));

  const approve = () => {
    setState(r.id, "executing");
    appendEvent(r.id, { type: "action.executing", ts: Date.now(), actionId: "act_" + r.id });
    push({ kind: "approval", title: "Run approuvé", body: `« ${r.title} » — exécution en cours.` });
    setTimeout(() => {
      appendEvent(r.id, { type: "action.verified", ts: Date.now(), actionId: "act_" + r.id });
      setState(r.id, "monitoring");
    }, 1600);
  };

  const B = STATE_LABELS[r.state];

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link to="/app/runs" className="mb-4 inline-flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Tous les runs
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[22px] font-semibold text-ink">{r.title}</h2>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${B.c}`}>{B.l}</span>
          </div>
          <p className="mt-1 text-[13px] text-ink-soft">{r.goal}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> {r.skill}</span>
            <span className="inline-flex items-center gap-1"><Radio className="h-3 w-3" /> {r.tool}</span>
            <span className="inline-flex items-center gap-1"><Fingerprint className="h-3 w-3" /> {r.idempotencyKey}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={subscribeStream} className="chip-ghost" disabled={streaming}>
            <Play className="h-3.5 w-3.5" /> {streaming ? "Streaming…" : "Stream live"}
          </button>
          <button onClick={() => setState(r.id, "cancelled")} className="chip-ghost">
            <Pause className="h-3.5 w-3.5" /> Annuler
          </button>
          <button onClick={() => setState(r.id, "failed_recoverable")} className="chip-ghost">
            <RefreshCw className="h-3.5 w-3.5" /> Simuler incident
          </button>
          {r.state === "waiting_for_approval" && (
            <button onClick={approve} className="btn-primary">
              <CheckCircle2 className="h-4 w-4" /> Approuver
            </button>
          )}
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-line/70 bg-white p-6">
        <h3 className="mb-4 font-display text-[15px] font-semibold text-ink">Cycle d'exécution</h3>
        <ol className="grid grid-cols-2 gap-2 md:grid-cols-6">
          {STATE_FLOW.map((s, i) => {
            const done = i < stepIndex;
            const cur = i === stepIndex;
            return (
              <li key={s} className={`rounded-xl border px-2.5 py-2 text-[11px] ${cur ? "border-[#ff6c02] bg-[#fff6ee] text-ink" : done ? "border-line/60 bg-surface-2 text-ink-soft" : "border-line/40 text-ink-soft/70"}`}>
                <span className="block font-medium">{STATE_LABELS[s].l}</span>
                <span className="text-[10px]">{done ? "✓" : cur ? "en cours" : "à venir"}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-line/70 bg-white p-6">
          <h3 className="mb-4 flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
            <Radio className="h-4 w-4 text-[#ff6c02]" /> Flux d'événements (SSE)
          </h3>
          <ol className="space-y-2">
            {r.events.slice().reverse().map((e, i) => <EventRow key={i} e={e} />)}
          </ol>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line/70 bg-white p-5">
            <h4 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Eye className="h-4 w-4 text-[#ff6c02]" /> Ce que voit l'utilisateur
            </h4>
            <p className="text-[12px] text-ink-soft">
              Progression lisible sans détails techniques : prompts système, tokens, JSON bruts et identifiants internes restent masqués.
            </p>
          </div>
          <div className="rounded-2xl border border-line/70 bg-white p-5">
            <h4 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Reprise & idempotence
            </h4>
            <p className="text-[12px] text-ink-soft">
              Ce run peut reprendre après fermeture du navigateur, perte réseau ou redémarrage worker. La clé d'idempotence empêche toute double création.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EventRow({ e }: { e: StreamEvent }) {
  const t = new Date(e.ts).toLocaleTimeString("fr-FR");
  const styleFor = () => {
    switch (e.type) {
      case "run.started":
      case "run.completed":
        return { i: CheckCircle2, c: "text-emerald-600 bg-emerald-50" };
      case "warning":
        return { i: AlertTriangle, c: "text-amber-700 bg-amber-50" };
      case "error.recovered":
        return { i: RefreshCw, c: "text-orange-700 bg-orange-50" };
      case "approval.required":
      case "question.required":
        return { i: AlertTriangle, c: "text-[#ff6c02] bg-[#fff6ee]" };
      case "action.executing":
      case "action.verified":
        return { i: Play, c: "text-violet-700 bg-violet-50" };
      default:
        return { i: Info, c: "text-sky-700 bg-sky-50" };
    }
  };
  const S = styleFor();
  return (
    <li className="flex items-start gap-3 rounded-xl border border-line/60 px-3 py-2">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${S.c}`}>
        <S.i className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-ink">{renderLabel(e)}</p>
        <p className="text-[10px] text-ink-soft">{t} · <span className="font-mono">{e.type}</span></p>
      </div>
    </li>
  );
}

function renderLabel(e: StreamEvent): string {
  switch (e.type) {
    case "run.started": return "Run démarré";
    case "message.delta": return e.text;
    case "step.started": return `${e.label}…`;
    case "step.completed": return e.summary ? `${e.label} — ${e.summary}` : `${e.label} : terminé`;
    case "data.found": return `${e.label}${e.count !== undefined ? ` (${e.count})` : ""}`;
    case "artifact.preview": return `Prévisualisation prête (${e.artifactId})`;
    case "question.required": return "Une information est nécessaire";
    case "approval.required": return "Approbation requise avant exécution";
    case "action.executing": return "Action en cours d'exécution";
    case "action.verified": return "Action vérifiée avec succès";
    case "warning": return e.message;
    case "error.recovered": return e.message;
    case "run.completed": return e.summary;
  }
}