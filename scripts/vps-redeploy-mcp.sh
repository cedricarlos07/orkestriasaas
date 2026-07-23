#!/bin/bash
set -euo pipefail
cd /opt/openship/releases/dep_Bl3oJdH3Ri7AmtCv

PID=$(ss -tlnp | grep ':3016' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)
if [ -z "${PID:-}" ]; then
  echo "No process on 3016 — abort (need env from running process)"
  exit 1
fi
echo "using pid=$PID"
tr '\0' '\n' < "/proc/$PID/environ" > /tmp/orkestria.env.raw

set -a
source <(grep -E '^(PORT|NODE_ENV|DATABASE_URL|BETTER_AUTH_URL|BETTER_AUTH_SECRET|TOKEN_ENCRYPTION_KEY|MCP_WRITE_ENABLED|LLM_|DEEPSEEK_)=' /tmp/orkestria.env.raw)
set +a
export PORT="${PORT:-3016}"
export NODE_ENV="${NODE_ENV:-production}"
echo "PORT=$PORT NODE_ENV=$NODE_ENV"

echo "=== npm install ==="
npm install --include=dev

echo "=== build ==="
npm run build

echo "=== drizzle ==="
npx drizzle-kit push --force || true

echo "=== restart ==="
fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
sleep 1
nohup /usr/local/bin/orkestria-prestart > /tmp/orkestria.start.log 2>&1 &
sleep 5

if ! ss -tlnp | grep -q ":${PORT}"; then
  echo "FAIL start"
  tail -80 /tmp/orkestria.start.log || true
  exit 1
fi

echo "=== health ==="
curl -sS "http://127.0.0.1:${PORT}/api/mcp"
echo
curl -sS "http://127.0.0.1:${PORT}/api/mcp/tools" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("tools", len(d.get("tools",[]))); print([t["name"] for t in d.get("tools",[]) if t["name"] in ("execute","create_ad_set","add_keywords","upload_creative")])'
echo DONE
