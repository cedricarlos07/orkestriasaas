import { createFileRoute, Link } from "@tanstack/react-router";
import { Map, ArrowRight } from "lucide-react";
import { ROADMAP_ITEMS } from "@/lib/app-nav";

export const Route = createFileRoute("/_authenticated/app/roadmap")({
  component: RoadmapPage,
});

function RoadmapPage() {
  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <header className="flex items-start gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[0_10px_24px_-10px_rgba(255,108,2,0.7)]">
          <Map className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Roadmap</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Bientôt sur Orkestria</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            Ces fonctions ne sont pas encore disponibles. Le produit live se concentre sur Meta, les campagnes, l’agent et le MCP.
          </p>
        </div>
      </header>

      <ul className="space-y-3">
        {ROADMAP_ITEMS.map((item) => (
          <li
            key={item.title}
            className="rounded-2xl border border-line/60 bg-gradient-to-br from-white to-[#faf6ef] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-[15px] font-semibold text-ink">{item.title}</p>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft ring-1 ring-line/60">
                Bientôt
              </span>
            </div>
            <p className="mt-1 text-[13px] text-ink-soft">{item.desc}</p>
          </li>
        ))}
      </ul>

      <Link to="/app" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#ff6c02] hover:underline">
        Retour à Aujourd&apos;hui <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
