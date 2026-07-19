import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Users2, ShieldCheck, CreditCard, BellRing, Save, UserPlus, Trash2, X, Check, KeyRound, Smartphone, Mail, MessageSquare, Sparkles, Monitor } from "lucide-react";

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
            {tab === 0 && <Form fields={[
              ["Nom de l'entreprise", "Velvet Studio"],
              ["Secteur", "Restauration"],
              ["Pays", "Côte d'Ivoire"],
              ["Devise", "FCFA"],
              ["Site web", "https://velvetstudio.ci"],
            ]} />}
            {tab === 1 && <Members />}
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
      <div className="pt-2"><button className="btn-primary"><Save className="h-4 w-4" /> Enregistrer</button></div>
    </div>
  );
}

type Member = { n: string; r: string; e: string };

function Members() {
  const [list, setList] = useState<Member[]>([
    { n: "Aïcha Diallo", r: "Propriétaire", e: "aicha@velvetstudio.ci" },
    { n: "Marc Kouassi", r: "Media buyer", e: "marc@agence.ci" },
    { n: "Nina Toure", r: "Créatif", e: "nina@agence.ci" },
  ]);
  const [invite, setInvite] = useState(false);
  const roleTint: Record<string, string> = {
    "Propriétaire": "bg-gradient-to-r from-[#ff8a3c] to-[#ff6c02] text-white",
    "Media buyer": "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
    "Créatif": "bg-violet-100 text-violet-800 ring-1 ring-violet-200",
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-[16px] font-semibold text-ink">Équipe</p>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-ink-soft ring-1 ring-line/60">{list.length} membres</span>
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
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${roleTint[m.r] ?? "bg-surface-2 text-ink"}`}>{m.r}</span>
              {m.r !== "Propriétaire" && (
                <button
                  onClick={() => setList((l) => l.filter((x) => x.e !== m.e))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-ink-soft ring-1 ring-line/60 transition hover:-translate-y-0.5 hover:text-rose-600"
                  title="Retirer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <button onClick={() => setInvite(true)} className="mt-4 btn-primary"><UserPlus className="h-4 w-4" /> Inviter un membre</button>
      {invite && (
        <InviteDialog
          onClose={() => setInvite(false)}
          onInvite={(m) => { setList((l) => [...l, m]); setInvite(false); }}
        />
      )}
    </div>
  );
}

function InviteDialog({ onClose, onInvite }: { onClose: () => void; onInvite: (m: Member) => void }) {
  const [n, setN] = useState("");
  const [e, setE] = useState("");
  const [r, setR] = useState("Media buyer");
  const valid = n.trim() && e.includes("@");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-b from-white to-[#faf6ef] shadow-2xl ring-1 ring-line/60 animate-[fadeInUp_.2s_ease-out]">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#ff6c02]/20 blur-3xl" />
        <header className="relative flex items-center justify-between border-b border-line/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"><UserPlus className="h-4 w-4" /></span>
            <h2 className="font-display text-[16px] font-semibold text-ink">Inviter un membre</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-white hover:text-ink"><X className="h-4 w-4" /></button>
        </header>
        <div className="relative space-y-3 p-5">
          <TextInput label="Nom complet" value={n} onChange={setN} placeholder="Ex : Fatou N'Guessan" />
          <TextInput label="E-mail" value={e} onChange={setE} placeholder="prenom@agence.ci" />
          <div>
            <span className="mb-1 block text-[12px] font-medium text-ink-soft">Rôle</span>
            <div className="flex flex-wrap gap-2">
              {["Media buyer", "Créatif", "Analyste"].map((role) => (
                <button
                  key={role}
                  onClick={() => setR(role)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 transition ${r === role ? "bg-gradient-to-r from-[#ff8a3c] to-[#ff6c02] text-white ring-[#ff6c02]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" : "bg-white text-ink-soft ring-line/60 hover:text-ink"}`}
                >{role}</button>
              ))}
            </div>
          </div>
        </div>
        <footer className="relative flex items-center justify-end gap-2 border-t border-line/60 bg-white/70 px-5 py-3">
          <button onClick={onClose} className="chip-ghost">Annuler</button>
          <button disabled={!valid} onClick={() => onInvite({ n, e, r })} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-4 w-4" /> Envoyer l'invitation</button>
        </footer>
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink-soft">{label}</span>
      <input value={value} onChange={(ev) => onChange(ev.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/20" />
    </label>
  );
}

