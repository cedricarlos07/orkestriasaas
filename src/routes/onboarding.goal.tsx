import { createFileRoute } from "@tanstack/react-router";
import { Check, ShoppingCart, Users, Sparkles, Calendar, MapPin, Megaphone, UserPlus, Eye } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { useOnboarding } from "@/lib/onboarding-store";

const GOALS = [
  { id: "orders", label: "Recevoir plus de commandes", icon: ShoppingCart },
  { id: "leads", label: "Obtenir des prospects", icon: Users },
  { id: "online", label: "Vendre en ligne", icon: Sparkles },
  { id: "event", label: "Promouvoir un événement", icon: Calendar },
  { id: "foot", label: "Augmenter les visites physiques", icon: MapPin },
  { id: "brand", label: "Développer la notoriété", icon: Megaphone },
  { id: "hire", label: "Recruter", icon: UserPlus },
  { id: "other", label: "Autre", icon: Eye },
];

export const Route = createFileRoute("/onboarding/goal")({ component: Step });

function Step() {
  const { data, setField } = useOnboarding();
  return (
    <>
      <StepHeader eyebrow="Étape 2 · Objectif" title="Quel est votre objectif principal ?" desc="Un seul suffit pour démarrer. Vous en ajouterez d'autres plus tard." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {GOALS.map(({ id, label, icon: Icon }) => {
          const active = data.goal === id;
          return (
            <button
              key={id}
              onClick={() => setField("goal", id)}
              className={`opt-tile flex items-center justify-between gap-3 ${active ? "opt-tile-active" : ""}`}
            >
              <div className="relative z-10 flex items-center gap-3">
                <div className={`icon-relief h-9 w-9 ${active ? "icon-relief-active" : ""}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-[14px] font-medium text-ink">{label}</span>
              </div>
              {active && <Check className="relative z-10 h-4 w-4 text-[#ff6c02]" />}
            </button>
          );
        })}
      </div>
    </>
  );
}