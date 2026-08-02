export type CampaignBriefTurn = { role: "user" | "agent"; text: string };

export type CampaignBrief = {
  name?: string;
  dailyBudget?: number;
  objective?: "traffic" | "leads" | "sales" | "messages";
  channel?: "website" | "whatsapp" | "messenger";
  /** True when user said Messages without specifying WhatsApp vs Messenger */
  channelPending?: boolean;
  countries?: string[];
  cities?: string[];
  neighborhoods?: string[];
  geoScope?: "country_wide" | "city" | "pending";
  radiusKm?: number;
  deviceTargeting?: "mobile" | "all";
  linkUrl?: string;
  confirmCreate?: boolean;
  confirmActivate?: boolean;
};

export function metaCreateParams(brief: CampaignBrief): {
  objective: string;
  channel?: "website" | "whatsapp" | "messenger";
  label: string;
} {
  if (brief.objective === "messages" || brief.channel === "whatsapp" || brief.channel === "messenger") {
    const channel = brief.channel === "messenger" ? "messenger" : "whatsapp";
    return {
      objective: "OUTCOME_ENGAGEMENT",
      channel,
      label: channel === "messenger" ? "Messages · Messenger" : "Messages · WhatsApp",
    };
  }
  if (brief.objective === "leads") {
    return { objective: "OUTCOME_LEADS", channel: "website", label: "Prospects" };
  }
  if (brief.objective === "sales") {
    return { objective: "OUTCOME_SALES", channel: "website", label: "Ventes" };
  }
  return { objective: "OUTCOME_TRAFFIC", channel: "website", label: "Trafic" };
}

export function geoBriefResolved(brief: CampaignBrief): boolean {
  if (brief.geoScope === "country_wide") return true;
  if (!(brief.cities?.length || brief.neighborhoods?.length)) return false;
  return typeof brief.radiusKm === "number";
}

export function metaCampaignGeoArgs(brief: CampaignBrief): {
  countries?: string[];
  cities?: string[];
  neighborhoods?: string[];
  radiusKm?: number;
  geoScope?: "country_wide" | "city";
  deviceTargeting?: "mobile" | "all";
} {
  return {
    countries: brief.countries,
    cities: brief.cities,
    neighborhoods: brief.neighborhoods,
    radiusKm: brief.radiusKm,
    geoScope: brief.geoScope === "country_wide" ? "country_wide" : brief.geoScope === "city" ? "city" : undefined,
    deviceTargeting: brief.deviceTargeting,
  };
}

