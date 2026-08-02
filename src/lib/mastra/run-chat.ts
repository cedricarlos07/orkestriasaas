import { RequestContext } from "@mastra/core/request-context";
import { getMastra } from "@/mastra/index";
import { loadOrchestratorPrompt } from "@/lib/mcp/orchestrator";
import { buildOrgContext } from "@/lib/mcp/org-context";
import type { OrchestratorInput, OrchestratorOutput } from "@/lib/mcp/orchestrator";

function extractText(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as {
      text?: string;
      object?: unknown;
      content?: string;
      response?: { text?: string };
    };
    if (r.text) return r.text;
    if (r.content) return r.content;
    if (r.response?.text) return r.response.text;
  }
  return String(result ?? "");
}

function extractToolsUsed(result: unknown): string[] {
  const tools: string[] = [];
  const r = result as {
    toolCalls?: Array<{ payload?: { toolName?: string }; toolName?: string; name?: string }>;
    steps?: Array<{ toolCalls?: Array<{ payload?: { toolName?: string }; toolName?: string }> }>;
  };
  for (const tc of r.toolCalls ?? []) {
    const name = tc.payload?.toolName ?? tc.toolName ?? tc.name;
    if (name) tools.push(name);
  }
  for (const step of r.steps ?? []) {
    for (const tc of step.toolCalls ?? []) {
      const name = tc.payload?.toolName ?? tc.toolName;
      if (name) tools.push(name);
    }
  }
  return [...new Set(tools)];
}

/**
 * Mastra-powered orchestrator — Memory (thread=chat, resource=org) + policy tools.
 */
export async function runMastraOrchestrator(
  input: OrchestratorInput & { threadId?: string },
): Promise<OrchestratorOutput> {
  const mastra = getMastra();
  const agent = mastra.getAgent("orkestria");

  const [basePrompt, orgContext] = await Promise.all([
    loadOrchestratorPrompt(),
    buildOrgContext(input.orgId, input.message),
  ]);

  const requestContext = new RequestContext();
  requestContext.set("organizationId", input.orgId);
  requestContext.set("orgId", input.orgId);
  requestContext.set("userId", input.userId);

  const threadId = input.threadId ?? input.runId ?? `org-${input.orgId}-default`;

  const result = await agent.generate(input.message, {
    requestContext,
    instructions: `${basePrompt}\n\n--- Contexte org ---\n${orgContext}`,
    memory: {
      thread: threadId,
      resource: input.orgId,
    },
    maxSteps: 8,
  });

  return {
    reply: extractText(result).trim() || "Je n'ai pas pu générer de réponse. Réessayez.",
    toolsUsed: extractToolsUsed(result),
    runId: input.runId ?? threadId,
  };
}
