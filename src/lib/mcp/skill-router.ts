import fs from "node:fs";
import path from "node:path";
import { getMediaBuyingSkill, type MediaBuyingSkill } from "@/lib/mcp/skills-repo";

export type ConnectedPlatform = "meta_ads" | "google_lsa" | "tiktok_ads" | "google_ads";

type Rule = {
  skillSuffix: string;
  patterns: RegExp[];
  platforms: ConnectedPlatform[];
  /** Local skills/ folder fallback id when vendor SOP missing */
  localFallback?: string;
};

const RULES: Rule[] = [
  {
    skillSuffix: "meta-ads/diagnostics/anomaly-detector",
    patterns: [/anomal|cpa|cpm|explos|chut[eé]|probl[eè]me|audit|diagnostic|bilan|analys/i],
    platforms: ["meta_ads"],
    localFallback: "performance-analyzer",
  },
  {
    skillSuffix: "meta-ads/diagnostics/capi-diagnostics",
    patterns: [/pixel|capi|conversion|tracking|événement|event match/i],
    platforms: ["meta_ads"],
    localFallback: "performance-analyzer",
  },
  {
    skillSuffix: "meta-ads/creative/creative-fatigue-detector",
    patterns: [/derni[eè]re pub|creative|cr[eé]atif|fatigue|annonce|publicit[eé]/i],
    platforms: ["meta_ads"],
    localFallback: "creative-generator",
  },
  {
    skillSuffix: "meta-ads/reporting/performance-report-generator",
    patterns: [/rapport|report|performance|r[eé]sultat|roas|semaine|mois/i],
    platforms: ["meta_ads"],
    localFallback: "performance-analyzer",
  },
  {
    skillSuffix: "meta-ads/launch/launch-verifier",
    patterns: [/lancer|campagne|launch|budget|cr[eé]er/i],
    platforms: ["meta_ads"],
    localFallback: "campaign-manager",
  },
  {
    skillSuffix: "google-lsa/diagnostics/lead-quality-auditor",
    patterns: [/lsa|local service|lead quality|google local/i],
    platforms: ["google_lsa", "google_ads"],
  },
  {
    skillSuffix: "tiktok-ads/diagnostics/anomaly-detector",
    patterns: [/tiktok|hold rate|spark ads/i],
    platforms: ["tiktok_ads"],
    localFallback: "performance-analyzer",
  },
];

function connectedSet(connectors: string[]): Set<ConnectedPlatform> {
  const s = new Set<ConnectedPlatform>();
  if (connectors.includes("meta_ads")) s.add("meta_ads");
  if (connectors.includes("google_lsa")) s.add("google_lsa");
  if (connectors.includes("google_ads")) s.add("google_ads");
  if (connectors.includes("tiktok_ads")) s.add("tiktok_ads");
  return s;
}

function loadLocalSkill(id: string): MediaBuyingSkill | null {
  const file = path.join(process.cwd(), "skills", id, "SKILL.md");
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf-8");
  const name = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id;
  const desc = raw.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? name;
  const steps = raw.match(/## Steps[\s\S]*?(?=\n## |$)/i)?.[0]?.replace(/^##[^\n]*\n?/, "").trim() ?? "";
  return {
    id: `local/${id}`,
    name,
    platform: "multi",
    category: "builtin",
    description: desc,
    whenToUse: desc,
    promptExcerpt: [
      `Purpose: ${desc}`,
      steps && `Workflow:\n${steps.slice(0, 700)}`,
      "Cite toujours nom + id du compte et nom de la Page. Langage simple, expert media buyer.",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1000),
    fullMarkdown: raw,
  };
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
    if (rule.localFallback) {
      const local = loadLocalSkill(rule.localFallback);
      if (local) return local;
    }
  }

  if (connected.has("meta_ads") && /pub|ads|meta|facebook|instagram|compte|page/i.test(t)) {
    return (
      getMediaBuyingSkill("meta-ads/creative/creative-fatigue-detector") ??
      loadLocalSkill("performance-analyzer")
    );
  }

  if (/audit|analys|performance|bilan|rapport/i.test(t)) {
    return loadLocalSkill("performance-analyzer");
  }

  return null;
}

export function formatSkillForPrompt(skill: MediaBuyingSkill): string {
  return [
    `SOP actif : ${skill.name} (${skill.platform} · ${skill.category})`,
    skill.promptExcerpt,
    "Applique ce SOP avec les données live. Cite nom + id du compte et nom de la Page. Ne redemande pas les comptes déjà connectés.",
  ].join("\n\n");
}
