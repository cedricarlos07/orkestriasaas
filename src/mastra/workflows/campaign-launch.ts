import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { invokeAgentTool } from "@/lib/mcp/agent-tools";

function toolCtx(orgId: string, userId: string) {
  return {
    keyId: "mastra-workflow",
    organizationId: orgId,
    userId,
    name: "orkestria-campaign-wf",
    scopes: ["read", "write"] as ("read" | "write" | "admin")[],
  };
}

const briefSchema = z.object({
  orgId: z.string(),
  userId: z.string(),
  name: z.string(),
  dailyBudget: z.number().positive(),
  objective: z.string().optional(),
  countries: z.array(z.string()).optional(),
});

const dryRunStep = createStep({
  id: "dry-run-create",
  inputSchema: briefSchema,
  outputSchema: z.object({
    orgId: z.string(),
    userId: z.string(),
    name: z.string(),
    dailyBudget: z.number(),
    objective: z.string().optional(),
    countries: z.array(z.string()).optional(),
    preview: z.unknown(),
  }),
  execute: async ({ inputData }) => {
    const preview = await invokeAgentTool(toolCtx(inputData.orgId, inputData.userId), "create_meta_campaign", {
      name: inputData.name,
      dailyBudget: inputData.dailyBudget,
      objective: inputData.objective ?? "OUTCOME_TRAFFIC",
      countries: inputData.countries ?? ["CI"],
      dry_run: true,
      mode: "dry_run",
    });
    return { ...inputData, preview };
  },
});

const confirmCreateStep = createStep({
  id: "confirm-create",
  inputSchema: dryRunStep.outputSchema,
  outputSchema: z.object({
    orgId: z.string(),
    userId: z.string(),
    name: z.string(),
    dailyBudget: z.number(),
    objective: z.string().optional(),
    countries: z.array(z.string()).optional(),
    createResult: z.unknown(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
  }),
  suspendSchema: z.object({
    message: z.string(),
    preview: z.unknown(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData?.approved) {
      return await suspend({
        message:
          "Aperçu dry_run prêt. Répondez « oui crée en pause » pour créer la campagne (aucune dépense).",
        preview: inputData.preview,
      });
    }
    const createResult = await invokeAgentTool(
      toolCtx(inputData.orgId, inputData.userId),
      "create_meta_campaign",
      {
        name: inputData.name,
        dailyBudget: inputData.dailyBudget,
        objective: inputData.objective ?? "OUTCOME_TRAFFIC",
        countries: inputData.countries ?? ["CI"],
        dry_run: false,
        mode: "live",
      },
    );
    return {
      orgId: inputData.orgId,
      userId: inputData.userId,
      name: inputData.name,
      dailyBudget: inputData.dailyBudget,
      objective: inputData.objective,
      countries: inputData.countries,
      createResult,
    };
  },
});

const confirmActivateStep = createStep({
  id: "confirm-activate",
  inputSchema: confirmCreateStep.outputSchema,
  outputSchema: z.object({
    createResult: z.unknown(),
    activateResult: z.unknown().optional(),
    status: z.string(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    adId: z.string().optional(),
  }),
  suspendSchema: z.object({
    message: z.string(),
    createResult: z.unknown(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData?.approved || !resumeData.adId) {
      return await suspend({
        message:
          "Campagne créée en PAUSE. Pour dépenser, envoyez « oui active » avec l'ad id Meta.",
        createResult: inputData.createResult,
      });
    }
    const activateResult = await invokeAgentTool(
      toolCtx(inputData.orgId, inputData.userId),
      "activate_meta_campaign",
      { adId: resumeData.adId, dry_run: false, mode: "live" },
    );
    return {
      createResult: inputData.createResult,
      activateResult,
      status: "ACTIVE",
    };
  },
});

export const campaignLaunchWorkflow = createWorkflow({
  id: "campaign-launch",
  inputSchema: briefSchema,
  outputSchema: confirmActivateStep.outputSchema,
})
  .then(dryRunStep)
  .then(confirmCreateStep)
  .then(confirmActivateStep)
  .commit();
