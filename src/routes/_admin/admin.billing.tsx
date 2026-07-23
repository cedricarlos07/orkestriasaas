import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PLANS, getInvoices, getOrganizations, fmtMoney, fmtRelative, type Plan } from "@/lib/admin-store";
import { CreditCard, CheckCircle2, XCircle, RotateCcw, Clock, Smartphone, Building2, Ticket, Percent } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/billing")({
  head: () => ({ meta: [{ title: "Facturation — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: BillingPage,
});

function BillingPage() {
  const [tab, setTab] = useState<"plans" | "invoices" | "dunning">("plans");
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Abonnements & facturation</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">Business model & paiements</h1>
        <p className="mt-1 text-[13px] text-white/60">Plans, factures, dunning, moyens de paiement (carte, Mobile Money, virement).</p>
      </header>

      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-[12.5px]">
        {[["plans", "Plans"], ["invoices", "Factures & paiements"], ["dunning", "Dunning"]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v as any)} className={`rounded-full px-4 py-1.5 transition ${tab === v ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab === "plans" && <PlansTab />}
      {tab === "invoices" && <InvoicesTab />}
      {tab === "dunning" && <DunningTab />}
    </div>
  );
}

function PlansTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {PLANS.map((p) => <PlanCard key={p.id} p={p} />)}
    </div>
  );
}

function PlanCard({ p }: { p: Plan }) {
  const [edit, setEdit] = useState(false);
  return (
    <div className={`rounded-2xl border p-5 ${p.audience === "enterprise" ? "border-[#ff8a3d]/40 bg-gradient-to-br from-[#ff6c02]/[0.08] to-white/[0.02]" : "border-white/10 bg-white/[0.02]"}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10.5px] uppercase tracking-widest text-white/40">{p.audience}</p>
          <h3 className="mt-0.5 font-display text-[18px] font-semibold">{p.name}</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-white/70">{p.autonomy}</span>
      </div>
      <p className="mt-3 font-display text-[24px] font-semibold">{fmtMoney(p.priceMonthly, "plan")}<span className="text-[12px] font-normal text-white/50"> / mois</span></p>
      <p className="text-[11.5px] text-white/50">ou {fmtMoney(p.priceYearly, "plan")} / an</p>
      <ul className="mt-4 space-y-1.5 text-[12.5px] text-white/75">
        <Li>{p.orgs} organisation{p.orgs === 1 ? "" : "s"}</Li>
        <Li>{p.workspaces} workspace{p.workspaces === 1 ? "" : "s"}</Li>
        <Li>{p.adAccounts} compte{p.adAccounts === 1 ? "" : "s"} publicitaires</Li>
        <Li>{p.users} utilisateur{p.users === 1 ? "" : "s"}</Li>
        <Li>{p.runsPerMonth} runs / mois</Li>
        <Li>Historique {p.historyDays} j</Li>
        <Li>Automations : {p.automations}</Li>
        <Li>Support : {p.support}</Li>
      </ul>
      <button onClick={() => setEdit(true)} className="mt-4 w-full rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] hover:bg-white/[0.06]">Modifier ce plan</button>
      {edit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setEdit(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111114] p-6">
            <h3 className="font-display text-[18px] font-semibold">Configuration — {p.name}</h3>
            <p className="mt-1 text-[12.5px] text-white/60">Aperçu démo, non persisté. Les changements réels doivent passer par un cycle de review.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12.5px]">
              <Field label="Prix mensuel" defaultValue={p.priceMonthly} />
              <Field label="Prix annuel" defaultValue={p.priceYearly} />
              <Field label="Runs / mois" defaultValue={String(p.runsPerMonth)} />
              <Field label="Historique (jours)" defaultValue={p.historyDays} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEdit(false)} className="rounded-full border border-white/10 px-4 py-2 text-[12.5px] text-white/70">Annuler</button>
              <button onClick={() => setEdit(false)} className="rounded-full bg-[#ff6c02] px-4 py-2 text-[12.5px] font-semibold text-white">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string | number }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-white/50">{label}</span>
      <input defaultValue={defaultValue} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] outline-none focus:border-[#ff8a3d]" />
    </label>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 rounded-full bg-[#ff8a3d]" />{children}</li>;
}

function InvoicesTab() {
  const orgs = Object.fromEntries(getOrganizations().map((o) => [o.id, o.name]));
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const rows = useMemo(() => getInvoices().filter((i) =>
    (status === "all" || i.status === status) && (method === "all" || i.method === method)
  ).slice(0, 60), [status, method]);

  const kpis = useMemo(() => {
    const all = getInvoices();
    return {
      paid: all.filter((i) => i.status === "payée").length,
      failed: all.filter((i) => i.status === "échec").length,
      pending: all.filter((i) => i.status === "en_attente").length,
      refunded: all.filter((i) => i.status === "remboursée").length,
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile icon={CheckCircle2} label="Payées" value={kpis.paid} tone="ok" />
        <KpiTile icon={XCircle} label="Échouées" value={kpis.failed} tone="warn" />
        <KpiTile icon={Clock} label="En attente" value={kpis.pending} />
        <KpiTile icon={RotateCcw} label="Remboursées" value={kpis.refunded} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[["all", "Tous"], ["payée", "Payées"], ["échec", "Échec"], ["en_attente", "En attente"], ["remboursée", "Remboursées"]].map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v)} className={`rounded-full border px-3 py-1 text-[12px] ${status === v ? "border-[#ff8a3d] bg-[#ff6c02]/15 text-[#ff8a3d]" : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"}`}>{l}</button>
        ))}
        <span className="mx-2 h-6 w-px bg-white/10" />
        {[["all", "Tous moyens"], ["carte", "Carte"], ["mobile_money", "Mobile Money"], ["virement", "Virement"], ["manuel", "Manuel"]].map(([v, l]) => (
          <button key={v} onClick={() => setMethod(v)} className={`rounded-full border px-3 py-1 text-[12px] ${method === v ? "border-[#ff8a3d] bg-[#ff6c02]/15 text-[#ff8a3d]" : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"}`}>{l}</button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-[13px]">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-white/40">
            <tr><th className="px-4 py-3">Facture</th><th>Organisation</th><th>Montant</th><th>Moyen</th><th>Statut</th><th>Émise</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((i) => (
              <tr key={i.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-2.5 font-mono text-[12px] text-white/80">{i.id}</td>
                <td className="text-white/80">{orgs[i.orgId]}</td>
                <td className="text-white/80">{fmtMoney(i.amount, "plan")}</td>
                <td className="text-white/70"><MethodPill m={i.method} /></td>
                <td><InvStatus s={i.status} /></td>
                <td className="text-white/50">{fmtRelative(i.issuedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === "warn" ? "border-amber-400/30 bg-amber-500/[0.06]" : tone === "ok" ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.08]"><Icon className="h-4 w-4" /></span>
      <p className="mt-3 text-[11px] uppercase tracking-wider text-white/50">{label}</p>
      <p className="font-display text-[22px] font-semibold">{value}</p>
    </div>
  );
}

function MethodPill({ m }: { m: string }) {
  const icon = m === "carte" ? CreditCard : m === "mobile_money" ? Smartphone : m === "virement" ? Building2 : Ticket;
  const Icon = icon;
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] capitalize"><Icon className="h-3 w-3" />{m.replace("_", " ")}</span>;
}

function InvStatus({ s }: { s: string }) {
  const map: Record<string, string> = {
    "payée": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    "échec": "bg-rose-500/15 text-rose-300 border-rose-500/25",
    "en_attente": "bg-amber-500/15 text-amber-300 border-amber-500/25",
    "remboursée": "bg-sky-500/15 text-sky-300 border-sky-500/25",
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[s]}`}>{s.replace("_", " ")}</span>;
}

function DunningTab() {
  const steps = [
    { label: "Paiement échoué", desc: "Détection instantanée par le PSP." },
    { label: "Notification au client", desc: "Email + in-app + WhatsApp le cas échéant." },
    { label: "Nouvelle tentative", desc: "3 retries automatiques sur J+1, J+3, J+7." },
    { label: "Période de grâce", desc: "7 jours — l'org reste pleinement opérationnelle." },
    { label: "Passage en lecture seule", desc: "L'écriture MCP est suspendue, les runs stoppent." },
    { label: "Suspension actions agentiques", desc: "L'agent n'exécute plus. Les campagnes existantes continuent chez Meta/Google." },
    { label: "Suspension complète", desc: "Accès plateforme suspendu. Les campagnes ne sont jamais supprimées." },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="font-display text-[16px] font-semibold">Flow en cas de paiement échoué</h3>
        <p className="mt-1 text-[12.5px] text-white/60">Orkestria n'efface jamais les campagnes existantes. Elle arrête simplement de les gérer.</p>
        <ol className="mt-5 space-y-3">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#ff6c02] to-[#ff8a3d] text-[12px] font-semibold">{i + 1}</div>
              <div>
                <p className="text-[13.5px] font-medium">{s.label}</p>
                <p className="text-[12px] text-white/60">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="font-display text-[15px] font-semibold">Coupons & réductions</h3>
          <p className="mt-1 text-[12.5px] text-white/60">Émettre des codes promo temporaires.</p>
          <div className="mt-3 space-y-2 text-[12.5px]">
            <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2"><span className="font-mono">WELCOME25</span><span className="text-emerald-300">-25 % · 3 mois</span></div>
            <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2"><span className="font-mono">AGENCY10</span><span className="text-emerald-300">-10 % · agences</span></div>
          </div>
          <button className="mt-3 w-full rounded-full border border-white/10 bg-white/[0.04] py-2 text-[12.5px] hover:bg-white/[0.06] inline-flex items-center justify-center gap-1.5"><Percent className="h-3.5 w-3.5" /> Créer un coupon</button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="font-display text-[15px] font-semibold">Moyens de paiement</h3>
          <ul className="mt-3 space-y-1.5 text-[12.5px] text-white/80">
            <li className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> Carte (Visa, Mastercard)</li>
            <li className="flex items-center gap-2"><Smartphone className="h-3.5 w-3.5" /> Mobile Money (Wave, Orange Money, MTN)</li>
            <li className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Virement bancaire</li>
            <li className="flex items-center gap-2"><Ticket className="h-3.5 w-3.5" /> Paiement manuel (agences)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
