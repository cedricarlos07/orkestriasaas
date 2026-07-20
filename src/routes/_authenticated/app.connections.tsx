import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, PlugZap, Loader2, RefreshCw } from "lucide-react";
import { CONNECTORS } from "@/lib/oauth/connectors";
import { useConnections } from "@/lib/connections-store";
import { getAdsLinkStatus } from "@/functions/adkit";

export const Route = createFileRoute("/_authenticated/app/connections")({ component: Connections });

const EXTRA = [
  { id: "whatsapp", label: "WhatsApp Business", group: "business", desc: "Reliez pour mesurer les commandes" },
  { id: "shopify", label: "Shopify", group: "business", desc: "Non connecté" },
];

function Connections() {
  const { isLoading, byConnector, catalog } = useConnections();
  const qc = useQueryClient();
  const {
    data: adsLink,
    isLoading: adsLoading,
    isFetching: adsFetching,
    refetch: refetchAds,
  } = useQuery({
    queryKey: ["ads-link-status"],
    queryFn: () => getAdsLinkStatus(),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") || params.get("error")) {
      window.history.replaceState({}, "", "/app/connections");
    }
  }, []);

  useEffect(() => {
    if (adsLink?.platforms?.length) {
      void qc.invalidateQueries({ queryKey: ["connections"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
    }
  }, [adsLink?.platforms, qc]);

  const groups = [
    { title: "Régies publicitaires", filter: "ads" as const },
    { title: "Analytics & tracking", filter: "analytics" as const },
  ];

  const platformMap = Object.fromEntries((adsLink?.platforms ?? []).map((p) => [p.id, p]));

  const refresh = async () => {
    await refetchAds();
    await qc.invalidateQueries({ queryKey: ["connections"] });
    await qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Connexions</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Comptes publicitaires et outils</h1>
          <p className="text-[13px] text-ink-soft">
            Statut de vos régies — tout se gère dans Orkestria, sans quitter l&apos;app.
          </p>
        </div>
        {adsLink?.enabled && (
          <button type="button" className="chip-ghost" disabled={adsFetching} onClick={() => void refresh()}>
            {adsFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualiser
          </button>
        )}
      </header>

      {adsLink?.error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          {adsLink.error}
        </p>
      )}

      {isLoading || adsLoading ? (
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
                  const ads = platformMap[cfg.id as keyof typeof platformMap];
                  const linkedViaAds = Boolean(ads?.linked);
                  const connected = conn?.status === "connectée" || linkedViaAds;
                  const catalogItem = catalog.find((c) => c.id === cfg.id);
                  const configured = catalogItem?.configured ?? false;
                  const accountLabel =
                    ads?.accountName ?? conn?.externalAccount ?? (connected ? "Compte lié" : null);

                  return (
                    <li key={cfg.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                          <PlugZap className="h-4 w-4 text-ink-soft" />
                        </span>
                        <div>
                          <p className="text-[14px] font-medium text-ink">{cfg.label}</p>
                          <p className="text-[12px] text-ink-soft">
                            {connected
                              ? accountLabel
                              : configured
                                ? "En attente de liaison par Orkestria"
                                : "Non disponible"}
                          </p>
                        </div>
                      </div>
                      {connected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Connecté
                        </span>
                      ) : configured ? (
                        <span className="chip-ghost text-[12px] text-ink-soft">À activer</span>
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
