import { Memory } from "@mastra/memory";
import { PostgresStore, PgVector } from "@mastra/pg";

const WORKING_MEMORY_TEMPLATE = `# Fiche client Orkestria (PME)

## Identité
- Marque / entreprise :
- Secteur :
- Pays / villes cibles :
- Langue :

## Offre
- Produit / service :
- Prix / panier moyen :
- URL principale :
- WhatsApp / contact :

## Objectifs pubs
- Objectif principal (trafic / leads / ventes) :
- Budget journalier max :
- CPA / CPL cible :
- Plateformes (Meta / Google) :

## Comptes connectés
- Meta ad account :
- Page Facebook :
- Google Ads customer id :

## Préférences
- Ton de communication :
- Contraintes (pas de spend sans validation) :
- Notes :
`;

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL requis pour Mastra Memory / PostgresStore");
  return url;
}

let _storage: PostgresStore | null = null;
let _vector: PgVector | null = null;
let _memory: Memory | null = null;

export function getMastraStorage(): PostgresStore {
  if (!_storage) {
    _storage = new PostgresStore({
      id: "orkestria-mastra",
      connectionString: databaseUrl(),
    });
  }
  return _storage;
}

export function getMastraVector(): PgVector {
  if (!_vector) {
    _vector = new PgVector({
      id: "orkestria-mastra-vector",
      connectionString: databaseUrl(),
    });
  }
  return _vector;
}

function hasEmbedderKey(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim(),
  );
}

/** Full-power Mastra Memory: Observational + Working (org) + Semantic Recall when embedder available. */
export function createOrkestriaMemory(): Memory {
  if (_memory) return _memory;

  const storage = getMastraStorage();
  const semantic = hasEmbedderKey();

  // Prefer Gemini embedder when GEMINI_API_KEY is set (common in this stack); else OpenAI.
  const embedder = process.env.OPENAI_API_KEY?.trim()
    ? "openai/text-embedding-3-small"
    : process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
      ? "google/text-embedding-004"
      : undefined;

  if (process.env.GEMINI_API_KEY?.trim() && !process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY.trim();
  }

  _memory = new Memory({
    storage,
    vector: semantic ? getMastraVector() : undefined,
    embedder: semantic && embedder ? embedder : undefined,
    options: {
      observationalMemory: true,
      lastMessages: 20,
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: WORKING_MEMORY_TEMPLATE,
      },
      semanticRecall: semantic
        ? { topK: 5, messageRange: 2, scope: "resource" }
        : false,
      generateTitle: true,
    },
  });

  return _memory;
}
