import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  PlugZap,
  Loader2,
  RefreshCw,
  Facebook,
  Search,
  AlertCircle,
  Chrome,
} from "lucide-react";
import { CONNECTORS } from "@/lib/oauth/connectors";
import { useConnections } from "@/lib/connections-store";
import { getGoogleSetupStatus } from "@/functions/adloop";
import { getMetaSetupStatus } from "@/functions/meta-settings";
import { getResearchStackStatus } from "@/functions/stack-status";

export const Route = createFileRoute("/_authenticated/app/connections")({ component: Connections });

const EXTRA = [
  { id: "whatsapp", label: "WhatsApp Business", group: "business", desc: "Reliez pour mesurer les commandes" },
  { id: "shopify", label: "Shopify", group: "business", desc: "Non connecté" },
];

function Connections() {
  const { isLoading, byConnector, catalog, connect, disconnect } = useConnections();
  const qc = useQueryClient();

  const {
    data: googleSetup,
    isLoading: googleLoading,
    isFetching: googleFetching,
    refetch: refetchGoogle,
  } = useQuery({
    queryKey: ["google-setup-status"],
    queryFn: () => getGoogleSetupStatus(),
    staleTime: 60_000,
    retry: 1,
  });

  const {
    data: metaSetup,
    isFetching: metaFetching,
    refetch: refetchMeta,
  } = useQuery({
    queryKey: ["meta-setup-status"],
    queryFn: () => getMetaSetupStatus(),
    staleTime: 60_000,
    retry: 1,
  });

  const { data: researchStack, refetch: refetchResearch } = useQuery({
    queryKey: ["research-stack-status"],
    queryFn: () => getResearchStackStatus(),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") || params.get("error")) {
      window.history.replaceState({}, "", "/app/connections");
      void qc.invalidateQueries({ queryKey: ["connections"] });
      void qc.invalidateQueries({ queryKey: ["connection-catalog"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      void qc.invalidateQueries({ queryKey: ["setup-status"] });
      void refetchMeta();
      void refetchGoogle();
    }
  }, [qc, refetchMeta, refetchGoogle]);

  const metaConn = byConnector("meta_ads");
  const metaLinked =
    Boolean(metaSetup?.oauthConnected) ||
    (metaConn?.status === "connectée" && metaConn?.via === "oauth");

  const groups = [
    { title: "Régies publicitaires", filter: "ads" as const },
    { title: "Analytics & tracking", filter: "analytics" as const },
  ];

  const refresh = async () => {
    await Promise.all([refetchGoogle(), refetchMeta(), refetchResearch()]);
    await qc.invalidateQueries({ queryKey: ["connections"] });
    await qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
  };

  const busy = googleFetching || metaFetching;

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Connexions</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Vos connexions</h1>
          <p className="text-[13px] text-ink-soft">
            Liez vos comptes publicitaires pour que Orkestria puisse lancer et suivre vos campagnes.
          </p>
        </div>
        <button type="button" className="chip-ghost" disabled={busy} onClick={() => void refresh()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Actualiser
        </button>
      </header>

      {/* Meta Ads */}
      <section className="rounded-2xl border border-line/70 bg-white p-5">
        <div className="flex items-start gap-3">
          <Facebook className="mt-0.5 h-5 w-5 text-[#1877F2]" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[14px] font-medium text-ink">Meta Ads</p>
              <p className="text-[12px] text-ink-soft">
                Un clic pour lier votre compte publicitaire Facebook / Instagram. Orkestria récupère automatiquement
                votre Page Facebook pour les publicités.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {metaLinked ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connecté ·{" "}
                    {metaSetup?.account ?? metaConn?.externalAccount ?? "compte lié"}
                  </span>
                  {metaSetup.pageName ? (
                    <span className="text-[12px] text-ink-soft">Page · {metaSetup.pageName}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[12px] text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Aucune Page Facebook trouvée — créez-en une sur Facebook puis reconnectez
                    </span>
                  )}
                  <button
                    type="button"
                    className="chip-ghost text-[12px]"
                    onClick={() => {
                      if (metaConn) disconnect(metaConn.id);
                    }}
                  >
                    Déconnecter
                  </button>
                </>
              ) : metaSetup?.tokenError && !metaConn ? (
                <>
                  <button type="button" className="btn-primary text-[13px]" onClick={() => void connect("meta_ads")}>
                    Connecter Meta
                  </button>
                  <button
                    type="button"
                    className="chip-ghost text-[12px]"
                    onClick={() => {
                      const conn = byConnector("meta_ads");
                      if (conn) disconnect(conn.id);
                    }}
                  >
                    Réinitialiser
                  </button>
                </>
              ) : (
                <button type="button" className="btn-primary text-[13px]" onClick={() => void connect("meta_ads")}>
                  Connecter Meta
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Google Ads */}
      <section className="rounded-2xl border border-line/70 bg-white p-5">
        <div className="flex items-start gap-3">
          <Chrome className="mt-0.5 h-5 w-5 text-[#4285F4]" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[14px] font-medium text-ink">Google Ads</p>
              <p className="text-[12px] text-ink-soft">
                Connectez votre compte Google Ads pour cibler un compte client précis. Sinon, Orkestria utilise le compte
                agence configuré sur le serveur.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {googleSetup?.googleReady ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Google Ads disponible
                </span>
              ) : googleSetup?.adloopConfigured ? (
                <span className="inline-flex items-center gap-1 text-[12px] text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {googleSetup.adloopHealth.error ?? "Google Ads en cours de configuration côté serveur"}
                </span>
              ) : (
                <span className="text-[12px] text-amber-700">Google Ads pas encore activé sur le serveur</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line/50 pt-3">
              {googleSetup?.oauthConnected ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connecté · {googleSetup.account ?? "compte lié"}
                  </span>
                  <button
                    type="button"
                    className="chip-ghost text-[12px]"
                    onClick={() => {
                      const conn = byConnector("google_ads");
                      if (conn) disconnect(conn.id);
                    }}
                  >
                    Déconnecter
                  </button>
                </>
              ) : googleSetup?.tokenError ? (
                <>
                  <span className="inline-flex items-center gap-1 text-[12px] text-amber-700">{googleSetup.tokenError}</span>
                  <button type="button" className="btn-primary text-[13px]" onClick={() => void connect("google_ads")}>
                    Reconnecter Google
                  </button>
                </>
              ) : (
                <button type="button" className="btn-primary text-[13px]" onClick={() => void connect("google_ads")}>
                  Connecter Google Ads (optionnel)
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Research */}
      <section className="rounded-2xl border border-line/70 bg-white p-5">
        <div className="flex items-start gap-3">
          <Search className="mt-0.5 h-5 w-5 text-ink-soft" />
          <div className="flex-1">
            <p className="text-[14px] font-medium text-ink">Recherche concurrents</p>
            <p className="text-[12px] text-ink-soft">
              Analyse des publicités Meta de vos concurrents (Meta Ad Library). Activé automatiquement côté serveur.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {researchStack?.configured ? (
                researchStack.health.ok ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Research disponible
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[12px] text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {researchStack.health.error ?? "Probe échoué"}
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px] text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" /> Configuration serveur en cours
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {isLoading || googleLoading ? (
        <div className="flex items-center gap-2 text-[13px] text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.title} className="rounded-2xl border border-line/70 bg-white">
            <div className="border-b border-line/60 px-5 py-3 text-[12px] uppercase tracking-wider text-ink-soft">
              {g.title}
            </div>
            <ul className="divide-y divide-line/60">
              {Object.values(CONNECTORS)
                .filter((c) => c.group === g.filter)
                .map((cfg) => {
                  const conn = byConnector(cfg.id);
                  const connected = conn?.status === "connectée";
                  const catalogItem = catalog.find((c) => c.id === cfg.id);
                  const configured = catalogItem?.configured ?? false;
                  const accountLabel = conn?.externalAccount ?? (connected ? "Compte lié" : null);
                  const isMeta = cfg.id === "meta_ads";
                  const isGoogle = cfg.id === "google_ads";
                  const metaReallyConnected = isMeta && (metaSetup?.oauthConnected || connected);
                  const googleReady = isGoogle && (googleSetup?.googleReady || googleSetup?.oauthConnected);
                  const showConnected = (isMeta ? metaReallyConnected : isGoogle ? googleReady : connected);

                  return (
                    <li key={cfg.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                          <PlugZap className="h-4 w-4 text-ink-soft" />
                        </span>
                        <div>
                          <p className="text-[14px] font-medium text-ink">{cfg.label}</p>
                          <p className="text-[12px] text-ink-soft">
                            {isMeta && metaReallyConnected
                              ? `${accountLabel}${metaSetup?.pageName ? ` · ${metaSetup.pageName}` : ""}`
                              : isMeta && metaSetup?.tokenError
                                ? "Connexion à refaire"
                                : isGoogle && googleSetup?.oauthConnected
                                  ? accountLabel
                                  : isGoogle && googleSetup?.googleReady
                                    ? "Compte agence (serveur)"
                                    : connected
                                      ? accountLabel
                                      : configured
                                        ? "Disponible"
                                        : "Bientôt"}
                          </p>
                        </div>
                      </div>
                      {showConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Connecté
                        </span>
                      ) : configured ? (
                        <button type="button" className="btn-primary text-[12px]" onClick={() => void connect(cfg.id)}>
                          Connecter
                        </button>
                      ) : (
                        <span className="chip-ghost text-[12px] text-ink-soft">Bientôt</span>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}

      <section className="rounded-2xl border border-line/70 bg-white">
        <div className="border-b border-line/60 px-5 py-3 text-[12px] uppercase tracking-wider text-ink-soft">
          Outils métier (bientôt)
        </div>
        <ul className="divide-y divide-line/60">
          {EXTRA.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-4 px-5 py-4 opacity-60">
              <div>
                <p className="text-[14px] font-medium text-ink">{it.label}</p>
                <p className="text-[12px] text-ink-soft">{it.desc}</p>
              </div>
              <button type="button" disabled className="chip-ghost bg-surface-2">
                Bientôt
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
