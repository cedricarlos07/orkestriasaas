import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, X } from "lucide-react";

const KEY = "orkestria.cookies.consent.v1";

type Consent = { essential: true; analytics: boolean; marketing: boolean; at: string };

function read(): Consent | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.localStorage.getItem(KEY) || "null"); } catch { return null; }
}
function write(c: Consent) {
  try { window.localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("orkestria:cookies", { detail: c }));
}

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = read();
    if (!existing) setOpen(true);
    const onReopen = () => { setDetails(true); setOpen(true); };
    window.addEventListener("orkestria:cookies:open", onReopen);
    return () => window.removeEventListener("orkestria:cookies:open", onReopen);
  }, []);

  if (!open) return null;

  const save = (a: boolean, m: boolean) => {
    write({ essential: true, analytics: a, marketing: m, at: new Date().toISOString() });
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Préférences cookies"
      className="fixed inset-x-3 bottom-3 z-[9999] md:inset-x-auto md:right-6 md:bottom-6 md:max-w-[440px]"
    >
      <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/95 p-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_24px_60px_-20px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#ff6c02]/15 blur-3xl" />
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ff6c02]/10 text-[#ff6c02]">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-sora text-[15px] font-semibold text-ink">Un petit mot sur les cookies</p>
              <button
                onClick={() => save(false, false)}
                aria-label="Refuser et fermer"
                className="rounded-full p-1 text-ink/50 hover:bg-black/[0.04] hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/70">
              On utilise des cookies essentiels pour faire tourner Orkestria, et — avec votre accord — des cookies de mesure d'audience pour améliorer le produit.
              <Link to="/privacy" className="ml-1 text-[#ff6c02] underline underline-offset-2 hover:opacity-80">En savoir plus</Link>
            </p>

            {details && (
              <div className="mt-4 space-y-2 rounded-xl border border-black/[0.06] bg-[#faf7f2] p-3">
                <Row label="Essentiels" desc="Session, sécurité. Toujours actifs." checked disabled />
                <Row label="Mesure d'audience" desc="Nous aide à comprendre l'usage." checked={analytics} onChange={setAnalytics} />
                <Row label="Marketing" desc="Personnalisation des communications." checked={marketing} onChange={setMarketing} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => save(true, true)}
                className="inline-flex items-center rounded-full bg-[#ff6c02] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_20px_-10px_rgba(255,108,2,0.7)] hover:brightness-110"
              >
                Tout accepter
              </button>
              <button
                onClick={() => save(false, false)}
                className="inline-flex items-center rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03]"
              >
                Refuser
              </button>
              {details ? (
                <button
                  onClick={() => save(analytics, marketing)}
                  className="ml-auto inline-flex items-center rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03]"
                >
                  Enregistrer mes choix
                </button>
              ) : (
                <button
                  onClick={() => setDetails(true)}
                  className="ml-auto text-[13px] font-medium text-ink/70 underline underline-offset-2 hover:text-ink"
                >
                  Personnaliser
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, desc, checked, disabled, onChange }: { label: string; desc: string; checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 ${disabled ? "opacity-70" : ""}`}>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        <div className="text-[12px] text-ink/60">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`relative mt-1 h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-[#ff6c02]" : "bg-black/15"} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export function openCookieSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("orkestria:cookies:open"));
}