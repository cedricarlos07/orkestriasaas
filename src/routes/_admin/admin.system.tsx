import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getSystemSettings, saveSystemSettings, logAudit, type SystemSettings } from "@/lib/admin-store";
import { Save, Settings2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/system")({
  head: () => ({ meta: [{ title: "Paramètres système — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: SystemPage,
});

function SystemPage() {
  const [s, setS] = useState<SystemSettings>(() => getSystemSettings());
  const save = () => { saveSystemSettings(s); logAudit({ actor: "root_super_admin", action: "Paramètres système enregistrés", target: "system" }); };
  const upd = <K extends keyof SystemSettings>(k: K, v: SystemSettings[K]) => setS({ ...s, [k]: v });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Paramètres système</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold">Configuration & maintenance</h1>
        </div>
        <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] px-3 py-1.5 text-[12.5px] font-medium text-white"><Save className="h-3.5 w-3.5" /> Enregistrer</button>
      </header>

      <Section title="Configuration générale" icon={Settings2}>
        <Grid>
          <Txt label="Nom de la plateforme" v={s.platformName} onChange={(v) => upd("platformName", v)} />
          <Txt label="Domaines (séparés par virgule)" v={s.domains.join(", ")} onChange={(v) => upd("domains", v.split(",").map((x) => x.trim()))} />
          <Txt label="E-mail support" v={s.supportEmail} onChange={(v) => upd("supportEmail", v)} />
          <Txt label="Fuseau horaire" v={s.timezone} onChange={(v) => upd("timezone", v)} />
          <Txt label="Devises" v={s.currencies.join(", ")} onChange={(v) => upd("currencies", v.split(",").map((x) => x.trim()))} />
          <Txt label="Langues" v={s.languages.join(", ")} onChange={(v) => upd("languages", v.split(",").map((x) => x.trim()))} />
          <Txt label="URL Conditions" v={s.termsUrl} onChange={(v) => upd("termsUrl", v)} />
          <Txt label="URL Confidentialité" v={s.privacyUrl} onChange={(v) => upd("privacyUrl", v)} />
        </Grid>
      </Section>

      <Section title="Limites globales" icon={AlertTriangle}>
        <Grid>
          <Num label="Budget publicitaire max (USD/j)" v={s.maxDailyBudgetUsd} onChange={(v) => upd("maxDailyBudgetUsd", v)} />
          <Num label="Augmentation max (%)" v={s.maxIncreasePct} onChange={(v) => upd("maxIncreasePct", v)} />
          <Num label="Durée max d'un run (min)" v={s.maxRunDurationMin} onChange={(v) => upd("maxRunDurationMin", v)} />
          <Num label="Itérations max" v={s.maxIterations} onChange={(v) => upd("maxIterations", v)} />
          <Num label="Fichier max (Mo)" v={s.maxFileMB} onChange={(v) => upd("maxFileMB", v)} />
          <Num label="Vidéo max (s)" v={s.maxVideoSec} onChange={(v) => upd("maxVideoSec", v)} />
          <Num label="Comptes max par plan" v={s.maxAccountsPerPlan} onChange={(v) => upd("maxAccountsPerPlan", v)} />
        </Grid>
      </Section>

      <Section title="Maintenance" icon={AlertTriangle}>
        <div className="space-y-3">
          <Toggle label="Mode maintenance" v={s.maintenanceMode} onChange={(v) => upd("maintenanceMode", v)} />
          <Toggle label="Désactiver les inscriptions" v={s.signupsDisabled} onChange={(v) => upd("signupsDisabled", v)} />
          <Toggle label="Suspendre les actions d'écriture" v={s.writeActionsSuspended} onChange={(v) => upd("writeActionsSuspended", v)} danger />
          <Txt label="Bannière globale" v={s.banner} onChange={(v) => upd("banner", v)} />
          <Txt label="Pays bloqués (séparés par virgule)" v={s.blockedCountries.join(", ")} onChange={(v) => upd("blockedCountries", v.split(",").map((x) => x.trim()).filter(Boolean))} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>; }
function Txt({ label, v, onChange }: { label: string; v: string; onChange: (v: string) => void }) {
  return <label className="block"><span className="text-[11px] uppercase tracking-wider text-white/50">{label}</span><input value={v} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] outline-none" /></label>;
}
function Num({ label, v, onChange }: { label: string; v: number; onChange: (v: number) => void }) {
  return <label className="block"><span className="text-[11px] uppercase tracking-wider text-white/50">{label}</span><input type="number" value={v} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] outline-none" /></label>;
}
function Toggle({ label, v, onChange, danger }: { label: string; v: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <label className={`flex items-center justify-between rounded-xl border p-3 ${v && danger ? "border-rose-500/25 bg-rose-500/[0.05]" : v ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
      <span className="text-[13px]">{label}</span>
      <input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)} className="h-4 w-8 appearance-none rounded-full bg-white/[0.1] checked:bg-[#ff6c02] transition relative before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-3 before:w-3 before:rounded-full before:bg-white before:transition checked:before:translate-x-4" />
    </label>
  );
}

import type React from "react";