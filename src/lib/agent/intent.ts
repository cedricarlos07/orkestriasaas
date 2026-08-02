export function detectIntent(
  message: string,
): "audit" | "report" | "campaign" | "research" | "setup" | "boost" | "general" {
  const t = message.toLowerCase();
  if (/config|configuration|setup|validate|vérifier|verifier|prêt|pret|\bv1\b/.test(t)) return "setup";
  if (/concurrent|competitor|ad library|spy|espion|benchmark/.test(t)) return "research";
  if (
    /boost|sponsoris|promouvoir\s+(le\s+|un\s+|ce\s+)?post|post\s+(à\s+)?(booster|sponsoriser)|utiliser\s+(un\s+)?post/.test(
      t,
    )
  ) {
    return "boost";
  }
  // Rapport before audit — "rapport ... 30 jours" must stay a report
  if (/rapport|report|hebdo|dirigeant/.test(t)) return "report";
  if (/audit|analys|diagnostic|bilan|problème|performance|résultat/.test(t)) return "audit";
  if (
    /campagne|lancer\s+(une\s+)?(pub|campagne)|créer\s+(une\s+)?(pub|campagne)|launch|activer\s+la\s+campagne|lancement de campagne|nouveau menu|whats?\s*app|messenger|messages?\s+ads|click[\s-]?to[\s-]?(whatsapp|message)/.test(
      t,
    )
  ) {
    return "campaign";
  }
  return "general";
}

export function extractPeriod(message: string): string {
  const t = message.toLowerCase();
  if (/7\s*jours|cette semaine|semaine dernière/.test(t)) return "7 derniers jours";
  if (/90\s*jours|3\s*mois/.test(t)) return "90 derniers jours";
  if (/mois en cours|ce mois|30\s*jours/.test(t)) return "30 derniers jours";
  if (/semaine/.test(t)) return "7 derniers jours";
  return "30 derniers jours";
}

export function extractBrandFromMessage(message: string): string | null {
  const quoted = message.match(/["«]([^"»]+)["»]/);
  if (quoted?.[1]) return quoted[1].trim();
  const m = message.match(/(?:concurrent|marque|brand)\s+(\w[\w\s-]{1,40})/i);
  return m?.[1]?.trim() ?? null;
}
