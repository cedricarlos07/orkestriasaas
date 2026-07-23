import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAudit, listAudits, startAudit } from "@/functions/audits";
import { asMs } from "@/lib/time";

export type AuditFinding = { label: string; kind: "problem" | "opportunity" | string };
export type AuditRun = {
  id: string;
  startedAt: number;
  completedAt?: number;
  status: "running" | "paused" | "done" | string;
  stepIndex: number;
  totalSteps: number;
  period: string;
  spend: string;
  conv: number;
  cpa: string;
  roas: string;
  findings: AuditFinding[];
};

function mapAudit(a: Awaited<ReturnType<typeof listAudits>>[number]): AuditRun {
  return {
    id: a.id,
    startedAt: asMs(a.startedAt),
    completedAt: a.completedAt ? asMs(a.completedAt) : undefined,
    status: a.status,
    stepIndex: a.stepIndex ?? 0,
    totalSteps: a.totalSteps ?? 5,
    period: a.period ?? "",
    spend: a.spend ?? "—",
    conv: a.conv ?? 0,
    cpa: a.cpa ?? "—",
    roas: a.roas ?? "—",
    findings: [],
  };
}

export function useAudits() {
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({
    queryKey: ["audits"],
    queryFn: async () => (await listAudits()).map(mapAudit),
  });

  const startMut = useMutation({
    mutationFn: (period?: string) => startAudit({ data: { period } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audits"] }),
  });

  return { list, start: startMut.mutateAsync, get: (id: string) => getAudit({ data: { id } }) };
}
