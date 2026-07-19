import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Megaphone, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/campaigns")({ component: () => <Outlet /> });

export function CampaignsShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="anim-fade-up mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white shadow-[0_12px_26px_-12px_rgba(255,108,2,0.65),inset_0_1px_0_rgba(255,255,255,0.35)]"
          >
            <Megaphone className="h-5 w-5" />
            <span className="absolute -inset-1 -z-10 rounded-3xl bg-[#ff6c02]/25 blur-xl anim-pulse-dot" />
          </span>
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wider text-[#c94a00]">Diffusion</p>
            <h1 className="mt-0.5 font-display text-[26px] font-semibold text-ink">Campagnes</h1>
            <p className="text-[13px] text-ink-soft">Vue unifiée Meta, Google et TikTok</p>
          </div>
        </div>
        <Link to="/app/campaigns/new" className="btn-primary btn-halo">
          <Plus className="h-4 w-4" /> Nouvelle campagne
        </Link>
      </header>
      {children}
      <p className="sr-only">{loc.pathname}</p>
    </div>
  );
}