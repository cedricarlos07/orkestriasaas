import type { AgentTool, AgentToolContext } from "./shared";
import { str } from "./shared";
import { logReadRun } from "@/lib/mcp/policy-engine";
import { coreTools } from "./core";
import { launchTools } from "./launch";
import { optimizeTools } from "./optimize";
import { createTools } from "./create";
import { measureTools } from "./measure";
import { governTools } from "./govern";

export type { AgentTool, AgentToolContext } from "./shared";

export const AGENT_TOOLS: AgentTool[] = [
  ...coreTools,
  ...launchTools,
  ...optimizeTools,
  ...createTools,
  ...measureTools,
  ...governTools,
];

export function getAgentTool(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((t) => t.name === name);
}

/** Invoke a tool with audit logging for reads (writes log themselves via the policy engine). */
export async function invokeAgentTool(
  ctx: AgentToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = getAgentTool(name);
  if (!tool) throw new Error(`Tool inconnu : ${name}`);
  const isWrite =
    ["launch", "optimize"].includes(tool.family) ||
    [
      "execute",
      "approve_action",
      "reject_action",
      "set_policy",
      "upload_creative",
      "autonomy_tick",
      "launch_meta_brief",
      "activate_meta_campaign",
    ].includes(name);
  const start = Date.now();
  try {
    const result = await tool.handler(ctx, args ?? {});
    if (!isWrite) {
      await logReadRun({
        orgId: ctx.organizationId,
        apiKeyId: ctx.keyId,
        connector: str(args?.platform),
        tool: name,
        params: args ?? {},
        status: "ok",
        latencyMs: Date.now() - start,
      });
    }
    return result;
  } catch (e) {
    if (!isWrite) {
      await logReadRun({
        orgId: ctx.organizationId,
        apiKeyId: ctx.keyId,
        connector: str(args?.platform),
        tool: name,
        params: args ?? {},
        status: "error",
        error: e instanceof Error ? e.message : "Erreur",
        latencyMs: Date.now() - start,
      });
    }
    throw e;
  }
}
