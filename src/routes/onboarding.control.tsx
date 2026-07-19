import { createFileRoute } from "@tanstack/react-router";
import { Compass, Sparkles, ShieldCheck } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { useOnboarding } from "@/lib/onboarding-store";

const MODES = [
  { id: "advisor", label: "Conseiller", tag: "Zéro exécution", desc: "Orkestria analyse et vous recommande. Vous gardez la main sur tout.", icon: Compass },
  { id: "assistant", label: "Assistant", tag: "Recommandé", desc: "Orkestria prépare chaque action et attend votre feu vert avant d'exécuter.", icon: Sparkles },
  { id: "autopilot", label: "Autopilot encadré", tag: "Automatique", desc: "Orkestria exécute dans les limites que vous fixez et vous alerte en cas de dérive.", icon: ShieldCheck },
];

export const Route = createFileRoute("/onboarding/control")({ component: Step });

function Step() {
  const { data, setField } = useOnboarding();
  return (
    <>
      <StepHeader eyebrow="Étape 7 · Contrôle" title="Choisissez votre niveau de contrôle" desc="Vous pourrez le changer à tout moment depuis vos paramètres." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {MODES.map(({ id, label, tag, desc, icon: Icon }) => {
          const active = data.control === id;
          return (
            <button
              key={id}
              onClick={() => setField("control", id)}
              className={`opt-tile flex h-full flex-col gap-3 p-5 ${active ? "opt-tile-active" : ""}`}
            >
              <div className="relative z-10 flex items-center justify-between">
                <div className={`icon-relief h-10 w-10 ${active ? "icon-relief-active" : ""}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${active ? "bg-[#ff6c02] text-white" : "bg-ink text-white"}`}>{tag}</span>
              </div>
              <p className="relative z-10 text-[15px] font-semibold text-ink">{label}</p>
              <p className="relative z-10 text-[13px] text-ink-soft">{desc}</p>
            </button>
          );
        })}
      </div>
    </>
  );
}