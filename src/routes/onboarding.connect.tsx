import { createFileRoute } from "@tanstack/react-router";
import { Check, Facebook, Chrome, Music2, BarChart3 } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { useOnboarding } from "@/lib/onboarding-store";
import { connectorFromPlatform } from "@/lib/oauth/connectors";

const PLATFORMS = [
  { id: "meta", label: "Meta Ads", desc: "Facebook & Instagram", icon: Facebook, color: "#1877F2" },
  { id: "google", label: "Google Ads", desc: "Search, YouTube, Display", icon: Chrome, color: "#4285F4" },
  { id: "tiktok", label: "TikTok Ads", desc: "For You & Spark Ads", icon: Music2, color: "#111" },
  { id: "ga4", label: "Google Analytics", desc: "GA4 · mesure des ventes", icon: BarChart3, color: "#F9AB00" },
];

export const Route = createFileRoute("/onboarding/connect")({ component: Step });

function Step() {
  const { data, setField } = useOnboarding();

  const connect = (platformId: string) => {
    const connector = connectorFromPlatform(platformId);
    if (!connector) return;
    setField("platforms", [...new Set([...data.platforms, platformId])]);
    window.location.href = `/api/oauth/${connector}/authorize?returnTo=${encodeURIComponent("/onboarding/summary")}`;
  };

  return (
    <>
      <StepHeader eyebrow="Étape 3 · Connexions" title="Connectez vos comptes publicitaires" desc="Vous pouvez commencer avec une seule plateforme et ajouter les autres plus tard." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PLATFORMS.map(({ id, label, desc, icon: Icon, color }) => {
          const active = data.platforms.includes(id);
          return (
            <div key={id} className={`opt-tile p-5 ${active ? "opt-tile-active" : ""}`}>
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_14px_-6px_rgba(0,0,0,0.35)]" style={{ backgroundColor: color }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-ink">{label}</p>
                    <p className="text-[13px] text-ink-soft">{desc}</p>
                  </div>
                </div>
                <button type="button" onClick={() => connect(id)} className={active ? "chip-ghost" : "btn-dark"}>
                  {active ? (<><Check className="h-4 w-4" /> Connecté</>) : "Connecter"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hint-glass mt-6 text-[13px] text-ink-soft">🔒 Connexion OAuth officielle. En local sans credentials, une connexion démo est créée.</div>
    </>
  );
}
