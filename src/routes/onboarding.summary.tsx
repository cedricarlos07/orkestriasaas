import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, TrendingUp, Lightbulb, Loader2 } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { useOnboarding } from "@/lib/onboarding-store";
import { completeOnboarding, saveOnboardingSession } from "@/functions/organizations";
import { runMultichannelAuditFn } from "@/functions/audits";
import { useEffect, useState } from "react";
import type { AuditSummary } from "@/lib/unified-ad-schema";

export const Route = createFileRoute("/onboarding/summary")({ component: Step });

function Step() {
  const { data } = useOnboarding();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    void runMultichannelAuditFn({ data: { period: "30 derniers jours" } })
      .then((res) => {
        setSummary(res.summary);
        setAuditError(null);
      })
      .catch((e) => {
        setSummary(null);
        setAuditError(e instanceof Error ? e.message : "Audit impossible");
      })
      .finally(() => setAuditLoading(false));
  }, []);

  const enterApp = async () => {
    setLoading(true);
    try {
      const companyName = data.account.name.trim() || data.pitch.slice(0, 40).trim() || "Mon entreprise";
      const saved = await saveOnboardingSession({
        data: { data: data as unknown as Record<string, unknown>, step: 8 },
      });
      await completeOnboarding({ data: { sessionId: saved.id, companyName } });
      navigate({ to: "/app" });
    } catch {
      navigate({ to: "/app" });
    } finally {
      setLoading(false);
    }
  };

  const problems = summary?.problems ?? [];
  const opportunities = summary?.opportunities ?? [];

  return (
    <>
      <StepHeader eyebrow="Étape 9 · Résultat" title="Voici votre premier bilan" desc="La situation, ce qui pose problème, ce qui peut décoller — et par où commencer." />
      {auditLoading ? (
        <div className="flex items-center gap-2 py-8 text-[13px] text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Analyse de vos comptes en cours…
        </div>
      ) : auditError ? (
        <div className="space-y-4 py-6">
          <p className="text-[14px] text-rose-600">{auditError}</p>
          <button type="button" onClick={() => void enterApp()} disabled={loading} className="btn-primary">
            {loading ? "Création de l'espace…" : "Entrer dans mon espace"}
          </button>
        </div>
      ) : (
        <>
          <div className="opt-tile opt-tile-active p-5">
            <p className="relative z-10 text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">Situation</p>
            <p className="relative z-10 mt-2 text-[15px] leading-relaxed text-ink">{summary?.situation}</p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card-soft p-5">
              <div className="relative z-10 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-rose-600">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /></span>
                Problèmes à corriger
              </div>
              <ol className="relative z-10 mt-3 space-y-2 text-[14px] text-ink">
                {problems.length === 0 ? (
                  <li>Aucun problème critique détecté.</li>
                ) : (
                  problems.map((p, i) => <li key={i}>{i + 1}. {p}</li>)
                )}
              </ol>
            </div>
            <div className="card-soft p-5">
              <div className="relative z-10 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-emerald-600">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><TrendingUp className="h-3.5 w-3.5" /></span>
                Opportunités
              </div>
              <ol className="relative z-10 mt-3 space-y-2 text-[14px] text-ink">
                {opportunities.length === 0 ? (
                  <li>Poursuivez le monitoring des performances.</li>
                ) : (
                  opportunities.map((o, i) => <li key={i}>{i + 1}. {o}</li>)
                )}
              </ol>
            </div>
          </div>
          <div className="card-ink mt-6 p-5">
            <div className="relative z-10 flex items-start gap-3">
              <div className="icon-relief icon-relief-active flex h-10 w-10">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Première action recommandée</p>
                <p className="mt-1 text-[15px]">{summary?.firstAction}</p>
                <button type="button" onClick={() => void enterApp()} disabled={loading} className="btn-primary mt-3">
                  {loading ? "Création de l'espace…" : "Entrer dans mon espace"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
