import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UserPlus, CheckCircle2, Clock, Eye, EyeOff, Activity, Wrench, TrendingUp, AlertTriangle, ChevronRight, X, Sparkles, Briefcase, Users, Play, Pause, Settings2, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/agency")({ component: Agency });

type Insight = {
  id: string;
  severity: "critical" | "warning" | "info";
  icon: typeof AlertTriangle;
  title: string;
  summary: string;
  causes: string[];
  actions: { label: string; impact: string }[];
  evidence: { label: string; value: string }[];
};

type Client = {
  name: string; sector: string; budget: string; status: "Actif" | "En pause";
  roas: string; insights: Insight[];
};

const CLIENTS: Client[] = [];

const APPROVAL_STEPS = ["Orkestria prépare", "Media buyer vérifie", "Responsable agence approuve", "Client approuve", "Orkestria publie"];

const SEVERITY: Record<Insight["severity"], { chip: string; halo: string; dot: string; label: string }> = {
  critical: { chip: "bg-rose-100 text-rose-700 ring-rose-200", halo: "bg-rose-400/20", dot: "bg-rose-500", label: "Critique" },
  warning: { chip: "bg-amber-100 text-amber-800 ring-amber-200", halo: "bg-amber-400/20", dot: "bg-amber-500", label: "À surveiller" },
  info: { chip: "bg-emerald-100 text-emerald-700 ring-emerald-200", halo: "bg-emerald-400/20", dot: "bg-emerald-500", label: "Opportunité" },
};

