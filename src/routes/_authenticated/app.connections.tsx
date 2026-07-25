import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { CONNECTORS } from "@/lib/oauth/connectors";
import { useConnections } from "@/lib/connections-store";
import { getMetaSetupStatus, setMetaPage } from "@/functions/meta-settings";
import { listAdAccounts, listLinkedAdAccounts, selectAdAccount, unlinkAdAccount } from "@/functions/ad-accounts";
import { Link } from "@tanstack/react-router";
import { BrandIcon, GoogleAdsIcon, MetaIcon, ResearchIcon } from "@/components/brand-icons";

export const Route = createFileRoute("/_authenticated/app/connections")({ component: Connections });

const EXTRA = [
  { id: "whatsapp", label: "WhatsApp Business", group: "business", desc: "Reliez pour mesurer les commandes" },
  { id: "shopify", label: "Shopify", group: "business", desc: "Non connecté" },
];

function sameMetaActId(a: string, b: string) {
  const na = a.replace(/^act_/i, "").replace(/\D/g, "");
  const nb = b.replace(/^act_/i, "").replace(/\D/g, "");
  return Boolean(na) && na === nb;
}

function sameMetaPageId(a: string | null | undefined, b: string) {
  if (!a) return false;
  return a === b || a.replace(/\D/g, "") === b.replace(/\D/g, "");
}

