import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { getMetaSetupStatus, setMetaPage } from "@/functions/meta-settings";
import { getResearchStackStatus } from "@/functions/stack-status";
import { listAdAccounts, listLinkedAdAccounts, selectAdAccount, unlinkAdAccount } from "@/functions/ad-accounts";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/connections")({ component: Connections });

const EXTRA = [
  { id: "whatsapp", label: "WhatsApp Business", group: "business", desc: "Reliez pour mesurer les commandes" },
  { id: "shopify", label: "Shopify", group: "business", desc: "Non connecté" },
];

function Connections() {
  const { isLoading, byConnector, catalog, connect, disconnect, disconnectConnector, disconnecting } =
    useConnections();
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
    staleTime: 15_000,
    retry: 1,
  });

  const { data: researchStack, refetch: refetchResearch } = useQuery({
    queryKey: ["research-stack-status"],
    queryFn: () => getResearchStackStatus(),
    staleTime: 60_000,
    retry: 1,
  });

  const metaConn = byConnector("meta_ads");
  const metaLinked =
    (metaConn?.status === "connectée" && metaConn?.via === "oauth") ||
    Boolean(metaSetup?.oauthConnected);

  const {
    data: metaAccounts = [],
    isLoading: metaAccountsLoading,
    refetch: refetchMetaAccounts,
  } = useQuery({
    queryKey: ["ad-accounts"],
    queryFn: () => listAdAccounts(),
    enabled: metaLinked,
    staleTime: 30_000,
  });

  const { data: linked, refetch: refetchLinked } = useQuery({
    queryKey: ["linked-ad-accounts"],
    queryFn: () => listLinkedAdAccounts(),
    staleTime: 15_000,
  });

  const [savingPage, setSavingPage] = useState(false);
  const [oauthBanner, setOauthBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [accountBusy, setAccountBusy] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const setPageMut = useMutation({
    mutationFn: (pageId: string) => setMetaPage({ data: { pageId } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["meta-setup-status"] });
      await refetchMeta();
    },
  });

  const metaOnly = metaAccounts.filter((a) => a.connector === "meta_ads");

  const handleLinkAccount = async (a: (typeof metaAccounts)[0], link: boolean) => {
    setAccountBusy(a.accountId);
    setAccountError(null);
    try {
      if (link) {
        await selectAdAccount({
          data: {
            connectionId: a.connectionId,
            accountId: a.accountId,
            accountName: a.name,
            connector: a.connector,
            link: true,
          },
        });
      } else {
        await unlinkAdAccount({ data: { accountId: a.accountId } });
      }
      await Promise.all([
        refetchLinked(),
        refetchMetaAccounts(),
        qc.invalidateQueries({ queryKey: ["dashboard-kpis"] }),
        qc.invalidateQueries({ queryKey: ["usage-quotas"] }),
      ]);
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : "Impossible de mettre à jour le compte");
    } finally {
      setAccountBusy(null);
    }
  };

  const handleSetActive = async (a: (typeof metaAccounts)[0]) => {
    setAccountBusy(a.accountId);
    setAccountError(null);
    try {
      await selectAdAccount({
        data: {
          connectionId: a.connectionId,
          accountId: a.accountId,
          accountName: a.name,
          connector: a.connector,
          link: true,
        },
      });
      await Promise.all([refetchLinked(), qc.invalidateQueries({ queryKey: ["dashboard-kpis"] })]);
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : "Impossible d'activer le compte");
    } finally {
      setAccountBusy(null);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const err = params.get("error");
    if (connected || err) {
      window.history.replaceState({}, "", "/app/connections");
      setOauthBanner(
        err
          ? { kind: "err", text: `Connexion échouée : ${err}` }
          : { kind: "ok", text: `${connected === "meta_ads" ? "Meta Ads" : connected === "google_ads" ? "Google Ads" : "Compte"} connecté avec succès.` },
      );
      void qc.invalidateQueries({ queryKey: ["connections"] });
      void qc.invalidateQueries({ queryKey: ["connection-catalog"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      void qc.invalidateQueries({ queryKey: ["setup-status"] });
      void qc.invalidateQueries({ queryKey: ["ad-accounts"] });
      void qc.invalidateQueries({ queryKey: ["linked-ad-accounts"] });
      void refetchMeta();
      void refetchGoogle();
    }
  }, [qc, refetchMeta, refetchGoogle]);

  const metaPageLabel =
    metaSetup?.pageName ??
    metaSetup?.availablePages?.find(
      (p) => p.id === metaSetup.pageId || p.id.replace(/\D/g, "") === metaSetup.pageId,
    )?.name ??
    (metaSetup?.pageId ? `Page ${metaSetup.pageId}` : null);

  const handleDisconnectMeta = async () => {
    try {
      await disconnectConnector("meta_ads");
      await refetchMeta();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Impossible de déconnecter Meta.");
    }
  };

  const handleSelectPage = async (pageId: string) => {
    setSavingPage(true);
    try {
      await setPageMut.mutateAsync(pageId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Impossible d'enregistrer la Page.");
    } finally {
      setSavingPage(false);
    }
  };

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

      {oauthBanner ? (
        <div
          className={`rounded-xl px-4 py-3 text-[13px] ${
            oauthBanner.kind === "err"
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {oauthBanner.text}
        </div>
      ) : null}

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
                  {metaFetching && !metaSetup ? (
                    <span className="text-[12px] text-ink-soft">Vérification de la Page…</span>
                  ) : metaPageLabel ? (
                    <span className="text-[12px] text-ink-soft">Page · {metaPageLabel}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[12px] text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Aucune Page détectée — choisissez une Page ci-dessous ou reconnectez Meta
                    </span>
                  )}
                  <button
                    type="button"
                    className="chip-ghost text-[12px]"
                    disabled={disconnecting}
                    onClick={() => void handleDisconnectMeta()}
                  >
                    {disconnecting ? "Déconnexion…" : "Déconnecter"}
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
            {metaLinked && (metaSetup?.availablePages?.length ?? 0) > 0 && (
              <div className="space-y-2 border-t border-line/50 pt-3">
                <p className="text-[12px] font-medium text-ink">Page Facebook pour les publicités</p>
                <div className="flex flex-wrap gap-2">
                  {metaSetup!.availablePages.map((p) => {
                    const selected =
                      metaSetup?.pageId === p.id || metaSetup?.pageId === p.id.replace(/\D/g, "");
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={savingPage || setPageMut.isPending}
                        onClick={() => void handleSelectPage(p.id)}
                        className={
                          selected
                            ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700 ring-1 ring-emerald-200"
                            : "chip-ghost text-[12px]"
                        }
                      >
                        {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {metaLinked && (
              <div className="space-y-2 border-t border-line/50 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-ink">Comptes publicitaires Meta</p>
                  <span className="text-[11px] text-ink-soft">
                    {linked?.accounts.length ?? 0}
                    {linked && linked.limit >= 0 ? ` / ${linked.limit}` : ""} liés
                  </span>
                </div>
                <p className="text-[12px] text-ink-soft">
                  Cochez les comptes à rattacher (limite de votre plan). Le compte actif sert aux campagnes et à l’agent.
                </p>
                {accountError && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                    {accountError}{" "}
                    <Link to="/app/settings" className="font-medium underline">
                      Passer au plan supérieur
                    </Link>
                  </p>
                )}
                {metaAccountsLoading ? (
                  <p className="flex items-center gap-2 text-[12px] text-ink-soft">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des comptes…
                  </p>
                ) : metaOnly.length === 0 ? (
                  <p className="text-[12px] text-ink-soft">Aucun compte Meta visible avec ce token OAuth.</p>
                ) : (
                  <ul className="divide-y divide-line/50 rounded-xl border border-line/60 bg-[#faf6ef]/40">
                    {metaOnly.map((a) => {
                      const isLinked = linked?.accounts.some((l) => l.accountId === a.accountId);
                      const isActive = linked?.activeAccountId === a.accountId;
                      const atLimit =
                        linked &&
                        linked.limit >= 0 &&
                        linked.accounts.length >= linked.limit &&
                        !isLinked;
                      return (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">{a.name}</p>
                            <p className="text-[11px] text-ink-soft">
                              {a.masked} · {a.currency}
                              {isActive ? " · actif" : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isLinked && !isActive && (
                              <button
                                type="button"
                                className="chip-ghost text-[11px]"
                                disabled={accountBusy === a.accountId}
                                onClick={() => void handleSetActive(a)}
                              >
                                Activer
                              </button>
                            )}
                            <button
                              type="button"
                              className={
                                isLinked
                                  ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200"
                                  : "chip-ghost text-[11px]"
                              }
                              disabled={accountBusy === a.accountId || Boolean(atLimit && !isLinked)}
                              title={atLimit ? "Limite du plan atteinte" : undefined}
                              onClick={() => void handleLinkAccount(a, !isLinked)}
                            >
                              {accountBusy === a.accountId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isLinked ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" /> Lié
                                </>
                              ) : (
                                "Lier"
                              )}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
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
                Orkestria peut utiliser le compte agence configuré sur le serveur. Liez un compte client seulement si
                vous voulez cibler un compte Google Ads précis.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {googleSetup?.oauthConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Compte client lié · {googleSetup.account ?? "Google Ads"}
                </span>
              ) : googleSetup?.agencyReady || googleSetup?.googleReady ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[12px] font-medium text-sky-800">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Disponible · compte agence
                </span>
              ) : googleSetup?.adloopConfigured ? (
                <span className="inline-flex items-center gap-1 text-[12px] text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Configuration Google Ads en cours côté serveur
                </span>
              ) : (
                <span className="text-[12px] text-amber-700">Google Ads pas encore activé sur le serveur</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line/50 pt-3">
              {googleSetup?.oauthConnected ? (
                <button
                  type="button"
                  className="chip-ghost text-[12px]"
                  onClick={() => {
                    const conn = byConnector("google_ads");
                    if (conn) disconnect(conn.id);
                  }}
                >
                  Déconnecter le compte client
                </button>
              ) : googleSetup?.oauthConfigured ? (
                <button type="button" className="btn-primary text-[13px]" onClick={() => void connect("google_ads")}>
                  {googleSetup.tokenError ? "Reconnecter un compte client" : "Lier un compte client"}
                </button>
              ) : (
                <span className="text-[12px] text-ink-soft">
                  {googleSetup?.googleReady
                    ? "Compte agence prêt — liaison client disponible bientôt."
                    : "En attente de configuration serveur."}
                </span>
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
        groups.map((g) => {
          const items = Object.values(CONNECTORS).filter(
            (c) => c.group === g.filter && c.id !== "meta_ads" && c.id !== "google_ads",
          );
          if (!items.length) return null;
          return (
          <section key={g.title} className="rounded-2xl border border-line/70 bg-white">
            <div className="border-b border-line/60 px-5 py-3 text-[12px] uppercase tracking-wider text-ink-soft">
              {g.title}
            </div>
            <ul className="divide-y divide-line/60">
              {items.map((cfg) => {
                  const conn = byConnector(cfg.id);
                  const connected = conn?.status === "connectée" && conn.via === "oauth";
                  const catalogItem = catalog.find((c) => c.id === cfg.id);
                  const configured = catalogItem?.configured ?? false;
                  const accountLabel = conn?.externalAccount ?? (connected ? "Compte lié" : null);

                  return (
                    <li key={cfg.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                          <PlugZap className="h-4 w-4 text-ink-soft" />
                        </span>
                        <div>
                          <p className="text-[14px] font-medium text-ink">{cfg.label}</p>
                          <p className="text-[12px] text-ink-soft">
                            {connected ? accountLabel : configured ? "Disponible" : "Bientôt"}
                          </p>
                        </div>
                      </div>
                      {connected ? (
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
          );
        })
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
