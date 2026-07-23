import { createFileRoute, Link, Outlet, useLocation, useNavigate, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { refreshAdminFromServer } from "@/lib/admin-store";
import { authClient } from "@/lib/auth-client";
import { BrandLogo } from "@/components/BrandLogo";
import {
  LayoutDashboard, Building2, Users, CreditCard, Plug, ShieldCheck,
  LogOut, Search, ChevronsLeft, ChevronsRight, ShieldAlert,
  Activity, Zap, CheckSquare, Sliders, Gauge, Coins, LayoutTemplate,
  Sparkles, Flag, LifeBuoy, AlertOctagon, Lock, FileSearch,
  BarChart3, Landmark, Settings2, UserCog,
  Briefcase, Receipt, Wallet, TrendingUp, Cpu, Bell, Globe2,
  MonitorCheck, MessageSquare, ShieldQuestion, Layers, Menu as MenuIcon, X, CalendarClock,
} from "lucide-react";

export const Route = createFileRoute("/_admin/admin")({
  head: () => ({ meta: [{ title: "Super Admin — Orkestria" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Vue globale",
    items: [
      { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, end: true },
      { to: "/admin/product-analytics", label: "Analytics produit", icon: BarChart3 },
    ],
  },
  {
    label: "Clients",
    items: [
      { to: "/admin/organizations", label: "Organisations", icon: Building2 },
      { to: "/admin/users", label: "Utilisateurs", icon: Users },
      { to: "/admin/organizations", label: "Agences", icon: Briefcase },
      { to: "/admin/billing", label: "Abonnements", icon: CreditCard },
    ],
  },
  {
    label: "Opérations",
    items: [
      { to: "/admin/runs", label: "Agent Runs", icon: Zap },
      { to: "/admin/actions", label: "Actions publicitaires", icon: Sliders },
      { to: "/admin/approvals", label: "Approbations", icon: CheckSquare },
      { to: "/admin/connections", label: "Connexions", icon: Plug },
      { to: "/admin/mcp", label: "MCP Health", icon: Activity },
    ],
  },
  {
    label: "IA et produit",
    items: [
      { to: "/admin/prompts", label: "Prompts", icon: Sparkles },
      { to: "/admin/prompts", label: "Skills", icon: Layers },
      { to: "/admin/costs", label: "Modèles IA", icon: Cpu },
      { to: "/admin/templates", label: "Templates", icon: LayoutTemplate },
      { to: "/admin/flags", label: "Feature Flags", icon: Flag },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/admin/billing", label: "Paiements", icon: Wallet },
      { to: "/admin/billing", label: "Factures", icon: Receipt },
      { to: "/admin/usage", label: "Consommation", icon: Gauge },
      { to: "/admin/costs", label: "Coûts", icon: Coins },
      { to: "/admin/finance", label: "Revenus", icon: TrendingUp },
    ],
  },
  {
    label: "Sécurité",
    items: [
      { to: "/admin/security", label: "Alertes", icon: ShieldAlert },
      { to: "/admin/security", label: "Sessions", icon: Lock },
      { to: "/admin/compliance", label: "Audit Logs", icon: FileSearch },
      { to: "/admin/policies", label: "Policies", icon: ShieldCheck },
      { to: "/admin/roles", label: "Accès internes", icon: UserCog },
    ],
  },
  {
    label: "Support",
    items: [
      { to: "/admin/support", label: "Tickets", icon: LifeBuoy },
      { to: "/admin/incidents", label: "Incidents", icon: AlertOctagon },
      { to: "/admin/mcp", label: "Statut système", icon: MonitorCheck },
      { to: "/admin/support", label: "Communications", icon: MessageSquare },
      { to: "/admin/booking", label: "Rendez-vous", icon: CalendarClock },
    ],
  },
  {
    label: "Paramètres",
    items: [
      { to: "/admin/billing", label: "Plans", icon: Landmark },
      { to: "/admin/system", label: "Limites", icon: ShieldQuestion },
      { to: "/admin/system", label: "Notifications", icon: Bell },
      { to: "/admin/system", label: "Pays et devises", icon: Globe2 },
      { to: "/admin/system", label: "Configuration système", icon: Settings2 },
    ],
  },
];

const adminRoute = getRouteApi("/_admin");

function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { session } = adminRoute.useRouteContext();
  const [ready, setReady] = useState(false);
  const [syncOk, setSyncOk] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { setMobileNav(false); }, [loc.pathname]);
  useEffect(() => {
    if (!mobileNav) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileNav]);

  useEffect(() => {
    let cancelled = false;
    void refreshAdminFromServer().then((ok) => {
      if (!cancelled) {
        setReady(true);
        setSyncOk(ok);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = (to: string, end?: boolean) =>
    end ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(to + "/");

  if (!ready) return <div className="grid min-h-screen place-items-center bg-[#0b0b0e] text-white/60 text-[13px]">Chargement du back-office…</div>;

  const email = session.user.email;

  return (
    <div className="flex min-h-screen bg-[#0b0b0e] text-white">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/10 bg-[#111114] lg:flex ${collapsed ? "w-[72px]" : "w-[260px]"}`}>
        <div className={`flex h-16 items-center gap-3 border-b border-white/10 ${collapsed ? "justify-center px-2" : "px-5"}`}>
          <BrandLogo variant="mark" className="h-8 w-8" />
          {!collapsed && (
            <div className="min-w-0">
              <BrandLogo variant="onDark" className="h-5 w-auto" />
              <p className="text-[10px] uppercase tracking-widest text-[#ff8a3d]">Super Admin</p>
            </div>
          )}
        </div>
        <nav className={`flex-1 overflow-y-auto ${collapsed ? "px-2 pt-4" : "px-3 pt-4"} pb-4`}>
          <div className={collapsed ? "space-y-1" : "space-y-4"}>
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    {group.label}
                  </p>
                )}
                {collapsed && <div className="mx-2 my-2 h-px bg-white/[0.06]" />}
                <ul className="space-y-0.5">
                  {group.items.map((item, idx) => {
                    const Icon = item.icon;
                    const active = isActive(item.to, item.end);
                    return (
                      <li key={`${group.label}-${item.label}-${idx}`}>
                        <Link
                          to={item.to}
                          title={collapsed ? `${group.label} · ${item.label}` : undefined}
                          className={`group flex items-center gap-3 rounded-xl text-[13.5px] transition ${collapsed ? "h-10 justify-center" : "px-3 py-2"} ${
                            active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                          }`}
                        >
                          <span className={`grid h-7 w-7 place-items-center rounded-lg ${active ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white shadow-[0_6px_16px_-6px_rgba(255,108,2,0.75)]" : "text-white/60"}`}>
                            <Icon className="h-[15px] w-[15px]" />
                          </span>
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <div className={`border-t border-white/10 ${collapsed ? "p-2" : "p-3"}`}>
          {!collapsed && (
            <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-widest text-white/40">Connecté</p>
              <p className="mt-0.5 truncate text-[13px] font-medium">{email}</p>
              <p className="text-[11px] text-[#ff8a3d]">Super Admin</p>
            </div>
          )}
          <div className={`flex ${collapsed ? "justify-center" : "gap-2"}`}>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="grid h-9 w-9 place-items-center rounded-lg text-white/60 hover:bg-white/[0.06] hover:text-white"
              aria-label="Basculer sidebar"
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
            {!collapsed && (
              <button
                onClick={() => { void authClient.signOut().then(() => nav({ to: "/auth", replace: true })); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-[13px] text-white/80 hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" /> Quitter
              </button>
            )}
          </div>
        </div>
      </aside>

      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-[#111114] shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-2">
                <BrandLogo variant="mark" className="h-8 w-8" />
                <div>
                  <BrandLogo variant="onDark" className="h-4 w-auto" />
                  <p className="text-[10px] uppercase tracking-widest text-[#ff8a3d]">Super Admin</p>
                </div>
              </div>
              <button onClick={() => setMobileNav(false)} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-lg text-white/60 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-4">
              <div className="space-y-4">
                {NAV_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{group.label}</p>
                    <ul className="space-y-0.5">
                      {group.items.map((item, idx) => {
                        const Icon = item.icon;
                        const active = isActive(item.to, item.end);
                        return (
                          <li key={`m-${group.label}-${item.label}-${idx}`}>
                            <Link
                              to={item.to}
                              onClick={() => setMobileNav(false)}
                              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] ${active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"}`}
                            >
                              <span className={`grid h-7 w-7 place-items-center rounded-lg ${active ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white" : ""}`}>
                                <Icon className="h-[15px] w-[15px]" />
                              </span>
                              <span className="truncate">{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </nav>
            <div className="border-t border-white/10 p-3">
              <button
                onClick={() => { void authClient.signOut().then(() => nav({ to: "/auth", replace: true })); }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-[13px] text-white/80 hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" /> Quitter
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-white/10 bg-[#0b0b0e]/85 px-3 backdrop-blur sm:gap-4 sm:px-6">
          <button
            onClick={() => setMobileNav(true)}
            aria-label="Ouvrir le menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="hidden flex-1 max-w-[520px] items-center gap-2 rounded-full bg-white/[0.04] px-4 py-2 text-[13px] text-white/60 ring-1 ring-white/10 sm:flex">
            <Search className="h-4 w-4" />
            <input placeholder="Rechercher une organisation, un utilisateur, une facture…" className="w-full bg-transparent outline-none placeholder:text-white/40" />
          </div>
          <div className="flex-1 sm:hidden" />
          <Link to="/app" className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/70 hover:bg-white/[0.05]">← <span className="hidden sm:inline">Espace client</span><span className="sm:hidden">App</span></Link>
        </header>
        {!syncOk && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-100 sm:px-6">
            Sync serveur incomplète — certaines listes peuvent être vides. Rechargez la page.
          </div>
        )}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
