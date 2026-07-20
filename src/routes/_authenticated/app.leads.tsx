import { createFileRoute, Link } from "@tanstack/react-router";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/leads")({ component: Leads });

function Leads() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Prospects · Ventes</p>
          <h1 className="mt-0.5 font-display text-[26px] font-semibold text-ink">Leads & ventes</h1>
          <p className="text-[13px] text-ink-soft">Aucun lead pour le moment — la capture WhatsApp / formulaires arrive ensuite.</p>
        </div>
      </header>

      <section className="card-soft flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Users className="h-10 w-10 text-ink-soft/40" />
        <p className="font-display text-[18px] font-semibold text-ink">Aucun prospect pour l’instant</p>
        <p className="max-w-md text-[14px] text-ink-soft">
          Les leads apparaîtront ici quand le tracking WhatsApp / Meta sera branché sur vos campagnes.
        </p>
        <Link to="/app/connections" className="btn-primary mt-2">
          Voir les connexions
        </Link>
      </section>
    </div>
  );
}
