import { createFileRoute } from "@tanstack/react-router";
import { Mic, Link as LinkIcon, Upload, Utensils, ShoppingBag, Home, GraduationCap, Briefcase, Building2 } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { useOnboarding } from "@/lib/onboarding-store";

const SECTORS = [
  { id: "resto", label: "Restauration", icon: Utensils },
  { id: "shop", label: "Boutique / e-commerce", icon: ShoppingBag },
  { id: "immo", label: "Immobilier", icon: Home },
  { id: "edu", label: "Formation / coaching", icon: GraduationCap },
  { id: "pro", label: "Services pro", icon: Briefcase },
  { id: "autre", label: "Autre", icon: Building2 },
];

export const Route = createFileRoute("/onboarding/business")({
  component: Step,
});

function Step() {
  const { data, setField } = useOnboarding();
  return (
    <>
      <StepHeader
        eyebrow="Étape 1 · Activité"
        title="Parlez-moi de votre entreprise"
        desc="Quelques phrases suffisent. Vous pouvez aussi choisir un secteur ci-dessous."
      />
      <div className="card-soft p-2">
        <textarea
          rows={4}
          value={data.pitch}
          onChange={(e) => setField("pitch", e.target.value)}
          className="relative z-10 block w-full resize-none rounded-xl bg-transparent p-4 text-[15px] text-ink placeholder:text-ink/40 focus:outline-none"
          placeholder="Ex : J'ai un restaurant à Cocody. Nous vendons du poulet croustillant et les clients commandent sur WhatsApp."
        />
        <div className="relative z-10 flex flex-wrap items-center gap-1 border-t border-line/60 px-2 py-2">
          <button className="chip-ghost"><Mic className="h-4 w-4" /> Parler</button>
          <button className="chip-ghost"><LinkIcon className="h-4 w-4" /> Coller un lien</button>
          <button className="chip-ghost"><Upload className="h-4 w-4" /> Document</button>
        </div>
      </div>

      <p className="mt-8 text-[13px] font-medium text-ink-soft">Ou choisissez un secteur</p>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        {SECTORS.map(({ id, label, icon: Icon }) => {
          const active = data.sector === id;
          return (
            <button
              key={id}
              onClick={() => setField("sector", id)}
              className={`opt-tile flex items-center gap-3 ${active ? "opt-tile-active" : ""}`}
            >
              <span className={`icon-relief relative z-10 h-10 w-10 ${active ? "icon-relief-active" : ""}`}>
                <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className="relative z-10 text-[14px] font-medium text-ink">{label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}