import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, History, Stethoscope, AlertTriangle, TrendingUp } from "lucide-react";
import { getAudit, listAudits, runMultichannelAuditFn } from "@/functions/audits";

export const Route = createFileRoute("/_authenticated/app/audit")({ component: Audit });

function Audit() {
  const qc = useQueryClient();
  const { data: audits = [], isLoading } = useQuery({
    queryKey: ["audits"],
    queryFn: () => listAudits(),
  });
  const latestId = audits[0]?.id;
  const { data: latestDetail } = useQuery({
    queryKey: ["audit", latestId],
    queryFn: () => getAudit({ data: { id: latestId! } }),
    enabled: Boolean(latestId),
  });
  const runMut = useMutation({
    mutationFn: () => runMultichannelAuditFn({ data: { period: "30 derniers jours" } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["audits"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  const findings = latestDetail?.findings ?? [];

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Diagnostic</p>
            <h1 className="mt-0.5 font-display text-[26px] font-semibold text-ink">Audit publicitaire</h1>
            <p className="text-[13px] text-ink-soft">Analyse réelle via vos comptes connectés — aucun chiffre inventé.</p>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={runMut.isPending}
          onClick={() => runMut.mutate()}
        >
          {runMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
          Lancer un audit
        </button>
      </header>

      {runMut.isError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {(runMut.error as Error)?.message ?? "Échec de l'audit"}
        </p>
      )}

      {runMut.data && (
        <section className="card-soft p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">Dernier résultat</p>
          <p className="mt-2 text-[14px] text-ink">
            {runMut.data.summary?.situation ?? "Audit terminé — consultez l'historique."}
          </p>
        </section>
      )}

      {latestDetail && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="card-soft p-5">
            <p className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
              <AlertTriangle className="h-4 w-4 text-rose-500" /> Problèmes
            </p>
            {findings.filter((f) => f.kind === "problem").length === 0 ? (
              <p className="text-[13px] text-ink-soft">Aucun problème enregistré pour cet audit.</p>
            ) : (
              <ul className="space-y-2 text-[13px] text-ink">
                {findings.filter((f) => f.kind === "problem").map((f) => (
                  <li key={f.id}>{f.label}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="card-soft p-5">
            <p className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Opportunités
            </p>
            {findings.filter((f) => f.kind !== "problem").length === 0 ? (
              <p className="text-[13px] text-ink-soft">Aucune opportunité listée pour cet audit.</p>
            ) : (
              <ul className="space-y-2 text-[13px] text-ink">
                {findings.filter((f) => f.kind !== "problem").map((f) => (
                  <li key={f.id}>{f.label}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="card-soft overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/60 px-5 py-3">
          <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-ink-soft">
            <History className="h-3.5 w-3.5" /> Historique
          </p>
          <span className="text-[11px] text-ink-soft">{audits.length} audit{audits.length > 1 ? "s" : ""}</span>
        </div>
        {isLoading ? (
          <p className="flex items-center gap-2 px-5 py-8 text-[13px] text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : audits.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-ink-soft">
            Aucun audit. Connectez Meta puis lancez une analyse.{" "}
            <Link to="/app/connections" className="text-[#ff6c02] underline">Connexions</Link>
          </p>
        ) : (
          <ul className="divide-y divide-line/60">
            {audits.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13px]">
                <div>
                  <p className="font-medium text-ink">{a.period ?? "Audit"}</p>
                  <p className="text-[11px] text-ink-soft">
                    {a.status} · {a.spend ?? "—"} · {a.conv ?? 0} conv. · ROAS {a.roas ?? "—"}
                  </p>
                </div>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-soft">
                  {a.startedAt ? new Date(a.startedAt).toLocaleDateString("fr-FR") : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
