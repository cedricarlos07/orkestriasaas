/**
 * Competitor research — Meta Ad Library via official Graph API.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import {
  isMetaAdLibraryConfigured,
  metaAppAccessToken,
  probeMetaAdLibraryHealth,
  researchCompetitorAdsViaMeta,
} from "@/lib/platforms/meta-ad-library";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";

export type CompetitorResearchInput = {
  brand: string;
  brands?: string[];
  country?: string;
};

export async function resolveResearchAccessToken(orgId?: string): Promise<string> {
  if (orgId) {
    const rows = await db
      .select()
      .from(connections)
      .where(eq(connections.organizationId, orgId))
      .limit(20);
    const meta = rows.find((r) => r.connector === "meta_ads" && r.status === "connectée" && r.encryptedTokens);
    if (meta) {
      try {
        const tokens = await ensureFreshTokens(meta.id, orgId, "meta_ads");
        if (tokens.accessToken) return tokens.accessToken;
      } catch {
        /* fall through to app token */
      }
    }
  }
  const app = metaAppAccessToken();
  if (!app) {
    throw new Error(
      "Research Ad Library : connectez Meta Ads ou configurez META_APP_ID + META_APP_SECRET",
    );
  }
  return app;
}

export async function researchCompetitorAds(
  input: CompetitorResearchInput & { orgId?: string },
): Promise<Record<string, unknown>> {
  const accessToken = await resolveResearchAccessToken(input.orgId);
  return researchCompetitorAdsViaMeta({
    accessToken,
    brand: input.brand,
    brands: input.brands,
    country: input.country,
  });
}

export async function probeResearchHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  if (!isMetaAdLibraryConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      error: "META_APP_ID / META_APP_SECRET requis pour Ad Library Meta",
    };
  }
  return probeMetaAdLibraryHealth();
}
