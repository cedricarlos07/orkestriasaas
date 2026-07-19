import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getUsers, getOrganizations, logAudit, fmtRelative, type PlatformUser } from "@/lib/admin-store";
import { Search, Filter, ShieldCheck, KeyRound, LogOut, UserX, UserCheck, ArrowRightLeft, UserCog, Eye } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/users")({
  head: () => ({ meta: [{ title: "Utilisateurs — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: UsersPage,
});

function UsersPage() {
  const orgs = getOrganizations();
  const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
  const [users, setUsers] = useState<PlatformUser[]>(getUsers());
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [twofa, setTwofa] = useState("all");
  const [impersonate, setImpersonate] = useState<PlatformUser | null>(null);

  const rows = useMemo(() => users.filter((u) =>
    (role === "all" || u.role === role) &&
    (status === "all" || u.status === status) &&
    (twofa === "all" || (twofa === "on" ? u.twoFA : !u.twoFA)) &&
    (q === "" || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()) || (orgMap[u.orgId] ?? "").toLowerCase().includes(q.toLowerCase()))
  ), [users, q, role, status, twofa, orgMap]);

  const patch = (id: string, p: Partial<PlatformUser>, action: string) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...p } : u));
    const u = users.find((x) => x.id === id);
    logAudit({ actor: "super_admin", action, target: u?.email ?? id });
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Utilisateurs</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Gestion des comptes plateforme</h1>
        <p className="mt-1 text-[13px] text-white/60">{rows.length} utilisateur{rows.length > 1 ? "s" : ""} · impersonation strictement encadrée.</p>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-2 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-white/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail, organisation…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/40" />
          </div>
          <Sel value={role} onChange={setRole} options={[["all", "Tous rôles"], ["owner", "Owner"], ["admin", "Admin"], ["media_buyer", "Media buyer"], ["analyst", "Analyst"], ["viewer", "Viewer"]]} />
          <Sel value={status} onChange={setStatus} options={[["all", "Tous statuts"], ["actif", "Actif"], ["suspendu", "Suspendu"], ["invité", "Invité"]]} />
          <Sel value={twofa} onChange={setTwofa} options={[["all", "2FA (tous)"], ["on", "2FA actif"], ["off", "2FA désactivé"]]} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-[13px]">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-4 py-3">Utilisateur</th><th>Organisation</th><th>Rôle</th><th>Pays</th>
              <th>Statut</th><th>2FA</th><th>Dernière connexion</th><th>Appareil</th><th>Conso</th><th>Incidents</th><th className="text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-[11px] text-white/50">{u.email}</p>
                </td>
                <td className="text-white/70">{orgMap[u.orgId] ?? u.orgId}</td>
                <td className="capitalize text-white/70">{u.role.replace("_", " ")}</td>
                <td className="text-white/70">{u.country}</td>
                <td><StatusPill s={u.status} /></td>
                <td>{u.twoFA ? <span className="text-emerald-300">Actif</span> : <span className="text-rose-300">—</span>}</td>
                <td className="text-white/50">{fmtRelative(u.lastLogin)}</td>
                <td className="text-white/60">{u.device}</td>
                <td className="text-white/70">{u.consumption} $</td>
                <td>{u.incidents > 0 ? <span className="text-rose-300">{u.incidents}</span> : <span className="text-white/40">—</span>}</td>
                <td className="pr-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <IconBtn title="Impersonation" icon={Eye} onClick={() => setImpersonate(u)} />
                    <IconBtn title="Réinit. mot de passe" icon={KeyRound} onClick={() => patch(u.id, {}, `Réinitialisation mot de passe — ${u.email}`)} />
                    <IconBtn title="Révoquer sessions" icon={LogOut} onClick={() => patch(u.id, {}, `Révocation sessions — ${u.email}`)} />
                    <IconBtn title="Imposer 2FA" icon={ShieldCheck} onClick={() => patch(u.id, { twoFA: true }, `2FA imposée — ${u.email}`)} />
                    <IconBtn title="Changer rôle" icon={UserCog} onClick={() => patch(u.id, { role: nextRole(u.role) }, `Changement de rôle — ${u.email}`)} />
                    <IconBtn title="Transférer propriété" icon={ArrowRightLeft} onClick={() => patch(u.id, {}, `Transfert de propriété — ${u.email}`)} />
                    {u.status === "suspendu"
                      ? <IconBtn title="Réactiver" icon={UserCheck} onClick={() => patch(u.id, { status: "actif" }, `Réactivation — ${u.email}`)} />
                      : <IconBtn title="Suspendre" icon={UserX} tone="danger" onClick={() => patch(u.id, { status: "suspendu" }, `Suspension — ${u.email}`)} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {impersonate && <ImpersonateModal user={impersonate} orgName={orgMap[impersonate.orgId] ?? ""} onClose={() => setImpersonate(null)} />}
    </div>
  );
}

