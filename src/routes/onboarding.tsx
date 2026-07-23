import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { OnboardingCtx, STEPS, defaultData, type OnboardingData } from "@/lib/onboarding-store";
import { BrandLogo } from "@/components/BrandLogo";
import {
  completeOnboarding,
  getOnboardingSession,
  saveOnboardingSession,
} from "@/functions/organizations";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — Orkestria" },
      { name: "description", content: "Configurez votre espace publicitaire Orkestria en quelques étapes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingLayout,
});

function OnboardingLayout() {
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [finishing, setFinishing] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout>>();
  const location = useLocation();
  const navigate = useNavigate();

  const currentIndex = useMemo(() => {
    const idx = STEPS.findIndex((s) => location.pathname.endsWith("/" + s.slug));
    return idx === -1 ? 0 : idx;
  }, [location.pathname]);

  useEffect(() => {
    void getOnboardingSession()
      .then((row) => {
        if (!row) return;
        setSessionId(row.id);
        setData({ ...defaultData, ...(row.data as Partial<OnboardingData>) });
      })
      .catch(() => {});
  }, []);

  const persist = useCallback(
    (next: OnboardingData, step: number) => {
      clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void saveOnboardingSession({
          data: { id: sessionId, data: next as unknown as Record<string, unknown>, step },
        })
          .then((res) => {
            if (res.id) setSessionId(res.id);
          })
          .catch(() => {});
      }, 400);
    },
    [sessionId],
  );

  const update = (patch: Partial<OnboardingData>) =>
    setData((d) => {
      const next = { ...d, ...patch };
      persist(next, currentIndex);
      return next;
    });
  const setField = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) =>
    setData((d) => {
      const next = { ...d, [key]: value };
      persist(next, currentIndex);
      return next;
    });

  const progress = ((currentIndex + 1) / STEPS.length) * 100;

  const finishOnboarding = async () => {
    const companyName = data.account.name.trim() || data.pitch.slice(0, 40).trim() || "Mon entreprise";
    setFinishing(true);
    try {
      let id = sessionId;
      if (!id) {
        const saved = await saveOnboardingSession({
          data: { data: data as unknown as Record<string, unknown>, step: currentIndex },
        });
        id = saved.id;
        setSessionId(id);
      }
      if (id) {
        await completeOnboarding({ data: { sessionId: id, companyName } });
      }
      navigate({ to: "/app" });
    } catch {
      navigate({ to: "/app" });
    } finally {
      setFinishing(false);
    }
  };

  const goBack = () => {
    if (currentIndex > 0) navigate({ to: STEPS[currentIndex - 1].path });
  };
  const goNext = () => {
    if (currentIndex < STEPS.length - 1) navigate({ to: STEPS[currentIndex + 1].path });
    else void finishOnboarding();
  };

  return (
    <OnboardingCtx.Provider value={{ data, update, setField }}>
      <main className="min-h-screen bg-surface-2">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-line/60 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
            <Link to="/" className="flex items-center gap-2">
              <BrandLogo className="h-7 w-auto" />
            </Link>
            <p className="hidden text-[13px] text-ink-soft sm:block">
              Étape <span className="font-semibold text-ink">{currentIndex + 1}</span> sur {STEPS.length} · <span className="text-ink">{STEPS[currentIndex].label}</span>
            </p>
            <Link to="/app" className="flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink">
              <X className="h-4 w-4" /> Quitter
            </Link>
          </div>
          <div className="h-1 w-full bg-line/60">
            <div className="h-full bg-[#ff6c02] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </header>

        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-6 py-10 md:grid-cols-[240px_1fr]">
          {/* Vertical stepper */}
          <aside className="hidden md:block">
            <ol className="sticky top-24 space-y-1">
              {STEPS.map((s, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                const disabled = i > currentIndex;
                const cls = active
                  ? "bg-white text-ink shadow-sm ring-1 ring-black/5"
                  : done
                  ? "text-ink-soft hover:bg-white/60"
                  : "text-ink-soft/50";
                const badge = active
                  ? "bg-[#ff6c02] text-white"
                  : done
                  ? "bg-ink text-white"
                  : "bg-line text-ink-soft";
                return (
                  <li key={s.slug}>
                    <button
                      onClick={() => !disabled && navigate({ to: s.path })}
                      disabled={disabled}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px] transition ${cls}`}
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${badge}`}>
                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-6 px-3 text-[12px] text-ink-soft">
              Vous pouvez revenir en arrière à tout moment. Vos réponses sont sauvegardées.
            </p>
          </aside>

          {/* Step card */}
          <section className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.15)] ring-1 ring-black/5 md:p-10">
            <Outlet />

            <div className="mt-10 flex items-center justify-between border-t border-line/60 pt-6">
              <button
                onClick={goBack}
                disabled={currentIndex === 0}
                className="chip-ghost disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
              <button onClick={goNext} disabled={finishing} className="btn-primary">
                {currentIndex === STEPS.length - 1
                  ? finishing
                    ? "Création de l'espace…"
                    : "Entrer dans mon espace"
                  : "Continuer"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>
      </main>
    </OnboardingCtx.Provider>
  );
}