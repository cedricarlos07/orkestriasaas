import { useEffect, useRef, useState } from "react";
import {
  X,
  ChevronRight,
  ArrowLeft,
  Check,
  ImagePlus,
} from "lucide-react";
import {
  BUDGET_CHIPS,
  BUSINESS_OPTIONS,
  COUNTRY_OPTIONS,
  emptyCampaignWizard,
  OBJECTIVE_OPTIONS,
  RADIUS_CHIPS,
} from "@/components/orkestria/suggestions";
import type { CampaignWizardState } from "@/components/orkestria/types";

/** Multi-step campaign brief wizard (numbered list + creatives). */
export function CampaignWizardModal({
  onCancel,
  onSubmit,
  pickImages,
}: {
  onCancel: () => void;
  onSubmit: (w: CampaignWizardState) => void;
  pickImages: (
    files: FileList | null,
    opts?: { max?: number; appendTo?: "pending" | "none" },
  ) => Promise<{ preview: string; dataUrl: string; name: string }[]>;
}) {
  const [wizard, setWizard] = useState<CampaignWizardState>(emptyCampaignWizard);
  const [step, setStep] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const titles = [
    "Quel type d'offre veux-tu promouvoir ?",
    "Quel objectif Meta ?",
    "Zone, pays et budget / jour",
    "Joindre les créas (images)",
    "Récapitulatif",
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const geoOk =
    wizard.countries.length > 0 &&
    (wizard.geoScope === "country" || wizard.cityText.trim().length >= 2);

  const stepValid =
    step === 0
      ? Boolean(
          wizard.businessType &&
            (wizard.businessType !== "custom" || wizard.businessCustom.trim().length > 2),
        )
      : step === 1
        ? Boolean(wizard.objective)
        : step === 2
          ? geoOk &&
            typeof wizard.dailyBudget === "number" &&
            wizard.dailyBudget > 0
          : true;

  const goNext = () => {
    if (!stepValid) return;
    if (step < titles.length - 1) setStep((s) => s + 1);
    else onSubmit(wizard);
  };

  const toggleCountry = (code: string) => {
    setWizard((w) => ({
      ...w,
      countries: w.countries.includes(code)
        ? w.countries.filter((c) => c !== code)
        : [...w.countries, code],
    }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-wizard-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 anim-fade-up"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[min(90vh,640px)] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_60px_-24px_rgba(20,20,20,0.35)]"
      >
        <div className="flex items-start gap-3 border-b border-line/60 bg-gradient-to-br from-[#fff9f3] to-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#c94a00]">
              Campagne · étape {step + 1}/{titles.length}
            </p>
            <h2 id="campaign-wizard-title" className="mt-1 font-display text-[18px] font-semibold text-ink">
              {titles[step]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="rounded-md p-1.5 text-ink-soft hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {step === 0 && (
            <ol className="space-y-1">
              {BUSINESS_OPTIONS.map((opt, i) => {
                const active = wizard.businessType === opt.id;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => setWizard((w) => ({ ...w, businessType: opt.id }))}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition ${
                        active
                          ? "bg-[#fff5ea] text-ink ring-1 ring-[#ffb066]"
                          : "text-ink hover:bg-[#faf7f2]"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                          active
                            ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white"
                            : "bg-[#f0ebe3] text-ink-soft"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 font-medium">{opt.label}</span>
                      {active && <ChevronRight className="h-4 w-4 text-[#c94a00]" aria-hidden />}
                    </button>
                  </li>
                );
              })}
              {wizard.businessType === "custom" && (
                <textarea
                  value={wizard.businessCustom}
                  onChange={(e) => setWizard((w) => ({ ...w, businessCustom: e.target.value }))}
                  rows={3}
                  placeholder="Ex : restaurant livraison, Abidjan, menu à 8 $"
                  className="mt-2 w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink-soft focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/25"
                />
              )}
            </ol>
          )}

          {step === 1 && (
            <ol className="space-y-1">
              {OBJECTIVE_OPTIONS.map((opt, i) => {
                const active = wizard.objective === opt.id;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => setWizard((w) => ({ ...w, objective: opt.id }))}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition ${
                        active
                          ? "bg-[#fff5ea] text-ink ring-1 ring-[#ffb066]"
                          : "text-ink hover:bg-[#faf7f2]"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                          active
                            ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white"
                            : "bg-[#f0ebe3] text-ink-soft"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 font-medium">{opt.label}</span>
                      {active && <ChevronRight className="h-4 w-4 text-[#c94a00]" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          {step === 2 && (
            <div className="space-y-4 px-2">
              <div>
                <p className="mb-2 text-[12px] font-semibold text-ink">Pays</p>
                <div className="flex flex-wrap gap-2">
                  {COUNTRY_OPTIONS.map((c) => {
                    const on = wizard.countries.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggleCountry(c.code)}
                        aria-pressed={on}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                          on
                            ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white"
                            : "bg-[#f0ebe3] text-ink-soft hover:text-ink"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-semibold text-ink">Ciblage géographique</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setWizard((w) => ({
                        ...w,
                        geoScope: "city",
                        radiusKm: w.radiusKm ?? 15,
                      }))
                    }
                    aria-pressed={wizard.geoScope === "city"}
                    className={`rounded-xl border px-3 py-2.5 text-left text-[13px] transition ${
                      wizard.geoScope === "city"
                        ? "border-[#ffb066] bg-[#fff5ea] text-ink"
                        : "border-line/70 bg-white text-ink-soft hover:border-[#ffb066] hover:text-ink"
                    }`}
                  >
                    <span className="font-medium text-ink">Ville / quartier + rayon</span>
                    <span className="mt-0.5 block text-[11px] text-ink-soft">
                      Ex. Cocody, Abidjan · 15 km
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setWizard((w) => ({
                        ...w,
                        geoScope: "country",
                        cityText: "",
                        radiusKm: null,
                      }))
                    }
                    aria-pressed={wizard.geoScope === "country"}
                    className={`rounded-xl border px-3 py-2.5 text-left text-[13px] transition ${
                      wizard.geoScope === "country"
                        ? "border-[#ffb066] bg-[#fff5ea] text-ink"
                        : "border-line/70 bg-white text-ink-soft hover:border-[#ffb066] hover:text-ink"
                    }`}
                  >
                    <span className="font-medium text-ink">Tout le pays</span>
                    <span className="mt-0.5 block text-[11px] text-ink-soft">
                      Budget plus dilué — à éviter en local
                    </span>
                  </button>
                </div>

                {wizard.geoScope === "city" && (
                  <div className="mt-3 space-y-3">
                    <label className="block text-[12px] font-semibold text-ink">
                      Ville, quartier ou zone
                      <input
                        type="text"
                        value={wizard.cityText}
                        onChange={(e) => setWizard((w) => ({ ...w, cityText: e.target.value }))}
                        placeholder="Ex. : Cocody, Abidjan — ou Dakar Plateau"
                        className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] font-normal text-ink placeholder:text-ink-soft focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/25"
                      />
                    </label>
                    <div>
                      <p className="mb-2 text-[12px] font-semibold text-ink">Rayon</p>
                      <div className="flex flex-wrap gap-2">
                        {RADIUS_CHIPS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setWizard((w) => ({ ...w, radiusKm: r }))}
                            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                              wizard.radiusKm === r
                                ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white"
                                : "bg-[#f0ebe3] text-ink-soft hover:text-ink"
                            }`}
                          >
                            {r} km
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setWizard((w) => ({ ...w, radiusKm: 0 }))}
                          className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                            wizard.radiusKm === 0
                              ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white"
                              : "bg-[#f0ebe3] text-ink-soft hover:text-ink"
                          }`}
                        >
                          Ville entière
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-[12px] font-semibold text-ink">Budget journalier</p>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_CHIPS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setWizard((w) => ({ ...w, dailyBudget: b }))}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                        wizard.dailyBudget === b
                          ? "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white"
                          : "bg-[#f0ebe3] text-ink-soft hover:text-ink"
                      }`}
                    >
                      {b}/j
                    </button>
                  ))}
                </div>
                <label className="mt-3 block text-[12px] text-ink-soft">
                  Autre montant
                  <input
                    type="number"
                    min={1}
                    value={wizard.dailyBudget ?? ""}
                    onChange={(e) =>
                      setWizard((w) => ({
                        ...w,
                        dailyBudget: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/25"
                    placeholder="Ex : 20"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 px-2">
              <p className="text-[13px] text-ink-soft">
                Ajoutez 1 à 5 images pour l’annonce (optionnel). Vous pourrez aussi en joindre plus tard dans le chat.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  void pickImages(e.target.files, { max: 5, appendTo: "none" }).then((next) => {
                    if (next.length) {
                      setWizard((w) => ({
                        ...w,
                        images: [...w.images, ...next].slice(0, 5),
                      }));
                    }
                    e.target.value = "";
                  });
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#ffb066] bg-[#fff9f1] px-4 py-6 text-[13px] font-medium text-[#c94a00] hover:bg-[#fff5ea]"
              >
                <ImagePlus className="h-5 w-5" aria-hidden />
                Ajouter des images
              </button>
              {wizard.images.length > 0 && (
                <ul className="grid grid-cols-3 gap-2">
                  {wizard.images.map((img, idx) => (
                    <li key={`${img.name}-${idx}`} className="relative overflow-hidden rounded-lg ring-1 ring-line">
                      <img src={img.preview} alt="" className="aspect-square w-full object-cover" />
                      <button
                        type="button"
                        aria-label="Retirer l'image"
                        onClick={() =>
                          setWizard((w) => ({
                            ...w,
                            images: w.images.filter((_, i) => i !== idx),
                          }))
                        }
                        className="absolute right-1 top-1 rounded-md bg-black/60 p-0.5 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="block text-[12px] font-semibold text-ink">
                Texte / URL (optionnel)
                <textarea
                  value={wizard.detail}
                  onChange={(e) => setWizard((w) => ({ ...w, detail: e.target.value }))}
                  rows={3}
                  placeholder="Ex : URL du site, offre, message de l'annonce…"
                  className="mt-1.5 w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-[13px] font-normal text-ink placeholder:text-ink-soft focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/25"
                />
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 px-2">
              <dl className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line/70 text-[13px]">
                <div className="flex justify-between gap-3 p-3">
                  <dt className="text-ink-soft">Offre</dt>
                  <dd className="text-right font-medium text-ink">
                    {wizard.businessType === "custom"
                      ? wizard.businessCustom || "—"
                      : BUSINESS_OPTIONS.find((b) => b.id === wizard.businessType)?.label ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 p-3">
                  <dt className="text-ink-soft">Objectif</dt>
                  <dd className="text-right font-medium text-ink">
                    {OBJECTIVE_OPTIONS.find((o) => o.id === wizard.objective)?.label ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 p-3">
                  <dt className="text-ink-soft">Pays</dt>
                  <dd className="text-right font-medium text-ink">
                    {wizard.countries
                      .map((c) => COUNTRY_OPTIONS.find((x) => x.code === c)?.label ?? c)
                      .join(", ") || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 p-3">
                  <dt className="text-ink-soft">Zone</dt>
                  <dd className="text-right font-medium text-ink">
                    {wizard.geoScope === "country"
                      ? "Tout le pays"
                      : [
                          wizard.cityText.trim() || "—",
                          typeof wizard.radiusKm === "number"
                            ? wizard.radiusKm === 0
                              ? "ville entière"
                              : `${wizard.radiusKm} km`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 p-3">
                  <dt className="text-ink-soft">Budget</dt>
                  <dd className="text-right font-medium text-ink">
                    {wizard.dailyBudget ? `${wizard.dailyBudget}/j` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 p-3">
                  <dt className="text-ink-soft">Créas</dt>
                  <dd className="text-right font-medium text-ink">
                    {wizard.images.length
                      ? `${wizard.images.length} image(s)`
                      : "Aucune — à joindre ensuite"}
                  </dd>
                </div>
              </dl>
              {wizard.detail.trim() && (
                <p className="rounded-xl bg-[#faf7f2] p-3 text-[12px] text-ink-soft">{wizard.detail}</p>
              )}
              <p className="text-[12px] text-ink-soft">
                Orkestria enverra le brief dans le chat (création en pause après votre confirmation).
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line/60 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}
            className="chip-ghost !py-1.5 !text-[12px]"
          >
            {step === 0 ? (
              "Annuler"
            ) : (
              <>
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Retour
              </>
            )}
          </button>
          <button
            type="button"
            disabled={!stepValid}
            onClick={goNext}
            className={`btn-primary btn-halo !px-4 !py-2 !text-[13px] ${!stepValid ? "pointer-events-none opacity-40" : ""}`}
          >
            {step === titles.length - 1 ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden /> Envoyer le brief
              </>
            ) : (
              <>
                Suivant <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