function nextRole(r: PlatformUser["role"]): PlatformUser["role"] {
  const order: PlatformUser["role"][] = ["viewer", "analyst", "media_buyer", "admin", "owner"];
  return order[(order.indexOf(r) + 1) % order.length];
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

function IconBtn({ icon: Icon, title, onClick, tone }: { icon: any; title: string; onClick: () => void; tone?: "danger" }) {
  return (
    <button title={title} onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-lg transition ${tone === "danger" ? "text-rose-300 hover:bg-rose-500/15" : "text-white/60 hover:bg-white/[0.08] hover:text-white"}`}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    actif: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    suspendu: "bg-rose-500/15 text-rose-300 border-rose-500/25",
    "invité": "bg-sky-500/15 text-sky-300 border-sky-500/25",
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[s] ?? "bg-white/[0.05] text-white/70 border-white/10"}`}>{s}</span>;
}

function ImpersonateModal({ user, orgName, onClose }: { user: PlatformUser; orgName: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [ticket, setTicket] = useState("");
  const [duration, setDuration] = useState("30");
  const [readOnly, setReadOnly] = useState(true);
  const [ack, setAck] = useState(false);

  const confirm = () => {
    logAudit({
      actor: "super_admin",
      action: `Impersonation ${readOnly ? "lecture seule" : "écriture"} — ${duration} min`,
      target: user.email,
      reason,
      ticket,
    });
    alert(`Session support ouverte pour ${user.name} (${orgName}). Bandeau visible dans l'espace impersonné. Journal mis à jour.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111114] p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#ff6c02] to-[#ff8a3d]"><Eye className="h-5 w-5" /></div>
          <div>
            <h3 className="font-display text-[18px] font-semibold">Impersonation sécurisée</h3>
            <p className="text-[12.5px] text-white/60">Ouverture d'une session support pour <span className="text-white/90">{user.name}</span> ({orgName}).</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-white/50">Raison (obligatoire)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Ex : le client ne peut pas lancer sa campagne (bug UI)" className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] outline-none focus:border-[#ff8a3d]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-white/50">Ticket support</label>
              <input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="SUP-1234" className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] outline-none focus:border-[#ff8a3d]" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-white/50">Durée</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] outline-none">
                {["15", "30", "60", "120"].map((d) => <option key={d} value={d} className="bg-[#111114]">{d} min</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px]">
            <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
            Lecture seule par défaut (recommandé)
          </label>
          <label className="flex items-start gap-2 text-[12px] text-white/70">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
            <span>Je confirme que cette session est nécessaire au support et que le client est informé le cas échéant. Un bandeau « Mode support actif » sera visible en permanence.</span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-white/10 px-4 py-2 text-[12.5px] text-white/70 hover:bg-white/[0.05]">Annuler</button>
          <button disabled={!ack || reason.trim().length < 8 || ticket.trim().length < 3} onClick={confirm} className="rounded-full bg-[#ff6c02] px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50 hover:brightness-110">Ouvrir la session</button>
        </div>
      </div>
    </div>
  );
}
