/**
 * Built-in MCP skills (SOPs) — chain existing tools under the policy engine.
 */
export type SkillDefinition = {
  id: string;
  name: string;
  description: string;
  steps: { tool: string; hint: string }[];
};

export const MCP_SKILLS: SkillDefinition[] = [
  {
    id: "launch",
    name: "Launch campaign",
    description: "Validate setup, propose a media plan, then create a paused campaign.",
    steps: [
      { tool: "validate_setup", hint: "Check key, connections and policy" },
      { tool: "create_media_plan", hint: "Allocate budget across connected platforms" },
      { tool: "create_campaign", hint: "Create paused campaign (use execute dry_run first)" },
    ],
  },
  {
    id: "optimize",
    name: "Optimize spend",
    description: "Detect anomalies and pause or reallocate underperformers.",
    steps: [
      { tool: "detect_anomalies", hint: "Find spend without conversions / low CTR / high CPA" },
      { tool: "get_performance", hint: "Pull 30-day performance" },
      { tool: "pause_campaign", hint: "Pause clear losers via execute dry_run then confirm" },
    ],
  },
  {
    id: "audit",
    name: "Tracking audit",
    description: "Diagnose conversion tracking and list conversion actions.",
    steps: [
      { tool: "diagnose_tracking", hint: "Check Google / Meta / TikTok conversion setup" },
      { tool: "list_conversions", hint: "List conversion actions / pixels" },
      { tool: "get_account_summary", hint: "Consolidated multi-platform snapshot" },
    ],
  },
  {
    id: "audience",
    name: "Audience launch",
    description: "Create an audience then attach it to a campaign or ad set.",
    steps: [
      { tool: "create_audience", hint: "Create audience (dry_run then confirm)" },
      { tool: "attach_audience", hint: "Attach to campaign (Google/LI) or ad set (Meta)" },
      { tool: "list_campaigns", hint: "Verify targeting surface" },
    ],
  },
  {
    id: "creative_rotate",
    name: "Creative rotation",
    description: "Find low-CTR Meta ads and pause losers under policy.",
    steps: [
      { tool: "suggest_creative_rotation", hint: "List Meta ads with low CTR" },
      { tool: "pause_ad", hint: "Pause suggested ads via execute dry_run then confirm" },
      { tool: "list_creatives", hint: "Refresh creative inventory" },
    ],
  },
];

export function listSkills(): SkillDefinition[] {
  return MCP_SKILLS;
}

export function getSkill(id: string): SkillDefinition | undefined {
  return MCP_SKILLS.find((s) => s.id === id);
}
