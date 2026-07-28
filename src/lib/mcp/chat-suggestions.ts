/** Clickable reply chips for Orkestria chat (AI-suggested answers). */

export type ChatSuggestion = { label: string; value: string };

type BriefLike = {
  objective?: "traffic" | "leads" | "sales" | "messages";
  channel?: "website" | "whatsapp" | "messenger";
  channelPending?: boolean;
  dailyBudget?: number;
  countries?: string[];
  /** Human city names e.g. Abidjan */
  cities?: string[];
  /** Neighborhood / zone labels */
  neighborhoods?: string[];
  /** country_wide = skip city; city = city set; pending = need precision */
  geoScope?: "country_wide" | "city" | "pending";
  radiusKm?: number;
  /** mobile = smartphones only (default for CI/SN local) */
  deviceTargeting?: "mobile" | "all";
  confirmCreate?: boolean;
};

const MOBILE_FIRST_COUNTRIES = new Set(["CI", "SN", "MA", "BJ", "TG", "BF", "ML", "GN", "CM"]);

function geoResolved(brief: BriefLike): boolean {
  if (brief.geoScope === "country_wide") return true;
  if (!(brief.cities?.length || brief.neighborhoods?.length)) return false;
  return typeof brief.radiusKm === "number";
}

const CITIES_BY_COUNTRY: Record<string, { label: string; value: string }[]> = {
  CI: [
    { label: "Abidjan (agglo)", value: "ville Abidjan" },
    { label: "Abidjan · Cocody", value: "quartier Cocody Abidjan" },
    { label: "Abidjan · Plateau", value: "quartier Plateau Abidjan" },
    { label: "Abidjan · Marcory", value: "quartier Marcory Abidjan" },
    { label: "Abidjan · Yopougon", value: "quartier Yopougon Abidjan" },
    { label: "Bouaké", value: "ville Bouaké" },
    { label: "Tout le pays (CI)", value: "ciblage pays entier" },
  ],
  SN: [
    { label: "Dakar", value: "ville Dakar" },
    { label: "Dakar · Plateau", value: "quartier Plateau Dakar" },
    { label: "Thiès", value: "ville Thiès" },
    { label: "Tout le pays (SN)", value: "ciblage pays entier" },
  ],
  MA: [
    { label: "Casablanca", value: "ville Casablanca" },
    { label: "Rabat", value: "ville Rabat" },
    { label: "Marrakech", value: "ville Marrakech" },
    { label: "Tout le pays (MA)", value: "ciblage pays entier" },
  ],
  FR: [
    { label: "Paris", value: "ville Paris" },
    { label: "Lyon", value: "ville Lyon" },
    { label: "Marseille", value: "ville Marseille" },
    { label: "Tout le pays (FR)", value: "ciblage pays entier" },
  ],
  BE: [
    { label: "Bruxelles", value: "ville Bruxelles" },
    { label: "Liège", value: "ville Liège" },
    { label: "Tout le pays (BE)", value: "ciblage pays entier" },
  ],
  CA: [
    { label: "Montréal", value: "ville Montréal" },
    { label: "Toronto", value: "ville Toronto" },
    { label: "Tout le pays (CA)", value: "ciblage pays entier" },
  ],
};

