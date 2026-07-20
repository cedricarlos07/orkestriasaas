import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useAgentRuns,
  STATE_LABELS,
  type AgentRun,
  type RunState,
} from "@/lib/agent-runs-store";
import {
  Activity,
  ChevronRight,
  Fingerprint,
  Radio,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/runs")({
  head: () => ({ meta: [{ title: "Agent Runs — Orkestria" }] }),
  component: RunsPage,
});

function RunsPage() {
  const { list } = useAgentRuns();

  const kpis = [
    {
      label: "Runs actifs",
      value: String(list.filter((r) => !isTerminal(r.state)).length),
      grad: "from-[#fff1e2] via-[#ffe0c2] to-[#ffcf9c]",
      ic: "text-[#c94a00]",
      ring: "ring-[#ffd7ac]",
    },
    {
      label: "À approuver",
      value: String(list.filter((r) => r.state === "waiting_for_approval").length),
      grad: "from-[#ffe6ee] via-[#ffc7d8] to-[#ffa3bd]",
      ic: "text-[#9e1e4a]",
      ring: "ring-[#ffbfd1]",
    },
    {
      label: "Sous surveillance",
      value: String(list.filter((r) => r.state === "monitoring").length),
      grad: "from-[#e6f7ee] via-[#c9edd8] to-[#a9e0bf]",
      ic: "text-[#0f7a3c]",
      ring: "ring-[#b6e3c8]",
    },
    {
      label: "Récupération",
      value: String(list.filter((r) => r.state === "failed_recoverable").length),
      grad: "from-[#f0e6ff] via-[#dcc7ff] to-[#c2a3ff]",
      ic: "text-[#4a2a9e]",
      ring: "ring-[#dccdff]",
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="anim-fade-up mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white shadow-[0_12px_26px_-12px_rgba(255,108,2,0.65),inset_0_1px_0_rgba(255,255,255,0.35)]"
          >
            <Activity className="h-5 w-5" />
            <span className="absolute -inset-1 -z-10 rounded-3xl bg-[#ff6c02]/25 blur-xl anim-pulse-dot" />
          </span>
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wider text-[#c94a00]">Exécution agentique</p>
            <h1 className="mt-0.5 font-display text-[26px] font-semibold text-ink">Agent Runs</h1>
            <p className="text-[13px] text-ink-soft">
              Cycle d'exécution · reprise · idempotence · streaming SSE
            </p>
          </div>
        </div>
        <Link to="/app/orkestria" className="btn-primary btn-halo">
          <Activity className="h-4 w-4" /> Lancer via Orkestria
        </Link>
      </header>

      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      <section className="stagger mt-6 space-y-3">
        {list.length === 0 ? (
          <div className="rounded-2xl border border-line/70 bg-white p-10 text-center text-[13px] text-ink-soft">
            Aucun run pour le moment. Les exécutions agent apparaissent ici après une action réelle.
          </div>
        ) : (
          list.map((r) => <RunRow key={r.id} r={r} />)
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, grad, ic, ring }: { label: string; value: string; grad: string; ic: string; ring: string }) {
  return (
    <div
      className={`card-hover anim-fade-up relative overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br ${grad} p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(20,20,20,0.28)]`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.15 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/50 blur-xl" />
      <div className="relative">
        <span
          aria-hidden
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/85 ring-1 ${ring} ${ic} shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]`}
        >
          <Activity className="h-3.5 w-3.5" />
        </span>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</p>
        <p className={`mt-0.5 font-display text-[26px] font-semibold ${ic}`}>{value}</p>
      </div>
    </div>
  );
}

function isTerminal(s: RunState) {
  return ["completed", "failed_final", "cancelled", "expired"].includes(s);
}

function RunRow({ r }: { r: AgentRun }) {
  const B = STATE_LABELS[r.state];
  return (
    <Link
      to="/app/runs/$id"
      params={{ id: r.id }}
      className="card-hover anim-fade-up relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(20,20,20,0.22)]"
      style={{ backgroundImage: "linear-gradient(180deg,#ffffff 0%,#faf7f2 100%)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.15 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#ff8a2b] to-[#ff5e00] opacity-70" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[14px] font-semibold text-ink">{r.title}</p>
          <span className={`inline-flex rounded-full border border-white/70 px-2 py-0.5 text-[11px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${B.c}`}>{B.l}</span>
        </div>
        <p className="mt-1 truncate text-[12px] text-ink-soft">{r.goal}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="chip-ghost !gap-1 !px-2 !py-0.5 !text-[11px]"><ShieldCheck className="h-3 w-3" /> {r.skill}</span>
          <span className="chip-ghost !gap-1 !px-2 !py-0.5 !text-[11px]"><Radio className="h-3 w-3" /> {r.tool}</span>
          <span className="chip-ghost !gap-1 !px-2 !py-0.5 !text-[11px] font-mono"><Fingerprint className="h-3 w-3" /> {r.idempotencyKey}</span>
        </div>
      </div>
      <span aria-hidden className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/85 text-[#c94a00] ring-1 ring-[#ffd7ac] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
  );
}