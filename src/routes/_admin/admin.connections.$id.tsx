import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  getConnection, getConnectionDetail, getOrganization, connectorLabel,
  updateConnection, patchConnectionDetail, logAudit, fmtRelative, fmtDateShort, fmtNum, fmtPct,
} from "@/lib/admin-store";
import { ArrowLeft, RefreshCw, Unplug, ShieldOff, PlayCircle, Beaker, Lock, AlertTriangle, KeyRound, EyeOff } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/connections/$id")({
  head: () => ({ meta: [{ title: "Fiche connexion — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: ConnectionDetailPage,
});

function ConnectionDetailPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [tick, setTick] = useState(0);
  const conn = useMemo(() => getConnection(id), [id, tick]);
  const detail = useMemo(() => conn ? getConnectionDetail(conn) : null, [conn, tick]);
  const org = conn ? getOrganization(conn.orgId) : null;

  if (!conn || !detail || !org) {
    return (
      <div className="space-y-4">
        <Link to="/admin/connections" className="inline-flex items-center gap-2 text-[13px] text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" /> Retour</Link>
        <p className="text-white/60">Connexion introuvable.</p>
      </div>
    );
  }

  const [reasonOpen, setReasonOpen] = useState<null | { title: string; onConfirm: (reason: string) => void }>(null);

  const askReason = (title: string, onConfirm: (r: string) => void) => setReasonOpen({ title, onConfirm });
  const bump = () => setTick((t) => t + 1);

  const doReconnect = (reason: string) => {
    updateConnection(conn.id, { status: "active", lastSync: new Date().toISOString() });
    patchConnectionDetail(conn.id, { connectedAt: new Date().toISOString(), lastErrors: [] });
    logAudit({ actor: "super_admin", action: "Demande de reconnexion", target: conn.id, reason });
    setReasonOpen(null); bump();
  };
  const doRevoke = (reason: string) => {
    updateConnection(conn.id, { status: "déconnectée" });
    patchConnectionDetail(conn.id, { readWrite: "aucune" });
    logAudit({ actor: "super_admin", action: "Révocation connexion", target: conn.id, reason });
    setReasonOpen(null); bump();
  };
  const doDisableWrite = (reason: string) => {
    patchConnectionDetail(conn.id, { writeDisabled: true, readWrite: "lecture" });
    logAudit({ actor: "super_admin", action: "Désactivation écriture", target: conn.id, reason });
    setReasonOpen(null); bump();
  };
  const doResync = () => {
    updateConnection(conn.id, { lastSync: new Date().toISOString() });
    logAudit({ actor: "super_admin", action: "Synchronisation relancée", target: conn.id });
    bump();
  };
  const doTest = () => {
    logAudit({ actor: "super_admin", action: "Test de connexion", target: conn.id });
    bump();
  };
  const doIsolate = (reason: string) => {
    patchConnectionDetail(conn.id, { isolated: true });
    logAudit({ actor: "super_admin", action: "Isolation connecteur", target: conn.id, reason });
    setReasonOpen(null); bump();
  };

  return (
    <div className="space-y-5">
      <Link to="/admin/connections" className="inline-flex items-center gap-2 text-[13px] text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" /> Toutes les connexions</Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Fiche connexion</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold">{connectorLabel(conn.connector)} — <span className="text-white/70">{org.name}</span></h1>
          <p className="mt-1 text-[13px] text-white/60">Compte externe {detail.externalAccount} · {conn.id}</p>
        </div>
        <StatusPill status={conn.status} />
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Identité">
          <Row label="Organisation">{org.name}</Row>
          <Row label="Fournisseur">{connectorLabel(conn.connector)}</Row>
          <Row label="Compte externe"><code className="text-white/80">{detail.externalAccount}</code></Row>
          <Row label="Statut lecture/écriture"><span className="capitalize">{detail.readWrite.replace("_", " / ")}</span></Row>
          <Row label="Actions autorisées">
            <div className="flex flex-wrap gap-1">
              {detail.allowedActions.map((a) => <Chip key={a}>{a}</Chip>)}
            </div>
          </Row>
        </Card>

        <Card title="Cycle de vie">
          <Row label="Date de connexion">{fmtDateShort(detail.connectedAt)}</Row>
          <Row label="Date d'expiration">
            <span className={new Date(detail.expiresAt) < new Date() ? "text-rose-300" : ""}>{fmtDateShort(detail.expiresAt)}</span>
          </Row>
          <Row label="Dernière synchro">{fmtRelative(conn.lastSync)}</Row>
          <Row label="Appels (24 h)">{fmtNum(conn.calls24h)}</Row>
          <Row label="Taux d'échec"><span className={conn.errorRate > 0.05 ? "text-amber-300" : ""}>{fmtPct(conn.errorRate, 1)}</span></Row>
        </Card>

        <Card title="Permissions & secret">
          <Row label="Scopes accordées">
            <div className="flex flex-wrap gap-1">{conn.scopes.map((s) => <Chip key={s}>{s}</Chip>)}</div>
          </Row>
          <Row label="Token OAuth">
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-2 py-1 font-mono text-[12px] text-white/70">
              <Lock className="h-3.5 w-3.5" /> {detail.tokenMasked}
              <EyeOff className="h-3.5 w-3.5 text-white/40" />
            </span>
            <p className="mt-1 text-[11px] text-white/40">Les tokens ne sont jamais affichés en clair.</p>
          </Row>
          <Row label="Écriture désactivée">{detail.writeDisabled ? <Tag tone="warn">Bloquée</Tag> : <Tag tone="ok">Autorisée</Tag>}</Row>
          <Row label="Connecteur isolé">{detail.isolated ? <Tag tone="warn">Isolé</Tag> : <Tag tone="ok">Actif</Tag>}</Row>
        </Card>
      </div>

      <Card title="Dernières erreurs">
        {detail.lastErrors.length === 0 ? (
          <p className="text-[13px] text-white/50">Aucune erreur récente.</p>
        ) : (
          <ul className="space-y-2">
            {detail.lastErrors.map((e, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-300" />
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-rose-200">{e.code}</p>
                  <p className="text-[12px] text-white/70">{e.message}</p>
                </div>
                <span className="text-[11px] text-white/40">{fmtRelative(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Actions administrateur">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Action icon={KeyRound} label="Demander une reconnexion" onClick={() => askReason("Demander une reconnexion", doReconnect)} />
          <Action icon={Unplug} label="Révoquer la connexion" danger onClick={() => askReason("Révoquer la connexion", doRevoke)} />
          <Action icon={ShieldOff} label="Désactiver l'écriture" onClick={() => askReason("Désactiver les actions d'écriture", doDisableWrite)} />
          <Action icon={PlayCircle} label="Relancer une synchronisation" onClick={doResync} />
          <Action icon={Beaker} label="Tester la connexion" onClick={doTest} />
          <Action icon={ShieldOff} label="Isoler le connecteur" danger onClick={() => askReason("Isoler ce connecteur", doIsolate)} />
        </div>
      </Card>

      {reasonOpen && <ReasonModal title={reasonOpen.title} onCancel={() => setReasonOpen(null)} onConfirm={reasonOpen.onConfirm} />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{title}</p>
      <div className="mt-3 space-y-2.5">{children}</div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
      <span className="text-[12px] text-white/50">{label}</span>
      <span className="max-w-[62%] text-right text-[13px] text-white/90">{children}</span>
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/70">{children}</span>;
}
function Tag({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" }) {
  const c = tone === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${c}`}>{children}</span>;
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "border-emerald-500/25 bg-emerald-500/15 text-emerald-300",
    expirée: "border-amber-500/25 bg-amber-500/15 text-amber-300",
    erreur: "border-rose-500/25 bg-rose-500/15 text-rose-300",
    permissions_manquantes: "border-amber-500/25 bg-amber-500/15 text-amber-300",
    déconnectée: "border-white/15 bg-white/[0.08] text-white/70",
  };
  return <span className={`rounded-full border px-3 py-1 text-[12px] font-medium capitalize ${map[status]}`}>{status.replace("_", " ")}</span>;
}
function Action({ icon: Icon, label, onClick, danger }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13px] transition ${
      danger ? "border-rose-500/25 bg-rose-500/[0.06] text-rose-200 hover:bg-rose-500/[0.12]" : "border-white/10 bg-white/[0.04] text-white/90 hover:bg-white/[0.08]"
    }`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
function ReasonModal({ title, onCancel, onConfirm }: { title: string; onCancel: () => void; onConfirm: (r: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141418] p-5">
        <h3 className="font-display text-[17px] font-semibold">{title}</h3>
        <p className="mt-1 text-[12.5px] text-white/60">Raison journalisée dans l'audit trail.</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] p-2.5 text-[13px] outline-none" placeholder="Motif de l'action…" />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-[13px] text-white/70 hover:bg-white/[0.06]">Annuler</button>
          <button disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())} className="rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40">Confirmer</button>
        </div>
      </div>
    </div>
  );
}

import type React from "react";