export function explainMetric(metric: string, value: number, context?: string): string {
  const ctx = context ? ` ${context}` : "";
  switch (metric) {
    case "ctr":
      if (value < 1) return `Cette publicité attire moins de personnes qu'avant.${ctx}`;
      return `Votre publicité performe correctement en termes de clics.${ctx}`;
    case "cpa":
      return value > 15000
        ? `Chaque client vous coûte environ ${Math.round(value).toLocaleString("fr-FR")} FCFA — c'est élevé.${ctx}`
        : `Chaque client vous coûte environ ${Math.round(value).toLocaleString("fr-FR")} FCFA.${ctx}`;
    case "roas":
      return value < 1
        ? `Pour 1 FCFA dépensé, vous récupérez moins d'1 FCFA — la campagne perd de l'argent.${ctx}`
        : `Pour 1 FCFA dépensé, vous récupérez ${value.toFixed(1)} FCFA.${ctx}`;
    default:
      return `Indicateur ${metric} : ${value}.${ctx}`;
  }
}

export function explainTechnical(term: string): string {
  const map: Record<string, string> = {
    CTR: "Pourcentage de personnes qui cliquent après avoir vu votre publicité",
    ROAS: "Retour sur dépense publicitaire — combien vous gagnez pour chaque franc investi",
    CPA: "Coût pour obtenir un client ou une commande",
    GAQL: "Langage de requête Google Ads (visible uniquement en vue avancée)",
    "ad set": "Groupe de publicités ciblant une audience similaire",
  };
  return map[term] ?? term;
}
