import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { CampaignsShell } from "./app.campaigns";
import { useCampaigns, type CampaignStatus } from "@/lib/campaigns-store";
import { useNotifications } from "@/lib/notifications-store";
import { ArrowLeft, Play, Pause, Copy, FileText, Sparkles, CheckCircle2, PauseCircle, AlertTriangle, Clock, Megaphone, Target, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/campaigns/$id")({ component: Detail });

const badge: Record<CampaignStatus, { c: string; i: typeof CheckCircle2; l: string }> = {
  live: { c: "bg-emerald-50 text-emerald-700", i: CheckCircle2, l: "En diffusion" },
  paused: { c: "bg-amber-50 text-amber-700", i: PauseCircle, l: "En pause" },
  draft: { c: "bg-slate-100 text-slate-600", i: AlertTriangle, l: "Brouillon" },
};

function Detail() {
  const { id } = useParams({ from: "/app/campaigns/$id" });
  const nav = useNavigate();
  const { list, duplicate, setStatus } = useCampaigns();
  const { push } = useNotifications();
  const c = useMemo(() => list.find((x) => x.id === id), [list, id]);

  if (!c) {
    return (
      <CampaignsShell>
        <div className="rounded-2xl border border-line/70 bg-white p-10 text-center">
          <p className="text-[14px] text-ink-soft">Cette campagne n'existe plus.</p>
          <Link to="/app/campaigns" className="mt-4 inline-flex chip-ghost"><ArrowLeft className="h-4 w-4" /> Retour</Link>
        </div>
      </CampaignsShell>
    );
  }

  const B = badge[(c.status as CampaignStatus)] ?? badge.draft;
  const timeline = [
    { t: c.createdAt, label: "Créée", body: c.externalId ? `ID externe : ${c.externalId}` : "Brouillon local." },
    ...(c.updatedAt !== c.createdAt
      ? [{ t: c.updatedAt, label: "Dernière mise à jour", body: `Statut : ${B.l}` }]
      : []),
  ].sort((a, b) => b.t - a.t);

  const change = (next: CampaignStatus) => {
    setStatus(c.id, next);
    push({ kind: "status", title: `Campagne ${next === "live" ? "activée" : next === "paused" ? "mise en pause" : "remise en brouillon"}`, body: `« ${c.name} » — ${next}.` });
  };

  return (
    <CampaignsShell>
      <div className="mb-4">
        <Link to="/app/campaigns" className="inline-flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Toutes les campagnes
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[22px] font-semibold text-ink">{c.name}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${B.c}`}>
              <B.i className="h-3.5 w-3.5" /> {B.l}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-ink-soft">{c.channel} · {c.zone ?? "—"} · Budget {c.budget ?? "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => change("draft")} className="chip-ghost"><FileText className="h-3.5 w-3.5" /> Brouillon</button>
          <button type="button" onClick={() => change("paused")} className="chip-ghost"><Pause className="h-3.5 w-3.5" /> Pause</button>
          <button type="button" onClick={() => change("live")} className="chip-ghost"><Play className="h-3.5 w-3.5" /> Live</button>
          <button
            type="button"
            onClick={() => {
              const copy = duplicate(c.id);
              if (copy) { push({ kind: "approval", title: "Brouillon créé", body: `« ${copy.name} » à approuver.` }); nav({ to: "/app/campaigns/$id", params: { id: copy.id } }); }
            }}
            className="chip-ghost"
          ><Copy className="h-3.5 w-3.5" /> Dupliquer</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { k: "Dépense", v: `${c.spend} FCFA`, i: Wallet },
          { k: "Conversions", v: String(c.conv), i: Target },
          { k: "ROAS", v: c.roas, i: Sparkles },
          { k: "Canal", v: c.channel, i: Megaphone },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-line/70 bg-white p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-soft"><s.i className="h-3.5 w-3.5" /> {s.k}</div>
            <p className="mt-2 font-display text-[20px] font-semibold text-ink">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-line/70 bg-white p-6">
            <h3 className="mb-2 font-display text-[16px] font-semibold text-ink">Plan média</h3>
            <p className="text-[13px] text-ink-soft">
              Les ad sets / audiences Meta seront listés ici après synchronisation.
            </p>
          </section>

          <section className="rounded-2xl border border-line/70 bg-white p-6">
            <h3 className="mb-2 font-display text-[16px] font-semibold text-ink">Créations</h3>
            <p className="text-[13px] text-ink-soft">Aucune création liée pour le moment.</p>
          </section>
        </div>

        <aside className="rounded-2xl border border-line/70 bg-white p-6">
          <h3 className="mb-4 flex items-center gap-2 font-display text-[16px] font-semibold text-ink"><Clock className="h-4 w-4 text-[#ff6c02]" /> Chronologie</h3>
          <ol className="relative space-y-4 border-l border-line/70 pl-4">
            {timeline.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#ff6c02] ring-4 ring-[#fff6ee]" />
                <p className="text-[13px] font-medium text-ink">{e.label}</p>
                <p className="text-[12px] text-ink-soft">{e.body}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">{new Date(e.t).toLocaleString("fr-FR")}</p>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </CampaignsShell>
  );
}
