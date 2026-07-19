import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAudit, fmtRelative, type AdminAuditEntry } from "@/lib/admin-store";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/audit")({
  head: () => ({ meta: [{ title: "Journal d'audit — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: AuditPage,
});

function AuditPage() {
  const [rows, setRows] = useState<AdminAuditEntry[]>([]);
  useEffect(() => { setRows(getAudit()); }, []);
  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Journal d'audit</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Traçabilité complète des actions Super Admin</h1>
        <p className="mt-1 text-[13px] text-white/60">Toutes les actions administratives sont horodatées, associées à un acteur et à une raison.</p>
      </header>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/[0.05]"><ShieldCheck className="h-5 w-5 text-white/60" /></div>
          <p className="mt-3 text-[14px] font-medium">Aucune action journalisée pour l'instant</p>
          <p className="mt-1 text-[12.5px] text-white/50">Effectuez une action depuis une fiche organisation ou utilisateur pour la voir apparaître ici.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="min-w-full text-[13px]">
            <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-white/40">
              <tr><th className="px-4 py-3">Horodatage</th><th>Acteur</th><th>Action</th><th>Cible</th><th>Ticket</th><th>Raison</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 text-white/70">{fmtRelative(r.at)}</td>
                  <td className="text-white/80">{r.actor}</td>
                  <td className="text-white/90">{r.action}</td>
                  <td className="text-white/70">{r.target}</td>
                  <td className="text-white/60">{r.ticket ?? "—"}</td>
                  <td className="max-w-md truncate text-white/60">{r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
