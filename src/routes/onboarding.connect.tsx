import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Facebook, Chrome, Music2, BarChart3, Loader2 } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { connectorFromPlatform, type ConnectorId } from "@/lib/oauth/connectors";
import { getOAuthAvailability } from "@/functions/platform-config";
import { listConnections } from "@/functions/connections";
import { getGoogleSetupStatus } from "@/functions/adloop";

const PLATFORMS = [
  { id: "meta", label: "Meta Ads", desc: "Facebook & Instagram", icon: Facebook, color: "#1877F2" },
  {
    id: "google",
    label: "Google Ads",
    desc: "Compte agence serveur — OAuth client si disponible",
    icon: Chrome,
    color: "#4285F4",
  },
  { id: "tiktok", label: "TikTok Ads", desc: "For You & Spark Ads", icon: Music2, color: "#111" },
  { id: "ga4", label: "Google Analytics", desc: "GA4 · mesure des ventes", icon: BarChart3, color: "#F9AB00" },
];

export const Route = createFileRoute("/onboarding/connect")({ component: Step });

function Step() {
  const qc = useQueryClient();

  const { data: availability } = useQuery({
    queryKey: ["platform-config"],
    queryFn: () => getOAuthAvailability(),
  });
  const { data: connections = [], isLoading: connLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => listConnections(),
  });
  const { data: googleSetup } = useQuery({
    queryKey: ["google-setup-status"],
    queryFn: () => getGoogleSetupStatus(),
    staleTime: 30_000,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") || params.get("error")) {
      window.history.replaceState({}, "", "/onboarding/connect");
      void qc.invalidateQueries({ queryKey: ["connections"] });
      void qc.invalidateQueries({ queryKey: ["meta-setup-status"] });
      if (params.get("connected")) {
        window.location.href = "/onboarding/accounts";
      }
    }
  }, [qc]);

  const configured = (platformId: string) => {
    const connector = connectorFromPlatform(platformId);
    if (!connector) return false;
    return availability?.connectors.find((c) => c.id === connector)?.configured ?? false;
  };

  const reallyConnected = (platformId: string): boolean => {
    const connector = connectorFromPlatform(platformId);
    if (!connector) return false;
    if (platformId === "google" && googleSetup?.googleReady) return true;
    const row = connections.find((c) => c.connector === connector && c.status === "connectée" && c.via === "oauth");
    return Boolean(row);
  };

  const connect = (platformId: string) => {
    const connector = connectorFromPlatform(platformId) as ConnectorId | null;
    if (!connector || !configured(platformId)) return;
    window.location.href = `/api/oauth/${connector}/authorize?returnTo=${encodeURIComponent("/onboarding/accounts")}`;
  };

  return (
    <>
      <StepHeader
        eyebrow="Étape 3 · Connexions"
        title="Connectez vos comptes publicitaires"
        desc="Commencez par Meta. Google Ads utilise le compte configuré sur le serveur ; vous pourrez lier un compte client ensuite."
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PLATFORMS.map(({ id, label, desc, icon: Icon, color }) => {
          const linked = reallyConnected(id);
          const ready = configured(id) || (id === "google" && Boolean(googleSetup?.googleReady));
          return (
            <div key={id} className={`opt-tile p-5 ${linked ? "opt-tile-active" : ""} ${!ready ? "opacity-70" : ""}`}>
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_14px_-6px_rgba(0,0,0,0.35)]"
                    style={{ backgroundColor: color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-ink">{label}</p>
                    <p className="text-[13px] text-ink-soft">
                      {id === "google" && googleSetup?.googleReady && !googleSetup.oauthConnected
                        ? "Compte agence actif"
                        : ready
                          ? desc
                          : "Credentials non configurées sur le serveur"}
                    </p>
                  </div>
                </div>
                {connLoading && id === "meta" ? (
                  <span className="chip-ghost text-[12px]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </span>
                ) : linked ? (
                  <span className="chip-ghost inline-flex items-center gap-1">
                    <Check className="h-4 w-4" /> Connecté
                  </span>
                ) : ready && configured(id) ? (
                  <button type="button" onClick={() => connect(id)} className="btn-dark">
                    Connecter
                  </button>
                ) : ready ? (
                  <span className="chip-ghost text-[12px] text-emerald-700">Disponible</span>
                ) : (
                  <span className="chip-ghost text-[12px] text-ink-soft">Bientôt</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="hint-glass mt-6 text-[13px] text-ink-soft">
        Connexion OAuth officielle. Le statut « Connecté » n&apos;apparaît qu&apos;après autorisation réussie.
      </div>
    </>
  );
}
