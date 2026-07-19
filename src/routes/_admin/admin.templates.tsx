import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  getTemplates, patchTemplate, templateCategoryLabel, templateStatusLabel, logAudit,
  fmtNum, fmtRelative, type CreativeTemplate, type TemplateStatus, type TemplateCategory,
} from "@/lib/admin-store";
import { Search, Plus, Copy, Archive, Send, ShieldCheck, Edit3, Filter, LayoutTemplate } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/templates")({
  head: () => ({ meta: [{ title: "Templates créatifs — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: TemplatesPage,
});

const CATS: TemplateCategory[] = ["restauration", "immobilier", "éducation", "beauté", "e-commerce", "automobile", "événementiel", "santé", "services_pro"];
const STATUSES: TemplateStatus[] = ["brouillon", "en_revue", "publié", "archivé"];

function TemplatesPage() {
  const [tick, setTick] = useState(0);
  const templates = useMemo(() => getTemplates(), [tick]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<CreativeTemplate | null>(null);

  const rows = templates.filter((t) => {
    if (cat !== "all" && t.category !== cat) return false;
    if (status !== "all" && t.status !== status) return false;
    if (q && !t.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const act = (t: CreativeTemplate, patch: Partial<CreativeTemplate>, label: string) => {
    patchTemplate(t.id, patch);
    logAudit({ actor: "super_admin", action: `Template : ${label}`, target: t.id });
    setTick((x) => x + 1);
    if (selected?.id === t.id) setSelected({ ...t, ...patch });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Templates créatifs</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold">Modèles d'affiches et vidéos</h1>
          <p className="mt-1 text-[13px] text-white/60">{templates.length} modèles gérés — publication, validation, quotas par plan.</p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] px-3 py-1.5 text-[12.5px] font-medium text-white"><Plus className="h-3.5 w-3.5" /> Créer un template</button>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-2 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-white/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom de template…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/40" />
          </div>
          <Sel value={cat} onChange={setCat} options={[["all", "Toutes catégories"], ...CATS.map((c) => [c, templateCategoryLabel(c)] as [string, string])]} />
          <Sel value={status} onChange={setStatus} options={[["all", "Tous statuts"], ...STATUSES.map((s) => [s, templateStatusLabel(s)] as [string, string])]} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((t) => (
          <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06]"><LayoutTemplate className="h-4 w-4 text-white/70" /></span>
                  <h3 className="font-display text-[15px] font-semibold">{t.name}</h3>
                </div>
                <p className="mt-1 text-[12px] text-white/50">{templateCategoryLabel(t.category)} · {t.language.toUpperCase()} · {t.region}</p>
              </div>
              <StatusChip s={t.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {t.formats.map((f) => <Chip key={f}>{f}</Chip>)}
              {t.brandReview && <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">Marque à valider</span>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
              <Stat label="Utilisations">{fmtNum(t.uses)}</Stat>
              <Stat label="Approbation">{(t.approvalRate * 100).toFixed(0)} %</Stat>
              <Stat label="ROAS moy.">{t.roasAvg.toFixed(2)}</Stat>
            </div>
            <p className="mt-2 text-[11px] text-white/40">Variables : {t.variables.join(", ")}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <MiniBtn onClick={() => setSelected(t)} icon={Edit3}>Détails</MiniBtn>
              <MiniBtn onClick={() => act(t, { id: t.id, uses: 0 }, "Duplication")} icon={Copy}>Dupliquer</MiniBtn>
              {t.status !== "publié" && <MiniBtn onClick={() => act(t, { status: "publié" }, "Publication")} icon={Send} primary>Publier</MiniBtn>}
              {t.status !== "en_revue" && <MiniBtn onClick={() => act(t, { status: "en_revue", brandReview: true }, "Soumission validation marque")} icon={ShieldCheck}>Soumettre marque</MiniBtn>}
              {t.status !== "archivé" && <MiniBtn onClick={() => act(t, { status: "archivé" }, "Archivage")} icon={Archive} danger>Archiver</MiniBtn>}
            </div>
            <p className="mt-2 text-[10.5px] text-white/40">Mis à jour {fmtRelative(t.updatedAt)}</p>
          </div>
        ))}
        {rows.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-white/50 md:col-span-2 xl:col-span-3">Aucun template.</p>}
      </div>

      {selected && <Drawer t={selected} onClose={() => setSelected(null)} onAct={act} />}
    </div>
  );
}

function Drawer({ t, onClose, onAct }: { t: CreativeTemplate; onClose: () => void; onAct: (t: CreativeTemplate, patch: Partial<CreativeTemplate>, label: string) => void }) {
  const [name, setName] = useState(t.name);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-[#141418] p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] uppercase tracking-widest text-[#ff8a3d]">Fiche template</p>
        <h2 className="mt-1 font-display text-[20px] font-semibold">{t.name}</h2>
        <p className="text-[12px] text-white/50">{templateCategoryLabel(t.category)} · {t.region}</p>

        <div className="mt-5 space-y-3">
          <Field label="Nom">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] outline-none" />
          </Field>
          <Field label="Formats disponibles"><p>{t.formats.join(", ")}</p></Field>
          <Field label="Langue"><p>{t.language.toUpperCase()}</p></Field>
          <Field label="Éléments obligatoires"><p>{t.requiredElements.join(", ")}</p></Field>
          <Field label="Variables"><p className="text-white/80">{t.variables.join(", ")}</p></Field>
          <Field label="Plans autorisés"><p>{t.plans === "tous" ? "Tous les plans" : t.plans.join(", ")}</p></Field>
          <Field label="Performances"><p>CTR moyen {t.ctrAvg.toFixed(2)} % · ROAS {t.roasAvg.toFixed(2)} · Approbation {(t.approvalRate * 100).toFixed(0)} %</p></Field>
          <Field label="Utilisations"><p>{fmtNum(t.uses)}</p></Field>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <MiniBtn onClick={() => onAct(t, { name }, "Renommage")} icon={Edit3} primary>Enregistrer</MiniBtn>
          <MiniBtn onClick={() => onAct(t, { plans: ["growth", "autopilot", "agency_growth", "agency_scale", "enterprise"] }, "Restriction aux plans premium")} icon={ShieldCheck}>Limiter aux plans premium</MiniBtn>
          <MiniBtn onClick={onClose} icon={Archive}>Fermer</MiniBtn>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[11px] uppercase tracking-wider text-white/40">{label}</p><div className="mt-1 text-[13px] text-white/85">{children}</div></div>;
}
function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2"><p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p><p className="mt-0.5 text-white/90">{children}</p></div>;
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/70">{children}</span>;
}
function StatusChip({ s }: { s: TemplateStatus }) {
  const map: Record<TemplateStatus, string> = {
    brouillon: "border-white/15 bg-white/[0.06] text-white/70",
    en_revue: "border-amber-500/25 bg-amber-500/15 text-amber-300",
    "publié": "border-emerald-500/25 bg-emerald-500/15 text-emerald-300",
    "archivé": "border-rose-500/25 bg-rose-500/15 text-rose-300",
  };
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${map[s]}`}>{templateStatusLabel(s)}</span>;
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none rounded-full border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-[12.5px] text-white/80 outline-none hover:bg-white/[0.06]">
        {options.map(([v, l]) => <option key={v} value={v} className="bg-[#111114]">{l}</option>)}
      </select>
      <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
    </div>
  );
}
function MiniBtn({ children, onClick, icon: Icon, danger, primary }: { children: React.ReactNode; onClick: () => void; icon: React.ComponentType<{ className?: string }>; danger?: boolean; primary?: boolean }) {
  const c = primary
    ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white"
    : danger
    ? "border border-rose-500/25 bg-rose-500/[0.06] text-rose-200 hover:bg-rose-500/[0.12]"
    : "border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]";
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] ${c}`}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

import type React from "react";