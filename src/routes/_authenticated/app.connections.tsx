import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  PlugZap,
  Loader2,
  RefreshCw,
  KeyRound,
  Facebook,
  Search,
  AlertCircle,
} from "lucide-react";
import { CONNECTORS } from "@/lib/oauth/connectors";
import { useConnections } from "@/lib/connections-store";
import { getAdloopLinkStatus, saveAdloopApiKey, clearAdloopApiKey } from "@/functions/adloop";
import { getMetaSetupStatus, saveMetaPageId, clearMetaPageId } from "@/functions/meta-settings";
import { getResearchStackStatus } from "@/functions/stack-status";

export const Route = createFileRoute("/_authenticated/app/connections")({ component: Connections });

const EXTRA = [
  { id: "whatsapp", label: "WhatsApp Business", group: "business", desc: "Reliez pour mesurer les commandes" },
  { id: "shopify", label: "Shopify", group: "business", desc: "Non connecté" },
];

function Connections() {
  const { isLoading, byConnector, catalog, connect, disconnect } = useConnections();
  const qc = useQueryClient();
  const [adloopKeyInput, setAdloopKeyInput] = useState("");
  const [pageIdInput, setPageIdInput] = useState("");

  const {
    data: adloopLink,
    isLoading: adloopLoading,
    isFetching: adloopFetching,
    refetch: refetchAdloop,
  } = useQuery({
    queryKey: ["adloop-link-status"],
    queryFn: () => getAdloopLinkStatus(),
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

  const saveAdloop = useMutation({
    mutationFn: (apiKey: string) => saveAdloopApiKey({ data: { apiKey } }),
    onSuccess: () => {
      setAdloopKeyInput("");
      void refetchAdloop();
      void qc.invalidateQueries({ queryKey: ["connections"] });
    },
  });

  const clearAdloop = useMutation({
    mutationFn: () => clearAdloopApiKey(),
    onSuccess: () => void refetchAdloop(),
  });

  const savePageId = useMutation({
    mutationFn: (pageId: string) => saveMetaPageId({ data: { pageId } }),
    onSuccess: () => {
      setPageIdInput("");
      void refetchMeta();
    },
  });

  const clearPageId = useMutation({
    mutationFn: () => clearMetaPageId(),
    onSuccess: () => void refetchMeta(),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") || params.get("error")) {
      window.history.replaceState({}, "", "/app/connections");
      void refetchMeta();
      void qc.invalidateQueries({ queryKey: ["connections"] });
    }
  }, [qc, refetchMeta]);

  const groups = [
    { title: "Régies publicitaires", filter: "ads" as const },
    { title: "Analytics & tracking", filter: "analytics" as const },
  ];

  const refresh = async () => {
    await Promise.all([refetchAdloop(), refetchMeta(), refetchResearch()]);
    await qc.invalidateQueries({ queryKey: ["connections"] });
    await qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
  };

  const busy = adloopFetching || metaFetching;

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Connexions</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Configuration V1</h1>
          <p className="text-[13px] text-ink-soft">
            Meta via OAuth + adkit · Google via AdLoop (alc_) · Research concurrents via useproxy (serveur).
          </p>
        </div>
        <button type="button" className="chip-ghost" disabled={busy} onClick={() => void refresh()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Actualiser
        </button>
      </header>

      {/* Meta + adkit */}
      <section className="rounded-2xl border border-line/70 bg-white p-5">
        <div className="flex items-start gap-3">
          <Facebook className="mt-0.5 h-5 w-5 text-[#1877F2]" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[14px] font-medium text-ink">Meta Ads (adkit)</p>
              <p className="text-[12px] text-ink-soft">
                OAuth Orkestria puis Page Facebook pour les créatifs. Lancement via{" "}
                <a
                  href="https://github.com/jatinjain25/adkit"
                  className="text-[#ff6c02] underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  adkit-mcp
                </a>
                .
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {metaSetup?.oauthConnected ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> OAuth Meta · {metaSetup.account ?? "compte lié"}
                  </span>
                  {metaSetup.adkitHealth.ok ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] text-emerald-700">
                      adkit OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[12px] text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {metaSetup.adkitHealth.error ?? "adkit non vérifié"}
                    </span>
                  )}
                  <button
                    type="button"
                    className="chip-ghost text-[12px]"
                    onClick={() => {
                      const conn = byConnector("meta_ads");
                      if (conn) disconnect(conn.id);
                    }}
                  >
                    Déconnecter
                  </button>
                </>
              ) : (
                <button type="button" className="btn-primary text-[13px]" onClick={() => void connect("meta_ads")}>
                  Connecter Meta
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2 border-t border-line/50 pt-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide text-ink-soft">Page Facebook ID</label>
                {metaSetup?.pageId ? (
                  <p className="text-[13px] font-medium text-ink">{metaSetup.pageId}</p>
                ) : (
                  <p className="text-[12px] text-amber-700">Requis pour lancer des campagnes Meta</p>
                )}
              </div>
              {metaSetup?.pageId ? (
                <button type="button" className="chip-ghost text-[12px]" onClick={() => clearPageId.mutate()}>
                  Retirer
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pageIdInput}
                    onChange={(e) => setPageIdInput(e.target.value)}
                    placeholder="123456789…"
                    className="min-w-[200px] rounded-xl border border-line/70 px-3 py-2 text-[13px]"
                  />
                  <button
                    type="button"
                    disabled={!pageIdInput.trim() || savePageId.isPending}
                    className="rounded-xl bg-ink px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
                    onClick={() => savePageId.mutate(pageIdInput.trim())}
                  >
                    Enregistrer Page ID
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* AdLoop Google */}
      <section className="rounded-2xl border border-line/70 bg-white p-5">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 text-[#ff6c02]" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[14px] font-medium text-ink">Google Ads via AdLoop Cloud</p>
              <p className="text-[12px] text-ink-soft">
                Pack Agency : connectez votre MCC une fois, créez vos clients sur{" "}
                <a href="https://getadloop.com" className="text-[#ff6c02] underline" target="_blank" rel="noreferrer">
                  getadloop.com
                </a>
                , puis collez la clé alc_…
              </p>
            </div>
            {adloopLink?.linked ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> AdLoop lié ({adloopLink.maskedKey})
                </span>
                {!adloopLink.health.ok && (
                  <span className="text-[12px] text-amber-700">{adloopLink.health.error ?? "Health check échoué"}</span>
                )}
                <button type="button" className="chip-ghost text-[12px]" onClick={() => clearAdloop.mutate()}>
                  Retirer la clé
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <input
                  type="password"
                  value={adloopKeyInput}
                  onChange={(e) => setAdloopKeyInput(e.target.value)}
                  placeholder="alc_…"
                  className="min-w-[240px] rounded-xl border border-line/70 px-3 py-2 text-[13px]"
                />
                <button
                  type="button"
                  disabled={!adloopKeyInput.trim() || saveAdloop.isPending}
                  className="rounded-xl bg-ink px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
                  onClick={() => saveAdloop.mutate(adloopKeyInput.trim())}
                >
                  {saveAdloop.isPending ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* useproxy research */}
      <section className="rounded-2xl border border-line/70 bg-white p-5">
        <div className="flex items-start gap-3">
          <Search className="mt-0.5 h-5 w-5 text-ink-soft" />
          <div className="flex-1">
            <p className="text-[14px] font-medium text-ink">Research concurrents (useproxy)</p>
            <p className="text-[12px] text-ink-soft">
              Meta Ad Library — clé serveur, invisible pour vous. URL : {researchStack?.url ?? "mcp.useproxy.dev"}
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
                  <AlertCircle className="h-3.5 w-3.5" /> En attente de clé USEPROXY_API_KEY (admin serveur)
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {isLoading || adloopLoading ? (
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
                  const adloopGoogle = cfg.id === "google_ads" && adloopLink?.linked;
                  const isMeta = cfg.id === "meta_ads";
                  const showConnected = connected || adloopGoogle;

                  return (
                    <li key={cfg.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                          <PlugZap className="h-4 w-4 text-ink-soft" />
                        </span>
                        <div>
                          <p className="text-[14px] font-medium text-ink">{cfg.label}</p>
                          <p className="text-[12px] text-ink-soft">
                            {isMeta && connected
                              ? `${accountLabel}${metaSetup?.pageId ? " · Page OK" : " · Page ID manquant"}`
                              : connected
                                ? accountLabel
                                : adloopGoogle
                                  ? "Google via AdLoop Cloud"
                                  : cfg.id === "google_ads"
                                    ? "Via clé AdLoop alc_ (ci-dessus)"
                                    : configured
                                      ? "OAuth disponible"
                                      : "Non disponible"}
                          </p>
                        </div>
                      </div>
                      {showConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Connecté
                        </span>
                      ) : configured && cfg.id !== "google_ads" ? (
                        <button type="button" className="btn-primary text-[12px]" onClick={() => void connect(cfg.id)}>
                          Connecter
                        </button>
                      ) : (
                        <span className="chip-ghost text-[12px] text-ink-soft">
                          {cfg.id === "google_ads" ? "AdLoop" : "Bientôt"}
                        </span>
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
