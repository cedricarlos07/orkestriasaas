import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMcpStatusesAdmin, refreshMcpHealth, listMcpCapabilities } from "@/functions/mcp";
import { listKillSwitches, toggleKillSwitch } from "@/functions/admin";
import { Activity, AlertTriangle, Power, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/mcp")({
  head: () => ({ meta: [{ title: "MCP & santé outils — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: MCPPage,
});

function MCPPage() {
  const qc = useQueryClient();
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["admin-mcp-status"],
    queryFn: () => listMcpStatusesAdmin(),
  });
  const { data: capabilities = [] } = useQuery({
    queryKey: ["mcp-capabilities"],
    queryFn: () => listMcpCapabilities(),
  });
  const { data: killRows = [] } = useQuery({
    queryKey: ["kill-switches"],
    queryFn: () => listKillSwitches(),
  });

  const refreshMut = useMutation({
    mutationFn: () => refreshMcpHealth(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-mcp-status"] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleKillSwitch({ data: { id, active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kill-switches"] }),
  });

  const ksMap = Object.fromEntries(killRows.map((k) => [k.key, k.active]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">MCP & santé outils</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold">Supervision technique des serveurs MCP</h1>
          <p className="mt-1 text-[13px] text-white/60">Google Ads, Meta, TikTok, GA4 — données Neon + probes live.</p>
        </div>
        <button
          type="button"
          onClick={() => refreshMut.mutate()}
          disabled={refreshMut.isPending}
          className="rounded-full bg-[#ff6c02] px-4 py-2 text-[13px] font-semibold text-white"
        >
          {refreshMut.isPending ? "Probe…" : "Rafraîchir health"}
        </button>
      </header>

      {isLoading ? (
        <p className="text-[13px] text-white/50">Chargement…</p>
      ) : (
        <section className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="min-w-full text-[13px]">
            <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-white/40">
              <tr><th className="px-4 py-3">Service</th><th>Statut</th><th>Latence</th><th>Uptime</th><th>Erreurs</th><th>Appels 24h</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {services.map((s) => (
                <tr key={s.id} className="align-top hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium">{s.label}</td>
                  <td><StatusChip s={s.status} /></td>
                  <td className="text-white/80">{s.latency} ms</td>
                  <td className="text-white/80">{s.uptime.toFixed(1)}%</td>
                  <td className={s.errorRate > 0.05 ? "text-amber-300" : "text-white/70"}>{(s.errorRate * 100).toFixed(1)}%</td>
                  <td className="text-white/70">{s.calls24h}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="font-display text-[17px] font-semibold">Registre des capacités</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-white/40">
              <tr><th className="px-3 py-2 text-left">Plateforme</th><th>Lire</th><th>Créer</th><th>Modifier</th><th>Pause</th><th>Budget</th><th>Créations</th></tr>
            </thead>
            <tbody>
              {capabilities.map((r) => (
                <tr key={r.platform} className="border-t border-white/[0.06]">
                  <td className="px-3 py-2 font-medium">{r.platform}</td>
                  {(["read", "create", "modify", "pause", "budget", "creatives"] as const).map((k) => (
                    <td key={k} className="text-center"><CapPill v={r[k]} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold"><ShieldOff className="h-4 w-4 text-rose-400" /> Kill switches (DB)</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {["meta_write", "google_write", "tiktok_write", "autopilot_global"].map((key) => {
            const row = killRows.find((k) => k.key === key);
            return (
            <button
              key={key}
              type="button"
              onClick={() => row && toggleMut.mutate({ id: row.id, active: !row.active })}
              className={`rounded-full px-3 py-1.5 text-[12px] ${ksMap[key] ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40" : "bg-white/[0.06] text-white/70"}`}
            >
              <Power className="mr-1 inline h-3 w-3" /> {key}: {ksMap[key] ? "ON" : "OFF"}
            </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatusChip({ s }: { s: string }) {
  const c = s === "ok" ? "bg-emerald-500/20 text-emerald-300" : s === "simulation" ? "bg-blue-500/20 text-blue-300" : "bg-amber-500/20 text-amber-300";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c}`}>{s}</span>;
}

function CapPill({ v }: { v: boolean }) {
  return v ? <span className="text-emerald-400">✓</span> : <span className="text-white/30">—</span>;
}
