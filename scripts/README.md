# Scripts Orkestria

## Garder (ops produit)

| Script | Rôle |
|--------|------|
| `smoke-v1-stack.mjs` | Vérifie Meta/Google/LLM env (pas Pipeboard) |
| `vps-deploy-v1.sh` | Deploy VPS release |
| `vps-redeploy-mcp.sh` | Redeploy MCP surface |
| `sync-prod-env-to-openship.mjs` | Sync secrets → Openship |
| `upload-openship.mjs` | Upload artefact |
| `stripe-sync-live.mjs` / `stripe-ensure-portal.mjs` | Stripe live |
| `migrate-drop-adloop-api-key.sql` | DROP colonne legacy |
| `migrate-meta-page-id.sql` | Migration Page Meta |
| `PENDING-PROD-SECRETS.env.example` | Checklist secrets |

## Préfixe `_`

Scripts `_*.py` / `_*.sh` / `_*.mjs` = **one-shot / diagnostic**. Ne pas les utiliser en prod. À archiver ou supprimer après usage.

## Interdit

- Toute dépendance `PIPEBOARD_*`, `ADLOOP_*`, `ADKIT_*`, `USEPROXY_*`
- Smoke qui exige des MCP Python tiers
