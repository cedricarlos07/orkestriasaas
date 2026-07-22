import { callAdkitMcpTool, probeAdkitMcp, type AdkitMcpEnv } from "@/lib/mcp/clients/adkit-mcp";
import type { MetaBrief } from "@/lib/mcp/meta-brief";

/** Build env for the upstream adkit-mcp subprocess (https://github.com/jatinjain25/adkit). */
export function buildAdkitEnv(opts: {
  accessToken: string;
  accountId: string;
  pageId?: string;
  allowSpend?: boolean;
}): AdkitMcpEnv {
  const act = opts.accountId.startsWith("act_")
    ? opts.accountId
    : `act_${opts.accountId.replace(/\D/g, "")}`;

  const env: AdkitMcpEnv = {
    META_ACCESS_TOKEN: opts.accessToken,
    META_AD_ACCOUNT_ID: act,
    META_API_VERSION: process.env.META_API_VERSION?.trim() || "v21.0",
    ADKIT_ALLOW_SPEND: opts.allowSpend ? "1" : "0",
    ADVERTISER_URL: process.env.ADVERTISER_URL?.trim() || "https://example.com",
  };

  if (opts.pageId?.trim()) env.META_PAGE_ID = opts.pageId.trim();
  if (process.env.META_APP_ID?.trim()) env.META_APP_ID = process.env.META_APP_ID.trim();
  if (process.env.META_APP_SECRET?.trim()) env.META_APP_SECRET = process.env.META_APP_SECRET.trim();
  if (process.env.META_INSTAGRAM_ACTOR_ID?.trim()) {
    env.META_INSTAGRAM_ACTOR_ID = process.env.META_INSTAGRAM_ACTOR_ID.trim();
  }
  if (process.env.GEMINI_API_KEY?.trim()) env.GEMINI_API_KEY = process.env.GEMINI_API_KEY.trim();

  return env;
}

/** Orkestria brief (USD) → adkit brief dict (minor units, snake_case). */
export function toAdkitBrief(
  brief: MetaBrief,
  opts?: { pageId?: string; accountId?: string },
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    campaign: {
      name: brief.campaign.name,
      objective: brief.campaign.objective ?? "OUTCOME_TRAFFIC",
      ...(brief.campaign.dailyBudget != null
        ? { daily_budget: Math.round(brief.campaign.dailyBudget * 100) }
        : {}),
    },
    adsets: brief.adsets.map((as) => ({
      name: as.name,
      daily_budget: Math.round(as.dailyBudget * 100),
      countries: as.countries?.length ? as.countries : ["US"],
      interest_ids: as.interestIds ?? [],
      ads: as.ads.map((ad) => ({
        name: ad.name,
        message: ad.message,
        headline: ad.headline,
        link: ad.link,
        cta: ad.cta ?? "LEARN_MORE",
        ...(ad.image || ad.imageUrl ? { image: ad.image ?? ad.imageUrl } : {}),
      })),
    })),
  };
  if (opts?.pageId) out.page = opts.pageId;
  if (opts?.accountId) {
    out.account = opts.accountId.startsWith("act_")
      ? opts.accountId
      : `act_${opts.accountId.replace(/\D/g, "")}`;
  }
  return out;
}

export async function adkitVerify(env: AdkitMcpEnv): Promise<Record<string, unknown>> {
  const res = await callAdkitMcpTool(env, "verify");
  if (!res.ok) throw new Error(res.error ?? "adkit verify failed");
  return (res.data as Record<string, unknown>) ?? {};
}

export async function adkitPlanBrief(env: AdkitMcpEnv, brief: MetaBrief, pageId?: string, accountId?: string) {
  const res = await callAdkitMcpTool(env, "plan_brief", {
    brief: toAdkitBrief(brief, { pageId, accountId }),
  });
  if (!res.ok) throw new Error(res.error ?? "adkit plan_brief failed");
  return res.data;
}

export async function adkitLaunchBrief(
  env: AdkitMcpEnv,
  brief: MetaBrief,
  opts: { go: boolean; pageId?: string; accountId?: string },
) {
  const res = await callAdkitMcpTool(
    env,
    "launch_brief",
    { brief: toAdkitBrief(brief, { pageId: opts.pageId, accountId: opts.accountId }), go: opts.go },
    opts.go ? 180_000 : 60_000,
  );
  if (!res.ok) throw new Error(res.error ?? "adkit launch_brief failed");
  return { ...(res.data as Record<string, unknown>), upstream: "adkit", latencyMs: res.latencyMs };
}

export async function adkitActivateAd(env: AdkitMcpEnv, adId: string) {
  const spendEnv = { ...env, ADKIT_ALLOW_SPEND: "1" };
  const res = await callAdkitMcpTool(spendEnv, "activate_ad", { ad_id: adId });
  if (!res.ok) throw new Error(res.error ?? "adkit activate_ad failed");
  return { ...(res.data as Record<string, unknown>), upstream: "adkit", status: "ACTIVE" };
}

export async function adkitPauseAd(env: AdkitMcpEnv, adId: string) {
  const res = await callAdkitMcpTool(env, "pause_ad", { ad_id: adId });
  if (!res.ok) throw new Error(res.error ?? "adkit pause_ad failed");
  return { ...(res.data as Record<string, unknown>), upstream: "adkit", status: "PAUSED" };
}

export async function adkitSearchTargeting(env: AdkitMcpEnv, query: string, type = "adinterest") {
  const res = await callAdkitMcpTool(env, "search_targeting", { query, type });
  if (!res.ok) throw new Error(res.error ?? "adkit search_targeting failed");
  return res.data;
}

export async function adkitOptimizeReport(
  env: AdkitMcpEnv,
  params: Record<string, unknown> = {},
) {
  const res = await callAdkitMcpTool(env, "optimize_report", params, 90_000);
  if (!res.ok) throw new Error(res.error ?? "adkit optimize_report failed");
  return res.data;
}

export { probeAdkitMcp };
