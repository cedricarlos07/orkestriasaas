# Orkestria — conventions agents

## Produit

SaaS multi-tenant Meta + Google Ads (TanStack Start, Mastra, Drizzle, better-auth).
Autres régies = **Bientôt**. Jamais mentionner Pipeboard / AdLoop / AdKit aux utilisateurs.

## Couches d'exécution ads

1. Chat / API → `src/lib/mcp/orchestrator.ts` (intents) + handlers `src/lib/agent/handlers/*` + Mastra
2. Tools → `src/lib/tools/{core,launch,optimize,create,measure,govern}.ts` (via `@/lib/mcp/agent-tools`)
3. Policy → `src/lib/mcp/policy-engine.ts` (`runWriteAction` unique)
4. Router → `src/lib/mcp/execution-router.ts` (gate Bientôt + adapter)
5. Adapters → `src/lib/platforms/adapter.ts` → `meta-api.ts` / `google-ads-api.ts`

## Dossiers clés

| Path | Rôle |
|------|------|
| `src/functions/` | Server functions TanStack (`setup.ts` barrel) |
| `src/lib/agent/` | Brief parser, intent, handlers campagne/audit/boost |
| `src/lib/tools/` | Catalogue tools MCP par familles |
| `src/components/orkestria/` | UI chat (wizard, reply, guided) |
| `src/lib/ads-core/` | Skills Hub (prompt only, pas d'API ads) |
| `src/mastra/` | Agent Mastra + memory |
| `src/db/schema/` | Drizzle (`auth` / `app` / `admin` / `mcp`) |

## Setup readiness

Utiliser `readyForMeta` / `readyForGoogle` — pas d'alias legacy.

## Critères plateforme propre

- Aucune string produit `pipeboard|adloop|adkit` dans `src/`
- Write stack unique : tool → policy → adapter → API
- Fichiers métier < ~600 lignes hors générés
- Smoke = Meta OAuth + Google developer token
- Un runtime agent (Mastra) + un system prompt source of truth

## Deploy

Voir `scripts/README.md`. Hot-deploy ne doit plus injecter de token Pipeboard.
