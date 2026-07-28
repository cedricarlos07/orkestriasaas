/** Clickable reply chips for Orkestria chat (AI-suggested answers). */

export type ChatSuggestion = { label: string; value: string };

type BriefLike = {
  objective?: "traffic" | "leads" | "sales" | "messages";
  channel?: "website" | "whatsapp" | "messenger";
  channelPending?: boolean;
  dailyBudget?: number;
  countries?: string[];
  confirmCreate?: boolean;
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
      { label: "France", value: "pays France" },
      { label: "Côte d'Ivoire", value: "pays Côte d'Ivoire" },
      { label: "Sénégal", value: "pays Sénégal" },
      { label: "Maroc", value: "pays Maroc" },
      { label: "Belgique", value: "pays Belgique" },
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

  // Deduplicate
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
