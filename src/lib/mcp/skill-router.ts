import { getMediaBuyingSkill, type MediaBuyingSkill } from "@/lib/mcp/skills-repo";

export type ConnectedPlatform = "meta_ads" | "google_lsa" | "tiktok_ads";

type Rule = {
  skillSuffix: string;
  patterns: RegExp[];
  platforms: ConnectedPlatform[];
};

const RULES: Rule[] = [
  {
    skillSuffix: "meta-ads/diagnostics/anomaly-detector",
    patterns: [/anomal|cpa|cpm|explos|chut[eé]|probl[eè]me|audit|diagnostic|bilan|analys/i],
    platforms: ["meta_ads"],
  },
  {
    skillSuffix: "meta-ads/diagnostics/capi-diagnostics",
    patterns: [/pixel|capi|conversion|tracking|événement|event match/i],
    platforms: ["meta_ads"],
  },
  {
    skillSuffix: "meta-ads/creative/creative-fatigue-detector",
    patterns: [/derni[eè]re pub|creative|cr[eé]atif|fatigue|annonce|publicit[eé]/i],
    platforms: ["meta_ads"],
  },
  {
    skillSuffix: "meta-ads/reporting/performance-report-generator",
    patterns: [/rapport|report|performance|r[eé]sultat|roas|semaine|mois/i],
    platforms: ["meta_ads"],
  },
  {
    skillSuffix: "meta-ads/launch/launch-verifier",
    patterns: [/lancer|campagne|launch|budget|cr[eé]er/i],
    platforms: ["meta_ads"],
  },
  {
    skillSuffix: "google-lsa/diagnostics/lead-quality-auditor",
    patterns: [/lsa|local service|lead quality|google local/i],
    platforms: ["google_lsa"],
  },
  {
    skillSuffix: "tiktok-ads/diagnostics/anomaly-detector",
    patterns: [/tiktok|hold rate|spark ads/i],
    platforms: ["tiktok_ads"],
  },
];

function connectedSet(connectors: string[]): Set<ConnectedPlatform> {
  const s = new Set<ConnectedPlatform>();
  if (connectors.includes("meta_ads")) s.add("meta_ads");
  if (connectors.includes("google_lsa")) s.add("google_lsa");
  if (connectors.includes("tiktok_ads")) s.add("tiktok_ads");
  return s;
}

export function matchMediaSkill(
  message: string,
  connectedConnectors: string[],
): MediaBuyingSkill | null {
  const connected = connectedSet(connectedConnectors);
  const t = message.toLowerCase();

  for (const rule of RULES) {
    if (!rule.platforms.some((p) => connected.has(p))) continue;
    if (!rule.patterns.some((re) => re.test(t))) continue;
    const skill = getMediaBuyingSkill(rule.skillSuffix);
    if (skill) return skill;
  }

  // Meta-only fallback when Meta connected and message mentions ads
  if (connected.has("meta_ads") && /pub|ads|meta|facebook|instagram/i.test(t)) {
    return getMediaBuyingSkill("meta-ads/creative/creative-fatigue-detector") ?? null;
  }

  return null;
}

export function formatSkillForPrompt(skill: MediaBuyingSkill): string {
  return [
    `SOP actif : ${skill.name} (${skill.platform} · ${skill.category})`,
    skill.promptExcerpt,
    "Applique ce SOP avec les données live du contexte. Ne redemande pas les comptes déjà connectés.",
  ].join("\n\n");
}
