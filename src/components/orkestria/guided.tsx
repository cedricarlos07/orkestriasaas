import { useEffect, useRef, useState } from "react";
import {
  X,
  ChevronRight,
  ArrowLeft,
  Check,
  Target,
  FileText,
} from "lucide-react";
import { INTENT_META } from "@/components/orkestria/suggestions";
import type { FormState, IntentKey } from "@/components/orkestria/types";

export function GuidedLauncher({ onPick }: { onPick: (i: IntentKey) => void }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Formulaire guidé</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.keys(INTENT_META) as IntentKey[]).map((k) => {
          const meta = INTENT_META[k];
          const Icon = meta.icon;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(k)}
              className="card-hover group flex items-center gap-2 rounded-xl border border-line/70 bg-white px-3 py-2 text-left text-[13px] text-ink hover:border-[#ffb066] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40"
              aria-label={`Ouvrir le formulaire ${meta.label}`}
            >
              <span aria-hidden className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${meta.grad} text-white shadow-[0_6px_14px_-6px_rgba(0,0,0,0.3)]`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GuidedForm({
  value,
  intent,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: FormState;
  intent: IntentKey;
  onChange: (v: FormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const meta = INTENT_META[intent];
  const Icon = meta.icon;
  const [step, setStep] = useState<"edit" | "preview">("edit");

  // Focus trap-lite: focus first control on mount, ESC closes
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guided-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 anim-fade-up"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_60px_-24px_rgba(0,0,0,0.35)]"
      >
        <div className={`flex items-center gap-3 bg-gradient-to-br ${meta.grad} p-4 text-white`}>
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
              {step === "edit" ? "Étape 1 · Formulaire guidé" : "Étape 2 · Prévisualisation"}
            </p>
            <h2 id="guided-title" className="font-display text-[18px] font-semibold">{meta.label}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer le formulaire"
            className="ml-auto rounded-md p-1.5 text-white/85 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {step === "edit" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep("preview");
          }}
          className="space-y-4 p-5"
        >
          <fieldset>
            <legend className="mb-2 text-[12px] font-semibold text-ink">Type de demande</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(INTENT_META) as IntentKey[]).map((k, i) => {
                const active = value.intent === k;
                const m = INTENT_META[k];
                const KIcon = m.icon;
                return (
                  <button
                    key={k}
                    ref={i === 0 ? firstRef : undefined}
                    type="button"
                    onClick={() => onChange({ ...value, intent: k, scope: m.scopes[1] ?? m.scopes[0] })}
                    aria-pressed={active}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left text-[12px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40 ${
                      active
                        ? "border-[#ffb066] bg-gradient-to-br from-[#fff5ea] to-[#ffe4c9] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                        : "border-line bg-white text-ink-soft hover:border-[#ffb066] hover:text-ink"
                    }`}
                  >
                    <span aria-hidden className={`flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br ${m.grad} text-white`}>
                      <KIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-medium leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="scope" className="mb-1.5 block text-[12px] font-semibold text-ink">
              Portée
            </label>
            <select
              id="scope"
              value={value.scope}
              onChange={(e) => onChange({ ...value, scope: e.target.value })}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/25"
            >
              {meta.scopes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="detail" className="mb-1.5 block text-[12px] font-semibold text-ink">
              Précisions <span className="font-normal text-ink-soft">(optionnel)</span>
            </label>
            <textarea
              id="detail"
              value={value.detail}
              onChange={(e) => onChange({ ...value, detail: e.target.value })}
              rows={3}
              placeholder={meta.detailPh}
              className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink-soft focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/25"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className="chip-ghost !py-1.5 !text-[12px]">
              Annuler
            </button>
            <button type="submit" className="btn-primary btn-halo !px-4 !py-2 !text-[13px]">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden /> Prévisualiser
            </button>
          </div>
        </form>
        ) : (
          <div className="space-y-4 p-5">
            <p className="text-[12px] text-ink-soft">
              Vérifiez le récapitulatif avant de lancer la demande à Orkestria.
            </p>
            <dl className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line/70 bg-white">
              <div className="flex items-start gap-3 p-3">
                <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${meta.grad} text-white`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Type</dt>
                  <dd className="text-[14px] font-medium text-ink">{meta.label}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3">
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff5ea] text-[#c94a00] ring-1 ring-[#ffd7ac]">
                  <Target className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Portée</dt>
                  <dd className="text-[14px] font-medium text-ink">{value.scope}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3">
                <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f0ff] text-[#4a2a9e] ring-1 ring-[#dccdff]">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Précisions</dt>
                  <dd className="whitespace-pre-wrap text-[14px] text-ink">
                    {value.detail.trim() || <span className="italic text-ink-soft">Aucune — Orkestria utilisera les réglages par défaut.</span>}
                  </dd>
                </div>
              </div>
            </dl>
            <div className="rounded-xl border border-[#ffe0c2] bg-[#fff9f1] p-3 text-[12px] text-[#7a4a10]">
              Une fois validée, cette demande sera envoyée dans la conversation et Orkestria commencera l'exécution.
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep("edit")}
                className="chip-ghost !py-1.5 !text-[12px]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Modifier
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onCancel} className="chip-ghost !py-1.5 !text-[12px]">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  className="btn-primary btn-halo !px-4 !py-2 !text-[13px]"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden /> Confirmer et lancer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
