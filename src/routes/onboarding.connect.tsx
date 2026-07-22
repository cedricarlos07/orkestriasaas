import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Facebook, Chrome, Music2, BarChart3 } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { useOnboarding } from "@/lib/onboarding-store";
import { connectorFromPlatform } from "@/lib/oauth/connectors";
import { getOAuthAvailability } from "@/functions/platform-config";

const PLATFORMS = [
  { id: "meta", label: "Meta Ads", desc: "Facebook & Instagram", icon: Facebook, color: "#1877F2" },
  { id: "google", label: "Google Ads", desc: "AdLoop self-hosted sur le serveur + OAuth optionnel", icon: Chrome, color: "#4285F4" },
  { id: "tiktok", label: "TikTok Ads", desc: "For You & Spark Ads", icon: Music2, color: "#111" },
  { id: "ga4", label: "Google Analytics", desc: "GA4 · mesure des ventes", icon: BarChart3, color: "#F9AB00" },
];

export const Route = createFileRoute("/onboarding/connect")({ component: Step });

function Step() {
  const { data, setField } = useOnboarding();
  const { data: availability } = useQuery({
    queryKey: ["platform-config"],
    queryFn: () => getOAuthAvailability(),
  });

  const configured = (platformId: string) => {
    const connector = connectorFromPlatform(platformId);
    if (!connector) return false;
    return availability?.connectors.find((c) => c.id === connector)?.configured ?? false;
  };

  const connect = (platformId: string) => {
    const connector = connectorFromPlatform(platformId);
    if (!connector || !configured(platformId)) return;
    setField("platforms", [...new Set([...data.platforms, platformId])]);
    window.location.href = `/api/oauth/${connector}/authorize?returnTo=${encodeURIComponent("/onboarding/accounts")}`;
  };

  return (
    <>
      <StepHeader eyebrow="Étape 3 · Connexions" title="Connectez vos comptes publicitaires" desc="Commencez par Meta (OAuth). Google utilise AdLoop self-hosted côté serveur ; OAuth Google optionnel pour cibler un compte client." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PLATFORMS.map(({ id, label, desc, icon: Icon, color }) => {
          const active = data.platforms.includes(id);
          const ready = configured(id);
          return (
            <div key={id} className={`opt-tile p-5 ${active ? "opt-tile-active" : ""} ${!ready ? "opacity-70" : ""}`}>
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_14px_-6px_rgba(0,0,0,0.35)]" style={{ backgroundColor: color }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-ink">{label}</p>
                    <p className="text-[13px] text-ink-soft">{ready ? desc : "Credentials non configurées sur le serveur"}</p>
                  </div>
                </div>
                {ready ? (
                  <button type="button" onClick={() => connect(id)} className={active ? "chip-ghost" : "btn-dark"}>
                    {active ? (<><Check className="h-4 w-4" /> Connecté</>) : "Connecter"}
                  </button>
                ) : (
                  <span className="chip-ghost text-[12px] text-ink-soft">Bientôt</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="hint-glass mt-6 text-[13px] text-ink-soft">🔒 Connexion OAuth officielle Meta. Aucune donnée simulée.</div>
    </>
  );
}
