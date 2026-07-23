import { createFileRoute, Link } from "@tanstack/react-router";
import { Wand2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/creations")({ component: Creations });

function Creations() {
  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white">
          <Wand2 className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Studio créatif</p>
          <h1 className="mt-0.5 font-display text-[26px] font-semibold text-ink">Créations</h1>
        </div>
      </header>

      <section className="card-soft flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Sparkles className="h-10 w-10 text-ink-soft/40" />
        <p className="font-display text-[18px] font-semibold text-ink">Bientôt disponible</p>
        <p className="max-w-md text-[14px] text-ink-soft">
          Génération d&apos;affiches et vidéos depuis Orkestria arrive prochainement. En attendant, lancez vos
          campagnes Meta avec les créatives déjà dans votre compte publicitaire.
        </p>
        <span className="chip-ghost mt-1">Bientôt</span>
        <Link to="/app/campaigns/new" className="btn-primary mt-2 inline-flex text-[13px]">
          Nouvelle campagne
        </Link>
      </section>
    </div>
  );
}
