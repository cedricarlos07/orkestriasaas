import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getSecurityAlerts, getActiveSessions, getSecretMetas, fmtRelative, fmtDateShort, logAudit, type SecurityAlert } from "@/lib/admin-store";
import { Lock, Monitor, KeyRound, LogOut, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/security")({
  head: () => ({ meta: [{ title: "Sécurité — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: SecurityPage,
});

const KIND_LABEL: Record<SecurityAlert["kind"], string> = {
  connexion_suspecte: "Connexion suspecte", trop_de_tentatives: "Trop de tentatives",
  changement_inhabituel: "Changement inhabituel", nouveau_pays: "Nouveau pays",
  token_anormal: "Token utilisé anormalement", extraction_massive: "Extraction massive",
  depassement_permissions: "Dépassement de permissions",
};

function SecurityPage() {
  const [tab, setTab] = useState<"alerts" | "sessions" | "secrets">("alerts");
  const alerts = useMemo(() => getSecurityAlerts(), []);
  const sessions = useMemo(() => getActiveSessions(), []);
  const secrets = useMemo(() => getSecretMetas(), []);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Sécurité</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Pages internes de sécurité</h1>
        <p className="mt-1 text-[13px] text-white/60">Alertes, sessions actives, secrets (jamais en clair).</p>
      </header>

      <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 w-fit">
        {[["alerts", "Alertes"], ["sessions", "Sessions"], ["secrets", "Secrets"]].map(([id, l]) => (
          <button key={id} onClick={() => setTab(id as typeof tab)} className={`rounded-full px-4 py-1.5 text-[12.5px] ${tab === id ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab === "alerts" && (
        <div className="grid gap-2">
          {alerts.map((a) => (
            <div key={a.id} className={`flex items-start gap-3 rounded-xl border p-3 ${a.severity === "critique" ? "border-rose-500/25 bg-rose-500/[0.05]" : a.severity === "warn" ? "border-amber-500/25 bg-amber-500/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
              <span className={`grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] ${a.severity === "critique" ? "text-rose-300" : a.severity === "warn" ? "text-amber-300" : "text-white/60"}`}><AlertTriangle className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium">{KIND_LABEL[a.kind]}</p>
                <p className="text-[12px] text-white/60">{a.who} · {a.where}</p>
                <p className="text-[12px] text-white/75">{a.details}</p>
              </div>
              <div className="text-right text-[11px] text-white/50">
                <p>{fmtRelative(a.at)}</p>
                <p className="mt-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 capitalize">{a.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "sessions" && (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5"><Monitor className="h-3.5 w-3.5" /> {sessions.length} sessions actives</p>
            <button onClick={() => logAudit({ actor: "security_admin", action: "Déconnexion globale forcée", target: "all_sessions" })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/[0.06] px-3 py-1.5 text-[12px] text-rose-200 hover:bg-rose-500/[0.12]"><LogOut className="h-3.5 w-3.5" /> Forcer déconnexion globale</button>
          </div>
          <table className="min-w-full text-[13px]">
            <thead className="bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-white/40">
              <tr><th className="px-4 py-3">Utilisateur</th><th>Appareil</th><th>IP</th><th>Pays</th><th>Démarrée</th><th>Dernière activité</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 text-white/90">{s.user}</td>
                  <td className="text-white/70">{s.device}</td>
                  <td className="text-white/70 font-mono text-[12px]">{s.ip}</td>
                  <td className="text-white/70">{s.country}</td>
                  <td className="text-white/60">{fmtRelative(s.startedAt)}</td>
                  <td className="text-white/60">{fmtRelative(s.lastSeen)}</td>
                  <td>
                    <button onClick={() => logAudit({ actor: "security_admin", action: `Session révoquée : ${s.user}`, target: s.id })}
                      className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11.5px] hover:bg-white/[0.08]">Révoquer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "secrets" && (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Registre des secrets — valeurs jamais affichées</p>
          </div>
          <table className="min-w-full text-[13px]">
            <thead className="bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-white/40">
              <tr><th className="px-4 py-3">Nom</th><th>Fournisseur</th><th>Env.</th><th>Créé</th><th>Dernière rotation</th><th>Statut</th><th>Responsable</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {secrets.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-white/90">{s.name}</td>
                  <td className="text-white/70">{s.provider}</td>
                  <td className="text-white/70">{s.env}</td>
                  <td className="text-white/60">{fmtDateShort(s.createdAt)}</td>
                  <td className={s.status === "à_rotationner" ? "text-amber-300" : "text-white/60"}>{fmtDateShort(s.lastRotatedAt)}</td>
                  <td><span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px]">{s.status.replace("_", " ")}</span></td>
                  <td className="text-white/70">{s.owner}</td>
                  <td>
                    <button onClick={() => logAudit({ actor: "security_admin", action: `Rotation demandée : ${s.name}`, target: s.id })}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11.5px]"><KeyRound className="h-3 w-3" /> Rotation</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}