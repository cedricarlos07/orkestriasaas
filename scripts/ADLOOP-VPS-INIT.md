# AdLoop self-hosted on VPS — checklist

Run once when you have Google credentials (GCP OAuth, Ads developer token, MCC).

## 1. Install (server)

```bash
bash scripts/ensure-adloop-server.sh
# or: pip3 install --break-system-packages adloop
```

## 2. Wizard (interactive — OAuth)

```bash
adloop init
```

On a headless VPS, the wizard prints an OAuth URL — open it in your browser, sign in, paste the code if prompted.

Config is written to `~/.adloop/config.yaml`.

## 3. Orkestria env (Openship / `.env.production.local`)

```env
ADLOOP_MCP_COMMAND=python3
ADLOOP_MCP_ARGS=-m adloop
ADLOOP_CONFIG=/root/.adloop/config.yaml
```

Remove legacy Cloud vars if present: `ADLOOP_MCP_URL`, `ADLOOP_API_KEY`.

Sync: `node scripts/sync-prod-env-to-openship.mjs`

## 4. Smoke

```bash
python3 -c "import subprocess; ..."  # or from Orkestria after deploy:
# validate_setup → AdLoop Google : ok
# Connexions UI → "AdLoop self-hosted OK"
```

## 5. Optional per-client targeting

Connect **Google Ads OAuth** in Connexions to pass a specific `customer_id` under your MCC. Without OAuth, AdLoop uses the default account from `config.yaml`.

Reference: https://docs.getadloop.com/quickstart/self-hosted
