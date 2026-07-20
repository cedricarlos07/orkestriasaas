import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Megaphone, ShieldAlert, Sparkles, TrendingUp, TrendingDown, Minus, Wallet, Target, Coins, CheckCircle2, Plug, Activity, Check, X, Pencil, Loader2 } from "lucide-react";
import { useNotifications } from "@/lib/notifications-store";
import { approveActionFn, listPendingApprovals, rejectActionFn } from "@/functions/ad-actions";
import { getDashboardKpis } from "@/functions/dashboard";

export const Route = createFileRoute("/_authenticated/app/")({ component: Today });

type Approval = {
  id: string;
  action: string;
  reason: string;
  cost: string;
  impact: string;
  risk: "Faible" | "Modéré" | "Élevé";
  confidence: number;
};

function Today() {
  const { push } = useNotifications();
  const qc = useQueryClient();
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: () => getDashboardKpis(),
  });
  const { data: pending = [] } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: () => listPendingApprovals(),
  });

  const kpiIcons: Record<string, typeof Wallet> = {
    spend: Wallet,
    results: Target,
    cpa: Coins,
    campaigns: Megaphone,
    account: Plug,
    issues: ShieldAlert,
  };

  const kpiStyles = [
    { grad: "from-[#fff1e2] via-[#ffe0c2] to-[#ffcf9c]", ring: "ring-[#ffb066]/50", ic: "text-[#c94a00]" },
    { grad: "from-[#e6f7ee] via-[#c9edd8] to-[#a9e0bf]", ring: "ring-[#5cc281]/50", ic: "text-[#0f7a3c]" },
    { grad: "from-[#fff7d6] via-[#ffe7a3] to-[#ffd36b]", ring: "ring-[#e8b83a]/50", ic: "text-[#8a5a00]" },
    { grad: "from-[#e8f0ff] via-[#c9dcff] to-[#a3c1ff]", ring: "ring-[#6b95ff]/50", ic: "text-[#1b3a8a]" },
    { grad: "from-[#f0e6ff] via-[#dcc7ff] to-[#c2a3ff]", ring: "ring-[#9b74ff]/50", ic: "text-[#4a2a9e]" },
    { grad: "from-[#ffe6ee] via-[#ffc7d8] to-[#ffa3bd]", ring: "ring-[#ff74a1]/50", ic: "text-[#9e1e4a]" },
  ];

  const approvals: Approval[] = pending.map((p) => ({
    id: p.id,
    action: p.action?.action ?? "Action publicitaire",
    reason: `Approbation requise (${p.track ?? "standard"})`,
    cost: "—",
    impact: "—",
    risk: p.track === "high" ? "Élevé" : p.track === "medium" ? "Modéré" : "Faible",
    confidence: 75,
  }));

  const decide = async (id: string, verdict: "approved" | "refused") => {
    const item = approvals.find((a) => a.id === id);
    if (verdict === "approved") await approveActionFn({ data: { approvalId: id } });
    else await rejectActionFn({ data: { approvalId: id } });
    void qc.invalidateQueries({ queryKey: ["pending-approvals"] });
    if (item) push({ kind: "status", title: verdict === "approved" ? "Action approuvée" : "Action refusée", body: `${item.action}` });
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 anim-fade-up">
        <div>
          <p className="text-[13px] text-ink-soft">{dashboard?.greeting ?? "Bonjour 👋"}</p>
          <h1 className="mt-1 font-display text-[28px] font-semibold text-ink">Aujourd'hui</h1>
          <p className="mt-1 max-w-[560px] text-[13px] text-ink-soft">
            {dashboard?.metaConnected
              ? `Données Meta · ${dashboard.company}. ${approvals.length} action${approvals.length > 1 ? "s" : ""} en attente.`
              : dashboard?.pendingApprovalsHint ?? "Connectez Meta Ads pour piloter vos campagnes."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/orkestria" className="btn-dark btn-halo">Parler à Orkestria</Link>
          <Link to="/app/campaigns/new" className="btn-primary btn-halo">Nouvelle campagne</Link>
        </div>
      </header>

      {!dashboard?.metaConnected && !dashLoading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-900">
          Connectez votre compte Meta Ads pour afficher vos KPIs réels.{" "}
          <Link to="/app/connections" className="font-semibold underline">Aller aux connexions</Link>
        </div>
      )}

      <section className="stagger grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {dashLoading ? (
          <div className="col-span-full flex items-center gap-2 text-[13px] text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement des métriques…
          </div>
        ) : (
          (dashboard?.kpis ?? []).map((s, idx) => {
          const Icon = kpiIcons[s.key] ?? Sparkles;
          const style = kpiStyles[idx % kpiStyles.length];
          const TrendIcon = s.trend === "up" ? TrendingUp : s.trend === "down" ? TrendingDown : Minus;
          const badgeCls = s.trend === "up" ? "kpi-up" : s.trend === "down" ? "kpi-down" : "kpi-flat";
          const trendLabel = s.trend === "up" ? "Amélioration" : s.trend === "down" ? "Baisse" : "Stable";
          return (
            <div
              key={s.key}
              className={`card-hover relative overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br ${style.grad} p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-16px_rgba(20,20,20,0.25)]`}
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/40 blur-xl anim-pulse-dot" />
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink/70">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-white/80 ${style.ic} ring-1 ${style.ring} shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {s.label}
                </div>
                <span className={`kpi-badge ${badgeCls}`} title={trendLabel}>
                  <TrendIcon className="h-2.5 w-2.5" strokeWidth={3} />
                  {s.delta}
                </span>
              </div>
              <p className="relative mt-2 font-display text-[18px] font-semibold text-ink">{s.value}</p>
              <p className="relative mt-0.5 text-[11px] text-ink-soft">{s.deltaLabel} · {trendLabel}</p>
            </div>
          );
        })
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card-hover anim-fade-up relative overflow-hidden rounded-2xl border border-[#ffd7b0] bg-gradient-to-br from-[#fff6ec] via-[#ffe9d1] to-[#ffdcb3] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_30px_-20px_rgba(200,90,0,0.35)]" style={{ animationDelay: "80ms" }}>
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#ff9040]/20 blur-3xl" />
            <h2 className="relative mb-4 flex items-center gap-2 font-display text-[16px] font-semibold text-ink"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white shadow-[0_6px_16px_-6px_rgba(255,108,2,0.6)]"><CheckCircle2 className="h-4 w-4" /></span> À approuver</h2>
            {approvals.length === 0 && <p className="text-[13px] text-ink-soft">Aucune action en attente. Tout est sous contrôle.</p>}
            <ul className="stagger relative space-y-3">
              {approvals.map((a) => (
                <li key={a.id} className="card-hover relative overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-4 backdrop-blur shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_-2px_rgba(0,0,0,0.06)]">
                  <span className="absolute left-0 top-4 h-8 w-[3px] rounded-r-full bg-gradient-to-b from-[#ff8a2b] to-[#ff5e00]" />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-ink">{a.action}</p>
                      <p className="mt-1 text-[13px] text-ink-soft">{a.reason}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
                        <Cell k="Coût" v={a.cost} />
                        <Cell k="Impact" v={a.impact} />
                        <Cell k="Risque" v={a.risk} />
                        <Cell k="Confiance" v={`${a.confidence}%`} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => void decide(a.id, "approved")} className="btn-primary btn-halo !px-3 !py-1.5 !text-[12px]"><Check className="h-3.5 w-3.5" /> Approuver</button>
                    <button className="chip-ghost !py-1.5 !text-[12px]"><Pencil className="h-3.5 w-3.5" /> Modifier</button>
                    <button onClick={() => void decide(a.id, "refused")} className="chip-ghost !py-1.5 !text-[12px]"><X className="h-3.5 w-3.5" /> Refuser</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-hover anim-fade-up relative overflow-hidden rounded-2xl border border-[#c9e4d3] bg-gradient-to-br from-[#f0faf3] via-[#dff2e6] to-[#c9e9d3] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_30px_-20px_rgba(20,100,60,0.25)]" style={{ animationDelay: "160ms" }}>
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#12a04d]/15 blur-3xl" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="relative flex items-center gap-2 font-display text-[16px] font-semibold text-ink"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#2fbf6b] to-[#0f7a3c] text-white shadow-[0_6px_16px_-6px_rgba(15,122,60,0.6)]"><Activity className="h-4 w-4" /></span> Actions réalisées</h2>
              <Link to="/app/reports" className="chip-ghost">Voir le rapport <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </div>
            <p className="relative text-[13px] text-ink-soft">
              Aucune action exécutée récemment. Les pauses, créations et syncs Meta / AdKit apparaîtront ici.
            </p>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card-hover anim-slide-r relative overflow-hidden rounded-2xl border border-[#ffd0c2] bg-gradient-to-br from-[#fff1ea] via-[#ffdbc7] to-[#ffc4a3] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_30px_-20px_rgba(180,60,0,0.3)]" style={{ animationDelay: "120ms" }}>
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#ff5e5e]/15 blur-3xl" />
            <h3 className="relative mb-3 flex items-center gap-2 font-display text-[16px] font-semibold text-ink"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff7a4a] to-[#c93a12] text-white shadow-[0_6px_16px_-6px_rgba(200,60,20,0.6)]"><ShieldAlert className="h-4 w-4" /></span> Alertes</h3>
            {!dashboard?.metaConnected ? (
              <p className="relative text-[13px] text-ink">
                Connectez Meta Ads pour activer les alertes.{" "}
                <Link to="/app/connections" className="font-semibold underline">Connexions</Link>
              </p>
            ) : (
              <p className="relative text-[13px] text-ink-soft">Aucune alerte — tout est calme pour le moment.</p>
            )}
          </div>

          <div className="card-ink card-hover anim-slide-r p-5" style={{ animationDelay: "220ms" }}>
            <p className="relative text-[12px] font-medium uppercase tracking-wider text-[#ff8a3d]">Prochaine étape</p>
            <p className="relative mt-2 text-[14px]">
              {dashboard?.metaConnected
                ? "Lancez une analyse ou créez une campagne Meta via AdKit."
                : "Connectez Meta Ads pour piloter vos campagnes."}
            </p>
            <div className="relative mt-3 flex gap-2">
              <Link to={dashboard?.metaConnected ? "/app/campaigns/new" : "/app/connections"} className="btn-primary btn-halo !px-3 !py-1.5 !text-[12px]">
                {dashboard?.metaConnected ? "Nouvelle campagne" : "Connecter Meta"}
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-line/60 bg-gradient-to-b from-white to-[#f5f2ec] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <p className="text-[10px] uppercase tracking-wider text-ink-soft">{k}</p>
      <p className="mt-0.5 text-[12px] font-medium text-ink">{v}</p>
    </div>
  );
}