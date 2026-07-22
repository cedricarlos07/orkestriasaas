import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { buildAdkitEnv, adkitVerify } from "@/lib/mcp/adkit-bridge";
import { getOrgAdloopApiKey, isAdloopLinked } from "@/lib/mcp/adloop-org";
import { probeAdloopHealth } from "@/lib/mcp/clients/adloop";
import { probeUseproxyHealth } from "@/lib/mcp/clients/useproxy";
import { resolveMetaPageId } from "@/lib/mcp/meta-org";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";

export type StackSetupStatus = {
  meta: {
    oauthConnected: boolean;
    account: string | null;
    pageId: string | null;
    adkitVerify: "ok" | "skipped" | "error";
    adkitError?: string;
  };
  google: {
    adloopLinked: boolean;
    adloopHealth: "ok" | "skipped" | "error";
    adloopError?: string;
  };
  research: {
    useproxyConfigured: boolean;
    useproxyHealth: "ok" | "skipped" | "error";
    useproxyError?: string;
    url: string;
  };
  readyForCampaign: boolean;
  missingSteps: string[];
};

export async function getStackSetupStatus(orgId: string): Promise<StackSetupStatus> {
  const rows = await db.select().from(connections).where(eq(connections.organizationId, orgId));
  const metaConn = rows.find((r) => r.connector === "meta_ads" && r.status === "connectée");
  const pageId = await resolveMetaPageId(orgId, null);

  const missingSteps: string[] = [];

  let adkitVerify: StackSetupStatus["meta"]["adkitVerify"] = "skipped";
  let adkitError: string | undefined;
  if (metaConn) {
    try {
      const tokens = await ensureFreshTokens(metaConn.id, orgId, "meta_ads");
      const env = buildAdkitEnv({
        accessToken: tokens.accessToken,
        accountId: tokens.accountId ?? metaConn.externalAccount ?? "",
        pageId: pageId ?? undefined,
        allowSpend: false,
      });
      await adkitVerify(env);
      adkitVerify = "ok";
    } catch (e) {
      adkitVerify = "error";
      adkitError = e instanceof Error ? e.message : "adkit verify failed";
    }
  } else {
    missingSteps.push("Connecter Meta Ads (OAuth)");
  }

  if (!pageId) missingSteps.push("Enregistrer la Page Facebook ID (Connexions)");

  const adloopLinked = await isAdloopLinked(orgId);
  let adloopHealth: StackSetupStatus["google"]["adloopHealth"] = "skipped";
  let adloopError: string | undefined;
  if (adloopLinked) {
    const key = await getOrgAdloopApiKey(orgId);
    if (key) {
      const probe = await probeAdloopHealth(key);
      if (probe.ok) adloopHealth = "ok";
      else {
        adloopHealth = "error";
        adloopError = probe.error;
      }
    }
  }

  const useproxyConfigured = Boolean(process.env.USEPROXY_API_KEY?.trim());
  let useproxyHealth: StackSetupStatus["research"]["useproxyHealth"] = "skipped";
  let useproxyError: string | undefined;
  if (useproxyConfigured) {
    const probe = await probeUseproxyHealth();
    if (probe.ok) useproxyHealth = "ok";
    else {
      useproxyHealth = "error";
      useproxyError = probe.error;
    }
  } else {
    missingSteps.push("Clé useproxy serveur (research concurrents — admin)");
  }

  const readyForCampaign =
    Boolean(metaConn) &&
    Boolean(pageId) &&
    adkitVerify === "ok" &&
    missingSteps.filter((s) => !s.includes("useproxy")).length === 0;

  return {
    meta: {
      oauthConnected: Boolean(metaConn),
      account: metaConn?.externalAccount ?? null,
      pageId,
      adkitVerify,
      adkitError,
    },
    google: { adloopLinked, adloopHealth, adloopError },
    research: {
      useproxyConfigured,
      useproxyHealth,
      useproxyError,
      url: process.env.USEPROXY_MCP_URL ?? "https://mcp.useproxy.dev/mcp",
    },
    readyForCampaign,
    missingSteps,
  };
}
