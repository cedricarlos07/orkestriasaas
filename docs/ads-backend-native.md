# Ads backend — Orkestria native (Meta + Google)

Pipeboard / AdLoop / AdKit ont été **retirés**. Exécution uniquement via :

- Meta Marketing API (Graph) + tokens org OAuth
- Google Ads API + tokens org OAuth

TikTok / Snap / Reddit / LinkedIn / … → **Bientôt** (pas de write).

## Prérequis

```
META_APP_ID=
META_APP_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=   # si MCC
```

## Fichiers clés

- `src/lib/mcp/execution-router.ts` — Meta + Google only (via adapters)
- `src/lib/platforms/meta-api.ts` / `google-ads-api.ts`
- `src/lib/platforms/adapter.ts` — dispatch unique
- `src/lib/mcp/policy-engine.ts` — dry_run → approve → live
- `src/lib/ads-core/backend.ts` — toujours `orkestria`

## Critères propres

Voir `AGENTS.md`.
