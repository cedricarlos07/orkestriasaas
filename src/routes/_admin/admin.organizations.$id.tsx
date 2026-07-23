import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  getOrganization, PLANS, updateOrganization, logAudit, getUsers, getConnections, connectorLabel,
  fmtMoney, fmtNum, fmtRelative, planLabel, type Organization,
} from "@/lib/admin-store";
import { setOrganizationWriteBlock } from "@/functions/admin";
import { StatusPill } from "./admin.index";
import {
  ArrowLeft, Ban, Play, Repeat, ShieldOff, ShieldCheck, Lock, Unplug, FileSearch,
  Download, Trash2, Sparkles, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_admin/admin/organizations/$id")({
  head: () => ({ meta: [{ title: "Organisation — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: OrgDetail,
});

function OrgDetail() {
  const { id } = useParams({ from: "/admin/organizations/$id" });
  const nav = useNavigate();
  const org = getOrganization(id);
  const [reasonModal, setReasonModal] = useState<{ action: string; run: (reason: string) => void } | null>(null);
  const [tick, setTick] = useState(0);

  if (!org) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <p className="text-white/70">Organisation introuvable.</p>
        <Link to="/admin/organizations" className="mt-3 inline-block text-[#ff8a3d] hover:underline">← Retour à la liste</Link>
      </div>
    );
  }

  const plan = PLANS.find((p) => p.id === org.plan)!;
  const members = getUsers().filter((u) => u.orgId === org.id);
  const conns = getConnections().filter((c) => c.orgId === org.id);

  const run = (action: string, patch: Partial<Organization>, need = true) => {
    const exec = (reason: string) => {
      updateOrganization(org.id, patch);
      void setOrganizationWriteBlock({
        data: {
          organizationId: org.id,
          writeBlocked: patch.writeBlocked ?? org.writeBlocked,
          status: patch.status,
        },
      }).catch((e) => console.error(e));
      logAudit({ actor: "super_admin", action, target: org.name, reason });
      setReasonModal(null);
      setTick((t) => t + 1);
    };
    if (need) setReasonModal({ action, run: exec });
    else exec("action non-critique");
  };

  return (
    <div className="space-y-6" key={tick}>
      <button onClick={() => nav({ to: "/admin/organizations" })} className="inline-flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Toutes les organisations
      </button>

      <header className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#ff6c02] to-[#ff8a3d] font-display text-[16px] font-semibold text-white">
                {org.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div>
                <h1 className="font-display text-[24px] font-semibold">{org.name}</h1>
                <p className="text-[12.5px] text-white/60 capitalize">{org.type} · {org.country} · {org.sector}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill s={org.status} />
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-white/70">Plan {plan.name}</span>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${org.health === "critique" ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : org.health === "attention" ? "border-amber-400/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>Santé : {org.health}</span>
              {org.autopilot && <span className="rounded-full border border-[#ff8a3d]/30 bg-[#ff6c02]/10 px-2.5 py-0.5 text-[11px] text-[#ff8a3d]">Autopilot</span>}
              {org.writeBlocked && <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] text-rose-300">Écriture bloquée</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-white/40">Dépenses supervisées</p>
            <p className="mt-0.5 font-display text-[22px] font-semibold">{fmtMoney(org.adSpend)}</p>
            <p className="text-[11.5px] text-white/50">Coût IA : {Math.round(org.aiSpend)} $ · Renouvellement {fmtRelative(org.renewsAt)}</p>
          </div>
        </div>
      </header>

      <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.06] p-3 text-[12.5px] text-amber-200 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Le Super Admin ne doit pas consulter les données détaillées d'une organisation sans <strong>raison explicite</strong>. Toute action est <strong>journalisée</strong> et associée au compte support.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Informations générales">
          <Kv rows={[
            ["Nom légal", org.name],
            ["Type", org.type],
            ["Secteur", org.sector],
            ["Pays", org.country],
            ["Devise", org.currency],
            ["Fuseau", org.timezone],
            ["Langue", org.language],
            ["Responsable de compte", org.accountManager],
            ["Renouvellement", new Date(org.renewsAt).toLocaleDateString("fr-FR")],
          ]} />
        </Panel>
        <Panel title="Workspaces & activité">
          <Kv rows={[
            ["Workspaces", `${org.workspaces}`],
            ["Comptes publicitaires", `${org.adAccounts}`],
            ["Membres", `${org.members}`],
            ["Campagnes actives", `${8 + (org.adAccounts * 2)}`],
            ["Connexions", `${conns.length}`],
            ["Règles d'autonomie", plan.autonomy],
            ["Automations", plan.automations],
            ["Inscrite le", new Date(org.createdAt).toLocaleDateString("fr-FR")],
            ["Dernière activité", fmtRelative(org.lastActive)],
          ]} />
        </Panel>
        <Panel title="Actions administratives" subtitle="Chaque action nécessite une raison journalisée">
          <div className="grid grid-cols-2 gap-2">
            {org.status === "suspendue" ? (
              <ActionBtn icon={Play} label="Réactiver" onClick={() => run("Réactivation", { status: "active", writeBlocked: false })} />
            ) : (
              <ActionBtn icon={Ban} label="Suspendre" tone="danger" onClick={() => run("Suspension", { status: "suspendue", writeBlocked: true })} />
            )}
            <ActionBtn icon={Repeat} label="Changer d'offre" onClick={() => run("Changement d'offre", { plan: nextPlan(org.plan) })} />
            <ActionBtn icon={Sparkles} label="Quota temporaire" onClick={() => run("Quota temporaire", {})} />
            <ActionBtn icon={org.autopilot ? ShieldOff : ShieldCheck} label={org.autopilot ? "Désactiver Autopilot" : "Activer Autopilot"} onClick={() => run(org.autopilot ? "Désactivation Autopilot" : "Activation Autopilot", { autopilot: !org.autopilot })} />
            <ActionBtn icon={Lock} label={org.writeBlocked ? "Rétablir l'écriture" : "Bloquer l'écriture"} onClick={() => run(org.writeBlocked ? "Déblocage écriture" : "Blocage écriture", { writeBlocked: !org.writeBlocked })} />
            <ActionBtn icon={Unplug} label="Révoquer connexions" onClick={() => run("Révocation connexions", {})} />
            <ActionBtn icon={FileSearch} label="Audit de sécurité" onClick={() => run("Audit sécurité", {}, false)} />
            <ActionBtn icon={Download} label="Exporter les données" onClick={() => run("Export RGPD", {}, false)} />
            <ActionBtn icon={Trash2} label="Supprimer (RGPD)" tone="danger" onClick={() => run("Suppression RGPD", { status: "suspendue" })} />
          </div>
        </Panel>
      </div>

      <Panel title={`Membres (${members.length})`} subtitle="Aperçu — pas de PII détaillée">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-wider text-white/40">
              <tr><th className="py-2">Nom</th><th>Rôle</th><th>Statut</th><th>2FA</th><th>Dernière connexion</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {members.slice(0, 8).map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5"><Link to="/admin/users" className="hover:text-[#ff8a3d]">{m.name}</Link></td>
                  <td className="text-white/70 capitalize">{m.role.replace("_", " ")}</td>
                  <td className="text-white/70 capitalize">{m.status}</td>
                  <td>{m.twoFA ? <span className="text-emerald-300">Actif</span> : <span className="text-rose-300">Désactivé</span>}</td>
                  <td className="text-white/50">{fmtRelative(m.lastLogin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`Connexions publicitaires (${conns.length})`} subtitle="État de synchronisation par connecteur">
        <div className="grid gap-2 md:grid-cols-2">
          {conns.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{connectorLabel(c.connector)}</p>
                <p className="text-[11px] text-white/50">MAJ {fmtRelative(c.lastSync)} · {fmtNum(c.calls24h)} appels 24 h</p>
              </div>
              <StatusPill s={c.status} />
            </div>
          ))}
        </div>
      </Panel>

      {reasonModal && (
        <ReasonModal
          action={reasonModal.action}
          org={org.name}
          onCancel={() => setReasonModal(null)}
          onConfirm={reasonModal.run}
        />
      )}
    </div>
  );
}

function nextPlan(p: string) {
  const order = ["solo", "business", "growth", "autopilot", "agency_start", "agency_growth", "agency_scale", "enterprise"];
  const i = order.indexOf(p);
  return (order[(i + 1) % order.length]) as any;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-3">
        <h3 className="font-display text-[15px] font-semibold">{title}</h3>
        {subtitle && <p className="text-[11.5px] text-white/50">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Kv({ rows }: { rows: [string, string | number][] }) {
  return (
    <dl className="divide-y divide-white/[0.06] text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between py-2">
          <dt className="text-white/50">{k}</dt>
          <dd className="text-white/90 capitalize">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActionBtn({ icon: Icon, label, onClick, tone }: { icon: any; label: string; onClick: () => void; tone?: "danger" }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12.5px] transition ${
      tone === "danger" ? "border-rose-500/25 bg-rose-500/[0.05] text-rose-200 hover:bg-rose-500/10" : "border-white/10 bg-white/[0.03] text-white/85 hover:bg-white/[0.06]"
    }`}>
      <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span>
    </button>
  );
}

function ReasonModal({ action, org, onCancel, onConfirm }: { action: string; org: string; onCancel: () => void; onConfirm: (r: string) => void }) {
  const [reason, setReason] = useState("");
  const [ticket, setTicket] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111114] p-6">
        <h3 className="font-display text-[18px] font-semibold text-white">Confirmer : {action}</h3>
        <p className="mt-1 text-[12.5px] text-white/60">Sur <span className="text-white/90">{org}</span>. Cette action sera <strong>journalisée</strong>.</p>
        <label className="mt-4 block text-[11px] uppercase tracking-wider text-white/50">Raison (obligatoire)</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Motif détaillé de l'action…" className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white outline-none focus:border-[#ff8a3d]" />
        <label className="mt-3 block text-[11px] uppercase tracking-wider text-white/50">Ticket support (facultatif)</label>
        <input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="SUP-1234" className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white outline-none focus:border-[#ff8a3d]" />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-full border border-white/10 px-4 py-2 text-[12.5px] text-white/70 hover:bg-white/[0.05]">Annuler</button>
          <button
            disabled={reason.trim().length < 6}
            onClick={() => onConfirm(`${reason.trim()}${ticket ? ` [${ticket}]` : ""}`)}
            className="rounded-full bg-[#ff6c02] px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50 hover:brightness-110"
          >Exécuter</button>
        </div>
      </div>
    </div>
  );
}