function Security() {
  const [twoFA, setTwoFA] = useState(true);
  const [alerts, setAlerts] = useState(true);
  const sessions = [
    { device: "MacBook Pro · Chrome", loc: "Abidjan, CI", when: "Actif maintenant", current: true, icon: Monitor },
    { device: "iPhone 14 · Safari", loc: "Abidjan, CI", when: "Il y a 2 h", current: false, icon: Smartphone },
  ];
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line/60 bg-gradient-to-br from-white to-[#faf6ef] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"><KeyRound className="h-4 w-4" /></span>
            <div>
              <p className="text-[14px] font-medium text-ink">Mot de passe</p>
              <p className="text-[12px] text-ink-soft">Dernière modification il y a 46 jours.</p>
            </div>
          </div>
          <button className="chip-ghost">Modifier</button>
        </div>
      </div>

      <div className="rounded-2xl border border-line/60 bg-gradient-to-br from-white to-[#faf6ef] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"><ShieldCheck className="h-4 w-4" /></span>
            <div>
              <p className="text-[14px] font-medium text-ink">Authentification à deux facteurs</p>
              <p className="text-[12px] text-ink-soft">Code par SMS ou application d'authentification.</p>
            </div>
          </div>
          <SwitchToggle on={twoFA} onChange={() => setTwoFA((v) => !v)} />
        </div>
      </div>

      <div className="rounded-2xl border border-line/60 bg-gradient-to-br from-white to-[#faf6ef] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-[14px] font-semibold text-ink">Sessions actives</p>
          <SwitchToggle on={alerts} onChange={() => setAlerts((v) => !v)} label="Alertes de connexion" />
        </div>
        <ul className="divide-y divide-line/60">
          {sessions.map((s) => (
            <li key={s.device} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-ink-soft ring-1 ring-line/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"><s.icon className="h-4 w-4" /></span>
                <div>
                  <p className="text-[13px] font-medium text-ink">{s.device}</p>
                  <p className="text-[11px] text-ink-soft">{s.loc} · {s.when}</p>
                </div>
              </div>
              {s.current
                ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Cet appareil</span>
                : <button className="chip-ghost text-rose-600">Déconnecter</button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Billing() {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a1a] via-[#242424] to-[#0f0f0f] p-6 text-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-52 w-52 rounded-full bg-[#ff6c02]/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }} />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#ffbb85]">Plan actuel</p>
            <p className="mt-1 font-display text-[22px] font-semibold">Pro · 49 000 FCFA / mois</p>
            <p className="mt-1 max-w-md text-[13px] text-white/70">3 comptes publicitaires, créations illimitées (moteur interne), Ads Guardian, rapports avancés.</p>
          </div>
          <button className="btn-primary shrink-0">Changer de plan</button>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-3 text-center">
          {[["Comptes", "3 / 3"], ["Créations", "128"], ["Prochain paiement", "12 août"]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="text-[10px] uppercase tracking-wider text-white/60">{k}</p>
              <p className="mt-0.5 text-[14px] font-semibold text-white">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line/60 bg-gradient-to-br from-white to-[#faf6ef] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"><CreditCard className="h-4 w-4" /></span>
            <div>
              <p className="text-[14px] font-medium text-ink">Mobile Money</p>
              <p className="text-[12px] text-ink-soft">+225 07 •• •• 43 · par défaut</p>
            </div>
          </div>
          <button className="chip-ghost">Mettre à jour</button>
        </div>
      </div>

      <div className="rounded-2xl border border-line/60 bg-white p-5">
        <p className="mb-2 font-display text-[14px] font-semibold text-ink">Dernières factures</p>
        <ul className="divide-y divide-line/60 text-[13px]">
          {[["FCT-2026-07", "12 juil.", "49 000 FCFA"], ["FCT-2026-06", "12 juin", "49 000 FCFA"], ["FCT-2026-05", "12 mai", "49 000 FCFA"]].map(([id, d, m]) => (
            <li key={id} className="flex items-center justify-between py-2.5">
              <span className="text-ink">{id} <span className="text-ink-soft">· {d}</span></span>
              <span className="flex items-center gap-3"><span className="text-ink">{m}</span><button className="text-[12px] font-medium text-[#ff6c02] hover:underline">Télécharger</button></span>
            </li>
          ))}
        </ul>
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