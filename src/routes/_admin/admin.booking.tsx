import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarClock, Save, Trash2, Plus, User, Mail, Building2, Clock } from "lucide-react";
import { getConfig, saveConfig, listBookings, cancelBooking, DEFAULT_CONFIG, type AvailabilityConfig, type Weekday, type Booking } from "@/lib/booking-store";

export const Route = createFileRoute("/_admin/admin/booking")({
  head: () => ({ meta: [{ title: "Rendez-vous — Orkestria Admin" }, { name: "robots", content: "noindex" }] }),
  component: BookingAdmin,
});

const DAYS: { v: Weekday; label: string }[] = [
  { v: 1, label: "Lundi" }, { v: 2, label: "Mardi" }, { v: 3, label: "Mercredi" },
  { v: 4, label: "Jeudi" }, { v: 5, label: "Vendredi" }, { v: 6, label: "Samedi" }, { v: 0, label: "Dimanche" },
];

function BookingAdmin() {
  const [cfg, setCfg] = useState<AvailabilityConfig>(() => getConfig());
  const [bookings, setBookings] = useState<Booking[]>(() => listBookings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    function refresh() { setBookings(listBookings()); }
    window.addEventListener("booking:list", refresh);
    return () => window.removeEventListener("booking:list", refresh);
  }, []);

  function update<K extends keyof AvailabilityConfig>(key: K, val: AvailabilityConfig[K]) {
    setCfg({ ...cfg, [key]: val });
    setSaved(false);
  }
  function toggleDay(d: Weekday) {
    const wd = cfg.workingDays.includes(d) ? cfg.workingDays.filter(x => x !== d) : [...cfg.workingDays, d];
    update("workingDays", wd.sort() as Weekday[]);
  }
  function addBreak() { update("breaks", [...cfg.breaks, { start: "12:30", end: "13:30" }]); }
  function removeBreak(i: number) { update("breaks", cfg.breaks.filter((_, idx) => idx !== i)); }
  function updateBreak(i: number, field: "start" | "end", v: string) {
    update("breaks", cfg.breaks.map((b, idx) => idx === i ? { ...b, [field]: v } : b));
  }
  function onSave() { saveConfig(cfg); setSaved(true); setTimeout(() => setSaved(false), 1800); }
  function onReset() { setCfg(DEFAULT_CONFIG); saveConfig(DEFAULT_CONFIG); }

  const upcoming = bookings.filter(b => b.status === "confirmed" && new Date(b.startISO).getTime() > Date.now())
    .sort((a, b) => a.startISO.localeCompare(b.startISO));
  const past = bookings.filter(b => b.status !== "confirmed" || new Date(b.startISO).getTime() <= Date.now())
    .sort((a, b) => b.startISO.localeCompare(a.startISO)).slice(0, 20);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#ff6c02]/10 text-[#ff6c02]"><CalendarClock className="h-5 w-5" /></div>
        <div>
          <h1 className="font-sora text-2xl font-semibold">Rendez-vous & disponibilités</h1>
          <p className="text-[14px] text-ink/60">Configurez vos créneaux — le module de réservation les affiche automatiquement sur la page contact.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Config */}
        <div className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_40px_-30px_rgba(0,0,0,0.15)]">
          <h2 className="font-sora text-[16px] font-semibold">Paramètres généraux</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <NumField label="Durée de session (min)" value={cfg.durationMin} onChange={(v) => update("durationMin", v)} min={15} max={180} step={15} />
            <NumField label="Buffer entre sessions (min)" value={cfg.bufferMin} onChange={(v) => update("bufferMin", v)} min={0} max={60} step={5} />
            <NumField label="Délai minimum de préavis (h)" value={cfg.leadTimeHours} onChange={(v) => update("leadTimeHours", v)} min={0} max={72} step={1} />
            <NumField label="Fenêtre de réservation (jours)" value={cfg.windowDays} onChange={(v) => update("windowDays", v)} min={1} max={90} step={1} />
            <TextField label="Heure de début" value={cfg.dailyStart} onChange={(v) => update("dailyStart", v)} type="time" />
            <TextField label="Heure de fin" value={cfg.dailyEnd} onChange={(v) => update("dailyEnd", v)} type="time" />
            <TextField label="Fuseau horaire" value={cfg.timezone} onChange={(v) => update("timezone", v)} placeholder="Africa/Abidjan" />
          </div>

          <h3 className="mt-8 text-[13px] font-semibold uppercase tracking-wider text-ink/60">Jours travaillés</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {DAYS.map(d => {
              const on = cfg.workingDays.includes(d.v);
              return (
                <button key={d.v} onClick={() => toggleDay(d.v)} className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${on ? "border-[#ff6c02] bg-[#ff6c02] text-white" : "border-black/10 bg-white text-ink/70 hover:bg-black/[0.03]"}`}>
                  {d.label}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink/60">Pauses quotidiennes</h3>
            <button onClick={addBreak} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#ff6c02] hover:underline"><Plus className="h-3.5 w-3.5" /> Ajouter une pause</button>
          </div>
          <div className="mt-3 space-y-2">
            {cfg.breaks.length === 0 && <p className="text-[13px] text-ink/50">Aucune pause configurée.</p>}
            {cfg.breaks.map((b, i) => (
              <div key={i} className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#faf7f2]/50 p-3">
                <input type="time" value={b.start} onChange={(e) => updateBreak(i, "start", e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[14px]" />
                <span className="text-ink/50">→</span>
                <input type="time" value={b.end} onChange={(e) => updateBreak(i, "end", e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[14px]" />
                <button onClick={() => removeBreak(i)} className="ml-auto rounded-full p-1.5 text-ink/50 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button onClick={onReset} className="text-[13px] text-ink/60 hover:text-ink hover:underline">Réinitialiser</button>
            <button onClick={onSave} className="inline-flex items-center gap-2 rounded-full bg-[#ff6c02] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_20px_-10px_rgba(255,108,2,0.6)] hover:brightness-110">
              {saved ? "Enregistré ✓" : (<><Save className="h-4 w-4" /> Enregistrer</>)}
            </button>
          </div>
        </div>

        {/* Bookings */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-black/[0.06] bg-white p-6">
            <h2 className="font-sora text-[16px] font-semibold">À venir <span className="ml-2 rounded-full bg-[#ff6c02]/10 px-2 py-0.5 text-[12px] text-[#ff6c02]">{upcoming.length}</span></h2>
            <div className="mt-4 space-y-2">
              {upcoming.length === 0 && <p className="text-[13px] text-ink/50">Aucun rendez-vous prévu.</p>}
              {upcoming.map(b => <BookingRow key={b.id} b={b} onCancel={() => cancelBooking(b.id)} />)}
            </div>
          </div>
          <div className="rounded-3xl border border-black/[0.06] bg-white p-6">
            <h2 className="font-sora text-[16px] font-semibold">Historique</h2>
            <div className="mt-4 space-y-2">
              {past.length === 0 && <p className="text-[13px] text-ink/50">Aucun historique.</p>}
              {past.map(b => <BookingRow key={b.id} b={b} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div>
      <label className="text-[13px] font-medium text-ink/80">{label}</label>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-[#ff6c02]" />
    </div>
  );
}
function TextField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-[13px] font-medium text-ink/80">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-[#ff6c02]" />
    </div>
  );
}
function BookingRow({ b, onCancel }: { b: Booking; onCancel?: () => void }) {
  const d = new Date(b.startISO);
  const cancelled = b.status === "cancelled";
  return (
    <div className={`rounded-2xl border border-black/[0.06] p-3 text-[13px] ${cancelled ? "opacity-50 line-through" : "bg-[#faf7f2]/40"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-ink"><Clock className="h-3.5 w-3.5 text-[#ff6c02]" /> {d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
        {onCancel && !cancelled && <button onClick={onCancel} className="rounded-full p-1 text-ink/50 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-ink/70">
        <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {b.name}</span>
        <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {b.email}</span>
        {b.company && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {b.company}</span>}
      </div>
      <div className="mt-1 text-[12px] text-ink/50">{b.topic}</div>
    </div>
  );
}