export function parseCampaignBrief(message: string, history?: CampaignBriefTurn[]): CampaignBrief {
  const blob = [...(history ?? []).map((h) => h.text), message].join("\n");
  const lower = blob.toLowerCase();
  const brief: CampaignBrief = {};

  const budget =
    blob.match(/(\d+[.,]?\d*)\s*(?:€|eur|usd|\$)?\s*(?:\/\s*j(?:our)?|par\s*jour|daily)/i) ||
    blob.match(/budget\s*(?:journalier|daily)?\s*[:=]?\s*(\d+[.,]?\d*)/i) ||
    blob.match(/\b(\d+[.,]?\d*)\s*(?:€|eur|usd|\$)\b/i);
  if (budget?.[1]) brief.dailyBudget = Number(budget[1].replace(",", "."));

  const hasWhatsApp = /whats?\s*app/i.test(lower);
  const hasMessenger = /messenger/i.test(lower);
  const hasMessages =
    /messages?\s*(ads|meta)?|click[\s-]?to[\s-]?(whatsapp|message)|conversations?\s+(whats|meta|messenger)|\bmessages?\b/i.test(
      lower,
    ) && !/wa\.me|api\.whatsapp|business\s+api|envoi\s+auto/i.test(lower);

  if (hasWhatsApp || hasMessenger || hasMessages) {
    brief.objective = "messages";
    if (hasWhatsApp && !hasMessenger) brief.channel = "whatsapp";
    else if (hasMessenger && !hasWhatsApp) brief.channel = "messenger";
    else if (hasWhatsApp && hasMessenger) brief.channel = "whatsapp";
    else brief.channelPending = true;
  } else if (/lead|prospect|formulaire/.test(lower)) brief.objective = "leads";
  else if (/achat|vente|purchase|conversion|catalogue/.test(lower)) brief.objective = "sales";
  else if (/trafic|traffic|visite|clics?/.test(lower)) brief.objective = "traffic";

  if (hasMessenger && brief.objective === "messages") brief.channel = "messenger";
  if (hasWhatsApp && brief.objective === "messages") brief.channel = "whatsapp";
  if (brief.channel) brief.channelPending = false;

  const countries: string[] = [];
  if (/\b(france|français|fr)\b/i.test(blob)) countries.push("FR");
  if (/\b(belgique|be)\b/i.test(blob)) countries.push("BE");
  if (/\b(suisse|ch)\b/i.test(blob)) countries.push("CH");
  if (/\b(canada|ca)\b/i.test(blob)) countries.push("CA");
  if (/\b(usa|états-unis|etats-unis|us)\b/i.test(blob)) countries.push("US");
  if (
    /\b(côte\s*d['']?ivoire|cote\s*d['']?ivoire|ivory\s*coast|\bci\b|abidjan|yamoussoukro)\b/i.test(blob)
  ) {
    countries.push("CI");
  }
  if (/\b(sénégal|senegal|\bsn\b|dakar)\b/i.test(blob)) countries.push("SN");
  if (/\b(maroc|\bma\b|casablanca|rabat)\b/i.test(blob)) countries.push("MA");
  if (countries.length) brief.countries = [...new Set(countries)];

  if (/ciblage\s+pays\s+entier|tout\s+le\s+pays|pays\s+entier/i.test(lower)) {
    brief.geoScope = "country_wide";
  }
  const ville = blob.match(/\bville\s+([A-Za-zÀ-ÿ'’-]+(?:\s+[A-Za-zÀ-ÿ'’-]+)?)/i);
  const quartier = blob.match(/\bquartier\s+([A-Za-zÀ-ÿ'’-]+(?:\s+[A-Za-zÀ-ÿ'’-]+)?)/i);
  const knownCities = [
    "abidjan", "bouaké", "bouake", "yamoussoukro", "dakar", "thiès", "thies",
    "casablanca", "rabat", "marrakech", "paris", "lyon", "marseille", "bruxelles",
    "montréal", "montreal", "toronto",
  ];
  const knownQuarters = [
    "cocody", "plateau", "marcory", "yopougon", "treichville", "riviera", "zone 4", "angré", "angre",
  ];
  const cities: string[] = [];
  const neighborhoods: string[] = [];
  if (ville?.[1]) cities.push(ville[1].trim());
  if (quartier?.[1]) neighborhoods.push(quartier[1].trim());
  for (const c of knownCities) {
    if (new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(blob)) {
      cities.push(c.charAt(0).toUpperCase() + c.slice(1));
    }
  }
  for (const q of knownQuarters) {
    if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(blob)) {
      neighborhoods.push(q.charAt(0).toUpperCase() + q.slice(1));
    }
  }
  if (cities.length) {
    brief.cities = [...new Set(cities.map((c) => c.replace(/\s+/g, " ").trim()))];
    brief.geoScope = brief.geoScope === "country_wide" ? "country_wide" : "city";
  }
  if (neighborhoods.length) {
    brief.neighborhoods = [...new Set(neighborhoods)];
    brief.geoScope = brief.geoScope === "country_wide" ? "country_wide" : "city";
  }

  const radius = blob.match(/rayon\s*(\d+)\s*km/i) || blob.match(/(\d+)\s*km\s*(?:autour|radius)?/i);
  if (/rayon\s+ville\s+enti[eè]re|sans\s+rayon|ville\s+enti[eè]re/i.test(lower)) {
    brief.radiusKm = 0;
  } else if (radius?.[1]) {
    brief.radiusKm = Number(radius[1]);
  }

  if (/ciblage\s+mobile\s+uniquement|mobile\s+uniquement|smartphones?\s+uniquement/i.test(lower)) {
    brief.deviceTargeting = "mobile";
  } else if (/ciblage\s+tous\s+appareils|mobile\s*\+\s*ordinateur|tous\s+appareils/i.test(lower)) {
    brief.deviceTargeting = "all";
  }

  const url = blob.match(/https?:\/\/[^\s)>\]]+/i);
  if (url?.[0]) brief.linkUrl = url[0].replace(/[.,;]+$/, "");

  const name = blob.match(/(?:campagne|campaign)\s+[«"]([^»"]+)[»"]/i);
  if (name?.[1]) brief.name = name[1].trim();

  brief.confirmCreate =
    /oui[,.]?\s*(crée|creer|crée[- ]la|lance|valide)|confirme\s+la\s+cr[eé]ation|crée\s+en\s+pause|go\s+pause/i.test(
      message,
    );
  brief.confirmActivate =
    /oui[,.]?\s*active|active\s+(la\s+)?campagne|confirme\s+l['']activation|go\s+live|mets?\s+en\s+ligne/i.test(
      message,
    );

  return brief;
}
