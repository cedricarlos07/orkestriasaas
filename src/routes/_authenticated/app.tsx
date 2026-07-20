import { createFileRoute, Link, Outlet, useLocation, useNavigate, getRouteApi } from "@tanstack/react-router";
import { APP_NAV_GROUPS } from "@/lib/app-nav";
import { Bell, Plus, Search, Check, X, CheckCircle2, Mail, ChevronsLeft, ChevronsRight, HelpCircle, Sparkles, LogOut, ChevronDown, Settings as SettingsIcon, RefreshCw, Briefcase, User, ShieldAlert, Menu as MenuIcon } from "lucide-react";
import { checkSuperAdminSession } from "@/lib/admin-store";
import { authClient } from "@/lib/auth-client";
import { getProfile, saveUserProfile } from "@/functions/profiles";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

import { useNotifications, timeAgo, type Notification } from "@/lib/notifications-store";
import { useCampaigns } from "@/lib/campaigns-store";

type AppProfile = {
  userId: string;
  email: string;
  appRole: "agency" | "client";
  company: string;
  sector?: string | null;
  size?: string | null;
};

const authenticatedRoute = getRouteApi("/_authenticated");

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Espace Orkestria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppLayout,
});

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, profile: routeProfile } = authenticatedRoute.useRouteContext();
  const [profileOverride, setProfileOverride] = useState<AppProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const profile: AppProfile =
    profileOverride ??
    ({
      userId: routeProfile.userId,
      email: session.user.email,
      appRole: routeProfile.appRole as "agency" | "client",
      company: routeProfile.company,
      sector: routeProfile.sector,
      size: routeProfile.size,
    } satisfies AppProfile);

  useEffect(() => {
    void checkSuperAdminSession().then(setIsAdmin);
  }, []);

  useEffect(() => {
    const onChange = () => {
      void getProfile().then((p) => {
        if (!p) return;
        setProfileOverride({
          userId: p.userId,
          email: session.user.email,
          appRole: p.appRole as "agency" | "client",
          company: p.company,
          sector: p.sector,
          size: p.size,
        });
      });
    };
    window.addEventListener("orkestria:profile-changed", onChange);
    return () => window.removeEventListener("orkestria:profile-changed", onChange);
  }, [session.user.email]);

  const isActive = (to: string) =>
    to === "/app" ? location.pathname === "/app" : location.pathname.startsWith(to);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("orkestria:sidebar:collapsed") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("orkestria:sidebar:collapsed", collapsed ? "1" : "0");
  }, [collapsed]);
  const { unread } = useNotifications();
  const { list: campaigns } = useCampaigns();
  const liveCount = campaigns.filter((c) => c.status === "live").length;
  const draftCount = campaigns.filter((c) => c.status === "draft").length;
  const badges: Record<string, number> = {
    "/app": unread,
    "/app/campaigns": liveCount,
    "/app/runs": campaigns.filter((c) => c.status === "paused").length,
  };

  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { setMobileNav(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileNav) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileNav]);

  const initials = (profile.company || "OR")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-surface-2">
      {/* Sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line/70 bg-white transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[72px]" : "w-[264px]"
        }`}
      >
        <div className={`flex h-16 items-center gap-2 border-b border-line/70 ${collapsed ? "justify-center px-2" : "px-5"}`}>
          {collapsed ? (
            <div className="relative">
              <BrandLogo variant="mark" className="h-8 w-8" />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
          ) : (
            <>
              <div className="min-w-0">
                <BrandLogo className="block h-5 w-auto" />
                <span className="mt-0.5 block text-[10px] text-ink-soft">Agent publicitaire</span>
              </div>
              <span className="ml-auto rounded-full bg-[#fff6ee] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#ff6c02]">Beta</span>
            </>
          )}
        </div>

        <div className={`${collapsed ? "px-2 pt-3" : "px-3 pt-4"}`}>
          <Link
            to="/app/campaigns/new"
            title="Nouvelle campagne"
            className={`btn-primary flex items-center justify-center gap-2 ${collapsed ? "!h-10 !w-full !p-0" : "w-full !py-2.5"}`}
          >
            <Plus className="h-4 w-4" />
            {!collapsed && <span>Nouvelle campagne</span>}
          </Link>
          {!collapsed && draftCount > 0 && (
            <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-ink-soft">
              <Sparkles className="h-3 w-3 text-[#ff6c02]" />
              {draftCount} brouillon{draftCount > 1 ? "s" : ""} en attente
            </p>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto ${collapsed ? "px-2 pt-4" : "px-3 pt-4"} pb-4`}>
          {APP_NAV_GROUPS.map((group, gi) => (
            <div key={group.title} className={gi > 0 ? "mt-5" : ""}>
              {!collapsed && (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft/70">
                  {group.title}
                </p>
              )}
              {collapsed && gi > 0 && <div className="mx-2 mb-3 h-px bg-line/70" />}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.to);
                  const Icon = item.icon;
                  const badge = badges[item.to];
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        title={collapsed ? item.label : undefined}
                        className={`group relative flex items-center gap-3 rounded-xl text-[13.5px] transition ${
                          collapsed ? "h-10 justify-center" : "px-3 py-2"
                        } ${
                          active
                            ? "bg-ink text-white shadow-sm"
                            : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                        }`}
                      >
                        {active && !collapsed && (
                          <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#ff6c02] animate-[navRail_320ms_ease-out]" />
                        )}
                        <span
                          className={`relative flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-300 ${
                            active
                              ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white shadow-[0_6px_16px_-6px_rgba(255,108,2,0.75)] ring-1 ring-white/25 animate-[navIconPop_360ms_cubic-bezier(0.34,1.56,0.64,1)]"
                              : "text-ink-soft group-hover:bg-surface-2 group-hover:text-ink"
                          }`}
                        >
                          {active && (
                            <span className="pointer-events-none absolute inset-0 rounded-lg bg-[#ff6c02]/40 blur-md animate-[navGlow_2.4s_ease-in-out_infinite]" />
                          )}
                          <Icon
                            className={`relative h-[15px] w-[15px] shrink-0 transition-transform duration-300 ${
                              active ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" : "group-hover:scale-110"
                            }`}
                            strokeWidth={active ? 2.4 : 2}
                          />
                        </span>
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {!collapsed && badge ? (
                          <span
                            className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                              active ? "bg-white/15 text-white" : "bg-[#fff6ee] text-[#ff6c02]"
                            }`}
                          >
                            {badge}
                          </span>
                        ) : null}
                        {collapsed && badge ? (
                          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#ff6c02]" />
                        ) : null}
                        {!collapsed && !badge && item.kbd && (
                          <kbd className="ml-auto hidden rounded border border-line/60 bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-soft group-hover:inline-block">
                            {item.kbd}
                          </kbd>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {!collapsed && (
          <Link
            to="/app/orkestria"
            className="mx-3 mb-3 flex items-start gap-2 rounded-xl border border-line/60 bg-gradient-to-br from-[#fff6ee] to-white p-3 transition hover:border-[#ff6c02]/40"
          >
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6c02]" />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-ink">Besoin d'aide ?</p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">
                Demandez à l'agent Orkestria en langage naturel.
              </p>
            </div>
          </Link>
        )}

        <div className={`border-t border-line/70 ${collapsed ? "p-2" : "p-3"}`}>
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-[13px] font-semibold text-white shadow-sm">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{profile?.company ?? "Espace Orkestria"}</p>
                <p className="truncate text-[11px] text-ink-soft">
                  {profile?.appRole === "agency" ? "Agence" : "Annonceur"} · {profile?.sector ?? "—"}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                aria-label="Réduire la barre latérale"
                className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface-2 hover:text-ink"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              aria-label="Déployer la barre latérale"
              className="mt-2 flex w-full items-center justify-center rounded-lg py-1.5 text-ink-soft transition hover:bg-surface-2 hover:text-ink"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-line/70 px-4">
              <div className="flex items-center gap-2">
                <BrandLogo className="h-7 w-auto" />
              </div>
              <button onClick={() => setMobileNav(false)} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-surface-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-3 pt-3">
              <Link to="/app/campaigns/new" onClick={() => setMobileNav(false)} className="btn-primary flex w-full items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> Nouvelle campagne
              </Link>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-4">
              {APP_NAV_GROUPS.map((group, gi) => (
                <div key={group.title} className={gi > 0 ? "mt-5" : ""}>
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft/70">{group.title}</p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = isActive(item.to);
                      const Icon = item.icon;
                      const badge = badges[item.to];
                      return (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            onClick={() => setMobileNav(false)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] ${active ? "bg-ink text-white" : "text-ink-soft hover:bg-surface-2 hover:text-ink"}`}
                          >
                            <span className={`grid h-7 w-7 place-items-center rounded-lg ${active ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white" : ""}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="flex-1 truncate">{item.label}</span>
                            {badge ? (
                              <span className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${active ? "bg-white/15 text-white" : "bg-[#fff6ee] text-[#ff6c02]"}`}>{badge}</span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line/70 bg-white/90 px-3 backdrop-blur sm:gap-4 sm:px-6">
          <button
            onClick={() => setMobileNav(true)}
            aria-label="Ouvrir le menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-surface-2 lg:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="hidden flex-1 items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-[13px] text-ink-soft ring-1 ring-line/60 max-w-[420px] sm:flex">
            <Search className="h-4 w-4" />
            <input
              placeholder="Chercher une campagne, un lead, un rapport…"
              className="w-full bg-transparent outline-none placeholder:text-ink-soft"
            />
          </div>
          <div className="flex-1 sm:hidden" />
          <NotificationsBell />
          <AccountMenu profile={profile} initials={initials} isAdmin={isAdmin} />
        </header>
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AccountMenu({ profile, initials, isAdmin }: { profile: AppProfile | null; initials: string; isAdmin: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const doSignOut = () => {
    void authClient.signOut().then(() => navigate({ to: "/auth", replace: true }));
  };

  return (
    <>
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-line/60 bg-white py-1 pl-1 pr-3 text-[13px] font-medium text-ink hover:bg-surface-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-[11px] font-semibold text-white">{initials}</span>
        <span className="hidden max-w-[140px] truncate sm:inline">{profile?.company ?? "Compte"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-soft" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[240px] overflow-hidden rounded-2xl border border-line/70 bg-white shadow-lg">
          <div className="border-b border-line/60 px-4 py-3">
            <p className="truncate text-[13px] font-semibold text-ink">{profile?.company}</p>
            <p className="truncate text-[11px] text-ink-soft">{profile?.email}</p>
            <span className="mt-1.5 inline-flex items-center rounded-full bg-[#fff6ee] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#ff6c02]">
              {profile?.appRole === "agency" ? "Agence" : "Annonceur"}
            </span>
          </div>
          <ul className="py-1 text-[13px]">
            <li>
              <button onClick={() => { setOpen(false); setSwitcherOpen(true); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-ink hover:bg-surface-2">
                <RefreshCw className="h-4 w-4 text-ink-soft" /> Changer d'espace
              </button>
            </li>
            <li>
              <Link to="/app/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-ink hover:bg-surface-2">
                <SettingsIcon className="h-4 w-4 text-ink-soft" /> Paramètres
              </Link>
            </li>
            {isAdmin && (
              <li>
                <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-[#ff6c02] hover:bg-[#fff6ee]">
                  <ShieldAlert className="h-4 w-4" /> Back-office Super Admin
                </Link>
              </li>
            )}
            <li>
              <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-ink hover:bg-surface-2">
                <X className="h-4 w-4 text-ink-soft" /> Retour au site
              </Link>
            </li>
            <li className="border-t border-line/60">
              <button onClick={doSignOut} className="flex w-full items-center gap-2 px-4 py-2 text-left text-rose-600 hover:bg-rose-50">
                <LogOut className="h-4 w-4" /> Se déconnecter
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
    {switcherOpen && profile && (
      <WorkspaceSwitcher profile={profile} onClose={() => setSwitcherOpen(false)} />
    )}
    </>
  );
}

function NotificationsBell() {
  return <NotificationsBellInner />;
}

function WorkspaceSwitcher({ profile, onClose }: { profile: AppProfile; onClose: () => void }) {
  const navigate = useNavigate();
  const [role, setRole] = useState<"agency" | "client">(profile.appRole);
  const [company, setCompany] = useState(profile.company);
  const [sector, setSector] = useState(profile.sector ?? "Restauration");
  const [saving, setSaving] = useState(false);

  const SECTORS = ["Restauration", "E-commerce", "Beauté", "Immobilier", "Services", "Autre"];

  const apply = async () => {
    if (company.trim().length < 2) return;
    setSaving(true);
    try {
      await saveUserProfile({
        data: { appRole: role, company: company.trim(), sector, size: profile.size ?? undefined },
      });
      window.dispatchEvent(new Event("orkestria:profile-changed"));
      onClose();
      navigate({ to: role === "agency" ? "/app/agency" : "/app" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card-soft my-auto flex w-full max-w-[520px] max-h-[calc(100vh-2rem)] flex-col overflow-hidden p-0">
        <div className="relative z-10 sticky top-0 flex shrink-0 items-center justify-between gap-3 border-b border-line/60 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">Espace de travail</p>
            <h2 className="mt-1 font-display text-[22px] font-semibold text-ink">Changer d'entreprise ou de rôle</h2>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="shrink-0 rounded-full p-1.5 text-ink-soft hover:bg-surface-2 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setRole("client")} className={`opt-tile flex items-center gap-3 !p-3.5 ${role === "client" ? "opt-tile-active" : ""}`}>
            <span className={`icon-relief h-9 w-9 ${role === "client" ? "icon-relief-active" : ""}`}><User className="h-4 w-4" /></span>
            <span className="text-[13px] font-semibold text-ink">Annonceur</span>
          </button>
          <button onClick={() => setRole("agency")} className={`opt-tile flex items-center gap-3 !p-3.5 ${role === "agency" ? "opt-tile-active" : ""}`}>
            <span className={`icon-relief h-9 w-9 ${role === "agency" ? "icon-relief-active" : ""}`}><Briefcase className="h-4 w-4" /></span>
            <span className="text-[13px] font-semibold text-ink">Agence</span>
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink">Nom de l'entreprise</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="block w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/20" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink">Secteur</span>
            <select value={sector} onChange={(e) => setSector(e.target.value)} className="block w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/20">
              {SECTORS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
        </div>

        <div className="relative z-10 sticky bottom-0 flex shrink-0 items-center justify-between gap-3 border-t border-line/60 bg-white/95 px-6 py-4 backdrop-blur">
          <button onClick={onClose} className="chip-ghost">Annuler</button>
          <button onClick={apply} disabled={saving || company.trim().length < 2} className="btn-primary disabled:opacity-50">
            {saving ? "Mise à jour…" : "Appliquer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationsBellInner() {
  const { list, unread, markAllRead, remove } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="chip-ghost">
        <Bell className="h-4 w-4" /> Alertes
        {unread > 0 && (
          <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff6c02] px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-30 mt-2 max-w-[380px] overflow-hidden rounded-2xl border border-line/70 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-[380px]">
          <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-ink">Notifications</p>
              <p className="text-[11px] text-ink-soft">In-app · email envoyé automatiquement</p>
            </div>
            <button onClick={markAllRead} className="text-[12px] text-[#ff6c02] hover:underline">
              Tout marquer comme lu
            </button>
          </div>
          <ul className="max-h-[440px] divide-y divide-line/60 overflow-y-auto">
            {list.length === 0 && (
              <li className="px-4 py-10 text-center text-[13px] text-ink-soft">Aucune notification pour le moment.</li>
            )}
            {list.map((n) => <NotifRow key={n.id} n={n} onRemove={() => remove(n.id)} />)}
          </ul>
        </div>
      )}
    </div>
  );
}

function NotifRow({ n, onRemove }: { n: Notification; onRemove: () => void }) {
  const Icon = n.kind === "approval" ? CheckCircle2 : n.kind === "status" ? Check : Bell;
  const tone = n.kind === "approval" ? "text-[#ff6c02] bg-[#fff6ee]" : n.kind === "status" ? "text-emerald-600 bg-emerald-50" : "text-ink-soft bg-surface-2";
  return (
    <li className={`flex gap-3 px-4 py-3 ${n.read ? "" : "bg-[#fff9f3]"}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">{n.title}</p>
        <p className="mt-0.5 text-[12px] text-ink-soft">{n.body}</p>
        <p className="mt-1 flex items-center gap-2 text-[11px] text-ink-soft">
          <span>{timeAgo(n.createdAt)}</span>
          {n.emailSent && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> e-mail envoyé</span>}
        </p>
      </div>
      <button onClick={onRemove} className="text-ink-soft hover:text-ink" aria-label="Retirer">
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}