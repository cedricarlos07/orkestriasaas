import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CreditCard,
  Gauge,
  Save,
  Sparkles,
  ExternalLink,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import { getProfile, saveUserProfile } from "@/functions/profiles";
import { getBillingStatus, getUsageQuotas, openBillingPortal, payCommission, startCheckout } from "@/functions/billing";
import { listLinkedAdAccounts } from "@/functions/ad-accounts";
import { authClient } from "@/lib/auth-client";
import { formatPriceCents, formatUsd } from "@/lib/pricing/money";
import type { PlanId } from "@/lib/pricing/plans";

export const Route = createFileRoute("/_authenticated/app/settings")({ component: Settings });

const TABS = [
  { id: "company", label: "Entreprise", icon: Building2 },
  { id: "usage", label: "Mon usage", icon: Gauge },
  { id: "billing", label: "Facturation", icon: CreditCard },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Settings() {
  const [tab, setTab] = useState<TabId>("company");
  const { data: profile, refetch: refetchProfile } = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#billing") setTab("billing");
    if (window.location.hash === "#usage") setTab("usage");
  }, []);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[0_10px_24px_-10px_rgba(255,108,2,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Paramètres</p>
            <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Configuration du compte</h1>
            <p className="text-[13px] text-ink-soft">Entreprise, usage et facturation — uniquement ce qui est enregistré.</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        <aside className="card-soft h-max overflow-hidden p-2">
          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-[#fff2e5] to-white text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-inset ring-[#ff6c02]/25"
                      : "text-ink-soft hover:bg-white/70 hover:text-ink"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      active
                        ? "bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white"
                        : "bg-gradient-to-br from-white to-[#faf6ef] text-ink-soft ring-1 ring-line/60"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {t.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="card-soft relative overflow-hidden p-6">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#ff6c02]/10 blur-3xl" />
          <div className="relative">
            {tab === "company" && (
              <CompanyForm
                profile={profile}
                email={session?.user?.email}
                onSaved={() => void refetchProfile()}
              />
            )}
            {tab === "usage" && <UsagePanel onUpgrade={() => setTab("billing")} />}
            {tab === "billing" && <Billing />}
          </div>
        </section>
      </div>
    </div>
  );
}

function CompanyForm({
  profile,
  email,
  onSaved,
}: {
  profile: Awaited<ReturnType<typeof getProfile>> | undefined;
  email?: string;
  onSaved: () => void;
}) {
  const [company, setCompany] = useState(profile?.company ?? "");
  const [sector, setSector] = useState(profile?.sector ?? "");
  const [country, setCountry] = useState(profile?.country ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      saveUserProfile({
        data: {
          appRole: profile?.appRole ?? "client",
          company: company.trim() || "Mon entreprise",
          sector: sector.trim() || undefined,
          country: country.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setMsg("Enregistré.");
      onSaved();
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : "Erreur"),
  });

  useEffect(() => {
    setCompany(profile?.company ?? "");
    setSector(profile?.sector ?? "");
    setCountry(profile?.country ?? "");
  }, [profile?.company, profile?.sector, profile?.country]);

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-soft">Compte : {email ?? "—"}</p>
      {(
        [
          ["Nom de l'entreprise", company, setCompany],
          ["Secteur", sector, setSector],
          ["Pays", country, setCountry],
        ] as const
      ).map(([label, value, set]) => (
        <div key={label} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-6">
          <label className="w-56 text-[13px] font-medium text-ink">{label}</label>
          <input
            value={value}
            onChange={(e) => set(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-white px-3 py-2 text-[14px] text-ink focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/20"
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="button" className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </button>
        {msg && <span className="text-[12px] text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}

function UsagePanel({ onUpgrade }: { onUpgrade: () => void }) {
  const { data: quotas, isLoading } = useQuery({ queryKey: ["usage-quotas"], queryFn: () => getUsageQuotas() });
  const { data: linked } = useQuery({ queryKey: ["linked-ad-accounts"], queryFn: () => listLinkedAdAccounts() });

  const gauges = useMemo(() => {
    if (!quotas) return [];
    const adMax = quotas.quotas.adAccounts;
    const adUsed = linked?.accounts.length ?? 0;
    return [
      {
        label: "Comptes pubs",
        used: adUsed,
        max: adMax,
        unit: "",
        hint: "liés à Orkestria",
      },
      {
        label: "Crédit IA",
        used: Number(quotas.usage.aiSpendUsdMonth.toFixed(2)),
        max: quotas.quotas.aiBudgetUsdMonthly,
        unit: "$",
        hint: "consommé ce mois",
      },
      {
        label: "Runs agent",
        used: quotas.usage.runsMonth,
        max: quotas.quotas.runsPerMonth,
        unit: "",
        hint: "ce mois",
      },
    ];
  }, [quotas, linked]);

  const anyFull = gauges.some((g) => g.max >= 0 && g.used >= g.max);

  if (isLoading || !quotas) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement de l&apos;usage…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-display text-[16px] font-semibold text-ink">Mon usage</p>
        <p className="mt-1 text-[13px] text-ink-soft">
          Plan {quotas.planId.replace(/_/g, " ")} · chiffres réels de votre organisation.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {gauges.map((g) => {
          const pct = g.max < 0 ? 0 : Math.min(100, Math.round((g.used / Math.max(g.max, 1)) * 100));
          const full = g.max >= 0 && g.used >= g.max;
          return (
            <div key={g.label} className="rounded-2xl border border-line/60 bg-white/80 p-4">
              <p className="text-[11px] uppercase tracking-wider text-ink-soft">{g.label}</p>
              <p className="mt-1 font-display text-[22px] font-semibold text-ink">
                {g.unit}
                {g.used}
                <span className="text-[13px] font-normal text-ink-soft">
                  {" "}
                  / {g.max < 0 ? "∞" : `${g.unit}${g.max}`}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{g.hint}</p>
              {g.max >= 0 && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${full ? "bg-rose-500" : "bg-[#ff6c02]"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {anyFull && (
        <button type="button" className="btn-primary" onClick={onUpgrade}>
          Passer au plan supérieur <ArrowUpRight className="h-4 w-4" />
        </button>
      )}
      <p className="text-[12px] text-ink-soft">
        Gérer les comptes pubs dans{" "}
        <Link to="/app/connections" className="font-medium text-[#ff6c02] hover:underline">
          Connexions
        </Link>
        .
      </p>
    </div>
  );
}

function Billing() {
  const qc = useQueryClient();
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [agencyOpen, setAgencyOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["billing"],
    queryFn: () => getBillingStatus(),
  });
  const checkout = useMutation({
    mutationFn: (planId: PlanId) => startCheckout({ data: { planId, interval } }),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
  });
  const portal = useMutation({
    mutationFn: () => openBillingPortal(),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
  });
  const pay = useMutation({
    mutationFn: () => payCommission(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["billing"] });
      if (res.url) window.location.href = res.url;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement facturation…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[14px] text-rose-700">
        Impossible de charger la facturation.
      </div>
    );
  }

  const c = data.commission;
  const ratePct = Math.round((c?.rate ?? 0.08) * 100);
  const agencyPlans = data.catalog.filter((p) => p.audience === "agence" || p.id === "enterprise");

  return (
    <div id="billing" className="space-y-5">
      <div className="rounded-2xl border border-line/60 bg-gradient-to-br from-white to-[#faf6ef] p-5">
        <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Commission sur budget pub</p>
        <p className="mt-1 font-display text-[22px] font-semibold text-ink">
          {ratePct}&nbsp;% du spend Meta + Google
        </p>
        <p className="mt-1 text-[13px] text-ink-soft">
          Sans abonnement obligatoire. Vous payez uniquement {ratePct}&nbsp;% de votre spend Meta + Google.
        </p>
        {c?.writeBlocked || data.writeBlocked ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">
            Écritures bloquées — une facture de commission est en retard. Payez pour reprendre.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-line/60 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-wider text-ink-soft">Ce mois ({c?.period})</p>
            <p className="mt-2 font-display text-[28px] font-semibold text-ink">
              {formatUsd(c?.commissionUsd ?? 0)}
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">
              Spend tracké : {formatUsd(c?.monthSpendUsd ?? 0)}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={!data.configured || (c?.commissionUsd ?? 0) <= 0 || pay.isPending}
            onClick={() => pay.mutate()}
          >
            {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {(c?.commissionUsd ?? 0) > 0 ? "Payer la commission" : "Rien à payer"}
          </button>
        </div>
        {!data.configured && (
          <p className="mt-3 text-[13px] text-amber-700">Stripe n’est pas encore configuré côté serveur.</p>
        )}
        {(pay.error || portal.error || checkout.error) && (
          <p className="mt-3 text-[13px] text-rose-600">
            {(pay.error || portal.error || checkout.error)?.message ?? "Erreur Stripe"}
          </p>
        )}
        {c?.openInvoice?.hostedUrl ? (
          <p className="mt-3 text-[13px] text-ink-soft">
            Facture ouverte :{" "}
            <a href={c.openInvoice.hostedUrl} className="font-medium text-[#ff6c02] underline" target="_blank" rel="noreferrer">
              ouvrir dans Stripe
            </a>
          </p>
        ) : null}
      </div>

      {(c?.invoices?.length ?? 0) > 0 ? (
        <div className="rounded-2xl border border-line/60 bg-white p-5">
          <p className="font-display text-[16px] font-semibold text-ink">Factures commission</p>
          <ul className="mt-3 divide-y divide-line/50">
            {c!.invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <p className="font-medium text-ink">{inv.period}</p>
                  <p className="text-ink-soft">
                    Spend {formatUsd(inv.spendUsd)} · {formatUsd(inv.commissionUsd)} · {inv.status}
                  </p>
                </div>
                {inv.hostedUrl ? (
                  <a href={inv.hostedUrl} className="chip-ghost text-[12px]" target="_blank" rel="noreferrer">
                    Voir
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.stripeCustomerId ? (
        <button type="button" className="chip-ghost" disabled={portal.isPending} onClick={() => portal.mutate()}>
          {portal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Portail Stripe
        </button>
      ) : null}

      <div className="rounded-2xl border border-dashed border-line/70 bg-surface-2/40 p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setAgencyOpen((v) => !v)}
        >
          <div>
            <p className="font-display text-[15px] font-semibold text-ink">Forfait agence (optionnel)</p>
            <p className="text-[12px] text-ink-soft">Abonnement fixe pour multi-comptes — pas le chemin principal.</p>
          </div>
          <span className="text-[12px] text-ink-soft">{agencyOpen ? "Masquer" : "Afficher"}</span>
        </button>

        {agencyOpen ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-ink-soft">
                Plan actuel (legacy) : <span className="font-medium text-ink">{data.planName}</span>
              </p>
              <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-black/5">
                <button
                  type="button"
                  onClick={() => setInterval("month")}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${interval === "month" ? "bg-ink text-white" : "text-ink-soft"}`}
                >
                  Mensuel
                </button>
                <button
                  type="button"
                  onClick={() => setInterval("year")}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${interval === "year" ? "bg-ink text-white" : "text-ink-soft"}`}
                >
                  Annuel
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {agencyPlans.map((p) => {
                const cents = interval === "year" ? p.priceYearlyCents : p.priceMonthlyCents;
                const current = p.id === data.planId;
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-4 ${current ? "border-[#ff6c02]/40 bg-[#fff6ee]" : "border-line/60 bg-white"}`}
                  >
                    <p className="font-display text-[16px] font-semibold text-ink">{p.name}</p>
                    <p className="mt-2 font-display text-[22px] font-semibold text-ink">
                      {formatPriceCents(cents)}
                      <span className="text-[12px] font-normal text-ink-soft">
                        /{interval === "year" ? "an" : "mois"}
                      </span>
                    </p>
                    <button
                      type="button"
                      className="btn-primary mt-4 w-full justify-center"
                      disabled={!data.configured || current || checkout.isPending || !p.stripe}
                      onClick={() => checkout.mutate(p.id as PlanId)}
                    >
                      {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {current ? "Plan actuel" : "Souscrire"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
