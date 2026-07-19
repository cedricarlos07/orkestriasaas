import type { TokenPayload } from "@/lib/crypto/tokens";
import { fetchGoogleAdsSnapshot } from "@/lib/platforms/google-ads-api";
import { fetchGa4Snapshot } from "@/lib/platforms/ga4-api";
import { fetchMetaAdsSnapshot } from "@/lib/platforms/meta-api";
import { fetchTikTokAdsSnapshot } from "@/lib/platforms/tiktok-api";
import type { UnifiedAccountSnapshot } from "@/lib/unified-ad-schema";
import type { MCPServerId } from "@/lib/unified-ad-schema";

export type MCPClientContext = {
  server: MCPServerId;
  connectionId: string;
  tokens: TokenPayload;
  period?: string;
};

export type MCPClientResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
  latencyMs: number;
};

export async function invokeMcpHttp(
  url: string,
  tool: string,
  params: Record<string, unknown>,
  tokens: TokenPayload,
): Promise<MCPClientResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: tool, arguments: params },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      error?: { message?: string };
      result?: unknown;
    };
    if (data.error) throw new Error(data.error.message ?? "MCP tool call failed");
    return { ok: true, data: data.result, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "MCP call failed",
      latencyMs: Date.now() - start,
    };
  }
}

export async function readAccountSnapshot(
  ctx: MCPClientContext,
  mcpUrl: string | undefined,
  tool: string,
): Promise<{ snapshot: UnifiedAccountSnapshot; raw?: unknown; fromMcp: boolean }> {
  if (mcpUrl) {
    const res = await invokeMcpHttp(mcpUrl, tool, { period: ctx.period ?? "LAST_30_DAYS" }, ctx.tokens);
    if (!res.ok) throw new Error(res.error ?? "Échec appel MCP");
    const snapshot = parseMcpResultToSnapshot(ctx, res.data);
    return { snapshot, raw: res.data, fromMcp: true };
  }

  if (!ctx.tokens.accountId) {
    throw new Error(
      `Compte publicitaire non sélectionné pour ${ctx.server}. Reconnectez la plateforme ou choisissez un compte.`,
    );
  }

  const period = ctx.period ?? "30 derniers jours";
  const snapshot = await fetchPlatformSnapshot(ctx.server, ctx.tokens, period);
  return { snapshot, fromMcp: false };
}

async function fetchPlatformSnapshot(
  server: MCPServerId,
  tokens: TokenPayload,
  period: string,
): Promise<UnifiedAccountSnapshot> {
  const accountId = tokens.accountId!;

  switch (server) {
    case "google_ads_read":
    case "google_ads_write":
      return fetchGoogleAdsSnapshot(tokens.accessToken, accountId, period);
    case "meta_ads":
      return fetchMetaAdsSnapshot(tokens.accessToken, accountId, period);
    case "tiktok_ads":
      return fetchTikTokAdsSnapshot(tokens.accessToken, accountId, period);
    case "ga4":
      return fetchGa4Snapshot(tokens.accessToken, accountId, period);
    default:
      throw new Error(`Serveur MCP inconnu : ${server}`);
  }
}

function parseMcpResultToSnapshot(ctx: MCPClientContext, data: unknown): UnifiedAccountSnapshot {
  if (typeof data === "object" && data !== null && "structuredContent" in data) {
    const sc = (data as { structuredContent?: UnifiedAccountSnapshot }).structuredContent;
    if (sc?.platform) return sc;
  }
  if (typeof data === "object" && data !== null && "platform" in data) {
    return data as UnifiedAccountSnapshot;
  }
  throw new Error(`Réponse MCP ${ctx.server}/${ctx.server} non normalisable — vérifiez le serveur MCP`);
}

export async function executePlatformWrite(
  server: MCPServerId,
  tool: string,
  tokens: TokenPayload,
  params: Record<string, unknown>,
): Promise<void> {
  if (!tokens.accountId) throw new Error("Compte publicitaire requis pour l'écriture");

  if (server === "meta_ads" && tool === "pause_campaign") {
    const campaignId = String(params.campaignId ?? params.campaign_id ?? "");
    if (!campaignId) throw new Error("campaignId requis");
    const { pauseMetaCampaign } = await import("@/lib/platforms/meta-api");
    await pauseMetaCampaign(tokens.accessToken, campaignId);
    return;
  }

  if (server === "google_ads_write" && tool === "update_budget") {
    const campaignId = String(params.campaignId ?? params.campaign_id ?? "");
    const budgetMicros = Number(params.budgetMicros ?? params.budget_micros ?? 0);
    if (!campaignId || !budgetMicros) throw new Error("campaignId et budgetMicros requis");
    const { updateGoogleCampaignBudget } = await import("@/lib/platforms/google-ads-api");
    await updateGoogleCampaignBudget(tokens.accessToken, tokens.accountId, campaignId, budgetMicros);
    return;
  }

  throw new Error(`Action write non supportée : ${server}/${tool}`);
}
