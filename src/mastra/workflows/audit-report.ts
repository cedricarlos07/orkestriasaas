import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { runMultichannelAudit } from "@/lib/mcp/audit-runner";
import { llmChatCompletion, isLlmConfigured } from "@/lib/llm/client";

const auditInput = z.object({
  orgId: z.string(),
  userId: z.string(),
  message: z.string().optional(),
});

const runAuditStep = createStep({
  id: "run-audit",
  inputSchema: auditInput,
  outputSchema: z.object({
    orgId: z.string(),
    message: z.string().optional(),
    summary: z.unknown(),
    runId: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const { runId, summary } = await runMultichannelAudit({
      orgId: inputData.orgId,
      userId: inputData.userId,
    });
    return { orgId: inputData.orgId, message: inputData.message, summary, runId };
  },
});

const composeReplyStep = createStep({
  id: "compose-reply",
  inputSchema: runAuditStep.outputSchema,
  outputSchema: z.object({
    reply: z.string(),
    runId: z.string().optional(),
    summary: z.unknown(),
  }),
  execute: async ({ inputData }) => {
    const summary = inputData.summary as {
      situation?: string;
      problems?: string[];
      opportunities?: string[];
      firstAction?: string;
    };
    if (!isLlmConfigured()) {
      return {
        reply: [
          summary.situation ?? "Audit terminé.",
          ...(summary.problems ?? []).map((p) => `• ${p}`),
          summary.firstAction ? `Prochaine action : ${summary.firstAction}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        runId: inputData.runId,
        summary: inputData.summary,
      };
    }
    const reply = await llmChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "Tu es Orkestria, media buyer. Résume l'audit en français, max 180 mots, chiffres du contexte uniquement, une prochaine action.",
        },
        {
          role: "user",
          content: `Message: ${inputData.message ?? "audit"}\n\nAudit:\n${JSON.stringify(summary).slice(0, 4000)}`,
        },
      ],
      maxTokens: 700,
    });
    return { reply, runId: inputData.runId, summary: inputData.summary };
  },
});

export const auditReportWorkflow = createWorkflow({
  id: "audit-report",
  inputSchema: auditInput,
  outputSchema: composeReplyStep.outputSchema,
})
  .then(runAuditStep)
  .then(composeReplyStep)
  .commit();
