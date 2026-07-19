import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  getTickets, updateTicket, getOrganizations, getUsers, ticketTypeLabel, fmtRelative, logAudit,
  type SupportTicket, type TicketStatus, type TicketPriority, type TicketType,
} from "@/lib/admin-store";
import { LifeBuoy, Search, Filter, RefreshCw, KeyRound, Plug, Gauge, ArrowUpRight, Shield } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/support")({
  head: () => ({ meta: [{ title: "Support & tickets — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: SupportPage,
});

const STATUSES: TicketStatus[] = ["ouvert", "en_cours", "en_attente_client", "résolu", "fermé"];
const PRIOS: TicketPriority[] = ["basse", "normale", "haute", "critique"];
const TYPES: TicketType[] = ["connexion", "campagne_non_creee", "budget", "paiement", "rapport", "media_rejete", "compte_suspendu", "tracking", "utilisation"];

function SupportPage() {
  const [tick, setTick] = useState(0);
  const tickets = useMemo(() => getTickets(), [tick]);
  const orgs = useMemo(() => Object.fromEntries(getOrganizations().map((o) => [o.id, o])), []);
  const users = useMemo(() => Object.fromEntries(getUsers().map((u) => [u.id, u])), []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [prio, setPrio] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const rows = tickets.filter((t) => {
    if (status !== "all" && t.status !== status) return false;
    if (prio !== "all" && t.priority !== prio) return false;
    if (type !== "all" && t.type !== type) return false;
    if (q && !t.subject.toLowerCase().includes(q.toLowerCase()) && !orgs[t.orgId]?.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const supportAction = (t: SupportTicket, label: string) => {
    logAudit({ actor: "support_agent", action: `Ticket ${t.id} : ${label}`, target: t.orgId });
    updateTicket(t.id, { status: "en_cours" });
    setTick((x) => x + 1);
    if (selected?.id === t.id) setSelected({ ...t, status: "en_cours" });
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Support & tickets</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Gestion du support client</h1>
        <p className="mt-1 text-[13px] text-white/60">{tickets.length} tickets · SLA suivis par priorité et type.</p>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-2 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-white/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sujet ou organisation…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/40" />
          </div>
          <Sel value={status} onChange={setStatus} options={[["all", "Tous statuts"], ...STATUSES.map((s) => [s, s.replace("_", " ")] as [string, string])]} />
          <Sel value={prio} onChange={setPrio} options={[["all", "Toutes priorités"], ...PRIOS.map((p) => [p, p] as [string, string])]} />
          <Sel value={type} onChange={setType} options={[["all", "Tous types"], ...TYPES.map((t) => [t, ticketTypeLabel(t)] as [string, string])]} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-[13px]">
          <thead className="bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-white/40">
            <tr><th className="px-4 py-3">Ticket</th><th>Sujet</th><th>Organisation</th><th>Type</th><th>Priorité</th><th>Statut</th><th>SLA</th><th>Agent</th><th>MAJ</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((t) => (
              <tr key={t.id} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => setSelected(t)}>
                <td className="px-4 py-2.5 font-mono text-[12px] text-white/70">{t.id}</td>
                <td className="text-white/90">{t.subject}</td>
                <td className="text-white/70">{orgs[t.orgId]?.name}</td>
                <td className="text-white/60">{ticketTypeLabel(t.type)}</td>
                <td><PrioChip p={t.priority} /></td>
                <td><StatusChip s={t.status} /></td>
                <td className="text-white/70">{t.slaHours} h</td>
                <td className="text-white/70">{t.assignedTo}</td>
                <td className="text-white/50">{fmtRelative(t.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/60" onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#141418] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] uppercase tracking-widest text-[#ff8a3d] flex items-center gap-1.5"><LifeBuoy className="h-3.5 w-3.5" /> Fiche ticket</p>
            <h2 className="mt-1 font-display text-[20px] font-semibold">{selected.subject}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-white/60">
              <span>{selected.id}</span><span>·</span>
              <PrioChip p={selected.priority} /><StatusChip s={selected.status} />
            </div>

            <div className="mt-4 grid gap-2 text-[13px]">
              <Row label="Organisation">{orgs[selected.orgId]?.name}</Row>
              <Row label="Client">{users[selected.userId]?.name} · {users[selected.userId]?.email}</Row>
              <Row label="Agent support">{selected.assignedTo}</Row>
              <Row label="SLA">{selected.slaHours} h</Row>
              <Row label="Run concerné">{selected.relatedRunId ?? "—"}</Row>
              <Row label="Action concernée">{selected.relatedActionId ?? "—"}</Row>
              <Row label="Connexion concernée">{selected.relatedConnectionId ?? "—"}</Row>
            </div>

            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wider text-white/50">Historique</p>
              <ul className="mt-2 space-y-2">
                {selected.history.map((h, i) => (
                  <li key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="flex items-center justify-between text-[11px] text-white/50"><span>{h.author}</span><span>{fmtRelative(h.at)}</span></div>
                    <p className="mt-1 text-[13px] text-white/85">{h.message}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-wider text-white/50">Actions support</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <MiniBtn onClick={() => supportAction(selected, "Consultation des logs")} icon={Shield}>Consulter logs</MiniBtn>
                <MiniBtn onClick={() => supportAction(selected, "Demande de reconnexion")} icon={KeyRound}>Reconnexion</MiniBtn>
                <MiniBtn onClick={() => supportAction(selected, "Synchro relancée")} icon={RefreshCw}>Relancer synchro</MiniBtn>
                <MiniBtn onClick={() => supportAction(selected, "Quota accordé +20 %")} icon={Gauge}>Accorder quota</MiniBtn>
                <MiniBtn onClick={() => supportAction(selected, "Accès temporaire ouvert")} icon={Plug}>Accès temporaire</MiniBtn>
                <MiniBtn onClick={() => supportAction(selected, "Escalade équipe technique")} icon={ArrowUpRight} primary>Escalader</MiniBtn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] pb-1.5"><span className="text-[11.5px] text-white/50">{label}</span><span className="text-right text-white/85">{children}</span></div>;
}
function PrioChip({ p }: { p: TicketPriority }) {
  const map: Record<TicketPriority, string> = { basse: "bg-white/[0.06] text-white/70", normale: "bg-white/[0.08] text-white/80", haute: "bg-amber-500/15 text-amber-300", critique: "bg-rose-500/15 text-rose-300" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${map[p]}`}>{p}</span>;
}
function StatusChip({ s }: { s: TicketStatus }) {
  const map: Record<TicketStatus, string> = { ouvert: "bg-blue-500/15 text-blue-300", en_cours: "bg-amber-500/15 text-amber-300", en_attente_client: "bg-white/[0.06] text-white/70", "résolu": "bg-emerald-500/15 text-emerald-300", "fermé": "bg-white/[0.06] text-white/50" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${map[s]}`}>{s.replace("_", " ")}</span>;
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none rounded-full border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-[12.5px] text-white/80 outline-none">{options.map(([v, l]) => <option key={v} value={v} className="bg-[#111114]">{l}</option>)}</select>
      <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
    </div>
  );
}
function MiniBtn({ children, onClick, icon: Icon, primary }: { children: React.ReactNode; onClick: () => void; icon: React.ComponentType<{ className?: string }>; primary?: boolean }) {
  const c = primary ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white" : "border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]";
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] ${c}`}><Icon className="h-3.5 w-3.5" /> {children}</button>;
}

import type React from "react";