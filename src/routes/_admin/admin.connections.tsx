import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getConnections, getConnectorCatalog, getOrganizations, connectorLabel, fmtNum, fmtRelative, fmtPct, logAudit, type Connection } from "@/lib/admin-store";
import { RefreshCw, Unplug, Search, Filter, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/connections")({
  head: () => ({ meta: [{ title: "Connexions — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const orgs = Object.fromEntries(getOrganizations().map((o) => [o.id, o.name]));
  const [conns, setConns] = useState<Connection[]>(getConnections());
  const [q, setQ] = useState("");
  const [connector, setConnector] = useState("all");
  const [status, setStatus] = useState("all");

  const kpis = useMemo(() => {
    const active = conns.filter((c) => c.status === "active").length;
    const expired = conns.filter((c) => c.status === "expirée").length;
    const perm = conns.filter((c) => c.status === "permissions_manquantes").length;
    const err = conns.filter((c) => c.status === "erreur").length;
    const disc = conns.filter((c) => c.status === "déconnectée").length;
    const calls = conns.reduce((s, c) => s + c.calls24h, 0);
    const errAvg = conns.reduce((s, c) => s + c.errorRate, 0) / Math.max(1, conns.length);
    return { active, expired, perm, err, disc, calls, errAvg };
  }, [conns]);

  const rows = useMemo(() => conns.filter((c) =>
    (connector === "all" || c.connector === connector) &&
    (status === "all" || c.status === status) &&
    (q === "" || (orgs[c.orgId] ?? "").toLowerCase().includes(q.toLowerCase()) || connectorLabel(c.connector).toLowerCase().includes(q.toLowerCase()))
  ), [conns, q, connector, status, orgs]);

  const refresh = (id: string) => {
    setConns((prev) => prev.map((c) => c.id === id ? { ...c, status: "active", lastSync: new Date().toISOString() } : c));
    logAudit({ actor: "super_admin", action: "Renouvellement OAuth", target: id });
  };
  const revoke = (id: string) => {
    setConns((prev) => prev.map((c) => c.id === id ? { ...c, status: "déconnectée" } : c));
    logAudit({ actor: "super_admin", action: "Révocation connexion", target: id });
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Connexions publicitaires</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Supervision des intégrations externes</h1>
        <p className="mt-1 text-[13px] text-white/60">Meta, Google, TikTok, GA4, WhatsApp, CRM, Sheets, Shopify…</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Tile label="Actives" value={fmtNum(kpis.active)} tone="ok" />
        <Tile label="Expirées" value={fmtNum(kpis.expired)} tone="warn" />
        <Tile label="OAuth à renouveler" value={fmtNum(kpis.expired + kpis.perm)} tone="warn" />
        <Tile label="Permissions manquantes" value={fmtNum(kpis.perm)} tone="warn" />
        <Tile label="Comptes déconnectés" value={fmtNum(kpis.disc)} />
        <Tile label="Appels 24 h" value={fmtNum(kpis.calls)} />
        <Tile label="Taux d'échec moyen" value={fmtPct(kpis.errAvg, 2)} tone={kpis.errAvg > 0.05 ? "warn" : "ok"} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-2 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-white/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Organisation, connecteur…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/40" />
          </div>
          <Sel value={connector} onChange={setConnector} options={[["all", "Tous connecteurs"], ...getConnectorCatalog().map((c) => [c.id, c.label] as [string, string])]} />
          <Sel value={status} onChange={setStatus} options={[["all", "Tous statuts"], ["active", "Active"], ["expirée", "Expirée"], ["erreur", "Erreur"], ["permissions_manquantes", "Permissions manquantes"], ["déconnectée", "Déconnectée"]]} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-[13px]">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-white/40">
            <tr><th className="px-4 py-3">Organisation</th><th>Connecteur</th><th>Statut</th><th>Dernière synchro</th><th>Appels 24 h</th><th>Taux d'échec</th><th>Scopes</th><th className="text-right pr-4">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-2.5 font-medium">
                  <Link to="/admin/connections/$id" params={{ id: c.id }} className="text-white hover:text-[#ff8a3d]">
                    {orgs[c.orgId]}
                  </Link>
                </td>
                <td className="text-white/80">{connectorLabel(c.connector)}</td>
                <td><ConnStatus s={c.status} /></td>
                <td className="text-white/60">{fmtRelative(c.lastSync)}</td>
                <td className="text-white/80">{fmtNum(c.calls24h)}</td>
                <td className={c.errorRate > 0.05 ? "text-amber-300" : "text-white/70"}>{fmtPct(c.errorRate, 1)}</td>
                <td className="text-[11.5px] text-white/50">{c.scopes.join(", ")}</td>
                <td className="pr-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button title="Renouveler OAuth" onClick={() => refresh(c.id)} className="grid h-7 w-7 place-items-center rounded-lg text-white/60 hover:bg-white/[0.08] hover:text-white"><RefreshCw className="h-3.5 w-3.5" /></button>
                    <button title="Révoquer" onClick={() => revoke(c.id)} className="grid h-7 w-7 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/15"><Unplug className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-white/50">Aucune connexion.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === "warn" ? "border-amber-400/30 bg-amber-500/[0.06]" : tone === "ok" ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
      <p className="text-[11px] uppercase tracking-wider text-white/50">{label}</p>
      <p className="mt-1 font-display text-[20px] font-semibold">{value}</p>
    </div>
  );
}

function ConnStatus({ s }: { s: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    "expirée": "bg-amber-500/15 text-amber-300 border-amber-500/25",
    erreur: "bg-rose-500/15 text-rose-300 border-rose-500/25",
    "permissions_manquantes": "bg-amber-500/15 text-amber-300 border-amber-500/25",
    "déconnectée": "bg-white/[0.08] text-white/70 border-white/15",
  };
  const label = s.replace("_", " ");
  const critical = s === "erreur";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[s]}`}>
      {critical && <AlertTriangle className="h-3 w-3" />}{label}
    </span>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
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
