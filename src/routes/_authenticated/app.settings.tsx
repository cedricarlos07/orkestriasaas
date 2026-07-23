import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Users2, ShieldCheck, CreditCard, BellRing, Save, UserPlus, Check, KeyRound, Smartphone, Mail, MessageSquare, Sparkles, Monitor, ExternalLink, Loader2 } from "lucide-react";
import { getProfile } from "@/functions/profiles";
import { getBillingStatus, openBillingPortal, startCheckout } from "@/functions/billing";
import { authClient } from "@/lib/auth-client";
import { formatPriceCents } from "@/lib/pricing/money";
import type { PlanId } from "@/lib/pricing/plans";

export const Route = createFileRoute("/_authenticated/app/settings")({ component: Settings });

const TABS = [
  { label: "Entreprise", icon: Building2 },
  { label: "Membres", icon: Users2 },
  { label: "Sécurité", icon: ShieldCheck },
  { label: "Facturation", icon: CreditCard },
  { label: "Notifications", icon: BellRing },
] as const;

function Settings() {
  const [tab, setTab] = useState(0);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const { data: session } = authClient.useSession();
  const companyFields: [string, string][] = [
    ["Nom de l'entreprise", profile?.company ?? "—"],
    ["Secteur", profile?.sector ?? "—"],
    ["Pays", profile?.country ?? "Côte d'Ivoire"],
    ["Devise", profile?.currency ?? "USD"],
    ["Site web", "—"],
  ];
  const owner = {
    n: session?.user?.name || profile?.company || "Vous",
    e: session?.user?.email || "—",
  };
  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[0_10px_24px_-10px_rgba(255,108,2,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]">
            <Sparkles className="h-5 w-5" />
            <span className="absolute inset-0 -z-10 rounded-2xl bg-[#ff6c02]/40 blur-xl animate-[softPulse_2.4s_ease-in-out_infinite]" />
          </span>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Paramètres</p>
            <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Configuration du compte</h1>
            <p className="text-[13px] text-ink-soft">Entreprise, équipe, sécurité, facturation et notifications.</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        <aside className="card-soft h-max overflow-hidden p-2">
          <nav className="flex md:flex-col gap-1 overflow-x-auto">
            {TABS.map((t, i) => {
              const Icon = t.icon;
              const active = tab === i;
              return (
                <button
                  key={t.label}
                  onClick={() => setTab(i)}
                  className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition ${active
                    ? "bg-gradient-to-r from-[#fff2e5] to-white text-ink ring-1 ring-inset ring-[#ff6c02]/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                    : "text-ink-soft hover:bg-white/70 hover:text-ink"}`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${active ? "bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white" : "bg-gradient-to-br from-white to-[#faf6ef] text-ink-soft ring-1 ring-line/60"}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {t.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="card-soft relative overflow-hidden p-6">
          <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-52 w-52 rounded-full bg-[#ff6c02]/10 blur-3xl" />
          <div className="relative">
            {tab === 0 && <Form fields={companyFields} />}
            {tab === 1 && <Members owner={owner} />}
            {tab === 2 && <Security />}
            {tab === 3 && <Billing />}
            {tab === 4 && <Notifications />}
          </div>
        </section>
      </div>
    </div>
  );
}

function Form({ fields }: { fields: [string, string][] }) {
  return (
    <div className="space-y-4">
      {fields.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-6">
          <label className="w-56 text-[13px] font-medium text-ink">{k}</label>
          <input defaultValue={v} className="flex-1 rounded-xl border border-line bg-white px-3 py-2 text-[14px] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/20" />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="button" className="chip-ghost" disabled title="Persistance bientôt disponible">
          <Save className="h-4 w-4" /> Enregistrer
        </button>
        <span className="text-[12px] text-ink-soft">Enregistrement entreprise bientôt disponible.</span>
      </div>
    </div>
  );
}

type Member = { n: string; r: string; e: string };

function Members({ owner }: { owner: { n: string; e: string } }) {
  const list: Member[] = [{ n: owner.n, r: "Propriétaire", e: owner.e }];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-[16px] font-semibold text-ink">Équipe</p>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-ink-soft ring-1 ring-line/60">1 membre</span>
      </div>
      <ul className="divide-y divide-line/60 rounded-xl border border-line/60 bg-gradient-to-b from-white to-[#faf6ef] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        {list.map((m) => (
          <li key={m.e} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-[12px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                {m.n.split(" ").map((p) => p[0]).join("").slice(0, 2)}
              </span>
              <div>
                <p className="text-[14px] font-medium text-ink">{m.n}</p>
                <p className="text-[12px] text-ink-soft">{m.e}</p>
              </div>
            </div>
            <span className="rounded-full bg-gradient-to-r from-[#ff8a3c] to-[#ff6c02] px-2.5 py-1 text-[11px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">{m.r}</span>
          </li>
        ))}
      </ul>
      <button type="button" disabled className="mt-4 chip-ghost" title="Bientôt">
        <UserPlus className="h-4 w-4" /> Inviter un membre
      </button>
      <p className="mt-2 text-[12px] text-ink-soft">Les invitations d&apos;équipe seront disponibles prochainement.</p>
    </div>
  );
}

function Security() {
  const [twoFA, setTwoFA] = useState(false);
  const [alerts, setAlerts] = useState(true);
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line/60 bg-gradient-to-br from-white to-[#faf6ef] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"><KeyRound className="h-4 w-4" /></span>
            <div>
              <p className="text-[14px] font-medium text-ink">Mot de passe</p>
              <p className="text-[12px] text-ink-soft">Géré depuis votre compte Orkestria.</p>
            </div>
          </div>
          <button className="chip-ghost" type="button" disabled title="Bientôt">Modifier</button>
        </div>
      </div>

      <div className="rounded-2xl border border-line/60 bg-gradient-to-br from-white to-[#faf6ef] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"><ShieldCheck className="h-4 w-4" /></span>
            <div>
              <p className="text-[14px] font-medium text-ink">Authentification à deux facteurs</p>
              <p className="text-[12px] text-ink-soft">Pas encore branchée — préférence locale uniquement.</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <SwitchToggle on={twoFA} onChange={() => setTwoFA((v) => !v)} />
            <span className="text-[10px] text-ink-soft">Aperçu · non enregistré</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line/60 bg-gradient-to-br from-white to-[#faf6ef] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-[14px] font-semibold text-ink">Sessions actives</p>
          <SwitchToggle on={alerts} onChange={() => setAlerts((v) => !v)} label="Alertes de connexion" />
        </div>
        <p className="text-[13px] text-ink-soft">Session actuelle uniquement — le listing multi-appareils n’est pas encore disponible.</p>
        <ul className="mt-3 divide-y divide-line/60">
          <li className="flex items-center justify-between gap-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-ink-soft ring-1 ring-line/60"><Monitor className="h-4 w-4" /></span>
              <div>
                <p className="text-[13px] font-medium text-ink">Cet appareil</p>
                <p className="text-[11px] text-ink-soft">Session en cours</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Actif</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Billing() {
  const qc = useQueryClient();
  const [interval, setInterval] = useState<"month" | "year">("month");
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

  const plans = data.catalog.filter((p) => p.audience !== "enterprise" || p.id === "enterprise");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line/60 bg-gradient-to-br from-white to-[#faf6ef] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Abonnement actuel</p>
            <p className="mt-1 font-display text-[22px] font-semibold text-ink">{data.planName}</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              Statut : <span className="font-medium text-ink">{data.status}</span>
              {data.billingInterval ? ` · facturation ${data.billingInterval === "year" ? "annuelle" : "mensuelle"}` : ""}
              {" · USD"}
            </p>
          </div>
          {data.stripeCustomerId && (
            <button
              type="button"
              className="btn-dark"
              disabled={portal.isPending}
              onClick={() => portal.mutate()}
            >
              {portal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Gérer dans Stripe
            </button>
          )}
        </div>
        {!data.configured && (
          <p className="mt-3 text-[13px] text-amber-700">Stripe n’est pas encore configuré côté serveur.</p>
        )}
        {(checkout.error || portal.error) && (
          <p className="mt-3 text-[13px] text-rose-600">
            {(checkout.error || portal.error)?.message ?? "Erreur Stripe"}
          </p>
        )}
        {data.quotas && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                label: "Runs / mois",
                used: data.quotas.usage.runsMonth,
                max: data.quotas.quotas.runsPerMonth,
              },
              {
                label: "MCP / mois",
                used: data.quotas.usage.mcpCallsMonth,
                max: data.quotas.quotas.mcpCallsPerMonth,
              },
              {
                label: "IA / jour",
                used: data.quotas.usage.llmCallsDay,
                max: data.quotas.quotas.llmCallsPerDay,
              },
              {
                label: "Budget IA $",
                used: Number(data.quotas.usage.aiSpendUsdMonth.toFixed(2)),
                max: data.quotas.quotas.aiBudgetUsdMonthly,
              },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-black/5">
                <p className="text-[11px] uppercase tracking-wider text-ink-soft">{m.label}</p>
                <p className="mt-0.5 text-[13px] font-semibold text-ink">
                  {m.used}
                  <span className="font-normal text-ink-soft">
                    {" "}/ {m.max < 0 ? "∞" : m.max}
                  </span>
                </p>
                <p className="text-[10px] text-ink-soft">
                  {data.quotas!.quotas.apiPerMinute}/min · {data.quotas!.quotas.apiPerHour}/h
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-[16px] font-semibold text-ink">Changer de plan</p>
        <div className="inline-flex rounded-full bg-surface-2 p-1 ring-1 ring-black/5">
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
            Annuel (−17 %)
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => {
          const cents = interval === "year" ? p.priceYearlyCents : p.priceMonthlyCents;
          const current = p.id === data.planId;
          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-4 ${current ? "border-[#ff6c02]/40 bg-[#fff6ee]" : "border-line/60 bg-white"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display text-[16px] font-semibold text-ink">{p.name}</p>
                {current && (
                  <span className="rounded-full bg-[#ff6c02] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                    Actuel
                  </span>
                )}
              </div>
              <p className="mt-2 font-display text-[24px] font-semibold text-ink">
                {formatPriceCents(cents)}
                <span className="text-[12px] font-normal text-ink-soft">
                  /{interval === "year" ? "an" : "mois"}
                </span>
              </p>
              <button
                type="button"
                className="btn-primary mt-4 w-full justify-center"
                disabled={!data.configured || current || checkout.isPending || !p.stripe}
                onClick={() => {
                  checkout.mutate(p.id as PlanId);
                  void qc;
                }}
              >
                {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {current ? "Plan actuel" : "Souscrire"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Notifications() {
  const [prefs, setPrefs] = useState({
    guardianEmail: true,
    guardianSMS: false,
    weekly: true,
    approvals: true,
    launches: true,
    tips: false,
  });
  type Key = keyof typeof prefs;
  const set = (k: Key) => setPrefs((p) => ({ ...p, [k]: !p[k] }));
  const rows: { key: Key; icon: React.ElementType; title: string; sub: string; tint: string }[] = [
    { key: "guardianEmail", icon: Mail, title: "Alertes Guardian (e-mail)", sub: "Anomalies, tracking cassé, budget qui dérape.", tint: "from-sky-400 to-sky-600" },
    { key: "guardianSMS", icon: MessageSquare, title: "Alertes urgentes (SMS)", sub: "Uniquement les incidents critiques.", tint: "from-rose-400 to-rose-600" },
    { key: "weekly", icon: BellRing, title: "Rapport hebdomadaire", sub: "Résumé livré chaque lundi 09h.", tint: "from-violet-400 to-violet-600" },
    { key: "approvals", icon: Check, title: "Approbations à traiter", sub: "Quand un client ou un manager attend votre validation.", tint: "from-amber-400 to-amber-600" },
    { key: "launches", icon: Sparkles, title: "Campagnes prêtes à publier", sub: "Notification dès qu'un brief est finalisé.", tint: "from-emerald-400 to-emerald-600" },
    { key: "tips", icon: Sparkles, title: "Conseils Orkestria", sub: "Idées d'optimisation contextuelles.", tint: "from-slate-500 to-slate-700" },
  ];
  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        Aperçu des préférences — pas encore enregistrées sur le serveur.
      </p>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-3 rounded-2xl border border-line/60 bg-gradient-to-br from-white to-[#faf6ef] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="flex items-start gap-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${r.tint} text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]`}><r.icon className="h-4 w-4" /></span>
            <div>
              <p className="text-[14px] font-medium text-ink">{r.title}</p>
              <p className="text-[12px] text-ink-soft">{r.sub}</p>
            </div>
          </div>
          <SwitchToggle on={prefs[r.key]} onChange={() => set(r.key)} />
        </div>
      ))}
    </div>
  );
}

function SwitchToggle({ on, onChange, label }: { on: boolean; onChange: () => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2">
      {label && <span className="text-[12px] text-ink-soft">{label}</span>}
      <button
        role="switch"
        aria-checked={on}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ring-1 transition ${on ? "bg-gradient-to-r from-[#ff8a3c] to-[#ff6c02] ring-[#ff6c02]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" : "bg-surface-2 ring-line/60"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition ${on ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}