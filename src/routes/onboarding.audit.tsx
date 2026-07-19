import { createFileRoute } from "@tanstack/react-router";
import { Check, Zap } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";

const ITEMS = ["Campagnes actives", "Dépenses", "Conversions", "Tracking", "Créations", "Audiences", "Anomalies", "Répartition du budget", "Opportunités"];

export const Route = createFileRoute("/onboarding/audit")({ component: Step });

function Step() {
  return (
    <>
      <StepHeader eyebrow="Étape 8 · Audit" title="J'analyse votre écosystème publicitaire" desc="Quelques secondes pour scanner vos comptes et repérer ce qui rapporte — et ce qui gaspille." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ITEMS.map((label, i) => (
          <div key={label} className="opt-tile flex items-center gap-3 !p-3">
            <span className="relative z-10 flex h-6 w-6 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#ff6c02]/40" style={{ animationDelay: `${i * 120}ms` }} />
              <span className="icon-relief icon-relief-active relative h-6 w-6">
                <Check className="h-3.5 w-3.5" />
              </span>
            </span>
            <span className="relative z-10 text-[14px] text-ink">{label}</span>
          </div>
        ))}
      </div>
      <div className="card-ink mt-6 flex items-center gap-3 p-5">
        <span className="icon-relief icon-relief-active relative z-10 h-9 w-9"><Zap className="h-4 w-4" /></span>
        <p className="relative z-10 text-[14px]">Analyse en cours — vous pouvez continuer, je vous préviens dès que c'est prêt.</p>
      </div>
    </>
  );
}