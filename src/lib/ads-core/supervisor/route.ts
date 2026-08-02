/**
 * Ads Supervisor — runtime port of Advertising Hub Buddy orchestrator.
 * Source: agents/orchestrator/buddy.md
 * https://github.com/itallstartedwithaidea/advertising-hub (MIT)
 */

export type HubAgentId =
  | "buddy"
  | "ppc-strategist"
  | "search-query-analyst"
  | "auditor"
  | "tracking-specialist"
  | "creative-strategist"
  | "programmatic-buyer"
  | "paid-social-strategist"
  | "budget-allocator"
  | "attribution-analyst"
  | "audience-architect"
  | "competitive-intel"
  | "reporting-unifier"
  | "linkedin-b2b-strategist"
  | "amazon-ads-specialist"
  | "microsoft-ppc-specialist";

export type PlatformHint = "meta" | "google" | "tiktok" | "linkedin" | "cross" | "unknown";

export type SupervisorRoute = {
  /** Primary Hub agent to load */
  agent: HubAgentId;
  /** Extra agents in sequence (Buddy "coordinate if needed") */
  secondary: HubAgentId[];
  platforms: PlatformHint[];
  /** Skill markdown path under ads-core/skills */
  skillPath: string;
  reason: string;
  /** Missing Hub pieces the caller should know about */
  gaps: string[];
};

type Rule = {
  patterns: RegExp[];
  route: Omit<SupervisorRoute, "gaps"> & { gaps?: string[] };
};

/**
 * Routing table adapted from Buddy examples + Hub agent decision frameworks.
 * Priority: first match wins.
 */
