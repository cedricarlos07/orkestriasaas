import { createFileRoute } from "@tanstack/react-router";
import { Check, Wallet } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { useOnboarding } from "@/lib/onboarding-store";

const BUDGETS = [
  "Moins de 50 000 FCFA",
  "50 000 à 150 000 FCFA",
  "150 000 à 500 000 FCFA",
  "500 000 à 2 000 000 FCFA",
  "Plus de 2 000 000 FCFA",
  "Je ne sais pas encore",
];

export const Route = createFileRoute("/onboarding/budget")({ component: Step });

function Step() {
  const { data, setField } = useOnboarding();
  return (
    <>
      <StepHeader eyebrow="Étape 6 · Budget" title="Quel budget publicitaire par mois ?" desc="Une fourchette suffit. Vous pourrez l'ajuster à tout moment." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {BUDGETS.map((b) => {
          const active = data.budget === b;
          return (
            <button
              key={b}
              onClick={() => setField("budget", b)}
              className={`opt-tile flex items-center justify-between gap-3 ${active ? "opt-tile-active" : ""}`}
            >
              <div className="relative z-10 flex items-center gap-3">
                <span className={`icon-relief h-9 w-9 ${active ? "icon-relief-active" : ""}`}>
                  <Wallet className="h-4 w-4" />
                </span>
                <span className="text-[14px] font-medium text-ink">{b}</span>
              </div>
              {active && <Check className="relative z-10 h-4 w-4 text-[#ff6c02]" />}
            </button>
          );
        })}
      </div>
    </>
  );
}