function Agency() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>(CLIENTS);
  const [activeClient, setActiveClient] = useState<string>("");
  const [workflows, setWorkflows] = useState<Record<string, boolean[]>>(
    Object.fromEntries(CLIENTS.map((c) => [c.name, [true, true, true, true, true]])),
  );
  const [showNew, setShowNew] = useState(false);
  const allInsights = useMemo(
    () => clients.flatMap((c) => c.insights.map((i) => ({ ...i, client: c.name }))),
    [clients],
  );
  const openInsight = useMemo(() => allInsights.find((i) => i.id === openId) ?? null, [openId, allInsights]);

  const toggleStatus = (name: string) =>
    setClients((prev) => prev.map((c) => (c.name === name ? { ...c, status: c.status === "Actif" ? "En pause" : "Actif" } : c)));
  const toggleStep = (name: string, idx: number) =>
    setWorkflows((prev) => ({ ...prev, [name]: prev[name].map((v, i) => (i === idx ? !v : v)) }));
  const addClient = (payload: { name: string; sector: string; budget: string }) => {
    const nc: Client = { ...payload, status: "Actif", roas: "—", insights: [] };
    setClients((prev) => [nc, ...prev]);
    setWorkflows((prev) => ({ ...prev, [nc.name]: [true, true, true, true, true] }));
    setActiveClient(nc.name);
    setShowNew(false);
  };

  const current = clients.find((c) => c.name === activeClient) ?? clients[0] ?? null;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[0_10px_24px_-10px_rgba(255,108,2,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]">
            <Briefcase className="h-5 w-5" />
            <span className="absolute inset-0 -z-10 rounded-2xl bg-[#ff6c02]/40 blur-xl animate-[softPulse_2.4s_ease-in-out_infinite]" />
          </span>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Espace agence</p>
            <h1 className="mt-1 font-display text-[26px] font-semibold text-ink">Clients, équipe, approbations</h1>
            <p className="text-[13px] text-ink-soft">Marque blanche activable · portail client sécurisé.</p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary"><UserPlus className="h-4 w-4" /> Nouveau client</button>
      </header>

      {clients.length === 0 && (
        <div className="card-soft p-8 text-center">
          <p className="font-display text-[18px] font-semibold text-ink">Aucun client pour l'instant</p>
          <p className="mt-2 text-[14px] text-ink-soft">Ajoutez votre premier client pour configurer workflows et insights.</p>
          <button onClick={() => setShowNew(true)} className="btn-primary mt-4"><UserPlus className="h-4 w-4" /> Ajouter un client</button>
        </div>
      )}

      {clients.length > 0 && current && (
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-soft overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/60 bg-gradient-to-r from-white/80 to-[#faf6ef]/80 px-5 py-3">
            <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-ink-soft">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                <Users className="h-3 w-3" />
              </span>
              Portefeuille clients
            </p>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-ink-soft ring-1 ring-line/60">{clients.length} clients</span>
          </div>
          <ul className="divide-y divide-line/60">
            {clients.map((c) => (
              <li
                key={c.name}
                className={`cursor-pointer px-5 py-3 transition ${activeClient === c.name ? "bg-gradient-to-r from-[#fff2e5] to-white ring-1 ring-inset ring-[#ff6c02]/25" : "hover:bg-white/70"}`}
                onClick={() => setActiveClient(c.name)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-[12px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                      {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-ink">{c.name}</p>
                      <p className="text-[12px] text-ink-soft">{c.sector} · {c.budget} · ROAS {c.roas}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${c.status === "Actif" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>{c.status}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStatus(c.name); }}
                      title={c.status === "Actif" ? "Mettre en pause" : "Réactiver"}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-white to-[#faf6ef] text-ink-soft ring-1 ring-line/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:-translate-y-0.5 hover:text-ink"
                    >
                      {c.status === "Actif" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                {c.insights.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.insights.map((it) => {
                      const s = SEVERITY[it.severity];
                      return (
                        <button
                          key={it.id}
                          onClick={() => setOpenId(it.id)}
                          className={`group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition hover:-translate-y-0.5 hover:shadow-sm ${s.chip}`}
                        >
                          <it.icon className="h-3 w-3" />
                          {it.title}
                          <ChevronRight className="h-3 w-3 opacity-60 transition group-hover:translate-x-0.5" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="card-soft card-hover relative overflow-hidden p-5">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#ff6c02]/15 blur-3xl" />
          <div className="mb-4 flex items-center justify-between">
            <p className="font-display text-[15px] font-semibold text-ink">Workflow d'approbation</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-ink-soft ring-1 ring-line/60">
              <Settings2 className="h-3 w-3" /> {current.name}
            </span>
          </div>
          <ol className="space-y-2 text-[13px]">
            {APPROVAL_STEPS.map((s, i) => {
              const on = workflows[current.name]?.[i] ?? true;
              return (
                <li key={s} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition ${on ? "border-white/60 bg-gradient-to-br from-white to-[#faf6ef] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" : "border-line/50 bg-surface-2/60"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${on ? (i < 2 ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white" : i === 2 ? "bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white" : "bg-gradient-to-br from-slate-500 to-slate-700 text-white") : "bg-surface-2 text-ink-soft"}`}>
                      {on ? (i < 2 ? <CheckCircle2 className="h-3.5 w-3.5" /> : i === 2 ? <Clock className="h-3.5 w-3.5" /> : i + 1) : i + 1}
                    </span>
                    <span className={on ? "text-ink" : "text-ink-soft line-through decoration-line/60"}>{s}</span>
                  </div>
                  <Toggle on={on} onChange={() => toggleStep(current.name, i)} />
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-[12px] text-ink-soft">Configurable par client. Sélectionnez un client à gauche pour ajuster ses étapes.</p>
        </div>
      </section>
      )}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="card-soft card-hover relative overflow-hidden p-5">
          <div aria-hidden className="pointer-events-none absolute -top-14 -right-14 h-36 w-36 rounded-full bg-emerald-300/25 blur-3xl" />
          <p className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <Eye className="h-3.5 w-3.5" />
            </span>
            Portail client — visible
          </p>
          <ul className="space-y-1.5 text-[13px] text-ink">
            <li>· Résultats et ROAS</li>
            <li>· Budget consommé</li>
            <li>· Campagnes et créations</li>
            <li>· Approbations et rapports</li>
            <li>· Décisions importantes</li>
          </ul>
        </div>
        <div className="card-soft card-hover relative overflow-hidden p-5">
          <div aria-hidden className="pointer-events-none absolute -top-14 -right-14 h-36 w-36 rounded-full bg-rose-300/25 blur-3xl" />
          <p className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <EyeOff className="h-3.5 w-3.5" />
            </span>
            Masqué au client
          </p>
          <ul className="space-y-1.5 text-[13px] text-ink-soft">
            <li>· Autres comptes de l'agence</li>
            <li>· Marge agence</li>
            <li>· Commentaires internes</li>
            <li>· Coûts techniques</li>
            <li>· Prompts internes</li>
          </ul>
        </div>
      </section>

      {openInsight && <InsightDrawer insight={openInsight} onClose={() => setOpenId(null)} />}
      {showNew && <NewClientDialog onClose={() => setShowNew(false)} onCreate={addClient} />}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={on}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ring-1 transition ${on ? "bg-gradient-to-r from-[#ff8a3c] to-[#ff6c02] ring-[#ff6c02]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" : "bg-surface-2 ring-line/60"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function NewClientDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (p: { name: string; sector: string; budget: string }) => void }) {
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [budget, setBudget] = useState("");
  const valid = name.trim() && sector.trim() && budget.trim();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-b from-white to-[#faf6ef] shadow-2xl ring-1 ring-line/60 animate-[fadeInUp_.2s_ease-out]">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#ff6c02]/20 blur-3xl" />
        <header className="relative flex items-center justify-between border-b border-line/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a3c] to-[#ff6c02] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"><UserPlus className="h-4 w-4" /></span>
            <h2 className="font-display text-[16px] font-semibold text-ink">Nouveau client</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-white hover:text-ink"><X className="h-4 w-4" /></button>
        </header>
        <div className="relative space-y-3 p-5">
          <Field label="Nom" value={name} onChange={setName} placeholder="Ex : Atelier Baobab" />
          <Field label="Secteur" value={sector} onChange={setSector} placeholder="Ex : Mode" />
          <Field label="Budget mensuel" value={budget} onChange={setBudget} placeholder="Ex : 300 000 FCFA/mois" />
        </div>
        <footer className="relative flex items-center justify-end gap-2 border-t border-line/60 bg-white/70 px-5 py-3">
          <button onClick={onClose} className="chip-ghost">Annuler</button>
          <button disabled={!valid} onClick={() => onCreate({ name, sector, budget })} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-4 w-4" /> Créer</button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink-soft">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/20" />
    </label>
  );
}

function InsightDrawer({ insight, onClose }: { insight: Insight & { client?: string }; onClose: () => void }) {
  const s = SEVERITY[insight.severity];
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={insight.title}>
      <button aria-label="Fermer" onClick={onClose} className="flex-1 bg-black/40 backdrop-blur-sm animate-[fadeInUp_.15s_ease-out]" />
      <aside className="relative flex h-full w-full max-w-[520px] flex-col overflow-y-auto bg-gradient-to-b from-white to-[#faf6ef] shadow-[-30px_0_60px_-30px_rgba(0,0,0,0.4)] animate-[fadeInUp_.25s_ease-out]">
        <div aria-hidden className={`pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl ${s.halo}`} />
        <header className="relative flex items-start justify-between gap-3 border-b border-line/60 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-white to-[#faf6ef] text-ink ring-1 ring-line/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <insight.icon className="h-5 w-5" />
            </span>
            <div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
              </span>
              <h2 className="mt-1 font-display text-[18px] font-semibold text-ink">{insight.title}</h2>
              {insight.client && <p className="mt-0.5 text-[12px] text-ink-soft">Client · <span className="font-medium text-ink/80">{insight.client}</span></p>}
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{insight.summary}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="rounded-full p-1.5 text-ink-soft transition hover:bg-white hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative space-y-5 p-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Preuves</p>
            <div className="grid grid-cols-2 gap-2">
              {insight.evidence.map((e) => (
                <div key={e.label} className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <p className="text-[11px] uppercase tracking-wider text-ink-soft">{e.label}</p>
                  <p className="mt-1 font-display text-[15px] font-semibold text-ink">{e.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Causes principales
            </p>
            <ul className="space-y-2">
              {insight.causes.map((c) => (
                <li key={c} className="flex items-start gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-[13px] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Actions proposées
            </p>
            <ul className="space-y-2">
              {insight.actions.map((a) => (
                <li key={a.label} className="flex items-start justify-between gap-3 rounded-xl border border-white/60 bg-gradient-to-br from-white to-[#faf6ef] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div>
                    <p className="text-[13px] font-medium text-ink">{a.label}</p>
                    <p className="mt-0.5 text-[11px] text-emerald-700">{a.impact}</p>
                  </div>
                  <button className="chip-ghost shrink-0"><ChevronRight className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="mt-auto border-t border-line/60 bg-white/70 p-4">
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="chip-ghost">Fermer</button>
            <button className="btn-primary"><Sparkles className="h-4 w-4" /> Demander à Orkestria</button>
          </div>
        </footer>
      </aside>
    </div>
  );
}