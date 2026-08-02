/**
 * Ads execution — proprietary Orkestria only (Meta Graph + Google Ads API).
 * Pipeboard has been removed.
 */

export type AdsBackend = "orkestria";

export function getAdsBackend(): AdsBackend {
  return "orkestria";
}

/** Always true — Meta via Graph API + org OAuth. */
export function useOrkestriaMetaBackend(): boolean {
  return true;
}

/** Always true — Google via Ads API + org OAuth. */
export function useOrkestriaGoogleBackend(): boolean {
  return true;
}
