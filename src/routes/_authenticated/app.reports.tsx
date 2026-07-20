import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileBarChart, Users, Building2, Cog, FileText, Loader2 } from "lucide-react";
import { getProfitabilityReport } from "@/functions/business-memory";
import { getDashboardKpis } from "@/functions/dashboard";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/reports")({ component: Reports });

const TYPES = [
  { i: Users, t: "Dirigeant", d: "Dépenses, ventes, marge, problèmes, décisions.", tone: "from-[#ff8a3c] to-[#ff6c02]", halo: "bg-[#ff6c02]/20" },
  { i: FileBarChart, t: "Marketing", d: "Performances par plateforme, audiences, créations.", tone: "from-sky-400 to-sky-600", halo: "bg-sky-300/25" },
  { i: Building2, t: "Agence", d: "Résultats, travail effectué, optimisations, actions.", tone: "from-violet-400 to-violet-600", halo: "bg-violet-300/25" },
  { i: Cog, t: "Technique", d: "Métriques détaillées, tracking, événements, config.", tone: "from-emerald-400 to-emerald-600", halo: "bg-emerald-300/25" },
];

function Reports() {
  const { data: execReport } = useQuery({
    queryKey: ["profitability-report"],
    queryFn: () => getProfitabilityReport(),
  });
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: () => getDashboardKpis(),
  });

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[0_10px_24px_-10px_rgba(255,108,2,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]">
            <FileBarChart className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Rapports</p>
            <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Performances réelles</h1>
            <p className="text-[13px] text-ink-soft">Données issues de vos comptes publicitaires connectés.</p>
          </div>
        </div>
      </header>

      {execReport && (
        <section className="card-soft border border-[#ff6c02]/20 bg-gradient-to-r from-[#fff8f0] to-white p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">
            Rapport dirigeant · {execReport.period}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink">{execReport.summary}</p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TYPES.map((t) => (
          <div key={t.t} className="card-soft relative overflow-hidden p-4 text-left opacity-80">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${t.tone} text-white`}>
              <t.i className="h-4 w-4" />
            </span>
            <p className="mt-3 font-display font-semibold text-ink">{t.t}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{t.d}</p>
            <p className="mt-2 text-[11px] font-medium text-ink-soft">Bientôt · export PDF</p>
          </div>
        ))}
      </section>

      <section className="card-soft p-5">
        <p className="text-[12px] font-medium uppercase tracking-wider text-ink-soft">Métriques 30 jours</p>
        {isLoading ? (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : !dashboard?.metaConnected || !(dashboard.kpis?.length) ? (
          <p className="mt-4 text-[14px] text-ink-soft">
            Connectez Meta Ads pour afficher les métriques.{" "}
            <Link to="/app/connections" className="font-semibold text-[#ff6c02] underline">
              Connexions
            </Link>
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {dashboard.kpis.map((k) => (
              <div key={k.key} className="rounded-xl border border-line/60 bg-white p-4">
                <p className="text-[11px] uppercase tracking-wider text-ink-soft">{k.label}</p>
                <p className="mt-2 font-display text-[20px] font-semibold text-ink">{k.value}</p>
                <p className="mt-1 text-[12px] text-ink-soft">{k.deltaLabel}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card-soft overflow-hidden">
        <div className="border-b border-line/60 px-5 py-3 text-[12px] font-medium uppercase tracking-wider text-ink-soft">
          Récents
        </div>
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-[14px] text-ink-soft">
          <FileText className="h-8 w-8 text-ink-soft/50" />
          <p>Aucun rapport enregistré.</p>
          <Link to="/app/orkestria" className="text-[#ff6c02] underline">
            Demander un rapport à Orkestria
          </Link>
        </div>
      </section>
    </div>
  );
}
