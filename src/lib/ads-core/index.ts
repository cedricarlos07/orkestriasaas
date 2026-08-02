/**
 * orkestria-ads-core — Advertising Hub integrated as Orkestria's ad brain.
 *
 * Upstream: https://github.com/itallstartedwithaidea/advertising-hub (MIT)
 * Copyright (c) 2025 John Williams / It All Started With A Idea
 *
 * This module does NOT call ad platform APIs. Execution stays in
 * src/lib/platforms + policy-engine (native Meta Graph + Google Ads API).
 */

export {
  type AdsBackend,
  getAdsBackend,
  useOrkestriaMetaBackend,
  useOrkestriaGoogleBackend,
} from "./backend";

export {
  type HubCampaign,
  type HubAdGroup,
  type HubAd,
  type HubAudience,
  type NormalizedMetrics,
  type CrossPlatformReport,
  type CampaignStatus,
  type CampaignType,
  type AudienceType,
  metricsCtr,
  metricsCpc,
  metricsCpa,
  metricsRoas,
  metricsConversionRate,
  reportTotalSpend,
  reportTotalConversions,
  reportBlendedCpa,
} from "./models/index";

export {
  type PlatformConfig,
  type PlatformSlug,
  loadPlatformConfig,
  listRegisteredPlatforms,
  listV1Platforms,
  platformHasCapability,
  connectorToHubSlug,
} from "./registry/platforms";

export {
  type SupervisorRoute,
  type HubAgentId,
  routeAdsRequest,
  formatRouteForPrompt,
} from "./supervisor/route";

export { loadHubSkill, hubSkillExcerpt, listHubSkillFiles } from "./skills/load";

import { formatRouteForPrompt, routeAdsRequest } from "./supervisor/route";
import { hubSkillExcerpt } from "./skills/load";

/** Build system prompt block: Buddy route + skill excerpt. */
export function buildHubBrainPrompt(userMessage: string): {
  route: ReturnType<typeof routeAdsRequest>;
  promptBlock: string;
} {
  const route = routeAdsRequest(userMessage);
  const skill = hubSkillExcerpt(route.skillPath);
  const secondarySkills = route.secondary
    .map((id) => {
      const pathGuess =
        id.includes("strategist") && id.startsWith("linkedin")
          ? `platform-specific/${id}.md`
          : id === "budget-allocator" ||
              id === "reporting-unifier" ||
              id === "attribution-analyst" ||
              id === "audience-architect" ||
              id === "competitive-intel"
            ? `cross-platform/${id}.md`
            : `paid-media/${id}.md`;
      return hubSkillExcerpt(pathGuess, 1200);
    })
    .filter(Boolean);

  const promptBlock = [
    "--- Advertising Hub (Buddy) ---",
    formatRouteForPrompt(route),
    skill ? `\n--- Skill: ${route.agent} ---\n${skill}` : null,
    secondarySkills.length
      ? `\n--- Secondary skills ---\n${secondarySkills.join("\n\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { route, promptBlock };
}
