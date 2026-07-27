import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appendRunEvent, createRun, listRuns, updateRunState } from "@/functions/runs";
import { createNotification } from "@/functions/notifications";
import { asMs } from "@/lib/time";

export type RunState =
  | "received"
  | "interpreting"
  | "planning"
  | "collecting_data"
  | "waiting_for_input"
  | "building_preview"
  | "waiting_for_approval"
  | "executing"
  | "verifying"
  | "monitoring"
  | "completed"
  | "partially_completed"
  | "failed_recoverable"
  | "failed_final"
  | "cancelled"
  | "expired";

export type StreamEvent = {
  type: string;
  ts: number;
  [key: string]: unknown;
};

export type AgentRun = {
  id: string;
  title: string;
  goal: string;
  skill: string | null;
  tool: string | null;
  state: RunState;
  createdAt: number;
  updatedAt: number;
  idempotencyKey: string | null;
  events: StreamEvent[];
};

export const STATE_FLOW: RunState[] = [
  "received",
  "interpreting",
  "planning",
  "collecting_data",
  "building_preview",
  "waiting_for_approval",
  "executing",
  "verifying",
  "monitoring",
  "completed",
];

export const STATE_LABELS: Record<RunState, { l: string; c: string; bg: string }> = {
  received: { l: "Reçu", c: "text-sky-700", bg: "bg-sky-50" },
  interpreting: { l: "Analyse", c: "text-indigo-700", bg: "bg-indigo-50" },
  planning: { l: "Préparation", c: "text-violet-700", bg: "bg-violet-50" },
  collecting_data: { l: "Lecture des comptes", c: "text-blue-700", bg: "bg-blue-50" },
  waiting_for_input: { l: "En attente de vous", c: "text-amber-700", bg: "bg-amber-50" },
  building_preview: { l: "Aperçu", c: "text-orange-700", bg: "bg-orange-50" },
  waiting_for_approval: { l: "À valider", c: "text-rose-700", bg: "bg-rose-50" },
  executing: { l: "En cours", c: "text-[#c94a00]", bg: "bg-[#fff6ee]" },
  verifying: { l: "Vérification", c: "text-teal-700", bg: "bg-teal-50" },
  monitoring: { l: "Suivi", c: "text-emerald-700", bg: "bg-emerald-50" },
  completed: { l: "Terminé", c: "text-emerald-800", bg: "bg-emerald-50" },
  partially_completed: { l: "Partiellement fait", c: "text-amber-800", bg: "bg-amber-50" },
  failed_recoverable: { l: "À reprendre", c: "text-orange-800", bg: "bg-orange-50" },
  failed_final: { l: "Échec", c: "text-rose-800", bg: "bg-rose-50" },
  cancelled: { l: "Annulé", c: "text-ink-soft", bg: "bg-surface-2" },
  expired: { l: "Expiré", c: "text-ink-soft", bg: "bg-surface-2" },
};

function mapRun(r: Awaited<ReturnType<typeof listRuns>>[number]): AgentRun {
  return {
    id: r.id,
    title: r.title,
    goal: r.goal,
    skill: r.skill,
    tool: r.tool,
    state: r.state as RunState,
    createdAt: asMs(r.createdAt),
    updatedAt: asMs(r.updatedAt),
    idempotencyKey: r.idempotencyKey,
    events: r.events.map((e) => ({
      type: e.type,
      ts: asMs(e.createdAt),
      ...(e.payload as Record<string, unknown>),
    })),
  };
}

export function useAgentRuns() {
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["agent-runs"],
    queryFn: async () => (await listRuns()).map(mapRun),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["agent-runs"] });

  const createMut = useMutation({
    mutationFn: (data: { title: string; goal: string; skill?: string; tool?: string }) =>
      createRun({ data }),
    onSuccess: invalidate,
  });

  const stateMut = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) => updateRunState({ data: { id, state } }),
    onSuccess: invalidate,
  });

  const eventMut = useMutation({
    mutationFn: ({ runId, type, payload }: { runId: string; type: string; payload?: Record<string, unknown> }) =>
      appendRunEvent({ data: { runId, type, payload } }),
    onSuccess: invalidate,
  });

  return {
    list,
    isLoading,
    create: createMut.mutateAsync,
    createDemo: (title: string, goal: string) =>
      createMut.mutateAsync({ title, goal, skill: "Strategy", tool: "Orkestria Agent" }).then(mapRun),
    setState: (id: string, state: RunState) => stateMut.mutate({ id, state }),
    appendEvent: (runId: string, ev: StreamEvent) =>
      eventMut.mutate({ runId, type: ev.type, payload: ev as Record<string, unknown> }),
    refresh: invalidate,
  };
}

export function useNotificationsPush() {
  return {
    push: (n: { kind: string; title: string; body: string }) =>
      void createNotification({ data: n }),
  };
}
