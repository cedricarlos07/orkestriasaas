import type { AuditSummary } from "@/lib/unified-ad-schema";

export type OrchestratorTurn = { role: "user" | "agent"; text: string };

export type OrchestratorInput = {
  orgId: string;
  userId: string;
  message: string;
  skill?: string;
  runId?: string;
  /** Mastra memory thread id (chat thread). */
  threadId?: string;
  /** Previous turns of the thread, oldest first, excluding the current message. */
  history?: OrchestratorTurn[];
  /** Optional image attachments from chat (native Meta upload). */
  attachments?: Array<{
    kind: "image";
    dataUrl?: string;
    url?: string;
    name?: string;
  }>;
};

export type OrchestratorOutput = {
  reply: string;
  toolsUsed: string[];
  auditSummary?: AuditSummary;
  runId?: string;
  matchedMediaSkill?: string;
  /** Clickable reply chips shown under the agent bubble (ChatGPT-style). */
  suggestions?: Array<{ label: string; value: string }>;
};
