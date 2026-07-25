import { createServerFn } from "@tanstack/react-start";
import { ensureSession } from "@/lib/auth.functions";
import { getActiveOrgId } from "./context";
import { isMetaAdLibraryConfigured } from "@/lib/platforms/meta-ad-library";
import { probeResearchHealth, resolveResearchAccessToken } from "@/lib/mcp/clients/useproxy";
import { probeMetaAdLibraryHealth } from "@/lib/platforms/meta-ad-library";

export const getResearchStackStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  const configured = isMetaAdLibraryConfigured();
  if (!configured) {
    return {
      configured: false,
      url: "graph.facebook.com/ads_archive",
      health: {
        ok: false,
        error: "META_APP_ID / META_APP_SECRET manquants",
      },
    };
  }
  let health: { ok: boolean; latencyMs: number; error?: string };
  try {
    const token = await resolveResearchAccessToken(orgId);
    health = await probeMetaAdLibraryHealth(token);
  } catch {
    health = await probeResearchHealth();
  }
  return {
    configured: true,
    url: "graph.facebook.com/ads_archive (Meta app)",
    health,
  };
});
