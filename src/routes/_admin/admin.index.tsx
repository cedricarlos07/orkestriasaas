import { createFileRoute, Link } from "@tanstack/react-router";
import {
  getGlobalKPIs, getMCPStatuses, getIncidents, PLANS, getOrganizations,
  getPlatformIncidents, getInvoices, getTickets, getAiLimits,
  fmtMoney, fmtNum, fmtPct, fmtRelative,
} from "@/lib/admin-store";
import {
  Users, Building2, CreditCard, TrendingUp, Megaphone, Wallet, Bot,
  AlertTriangle, Plug, Sparkles, ShieldAlert, Clock, Activity, ArrowRight,
  Sunrise, LifeBuoy, Coins, ShieldCheck, MessageSquare, RefreshCw, Search, FileText,
} from "lucide-react";

export const Route = createFileRoute("/_admin/admin/")({
  head: () => ({ meta: [{ title: "Tableau de bord — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminHome,
});

function AdminHome() {
  const k = getGlobalKPIs();
  const mcp = getMCPStatuses();
  const incidents = getIncidents();
  const orgs = getOrganizations().slice(0, 5);

  const platformIncidents = getPlatformIncidents().filter((i) => i.status !== "résolu");
  const failedInvoices = getInvoices().filter((i) => i.status === "échec");
  const riskyOrgs = getOrganizations().filter((o) => o.risk === "élevé" || o.status === "impayée" || o.status === "suspendue");
  const urgentTickets = getTickets().filter((t) => t.priority === "haute" || t.priority === "critique").slice(0, 6);
  const mcpDown = mcp.filter((m) => m.status !== "ok");
  const aiLimits = getAiLimits();
  const morning = [
    { label: "Santé MCP à vérifier", value: `${mcpDown.length} service${mcpDown.length > 1 ? "s" : ""}`, tone: mcpDown.length ? "warn" : "ok", to: "/admin/mcp", icon: Activity },
    { label: "Incidents ouverts", value: String(platformIncidents.length), tone: platformIncidents.length ? "warn" : "ok", to: "/admin/incidents", icon: AlertTriangle },
    { label: "Paiements échoués", value: String(failedInvoices.length), tone: failedInvoices.length ? "warn" : "ok", to: "/admin/billing", icon: CreditCard },
    { label: "Organisations à risque", value: String(riskyOrgs.length), tone: riskyOrgs.length ? "warn" : "ok", to: "/admin/organizations", icon: Building2 },
    { label: "Consommation IA anormale", value: `${fmtNum(Math.round(k.aiCostTotal))} $ / ${aiLimits.dailyGlobalUSD} $`, tone: k.aiCostTotal > aiLimits.dailyGlobalUSD * 0.8 ? "warn" : "ok", to: "/admin/costs", icon: Sparkles },
    { label: "Tickets prioritaires", value: String(urgentTickets.length), tone: urgentTickets.length ? "warn" : "ok", to: "/admin/support", icon: LifeBuoy },
    { label: "Actions financières échouées", value: "4", tone: "warn", to: "/admin/actions", icon: Wallet },
    { label: "Approbations en attente", value: fmtNum(k.pendingApprovals), tone: k.pendingApprovals > 10 ? "warn" : "ok", to: "/admin/approvals", icon: Clock },
  ] as const;

  const kpis = [
    { label: "Organisations actives", value: fmtNum(k.activeOrgs), icon: Building2, hint: "+3 cette semaine" },
    { label: "Utilisateurs actifs", value: fmtNum(k.activeUsers), icon: Users, hint: "+12 %" },
    { label: "Abonnements payants", value: fmtNum(k.payingSubs), icon: CreditCard, hint: "+2" },
    { label: "MRR", value: fmtMoney(k.mrr), icon: TrendingUp, hint: "+8.2 %" },
    { label: "ARR", value: fmtMoney(k.arr), icon: TrendingUp, hint: "projection annuelle" },
    { label: "Campagnes supervisées", value: fmtNum(k.supervisedCampaigns), icon: Megaphone, hint: "en cours" },
    { label: "Dépenses pub orchestrées", value: fmtMoney(k.adSpendOrchestrated), icon: Wallet, hint: "mois en cours" },
    { label: "Actions agents (24 h)", value: fmtNum(k.agentActionsToday), icon: Bot, hint: `${fmtPct(k.actionFailureRate, 2)} d'échec` },
    { label: "Connexions en erreur", value: fmtNum(k.connectionErrors), icon: Plug, tone: k.connectionErrors > 20 ? "warn" : "ok" as const },
    { label: "Coût IA total", value: `${fmtNum(Math.round(k.aiCostTotal))} $`, icon: Sparkles, hint: "24 h" },
    { label: "Incidents critiques", value: fmtNum(k.criticalIncidents), icon: ShieldAlert, tone: "warn" as const },
    { label: "Approbations bloquées", value: fmtNum(k.pendingApprovals), icon: Clock, hint: "à traiter" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Vue globale</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold">Pilotage de la plateforme</h1>
          <p className="mt-1 text-[13px] text-white/60">Une vision synthétique. Consultation d'une organisation = raison + journalisation.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/70">
          <Activity className="h-3.5 w-3.5 text-emerald-400" /> Systèmes opérationnels · MAJ temps réel
        </div>
      </header>

      <section className="rounded-2xl border border-[#ff8a3d]/25 bg-gradient-to-br from-[#ff8a3d]/[0.08] via-white/[0.03] to-transparent p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white shadow-[0_10px_28px_-10px_rgba(255,108,2,0.8)]">
              <Sunrise className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#ff8a3d]">Ce matin</p>
              <h2 className="mt-0.5 font-display text-[19px] font-semibold">Briefing quotidien du Super Admin</h2>
              <p className="text-[12.5px] text-white/60">Les 8 signaux à passer en revue chaque jour avant toute action.</p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {morning.map((m) => {
            const Icon = m.icon;
            const warn = m.tone === "warn";
            return (
              <Link key={m.label} to={m.to} className={`group rounded-xl border p-3 transition ${warn ? "border-amber-400/30 bg-amber-500/[0.06] hover:bg-amber-500/[0.1]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                <div className="flex items-center justify-between">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg ${warn ? "bg-amber-500/20 text-amber-300" : "bg-white/[0.06] text-white/70"}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
                </div>
                <p className="mt-2 text-[10.5px] uppercase tracking-wider text-white/40">{m.label}</p>
                <p className={`mt-0.5 font-display text-[16px] font-semibold ${warn ? "text-amber-200" : "text-white"}`}>{m.value}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          const tone = (k as any).tone as "warn" | "ok" | undefined;
          return (
            <div key={k.label} className={`rounded-2xl border p-4 ${tone === "warn" ? "border-amber-400/30 bg-amber-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex items-center justify-between">
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${tone === "warn" ? "bg-amber-500/20 text-amber-300" : "bg-white/[0.06] text-white/70"}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-wider text-white/40">{k.label}</p>
              <p className="mt-0.5 font-display text-[20px] font-semibold text-white">{k.value}</p>
              {k.hint && <p className="mt-0.5 text-[11px] text-white/50">{k.hint}</p>}
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Playbook
          title="En cas d'incident"
          icon={AlertTriangle}
          tone="rose"
          steps={[
            { label: "Couper les mutations d'une plateforme", to: "/admin/mcp" },
            { label: "Identifier les clients affectés", to: "/admin/incidents" },
            { label: "Suspendre les automatisations", to: "/admin/policies" },
            { label: "Informer les utilisateurs", to: "/admin/support" },
            { label: "Relancer les actions sûres", to: "/admin/actions" },
            { label: "Vérifier les budgets", to: "/admin/costs" },
            { label: "Publier un rapport", to: "/admin/incidents" },
          ]}
        />
        <Playbook
          title="En cas de plainte client"
          icon={MessageSquare}
          tone="amber"
          steps={[
            { label: "Ouvrir le ticket", to: "/admin/support" },
            { label: "Retrouver le run", to: "/admin/runs" },
            { label: "Vérifier les événements", to: "/admin/runs" },
            { label: "Consulter l'action publicitaire", to: "/admin/actions" },
            { label: "Comparer l'état avant / après", to: "/admin/actions" },
            { label: "Corriger ou escalader", to: "/admin/support" },
            { label: "Documenter la résolution", to: "/admin/compliance" },
          ]}
        />
        <Playbook
          title="En cas de coût anormal"
          icon={Coins}
          tone="emerald"
          steps={[
            { label: "Identifier les organisations concernées", to: "/admin/usage" },
            { label: "Trouver la fonctionnalité coûteuse", to: "/admin/costs" },
            { label: "Réduire les limites", to: "/admin/costs" },
            { label: "Changer le routage du modèle", to: "/admin/costs" },
            { label: "Corriger les boucles d'agent", to: "/admin/runs" },
            { label: "Proposer une montée en gamme", to: "/admin/billing" },
          ]}
        />
      </section>

      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-white/80">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">Principe fondamental</p>
            <h3 className="mt-0.5 font-display text-[15.5px] font-semibold">Le back-office n'est pas un poste de pilotage des campagnes clients.</h3>
            <p className="mt-1 text-[13px] text-white/70">Il sert à <span className="text-white">surveiller, sécuriser, diagnostiquer, administrer et assister</span>. Toute intervention sur un compte client doit être <span className="text-white">autorisée, limitée, motivée, visible, journalisée</span> et, quand c'est possible, <span className="text-white">réversible</span>.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Santé de la plateforme" subtitle="Services MCP, workers, files, notifications">
          <ul className="divide-y divide-white/[0.06]">
            {mcp.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2 w-2 rounded-full ${m.status === "ok" ? "bg-emerald-400" : m.status === "dégradé" ? "bg-amber-400" : "bg-rose-500"}`} />
                  <span className="text-[13px]">{m.label}</span>
                </div>
                <div className="text-right">
                  <p className={`text-[12px] font-semibold ${m.status === "ok" ? "text-emerald-300" : m.status === "dégradé" ? "text-amber-300" : "text-rose-300"}`}>{m.status}</p>
                  <p className="text-[10.5px] text-white/40">{m.latency} ms · {m.uptime} %</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Activité agentique" subtitle="Runs & actions en direct">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Runs en cours", value: "42", tone: "info" },
              { label: "Runs terminés (24 h)", value: fmtNum(2148), tone: "ok" },
              { label: "Runs échoués (24 h)", value: "31", tone: "warn" },
              { label: "Actions en attente", value: fmtNum(17), tone: "info" },
              { label: "Actions financières bloquées", value: "4", tone: "warn" },
              { label: "Coût IA du jour", value: "182 $", tone: "info" },
            ].map((r) => (
              <div key={r.label} className={`rounded-xl border p-3 ${r.tone === "warn" ? "border-amber-400/30 bg-amber-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
                <p className="text-[10.5px] uppercase tracking-wider text-white/40">{r.label}</p>
                <p className="mt-1 font-display text-[18px] font-semibold">{r.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Alertes critiques" subtitle="Événements à trancher aujourd'hui" action={<Link to="/admin/audit" className="text-[12px] text-[#ff8a3d] hover:underline">Journal complet →</Link>}>
          <ul className="space-y-2">
            {incidents.slice(0, 6).map((i) => (
              <li key={i.id} className={`rounded-xl border p-3 text-[12.5px] ${i.severity === "critique" ? "border-rose-500/30 bg-rose-500/[0.06]" : i.severity === "warn" ? "border-amber-400/30 bg-amber-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${i.severity === "critique" ? "text-rose-300" : i.severity === "warn" ? "text-amber-300" : "text-white/50"}`} />
                  <div className="min-w-0">
                    <p className="text-white/90">{i.message}</p>
                    <p className="mt-1 text-[10.5px] uppercase tracking-wider text-white/40">{i.kind.replace(/_/g, " ")} · {fmtRelative(i.at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Dernières organisations actives" subtitle="Aperçu — cliquez pour consulter (raison requise)" action={<Link to="/admin/organizations" className="text-[12px] text-[#ff8a3d] hover:underline flex items-center gap-1">Toutes les organisations <ArrowRight className="h-3 w-3" /></Link>}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-wider text-white/40">
              <tr><th className="py-2">Nom</th><th>Type</th><th>Plan</th><th>Statut</th><th>Dépenses</th><th>Dernière activité</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {orgs.map((o) => (
                <tr key={o.id} className="hover:bg-white/[0.03]">
                  <td className="py-2.5"><Link to="/admin/organizations/$id" params={{ id: o.id }} className="font-medium hover:text-[#ff8a3d]">{o.name}</Link></td>
                  <td className="text-white/70 capitalize">{o.type}</td>
                  <td className="text-white/70">{PLANS.find((p) => p.id === o.plan)?.name}</td>
                  <td><StatusPill s={o.status} /></td>
                  <td className="text-white/70">{fmtMoney(o.adSpend, o.currency)}</td>
                  <td className="text-white/50">{fmtRelative(o.lastActive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Playbook({ title, icon: Icon, tone, steps }: { title: string; icon: typeof AlertTriangle; tone: "rose" | "amber" | "emerald"; steps: { label: string; to: string }[] }) {
  const map = {
    rose: { border: "border-rose-500/25", bg: "bg-rose-500/[0.05]", chip: "bg-rose-500/20 text-rose-300", num: "text-rose-300" },
    amber: { border: "border-amber-400/25", bg: "bg-amber-500/[0.05]", chip: "bg-amber-500/20 text-amber-300", num: "text-amber-300" },
    emerald: { border: "border-emerald-500/25", bg: "bg-emerald-500/[0.05]", chip: "bg-emerald-500/20 text-emerald-300", num: "text-emerald-300" },
  }[tone];
  return (
    <div className={`rounded-2xl border ${map.border} ${map.bg} p-5`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${map.chip}`}><Icon className="h-4 w-4" /></span>
        <h3 className="font-display text-[15px] font-semibold">{title}</h3>
      </div>
      <ol className="mt-3 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i}>
            <Link to={s.to} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] text-white/75 hover:bg-white/[0.05] hover:text-white">
              <span className={`w-4 text-right font-mono text-[11px] ${map.num}`}>{i + 1}</span>
              <span className="flex-1">{s.label}</span>
              <ArrowRight className="h-3 w-3 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-semibold">{title}</h3>
          {subtitle && <p className="text-[11.5px] text-white/50">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    essai: "bg-sky-500/15 text-sky-300 border-sky-500/25",
    suspendue: "bg-rose-500/15 text-rose-300 border-rose-500/25",
    "impayée": "bg-amber-500/15 text-amber-300 border-amber-500/25",
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[s] ?? "bg-white/[0.05] text-white/70 border-white/10"}`}>{s}</span>;
}
