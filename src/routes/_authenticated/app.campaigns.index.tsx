import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CampaignsShell } from "./app.campaigns";
import { CheckCircle2, PauseCircle, AlertTriangle, Search, Copy, Play, Pause, Loader2 } from "lucide-react";
import { useCampaigns, type CampaignStatus } from "@/lib/campaigns-store";
import { useNotifications } from "@/lib/notifications-store";
import { syncCampaignsFromMeta } from "@/functions/campaigns";

export const Route = createFileRoute("/_authenticated/app/campaigns/")({ component: List });

const FILTERS: { id: "all" | CampaignStatus; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "draft", label: "Brouillons" },
  { id: "paused", label: "En pause" },
  { id: "live", label: "En diffusion" },
];

const badge = {
  live: { c: "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 ring-emerald-200/70", i: CheckCircle2, l: "Live" },
  paused: { c: "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700 ring-amber-200/70", i: PauseCircle, l: "En pause" },
  draft: { c: "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 ring-slate-300/70", i: AlertTriangle, l: "Brouillon" },
};

const CHANNEL_STYLE: Record<string, { grad: string; ic: string; ring: string }> = {
  Meta: { grad: "from-[#eaf0ff] to-[#d5e0ff]", ic: "text-[#1e40af]", ring: "ring-[#c7d4ff]" },
  Google: { grad: "from-[#e6f7ee] to-[#c9edd8]", ic: "text-[#0f7a3c]", ring: "ring-[#b6e3c8]" },
  TikTok: { grad: "from-[#ffe6ee] to-[#ffc7d8]", ic: "text-[#9e1e4a]", ring: "ring-[#ffbfd1]" },
};

function List() {
  const { list, duplicate, setStatus, isLoading, syncMeta } = useCampaigns();
  const { push } = useNotifications();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void (async () => {
      setSyncing(true);
      try {
        await syncMeta();
      } finally {
        setSyncing(false);
      }
    })();
  }, [syncMeta]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (needle && !c.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [list, q, filter]);

  const counts = useMemo(() => ({
    all: list.length,
    draft: list.filter((c) => c.status === "draft").length,
    paused: list.filter((c) => c.status === "paused").length,
    live: list.filter((c) => c.status === "live").length,
  }), [list]);

  const onDuplicate = (id: string, name: string) => {
    const copy = duplicate(id);
    if (copy) {
      push({
        kind: "approval",
        title: "Brouillon créé — à approuver",
        body: `« ${copy.name} » est prête à être ajustée (budget / zone) puis approuvée.`,
      });
    }
    return copy;
  };

  const onToggleStatus = (id: string, name: string, current: CampaignStatus) => {
    const next: CampaignStatus = current === "live" ? "paused" : "live";
    setStatus(id, next);
    push({
      kind: "status",
      title: next === "live" ? "Campagne activée" : "Campagne mise en pause",
      body: `« ${name} » est passée en ${next === "live" ? "diffusion" : "pause"}.`,
    });
  };

  return (
    <CampaignsShell>
      <div className="anim-fade-up mb-4 flex flex-wrap items-center gap-3">
        {syncing && (
          <span className="flex items-center gap-2 text-[12px] text-ink-soft">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sync Meta…
          </span>
        )}
        {isLoading && !syncing && (
          <span className="text-[12px] text-ink-soft">Chargement…</span>
        )}
        <div className="flex items-center gap-2 rounded-full border border-white/70 px-3 py-2 text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_-14px_rgba(20,20,20,0.25)] focus-within:ring-2 focus-within:ring-[#ff6c02]/30"
          style={{ backgroundImage: "linear-gradient(180deg,#ffffff 0%,#faf7f2 100%)" }}
        >
          <Search className="h-4 w-4 text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher par nom…"
            className="w-56 bg-transparent outline-none placeholder:text-ink-soft"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40 ${
                filter === f.id
                  ? "bg-gradient-to-br from-[#2a2a2a] to-[#050505] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_18px_-10px_rgba(0,0,0,0.5)]"
                  : "border border-white/70 bg-white text-ink-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] hover:border-[#ffb066] hover:text-ink"
              }`}
            >
              {f.label}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                filter === f.id ? "bg-white/20 text-white" : "bg-[#fff1e2] text-[#c94a00]"
              }`}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        className="card-hover anim-fade-up relative overflow-hidden rounded-2xl border border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_32px_-22px_rgba(20,20,20,0.28)]"
        style={{ backgroundImage: "linear-gradient(180deg,#ffffff 0%,#faf7f2 100%)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.10] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.15 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
        />
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[14px]">
          <thead className="bg-gradient-to-b from-[#f6f1e8] to-[#efe7d7] text-[12px] uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-5 py-3 font-medium">Campagne</th>
              <th className="px-3 py-3 font-medium">Canal</th>
              <th className="px-3 py-3 font-medium">Statut</th>
              <th className="px-3 py-3 font-medium">Dépense (USD)</th>
              <th className="px-3 py-3 font-medium">Conversions</th>
              <th className="px-3 py-3 font-medium">ROAS</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const B = badge[c.status];
              const ch = CHANNEL_STYLE[c.channel] ?? { grad: "from-slate-100 to-slate-200", ic: "text-ink", ring: "ring-line" };
              return (
                <tr key={c.id} className="border-t border-line/60 transition hover:bg-white/60">
                  <td className="px-5 py-4">
                    <Link to="/app/campaigns/$id" params={{ id: c.id }} className="font-medium text-ink hover:underline">{c.name}</Link>
                    {c.zone && <p className="text-[11px] text-ink-soft">{c.zone} · {c.budget}</p>}
                  </td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex items-center rounded-full border border-white/70 bg-gradient-to-br ${ch.grad} px-2.5 py-1 text-[12px] font-medium ${ch.ic} ring-1 ${ch.ring} shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]`}>
                      {c.channel}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${B.c}`}>
                      <B.i className="h-3.5 w-3.5" /> {B.l}
                    </span>
                  </td>
                  <td className="px-3 py-4 font-medium text-ink">{c.spend}</td>
                  <td className="px-3 py-4 font-medium text-ink">{c.conv}</td>
                  <td className="px-3 py-4 font-semibold text-[#c94a00]">{c.roas}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => onDuplicate(c.id, c.name)}
                        className="chip-ghost !py-1 !px-2 text-[12px]"
                        title="Dupliquer en brouillon"
                      >
                        <Copy className="h-3.5 w-3.5" /> Dupliquer
                      </button>
                      {c.status !== "draft" && (
                        <button
                          onClick={() => onToggleStatus(c.id, c.name, c.status)}
                          className={c.status === "live" ? "chip-ghost !py-1 !px-2 text-[12px]" : "btn-primary btn-halo !py-1 !px-2 !text-[12px]"}
                        >
                          {c.status === "live"
                            ? <><Pause className="h-3.5 w-3.5" /> Pause</>
                            : <><Play className="h-3.5 w-3.5" /> Activer</>}
                        </button>
                      )}
                      <Link to="/app/campaigns/$id" params={{ id: c.id }} className="btn-primary btn-halo !py-1 !px-2 !text-[12px]">Détails</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-[13px] text-ink-soft">
                  Aucune campagne ne correspond à votre recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </CampaignsShell>
  );
}