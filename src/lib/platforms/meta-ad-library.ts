/**
 * Meta Ad Library via official Graph API `/ads_archive`.
 * Uses the org Meta OAuth token when available, else app token (APP_ID|APP_SECRET).
 *
 * Limits (Meta policy): political/issue worldwide; commercial ads mainly for EU/UK (DSA).
 * No ScrapeCreators / useproxy third party.
 */

function graphBase(): string {
  const v = (process.env.META_API_VERSION ?? "v21.0").replace(/^\/?/, "");
  return `https://graph.facebook.com/${v.startsWith("v") ? v : `v${v}`}`;
}

export function isMetaAdLibraryConfigured(): boolean {
  return Boolean(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim());
}

export function metaAppAccessToken(): string | undefined {
  const id = process.env.META_APP_ID?.trim();
  const secret = process.env.META_APP_SECRET?.trim();
  if (!id || !secret) return undefined;
  return `${id}|${secret}`;
}

export type MetaAdLibraryAd = {
  id: string;
  pageId?: string;
  pageName?: string;
  bodies?: string[];
  titles?: string[];
  snapshotUrl?: string;
  startDate?: string;
  platforms?: string[];
  status?: string;
};

export type MetaAdLibrarySearchResult = {
  brand: string;
  country: string;
  adType: string;
  count: number;
  ads: MetaAdLibraryAd[];
  warning?: string;
  upstream: "meta_ads_archive";
  rawError?: string;
};

async function graphGet(path: string, accessToken: string, params: Record<string, string>) {
  const url = new URL(`${graphBase()}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  const body = (await res.json()) as {
    data?: Record<string, unknown>[];
    error?: { message?: string; code?: number; error_user_msg?: string };
    paging?: unknown;
  };
  if (!res.ok || body.error) {
    const msg = body.error?.error_user_msg || body.error?.message || `Meta Graph HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

function mapAd(row: Record<string, unknown>): MetaAdLibraryAd {
  const pageId = row.page_id != null ? String(row.page_id) : undefined;
  const bodies = Array.isArray(row.ad_creative_bodies)
    ? (row.ad_creative_bodies as unknown[]).map(String)
    : undefined;
  const titles = Array.isArray(row.ad_creative_link_titles)
    ? (row.ad_creative_link_titles as unknown[]).map(String)
    : undefined;
  const platforms = Array.isArray(row.publisher_platforms)
    ? (row.publisher_platforms as unknown[]).map(String)
    : undefined;
  return {
    id: String(row.id ?? ""),
    pageId,
    pageName: row.page_name != null ? String(row.page_name) : undefined,
    bodies,
    titles,
    snapshotUrl: row.ad_snapshot_url != null ? String(row.ad_snapshot_url) : undefined,
    startDate: row.ad_delivery_start_time != null ? String(row.ad_delivery_start_time) : undefined,
    platforms,
    status: row.ad_delivery_stop_time ? "inactive" : "active",
  };
}

/**
 * Search Meta Ad Library for a brand / keyword.
 * @param country ISO-2 (default FR — better commercial coverage under DSA than US)
 */
export async function searchMetaAdLibrary(opts: {
  accessToken: string;
  brand: string;
  country?: string;
  limit?: number;
  adType?: "ALL" | "POLITICAL_AND_ISSUE_ADS";
}): Promise<MetaAdLibrarySearchResult> {
  const country = (opts.country || process.env.META_AD_LIBRARY_DEFAULT_COUNTRY || "FR").toUpperCase();
  const adType = opts.adType ?? "ALL";
  const fields = [
    "id",
    "ad_creative_bodies",
    "ad_creative_link_titles",
    "ad_snapshot_url",
    "page_id",
    "page_name",
    "publisher_platforms",
    "ad_delivery_start_time",
    "ad_delivery_stop_time",
  ].join(",");

  try {
    const body = await graphGet("/ads_archive", opts.accessToken, {
      search_terms: opts.brand,
      ad_reached_countries: JSON.stringify([country]),
      ad_type: adType,
      ad_active_status: "ACTIVE",
      fields,
      limit: String(Math.min(opts.limit ?? 25, 50)),
    });
    const ads = (body.data ?? []).map(mapAd);
    const warning =
      ads.length === 0
        ? `Aucune pub trouvée pour « ${opts.brand} » (${country}, ${adType}). L’API Meta Ad Library ne couvre les pubs commerciales que pour UE/UK ; hors UE ce sont surtout les pubs politiques/sociales. Ajoutez le produit « Ad Library API » dans votre app Meta si erreur d’accès.`
        : country === "US" || country === "CA"
          ? "Hors UE/UK, Meta renvoie surtout des pubs politiques/issues — pas le spy commercial complet du site Ad Library."
          : undefined;
    return {
      brand: opts.brand,
      country,
      adType,
      count: ads.length,
      ads,
      warning,
      upstream: "meta_ads_archive",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ads_archive failed";
    return {
      brand: opts.brand,
      country,
      adType,
      count: 0,
      ads: [],
      warning: msg,
      rawError: msg,
      upstream: "meta_ads_archive",
    };
  }
}

export async function researchCompetitorAdsViaMeta(opts: {
  accessToken: string;
  brand: string;
  brands?: string[];
  country?: string;
}): Promise<Record<string, unknown>> {
  const brands = opts.brands?.length ? opts.brands : [opts.brand];
  const results: MetaAdLibrarySearchResult[] = [];
  for (const brand of brands) {
    results.push(
      await searchMetaAdLibrary({
        accessToken: opts.accessToken,
        brand,
        country: opts.country,
      }),
    );
  }
  return {
    brands,
    country: opts.country ?? process.env.META_AD_LIBRARY_DEFAULT_COUNTRY ?? "FR",
    results,
    upstream: "meta_ads_archive",
    note: "Research via Meta Graph ads_archive (votre app Meta) — pas de tiers ScrapeCreators/useproxy.",
  };
}

export async function probeMetaAdLibraryHealth(accessToken?: string): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  const token = accessToken || metaAppAccessToken();
  if (!token) {
    return { ok: false, latencyMs: 0, error: "META_APP_ID / META_APP_SECRET manquants" };
  }
  const res = await searchMetaAdLibrary({
    accessToken: token,
    brand: "Nike",
    country: "FR",
    limit: 5,
  });
  const latencyMs = Date.now() - start;
  if (res.rawError) {
    const t = res.rawError.toLowerCase();
    if (t.includes("(#10)") || t.includes("permission") || t.includes("ads_archive")) {
      return {
        ok: false,
        latencyMs,
        error:
          "Ad Library API non activée sur l’app Meta — Developers → votre app → Ajouter le produit « Ad Library API »",
      };
    }
    return { ok: false, latencyMs, error: res.rawError };
  }
  // Empty results still means API works
  return { ok: true, latencyMs };
}
