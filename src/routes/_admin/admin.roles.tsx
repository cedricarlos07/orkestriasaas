import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BACKOFFICE_ROLES, getStaff, saveStaff, fmtRelative, logAudit, type BackOfficeRole, type StaffMember } from "@/lib/admin-store";
import { UserCog, ShieldCheck, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/roles")({
  head: () => ({ meta: [{ title: "Rôles back-office — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: RolesPage,
});

function RolesPage() {
  const [tick, setTick] = useState(0);
  const staff = useMemo(() => getStaff(), [tick]);

  const setRole = (m: StaffMember, r: BackOfficeRole) => {
    saveStaff(staff.map((x) => x.id === m.id ? { ...x, role: r } : x));
    logAudit({ actor: "root_super_admin", action: `Rôle changé : ${m.email} → ${r}`, target: m.id });
    setTick((t) => t + 1);
  };
  const toggle2FA = (m: StaffMember) => {
    saveStaff(staff.map((x) => x.id === m.id ? { ...x, twoFA: !x.twoFA } : x));
    setTick((t) => t + 1);
  };
  const remove = (m: StaffMember) => {
    saveStaff(staff.filter((x) => x.id !== m.id));
    logAudit({ actor: "root_super_admin", action: `Collaborateur retiré : ${m.email}`, target: m.id });
    setTick((t) => t + 1);
  };
  const add = () => {
    const id = `stf_${Date.now().toString(36)}`;
    saveStaff([...staff, { id, name: "Nouveau collaborateur", email: "user@orkestria.io", role: "analyst", twoFA: false, lastLogin: new Date().toISOString() }]);
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Rôles back-office</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Modèle de responsabilités</h1>
        <p className="mt-1 text-[13px] text-white/60">Ne pas donner tous les droits à chaque employé — attribuez le rôle minimum nécessaire.</p>
      </header>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Rôles disponibles</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {BACKOFFICE_ROLES.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06]"><ShieldCheck className="h-4 w-4 text-[#ff8a3d]" /></span>
                <h3 className="font-display text-[15px] font-semibold">{r.name}</h3>
              </div>
              <p className="mt-1 text-[12.5px] text-white/60">{r.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {r.scopes.map((s) => <span key={s} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-white/70">{s}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5"><UserCog className="h-3.5 w-3.5" /> Collaborateurs Orkestria</p>
          <button onClick={add} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] px-3 py-1.5 text-[12.5px] font-medium text-white"><Plus className="h-3.5 w-3.5" /> Ajouter</button>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-white/40">
              <tr><th className="px-5 py-3">Nom</th><th>Email</th><th>Rôle</th><th>2FA</th><th>Dernière connexion</th><th>Accès temporaire</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {staff.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-2.5 text-white/90">{m.name}</td>
                  <td className="text-white/70">{m.email}</td>
                  <td>
                    <select value={m.role} onChange={(e) => setRole(m, e.target.value as BackOfficeRole)} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px]">
                      {BACKOFFICE_ROLES.map((r) => <option key={r.id} value={r.id} className="bg-[#111114]">{r.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <button onClick={() => toggle2FA(m)} className={`rounded-full px-2 py-0.5 text-[11px] ${m.twoFA ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{m.twoFA ? "activée" : "désactivée"}</button>
                  </td>
                  <td className="text-white/60">{fmtRelative(m.lastLogin)}</td>
                  <td className="text-white/60">{m.tempAccess ?? "—"}</td>
                  <td>
                    <button onClick={() => remove(m)} className="rounded-md p-1 text-white/50 hover:bg-white/[0.06] hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}