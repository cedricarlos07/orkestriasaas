/** Map a free-text zone / city string to ISO 3166-1 alpha-2 country codes for Meta geo. */
export function countriesFromZone(zone?: string | null): string[] {
  const raw = zone?.trim() ?? "";
  if (!raw) return ["US"];

  if (/^[A-Za-z]{2}$/.test(raw)) return [raw.toUpperCase()];

  const z = raw.toLowerCase();

  if (
    /côte.?d.?ivoire|cote.?d.?ivoire|\bci\b|abidjan|cocody|marcory|yopougon|plateau|bingerville|bouaké|bouake|san.?pedro|zone\s*4/.test(
      z,
    )
  ) {
    return ["CI"];
  }
  if (/sénégal|senegal|\bsn\b|dakar|thiès|thies/.test(z)) return ["SN"];
  if (/france|\bfr\b|paris|lyon|marseille|lille|bordeaux|toulouse|nantes/.test(z)) return ["FR"];
  if (/canada|\bca\b|montréal|montreal|toronto|vancouver|ottawa/.test(z)) return ["CA"];
  if (
    /usa|u\.s\.a|united states|\bus\b|new york|nyc|brooklyn|manhattan|los angeles|miami|chicago|houston|boston|atlanta/.test(
      z,
    )
  ) {
    return ["US"];
  }
  if (/uk|united kingdom|great britain|london|england|manchester/.test(z)) return ["GB"];
  if (/belgique|belgium|bruxelles|brussels/.test(z)) return ["BE"];
  if (/suisse|switzerland|genève|geneve|zurich/.test(z)) return ["CH"];
  if (/maroc|morocco|casablanca|rabat/.test(z)) return ["MA"];
  if (/tunisie|tunisia|tunis/.test(z)) return ["TN"];
  if (/cameroun|cameroon|douala|yaoundé|yaounde/.test(z)) return ["CM"];
  if (/ghana|accra/.test(z)) return ["GH"];
  if (/nigeria|lagos|abuja/.test(z)) return ["NG"];
  if (/kenya|nairobi/.test(z)) return ["KE"];
  if (/afrique du sud|south africa|johannesburg|cape town/.test(z)) return ["ZA"];

  return ["US"];
}
