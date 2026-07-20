import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { CheckCircle2, PlugZap, Loader2 } from "lucide-react";
import { CONNECTORS, type ConnectorId } from "@/lib/oauth/connectors";
import { useConnections } from "@/lib/connections-store";

export const Route = createFileRoute("/_authenticated/app/connections")({ component: Connections });

const EXTRA = [
  { id: "whatsapp", label: "WhatsApp Business", group: "business", desc: "Reliez pour mesurer les commandes" },
  { id: "shopify", label: "Shopify", group: "business", desc: "Non connecté" },
];

function Connections() {
  const { isLoading, connect, disconnect, byConnector, catalog } = useConnections();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") || params.get("error")) {
      window.history.replaceState({}, "", "/app/connections");
    }
  }, []);

  const groups = [
    { title: "Régies publicitaires", filter: "ads" as const },
    { title: "Analytics & tracking", filter: "analytics" as const },
  ];

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <header>
        <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Connexions</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Comptes publicitaires et outils</h1>
        <p className="text-[13px] text-ink-soft">
          Connectez vos comptes publicitaires pour piloter campagnes, budgets et rapports depuis Orkestria.
        </p>
      </header>

      {isLoading ? (
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
                  return (
                    <li key={cfg.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                          <PlugZap className="h-4 w-4 text-ink-soft" />
                        </span>
                        <div>
                          <p className="text-[14px] font-medium text-ink">{cfg.label}</p>
                          <p className="text-[12px] text-ink-soft">
                            {connected ? conn?.externalAccount : configured ? "Non connecté" : "Non configuré sur le serveur"}
                          </p>
                        </div>
                      </div>
                      {connected ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Connecté
                          </span>
                          <button
                            type="button"
                            onClick={() => conn && disconnect(conn.id)}
                            className="chip-ghost text-[12px]"
                          >
                            Déconnecter
                          </button>
                        </div>
                      ) : configured ? (
                        <button type="button" onClick={() => void connect(cfg.id as ConnectorId)} className="btn-primary !px-3 !py-1.5 !text-[12px]">
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
