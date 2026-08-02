import { AGENT_TOOLS, type AgentTool } from "./catalog";

export function toolsByFamily(family: AgentTool["family"]): AgentTool[] {
  return AGENT_TOOLS.filter((t) => t.family === family);
}

export const CORE_TOOLS = toolsByFamily("core");
export const LAUNCH_TOOLS = toolsByFamily("launch");
export const OPTIMIZE_TOOLS = toolsByFamily("optimize");
export const CREATE_TOOLS = toolsByFamily("create");
export const MEASURE_TOOLS = toolsByFamily("measure");
export const GOVERN_TOOLS = toolsByFamily("govern");
