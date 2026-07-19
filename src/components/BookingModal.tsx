import { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight, Check, Clock, Calendar as CalIcon, User, Mail, Building2 } from "lucide-react";
import {
  getConfig, listBookings, saveBooking, availableDates, daySlots,
  type Booking,
} from "@/lib/booking-store";

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTH_LABELS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

type Props = { open: boolean; onClose: () => void };

export function BookingModal({ open, onClose }: Props) {
  const [step, setStep] = useState<"pick" | "form" | "done">("pick");
  const [cfg, setCfg] = useState(() => getConfig());
  const [bookings, setBookings] = useState<Booking[]>(() => listBookings());
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState("Démo produit (30 min)");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState<Booking | null>(null);

  useEffect(() => {
    if (!open) return;
    setCfg(getConfig());
    setBookings(listBookings());
    setStep("pick"); setSelectedDay(null); setSelectedSlot(null); setConfirmed(null);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const validDates = useMemo(() => availableDates(cfg, bookings), [cfg, bookings]);
  const slots = useMemo(() => selectedDay ? daySlots(selectedDay, cfg, bookings) : [], [selectedDay, cfg, bookings]);

  // Calendar grid
  const grid = useMemo(() => {
    const first = new Date(cursor);
    first.setDate(1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const cells: (Date | null)[] = Array.from({ length: startOffset }, () => null);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  function submit() {
    if (!selectedSlot || !name || !email) return;
    const end = new Date(selectedSlot.getTime() + cfg.durationMin * 60_000);
    const b: Booking = {
      id: `bk_${Date.now().toString(36)}`,
      name, email, company: company || undefined, topic, message: message || undefined,
      startISO: selectedSlot.toISOString(), endISO: end.toISOString(),
      createdAt: new Date().toISOString(), status: "confirmed",
    };
    saveBooking(b);
    setConfirmed(b);
    setStep("done");
  }

  if (!open) return null;
  const today = new Date();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff6c02]/10 text-[#ff6c02]"><CalIcon className="h-5 w-5" /></div>
            <div>
              <div className="font-sora text-[15px] font-semibold">Réserver une démo Orkestria</div>
              <div className="text-[12px] text-ink/60 flex items-center gap-1.5"><Clock className="h-3 w-3" /> {cfg.durationMin} min · en visio</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-black/[0.05]" aria-label="Fermer"><X className="h-4 w-4" /></button>
        </div>

        {/* Body */}
        {step === "pick" && (
          <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
            {/* Calendar */}
            <div className="border-b border-black/[0.06] p-6 md:border-b-0 md:border-r">
              <div className="flex items-center justify-between">
                <div className="font-sora text-[15px] font-semibold capitalize">{MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}</div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-full p-1.5 hover:bg-black/[0.05]"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-full p-1.5 hover:bg-black/[0.05]"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-ink/50">
                {WEEK_LABELS.map((l, i) => <div key={i}>{l}</div>)}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {grid.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const enabled = validDates.some(x => sameDay(x, d));
                  const isToday = sameDay(d, today);
                  const isSelected = selectedDay && sameDay(d, selectedDay);
                  return (
                    <button
                      key={i}
                      disabled={!enabled}
                      onClick={() => { setSelectedDay(d); setSelectedSlot(null); }}
                      className={[
                        "aspect-square rounded-xl text-[13px] font-medium transition",
                        !enabled ? "text-ink/25" : "hover:bg-[#ff6c02]/10",
                        isSelected ? "bg-[#ff6c02] text-white hover:bg-[#ff6c02]" : "",
                        !isSelected && enabled ? "text-ink" : "",
                        isToday && !isSelected ? "ring-1 ring-[#ff6c02]/40" : "",
                      ].join(" ")}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-[12px] text-ink/50">Fuseau : {cfg.timezone}. Créneaux disponibles jusqu'à {cfg.windowDays} jours.</p>
            </div>

            {/* Slots */}
            <div className="p-6">
              {!selectedDay ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-ink/60">
                  <CalIcon className="h-8 w-8 text-ink/30" />
                  <p className="mt-3 text-[14px]">Choisissez un jour disponible pour voir les créneaux.</p>
                </div>
              ) : (
                <>
                  <div className="text-[13px] font-semibold text-ink/70 capitalize">{fmtDate(selectedDay)}</div>
                  <div className="mt-3 grid max-h-[320px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                    {slots.length === 0 && <p className="col-span-2 text-[13px] text-ink/50">Aucun créneau disponible ce jour.</p>}
                    {slots.map((s, i) => {
                      const sel = selectedSlot && sameDay(s, selectedSlot) && s.getHours() === selectedSlot.getHours() && s.getMinutes() === selectedSlot.getMinutes();
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedSlot(s)}
                          className={[
                            "rounded-xl border px-3 py-2.5 text-[14px] font-medium transition",
                            sel ? "border-[#ff6c02] bg-[#ff6c02] text-white" : "border-black/10 bg-white text-ink hover:border-[#ff6c02]/40 hover:bg-[#ff6c02]/5",
                          ].join(" ")}
                        >
                          {fmtTime(s)}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    disabled={!selectedSlot}
                    onClick={() => setStep("form")}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ff6c02] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_20px_-10px_rgba(255,108,2,0.6)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continuer <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {step === "form" && selectedSlot && (
          <div className="p-6 md:p-8">
            <button onClick={() => setStep("pick")} className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-ink/60 hover:text-ink"><ChevronLeft className="h-4 w-4" /> Changer de créneau</button>
            <div className="rounded-2xl border border-black/[0.06] bg-[#faf7f2] p-4 text-[13px]">
              <div className="flex items-center gap-2 text-ink/70"><CalIcon className="h-4 w-4 text-[#ff6c02]" /> <span className="capitalize">{fmtDate(selectedSlot)}</span> · {fmtTime(selectedSlot)} → {fmtTime(new Date(selectedSlot.getTime() + cfg.durationMin*60_000))}</div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <FormField icon={<User className="h-4 w-4" />} label="Votre nom *" value={name} onChange={setName} placeholder="Marie Dupont" />
              <FormField icon={<Mail className="h-4 w-4" />} label="E-mail pro *" value={email} onChange={setEmail} type="email" placeholder="marie@entreprise.com" />
              <FormField icon={<Building2 className="h-4 w-4" />} label="Entreprise" value={company} onChange={setCompany} placeholder="Studio Velvet" />
              <div>
                <label className="text-[13px] font-medium text-ink/80">Sujet</label>
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-[#ff6c02]">
                  <option>Démo produit (30 min)</option>
                  <option>Plan Agence</option>
                  <option>Onboarding entreprise</option>
                  <option>Cas d'usage spécifique</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-[13px] font-medium text-ink/80">Contexte (optionnel)</label>
              <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Objectifs, canaux publicitaires actuels, questions à préparer..." className="mt-2 w-full rounded-2xl border border-black/10 bg-[#faf7f2]/50 px-4 py-3 text-[14px] outline-none placeholder:text-ink/40 focus:border-[#ff6c02] focus:bg-white" />
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={onClose} className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Annuler</button>
              <button disabled={!name || !email} onClick={submit} className="inline-flex items-center gap-2 rounded-full bg-[#ff6c02] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_20px_-10px_rgba(255,108,2,0.6)] hover:brightness-110 disabled:opacity-40">Confirmer le rendez-vous</button>
            </div>
          </div>
        )}

        {step === "done" && confirmed && (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[#ff6c02]/10 text-[#ff6c02]"><Check className="h-7 w-7" /></div>
            <h3 className="mt-5 font-sora text-2xl font-semibold">Rendez-vous confirmé</h3>
            <p className="mt-2 max-w-md text-[15px] text-ink/70">Merci {confirmed.name.split(" ")[0]}. Un e-mail de confirmation part vers <b>{confirmed.email}</b> avec le lien visio.</p>
            <div className="mt-5 rounded-2xl border border-black/[0.06] bg-[#faf7f2] px-5 py-3 text-[14px] text-ink/80">
              <span className="capitalize">{fmtDate(new Date(confirmed.startISO))}</span> · {fmtTime(new Date(confirmed.startISO))} → {fmtTime(new Date(confirmed.endISO))}
            </div>
            <button onClick={onClose} className="mt-6 rounded-full bg-[#ff6c02] px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110">Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ icon, label, value, onChange, placeholder, type = "text" }: { icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[13px] font-medium text-ink/80">{icon} {label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-black/10 bg-[#faf7f2]/50 px-4 py-3 text-[15px] outline-none placeholder:text-ink/40 focus:border-[#ff6c02] focus:bg-white" />
    </div>
  );
}