/** Next guided choices for a campaign brief — ChatGPT-style buttons. */
export function campaignNextSuggestions(brief: BriefLike): ChatSuggestion[] {
  if (brief.confirmCreate) return [];

  if (!brief.objective) {
    return [
      { label: "Trafic", value: "objectif trafic" },
      { label: "Prospects", value: "objectif prospects" },
      { label: "Ventes", value: "objectif ventes" },
      { label: "Messages WhatsApp", value: "objectif Messages WhatsApp" },
      { label: "Messages Messenger", value: "objectif Messages Messenger" },
    ];
  }

  if (brief.objective === "messages" && (brief.channelPending || !brief.channel)) {
    return [
      {
        label: "WhatsApp — vos clients vous écrivent sur WhatsApp",
        value: "canal WhatsApp",
      },
      {
        label: "Messenger — vos clients vous écrivent sur Messenger",
        value: "canal Messenger",
      },
    ];
  }

  if (!brief.countries?.length) {
    return [
      { label: "Côte d'Ivoire", value: "pays Côte d'Ivoire" },
      { label: "France", value: "pays France" },
      { label: "Sénégal", value: "pays Sénégal" },
      { label: "Maroc", value: "pays Maroc" },
      { label: "Belgique", value: "pays Belgique" },
      { label: "Canada", value: "pays Canada" },
      {
        label: "Autre · je décris pays + ville",
        value: "pays ",
      },
    ];
  }

  // Precise geo — media buyer default for local / messaging
  const needsCity =
    brief.geoScope !== "country_wide" &&
    !(brief.cities?.length || brief.neighborhoods?.length);
  if (needsCity) {
    const primary = brief.countries[0]!;
    const cities = CITIES_BY_COUNTRY[primary] ?? [
      { label: "Tout le pays", value: "ciblage pays entier" },
    ];
    return [
      ...cities,
      {
        label: "Je décris ma zone (ville / quartier)",
        value: "ville ",
      },
    ];
  }

  // Radius when we have a city/quartier (local delivery / services)
  if (
    (brief.cities?.length || brief.neighborhoods?.length) &&
    brief.geoScope !== "country_wide" &&
    brief.radiusKm === undefined
  ) {
    return [
      { label: "Rayon 10 km", value: "rayon 10 km" },
      { label: "Rayon 15 km", value: "rayon 15 km" },
      { label: "Rayon 25 km", value: "rayon 25 km" },
      { label: "Toute la ville (sans rayon)", value: "rayon ville entière" },
      { label: "Autre rayon…", value: "rayon " },
    ];
  }

  // Device — mobile-first markets + local geo
  if (geoResolved(brief) && !brief.deviceTargeting) {
    const primary = brief.countries?.[0];
    const mobileDefault =
      (primary && MOBILE_FIRST_COUNTRIES.has(primary)) ||
      Boolean(brief.cities?.length || brief.neighborhoods?.length);
    if (mobileDefault) {
      return [
        { label: "Mobile uniquement (recommandé)", value: "ciblage mobile uniquement" },
        { label: "Mobile + ordinateur", value: "ciblage tous appareils" },
      ];
    }
    return [
      { label: "Tous appareils", value: "ciblage tous appareils" },
      { label: "Mobile uniquement", value: "ciblage mobile uniquement" },
    ];
  }

  if (!(typeof brief.dailyBudget === "number" && brief.dailyBudget > 0)) {
    return [
      { label: "10 / jour", value: "budget 10/j" },
      { label: "15 / jour", value: "budget 15/j" },
      { label: "25 / jour", value: "budget 25/j" },
      { label: "50 / jour", value: "budget 50/j" },
    ];
  }

  return [{ label: "Oui, crée en pause", value: "oui crée en pause" }];
}

/**
 * Parse arrow / numbered options from model text into chips,
 * e.g. "→ **WhatsApp** (...)" or "1. Trafic".
 */
export function extractSuggestionsFromReply(text: string): {
  cleanText: string;
  suggestions: ChatSuggestion[];
} {
  const suggestions: ChatSuggestion[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const keep: string[] = [];

  for (const line of lines) {
    const arrow = line.match(
      /^\s*(?:→|->|•|-)\s*\*?\*?([^*\n(]+?)\*?\*?\s*(?:\(([^)]*)\))?\s*$/u,
    );
    const numbered = line.match(/^\s*(\d+)[.)]\s+\*?\*?([^*\n]+?)\*?\*?\s*$/u);
    if (arrow) {
      const label = [arrow[1].trim(), arrow[2]?.trim()].filter(Boolean).join(" — ");
      const value = arrow[1].trim();
      if (value.length > 1 && value.length < 80) {
        suggestions.push({ label, value });
        continue;
      }
    }
    if (numbered) {
      const value = numbered[2].trim();
      if (value.length > 1 && value.length < 80) {
        suggestions.push({ label: value, value });
        continue;
      }
    }
    keep.push(line);
  }

  const seen = new Set<string>();
  const unique = suggestions.filter((s) => {
    const k = s.value.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    cleanText: unique.length ? keep.join("\n").replace(/\n{3,}/g, "\n\n").trim() : text.trim(),
    suggestions: unique,
  };
}

export function mergeSuggestions(
  primary: ChatSuggestion[] | undefined,
  fallback: ChatSuggestion[],
): ChatSuggestion[] | undefined {
  if (primary?.length) return primary;
  if (fallback.length) return fallback;
  return undefined;
}