const RULES: Rule[] = [
  {
    patterns: [
      /campagne|lancer|cr[eé]er|sponsoris|boost|fourmis|messages?\s*ads|whatsapp|messenger/i,
    ],
    route: {
      agent: "paid-social-strategist",
      secondary: ["budget-allocator", "creative-strategist"],
      platforms: ["meta", "google", "tiktok"],
      skillPath: "paid-media/paid-social-strategist.md",
      reason: "Campaign launch brief — Paid Social + Budget + Creative",
      gaps: [
        "No Hub write APIs — Orkestria prepare/approve/execute required",
        "Client entity + creative library still missing",
      ],
    },
  },
  {
    patterns: [
      /r[eé]partit|allou|où\s+mettre|where\s+should|cross.?canal|budget\s+allocator|portefeuille\s+budget/i,
    ],
    route: {
      agent: "budget-allocator",
      secondary: ["reporting-unifier"],
      platforms: ["cross"],
      skillPath: "cross-platform/budget-allocator.md",
      reason: "Cross-platform budget allocation (Budget Allocator)",
    },
  },
  {
    patterns: [/attribution|chiffres?\s+ne\s+match|conversion\s+numbers?\s+match|discrepan/i],
    route: {
      agent: "attribution-analyst",
      secondary: ["tracking-specialist"],
      platforms: ["cross"],
      skillPath: "cross-platform/attribution-analyst.md",
      reason: "Cross-platform measurement / attribution",
    },
  },
  {
    patterns: [/search\s*term|requ[eê]te|negative\s*keyword|mot[s]?\s*cl[eé]/i],
    route: {
      agent: "search-query-analyst",
      secondary: ["ppc-strategist"],
      platforms: ["google"],
      skillPath: "paid-media/search-query-analyst.md",
      reason: "Search query / negatives (Google)",
    },
  },
  {
    patterns: [/audit|diagnost|bilan|200\+|anomaly|anomal/i],
    route: {
      agent: "auditor",
      secondary: ["reporting-unifier"],
      platforms: ["cross"],
      skillPath: "paid-media/auditor.md",
      reason: "Paid media audit",
    },
  },
  {
    patterns: [/capi|pixel|tracking|gtm|ga4|conversion\s*api/i],
    route: {
      agent: "tracking-specialist",
      secondary: [],
      platforms: ["meta", "google"],
      skillPath: "paid-media/tracking-specialist.md",
      reason: "Tracking / CAPI",
      gaps: ["Meta CAPI validator exists as Hub script only — not wired to Orkestria yet"],
    },
  },
  {
    patterns: [/cr[eé]a|creative|visuel|vid[eé]o|rsa|headline|accroche|asset/i],
    route: {
      agent: "creative-strategist",
      secondary: ["paid-social-strategist"],
      platforms: ["meta", "google", "tiktok"],
      skillPath: "paid-media/creative-strategist.md",
      reason: "Creative strategy",
      gaps: ["Orkestria creative library not built yet — agent advises only"],
    },
  },
  {
    patterns: [/audience|lookalike|retarget|segment|ciblage|quartier|ville|geo|rayon/i],
    route: {
      agent: "audience-architect",
      secondary: ["paid-social-strategist"],
      platforms: ["cross"],
      skillPath: "cross-platform/audience-architect.md",
      reason: "Audience / geo targeting",
    },
  },
  {
    patterns: [/linkedin|b2b|abm/i],
    route: {
      agent: "linkedin-b2b-strategist",
      secondary: [],
      platforms: ["linkedin"],
      skillPath: "platform-specific/linkedin-b2b-strategist.md",
      reason: "LinkedIn B2B",
      gaps: ["LinkedIn write not in Orkestria v1 — connector only"],
    },
  },
  {
    patterns: [/tiktok/i],
    route: {
      agent: "paid-social-strategist",
      secondary: ["creative-strategist"],
      platforms: ["tiktok"],
      skillPath: "paid-media/paid-social-strategist.md",
      reason: "TikTok via Paid Social (no Hub PLATFORM.yaml — Orkestria stub)",
      gaps: [
        "TikTok absent from Advertising Hub platforms/",
        "Need dedicated PLATFORM + adapter write path",
      ],
    },
  },
  {
    patterns: [/google\s*ads|pmax|performance\s*max|search\s*campaign|gaql|ppc/i],
    route: {
      agent: "ppc-strategist",
      secondary: ["search-query-analyst"],
      platforms: ["google"],
      skillPath: "paid-media/ppc-strategist.md",
      reason: "Google Ads / PPC",
      gaps: ["Hub google-ads-mcp is external — Orkestria uses native Google Ads API"],
    },
  },
  {
    patterns: [/meta|facebook|instagram|avantage\+|advantage/i],
    route: {
      agent: "paid-social-strategist",
      secondary: ["creative-strategist"],
      platforms: ["meta"],
      skillPath: "paid-media/paid-social-strategist.md",
      reason: "Meta / Paid Social",
      gaps: ["Hub Meta MCP is planned only — execution via Orkestria Graph API"],
    },
  },
  {
    patterns: [/rapport|report|performance|r[eé]sultat|roas|insights?/i],
    route: {
      agent: "reporting-unifier",
      secondary: ["auditor"],
      platforms: ["cross"],
      skillPath: "cross-platform/reporting-unifier.md",
      reason: "Unified reporting",
    },
  },
];

const DEFAULT_ROUTE: SupervisorRoute = {
  agent: "buddy",
  secondary: ["paid-social-strategist", "ppc-strategist"],
  platforms: ["unknown"],
  skillPath: "orchestrator/buddy.md",
  reason: "Default Buddy — clarify platform then re-route",
  gaps: [],
};

/** Buddy step 1–5: identify platforms, route specialist, note gaps. */
export function routeAdsRequest(message: string): SupervisorRoute {
  const t = message.trim();
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(t))) {
      return {
        ...rule.route,
        gaps: rule.route.gaps ?? [],
      };
    }
  }
  return { ...DEFAULT_ROUTE };
}

export function formatRouteForPrompt(route: SupervisorRoute): string {
  const lines = [
    `SOP Hub actif : ${route.agent}`,
    `Raison : ${route.reason}`,
    `Plateformes : ${route.platforms.join(", ")}`,
    route.secondary.length ? `Agents secondaires : ${route.secondary.join(", ")}` : null,
    route.gaps.length ? `Gaps connus :\n- ${route.gaps.join("\n- ")}` : null,
    "Applique le skill Advertising Hub. Ne prétends pas avoir écrit sur les APIs sans outil Orkestria. Campagnes en pause jusqu'à approbation.",
  ];
  return lines.filter(Boolean).join("\n");
}