function Connections() {
  const { isLoading, byConnector, connect, disconnectConnector, disconnecting } =
    useConnections();
  const qc = useQueryClient();

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
  const [manualPageId, setManualPageId] = useState("");

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
    }
  }, [qc, refetchMeta]);

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
    await refetchMeta();
    await qc.invalidateQueries({ queryKey: ["connections"] });
    await qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
    await qc.invalidateQueries({ queryKey: ["ad-accounts"] });
    await qc.invalidateQueries({ queryKey: ["linked-ad-accounts"] });
  };

  const busy = metaFetching;

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

      {/* Google Ads — bientôt (en attente validation Google API) */}
      <section className="rounded-2xl border border-line/70 bg-white p-5">
        <div className="flex items-start gap-3">
          <GoogleAdsIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[14px] font-medium text-ink">Google Ads</p>
              <p className="text-[12px] text-ink-soft">
                Connexion client Google Ads — prévue dès validation de l’accès API Google. Meta Ads reste disponible.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-soft">
                Bientôt
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Meta Ads */}
      <section className="rounded-2xl border border-line/70 bg-white p-5">
        <div className="flex items-start gap-3">
          <MetaIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-[14px] font-medium text-ink">Meta Ads</p>
              <p className="text-[12px] text-ink-soft">
                Connectez Meta, choisissez votre Page Facebook, puis le compte publicitaire à utiliser.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {metaLinked ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connecté
                  </span>
                  {metaPageLabel ? (
                    <span className="text-[12px] text-ink-soft">Page · {metaPageLabel}</span>
                  ) : metaFetching ? (
                    <span className="inline-flex items-center gap-1 text-[12px] text-ink-soft">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des Pages…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[12px] text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Choisissez une Page ci-dessous
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
              ) : (
                <button type="button" className="btn-primary text-[13px]" onClick={() => void connect("meta_ads")}>
                  Connecter Meta
                </button>
              )}
            </div>

            {metaLinked && (
              <div className="space-y-2 border-t border-line/50 pt-3">
                <p className="text-[12px] font-medium text-ink">1 · Page Facebook pour les publicités</p>
                <p className="text-[12px] text-ink-soft">Sélectionnez la Page qui apparaîtra sur vos annonces.</p>
                {metaFetching && !metaSetup ? (
                  <p className="flex items-center gap-2 text-[12px] text-ink-soft">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des Pages…
                  </p>
                ) : (metaSetup?.availablePages?.length ?? 0) > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-line/60">
                    {metaSetup!.availablePages.map((p) => {
                      const selected = sameMetaPageId(metaSetup?.pageId, p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={savingPage || setPageMut.isPending}
                          onClick={() => void handleSelectPage(p.id)}
                          className={`flex w-full items-center justify-between gap-3 border-b border-line/50 px-3 py-2.5 text-left last:border-b-0 ${
                            selected ? "bg-[#fff5ea]" : "bg-white hover:bg-surface-2/60"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">{p.name}</p>
                            <p className="text-[11px] text-ink-soft">ID {p.id}</p>
                          </div>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? "border-[#ff6c02] bg-gradient-to-b from-[#ff9040] to-[#e55a00] text-white"
                                : "border-line bg-white"
                            }`}
                          >
                            {selected ? <Check className="h-3 w-3" /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-3">
                    <p className="text-[12px] text-amber-900">
                      Aucune Page listée automatiquement. Collez l’ID de votre Page Facebook (chiffres uniquement).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={manualPageId}
                        onChange={(e) => setManualPageId(e.target.value)}
                        placeholder="Ex. 123456789012345"
                        className="min-w-[200px] flex-1 rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-[#ff6c02]"
                      />
                      <button
                        type="button"
                        className="btn-primary text-[12px]"
                        disabled={savingPage || !manualPageId.trim()}
                        onClick={() => void handleSelectPage(manualPageId.trim())}
                      >
                        {savingPage ? "Enregistrement…" : "Utiliser cette Page"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {metaLinked && (
              <div className="space-y-2 border-t border-line/50 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-ink">2 · Compte publicitaire Meta</p>
                  <span className="text-[11px] text-ink-soft">
                    {linked?.accounts.length ?? 0}
                    {linked && linked.limit >= 0 ? ` / ${linked.limit}` : ""} liés
                  </span>
                </div>
                <p className="text-[12px] text-ink-soft">
                  Cochez le compte à rattacher (limite de votre plan). Le compte actif sert aux campagnes.
                </p>
                {accountError && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                    {/plan|quota|limite|upgrade|supérieur/i.test(accountError) ? (
                      <>
                        {accountError}{" "}
                        <Link to="/app/settings" className="font-medium underline">
                          Passer au plan supérieur
                        </Link>
                      </>
                    ) : /Failed query|column|does not exist/i.test(accountError) ? (
                      "Erreur technique temporaire — rechargez la page. Si ça continue, contactez le support."
                    ) : (
                      accountError
                    )}
                  </p>
                )}
                {metaAccountsLoading ? (
                  <p className="flex items-center gap-2 text-[12px] text-ink-soft">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des comptes…
                  </p>
                ) : metaOnly.length === 0 ? (
                  <p className="text-[12px] text-ink-soft">Aucun compte Meta visible avec ce token OAuth.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-line/60">
                    {metaOnly.map((a) => {
                      const isLinked = linked?.accounts.some((l) => sameMetaActId(l.accountId, a.accountId));
                      const isActive = linked?.activeAccountId
                        ? sameMetaActId(linked.activeAccountId, a.accountId)
                        : false;
                      const atLimit =
                        linked &&
                        linked.limit >= 0 &&
                        linked.accounts.length >= linked.limit &&
                        !isLinked;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          disabled={accountBusy === a.accountId || Boolean(atLimit && !isLinked)}
                          title={atLimit ? "Limite du plan atteinte" : undefined}
                          onClick={() => void handleLinkAccount(a, !isLinked)}
                          className={`flex w-full items-center justify-between gap-3 border-b border-line/50 px-3 py-2.5 text-left last:border-b-0 disabled:opacity-50 ${
                            isLinked ? "bg-[#fff5ea]" : "bg-white hover:bg-surface-2/60"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">{a.name}</p>
                            <p className="text-[11px] text-ink-soft">
                              {a.masked} · {a.currency}
                              {isActive ? " · actif" : ""}
                            </p>
                          </div>
                          <span className="flex items-center gap-2">
                            {accountBusy === a.accountId ? (
                              <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
                            ) : (
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                  isLinked
                                    ? "border-[#ff6c02] bg-gradient-to-b from-[#ff9040] to-[#e55a00] text-white"
                                    : "border-line bg-white"
                                }`}
                              >
                                {isLinked ? <Check className="h-3.5 w-3.5" /> : null}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Research */}
      <section className="rounded-2xl border border-line/70 bg-white p-5">
        <div className="flex items-start gap-3">
          <ResearchIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="text-[14px] font-medium text-ink">Recherche concurrents</p>
            <p className="text-[12px] text-ink-soft">
              Meta Ad Library (API officielle) — prévu bientôt. Meta Ads fonctionne sans ce module.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-soft">
                Bientôt
              </span>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
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
                {items.map((cfg) => (
                  <li key={cfg.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                        <BrandIcon id={cfg.id} className="h-5 w-5" title={cfg.label} />
                      </span>
                      <div>
                        <p className="text-[14px] font-medium text-ink">{cfg.label}</p>
                        <p className="text-[12px] text-ink-soft">Bientôt</p>
                      </div>
                    </div>
                    <span className="chip-ghost text-[12px] text-ink-soft">Bientôt</span>
                  </li>
                ))}
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
            <li key={it.id} className="flex items-center justify-between gap-4 px-5 py-4 opacity-70">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                  <BrandIcon id={it.id} className="h-5 w-5" title={it.label} />
                </span>
                <div>
                  <p className="text-[14px] font-medium text-ink">{it.label}</p>
                  <p className="text-[12px] text-ink-soft">{it.desc}</p>
                </div>
              </div>
              <span className="chip-ghost bg-surface-2 text-[12px]">Bientôt</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
