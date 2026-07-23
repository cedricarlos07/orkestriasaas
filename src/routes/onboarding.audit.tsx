import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, AlertTriangle, Zap } from "lucide-react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { runMultichannelAuditFn } from "@/functions/audits";
import type { AuditSummary } from "@/lib/unified-ad-schema";

export const Route = createFileRoute("/onboarding/audit")({ component: Step });

const CACHE_KEY = "orkestria:onboarding-audit";

export type CachedAudit = {
  summary: AuditSummary;
  at: number;
};

function Step() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void runMultichannelAuditFn({ data: { period: "30 derniers jours" } })
      .then((res) => {
        if (cancelled) return;
        setSummary(res.summary);
        setPhase("ok");
        try {
          const payload: CachedAudit = { summary: res.summary, at: Date.now() };
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        } catch {
          /* ignore quota */
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setPhase("error");
        setError(e instanceof Error ? e.message : "Audit impossible");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <StepHeader
        eyebrow="Étape 8 · Audit"
        title="Analyse de vos comptes publicitaires"
        desc="Scan réel de vos connexions Meta / Google pour préparer votre premier bilan."
      />

      {phase === "loading" && (
        <div className="space-y-4">
          <div className="card-ink flex items-center gap-3 p-5">
            <Loader2 className="relative z-10 h-5 w-5 animate-spin text-[#ff8a3d]" />
            <p className="relative z-10 text-[14px]">Analyse en cours — lecture des campagnes et des performances…</p>
          </div>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {["Campagnes", "Dépenses", "Résultats", "Tracking"].map((label) => (
              <li key={label} className="opt-tile flex items-center gap-3 !p-3">
                <Loader2 className="relative z-10 h-4 w-4 animate-spin text-[#ff6c02]" />
                <span className="relative z-10 text-[14px] text-ink">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === "ok" && summary && (
        <div className="space-y-4">
          <div className="opt-tile opt-tile-active flex items-start gap-3 p-5">
            <span className="icon-relief icon-relief-active relative z-10 h-9 w-9">
              <Check className="h-4 w-4" />
            </span>
            <div className="relative z-10">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">Scan terminé</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink">{summary.situation}</p>
              <p className="mt-2 text-[12px] text-ink-soft">
                {summary.problems?.length ?? 0} point{(summary.problems?.length ?? 0) > 1 ? "s" : ""} à corriger ·{" "}
                {summary.opportunities?.length ?? 0} piste{(summary.opportunities?.length ?? 0) > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={() => navigate({ to: "/onboarding/summary" })}>
            Voir mon bilan
          </button>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Impossible de scanner pour l’instant</p>
              <p className="mt-1">{error}</p>
              <p className="mt-1 text-amber-800/80">Vous pouvez continuer — le bilan se basera sur ce qui est disponible.</p>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={() => navigate({ to: "/onboarding/summary" })}>
            <Zap className="h-4 w-4" /> Continuer vers le bilan
          </button>
        </div>
      )}
    </>
  );
}
