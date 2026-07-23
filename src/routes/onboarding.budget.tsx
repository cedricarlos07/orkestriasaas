import { createFileRoute } from "@tanstack/react-router";
import { Check, Wallet } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { useOnboarding } from "@/lib/onboarding-store";

const BUDGETS = [
  "Moins de $75/mois",
  "$75 à $250/mois",
  "$250 à $800/mois",
  "$800 à $3,000/mois",
  "Plus de $3,000/mois",
  "Je ne sais pas encore",
];

export const Route = createFileRoute("/onboarding/budget")({ component: Step });

function Step() {
  const { data, setField } = useOnboarding();
  return (
    <>
      <StepHeader eyebrow="Étape 6 · Budget" title="Quel budget publicitaire par mois ?" desc="Montants en USD. Une fourchette suffit — vous pourrez ajuster à tout moment." />
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
