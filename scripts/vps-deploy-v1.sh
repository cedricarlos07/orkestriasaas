#!/bin/bash
set -euo pipefail
RELEASE="${RELEASE:-/opt/openship/releases/dep_Bl3oJdH3Ri7AmtCv}"
COMMIT="${COMMIT:-538f6613e8e4b17f10d5f8d3548e66d525e12942}"
PORT="${PORT:-3016}"

cd "$RELEASE"
git reset --hard
git clean -fd
git fetch origin orkestria-mcp
git checkout "$COMMIT"

PID="$(ss -tlnp | grep ":${PORT}" | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)"
if [ -n "${PID:-}" ] && [ -r "/proc/$PID/environ" ]; then
  tr '\0' '\n' < "/proc/$PID/environ" > /tmp/orkestria.env.raw
  grep -E '^(PORT|NODE_ENV|DATABASE_URL|BETTER_AUTH_|TOKEN_ENCRYPTION_KEY|MCP_WRITE_ENABLED|LLM_|DEEPSEEK_|META_APP_ID|META_APP_SECRET|META_API_VERSION|ADLOOP_MCP_|ADLOOP_CONFIG|USEPROXY_MCP_URL|ADKIT_MCP_COMMAND|ADVERTISER_URL)=' \
    /tmp/orkestria.env.raw > /tmp/orkestria.env || true
fi

if [ ! -s /tmp/orkestria.env ]; then
  cat > /tmp/orkestria.env <<'EOF'
PORT=3016
NODE_ENV=production
DATABASE_URL=postgresql://openship:openship@127.0.0.1:5433/orkestria
BETTER_AUTH_URL=https://orkestria.top
MCP_WRITE_ENABLED=true
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
ADLOOP_MCP_COMMAND=python3
ADLOOP_MCP_ARGS=-m adloop
USEPROXY_MCP_URL=https://mcp.useproxy.dev/mcp
ADKIT_MCP_COMMAND=adkit-mcp
META_APP_ID=
META_APP_SECRET=
META_API_VERSION=v21.0
ADVERTISER_URL=https://orkestria.top
EOF
fi

npm install --include=dev
bash scripts/deploy-ensure-adkit.sh || true
npm run build

set -a
# shellcheck disable=SC1091
source /tmp/orkestria.env
set +a
npx drizzle-kit push --force

UNIT="/etc/systemd/system/openship-dep_Bl3oJdH3Ri7AmtCv.service"
if [ -f "$UNIT" ] && [ -n "${META_APP_ID:-}" ] && [ -n "${META_APP_SECRET:-}" ]; then
  grep -v -E '^Environment=(META_APP_ID|META_APP_SECRET|META_API_VERSION)=' "$UNIT" > "${UNIT}.tmp"
  mv "${UNIT}.tmp" "$UNIT"
  awk -v id="$META_APP_ID" -v secret="$META_APP_SECRET" -v ver="${META_API_VERSION:-v21.0}" '
    { print }
    /Environment=TOKEN_ENCRYPTION_KEY=/ {
      print "Environment=META_APP_ID=" id
      print "Environment=META_APP_SECRET=" secret
      print "Environment=META_API_VERSION=" ver
    }
  ' "$UNIT" > "${UNIT}.new" && mv "${UNIT}.new" "$UNIT"
  systemctl daemon-reload
  systemctl restart openship-dep_Bl3oJdH3Ri7AmtCv.service
else
  fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
  sleep 1
  cd "$RELEASE"
  nohup /usr/local/bin/orkestria-prestart > /tmp/orkestria.start.log 2>&1 &
fi
sleep 8

if ! ss -tlnp | grep -q ":${PORT}"; then
  echo "START FAILED"
  tail -80 /tmp/orkestria.start.log || true
  exit 1
fi

curl -sS -o /dev/null -w "tools=%{http_code}\n" "http://127.0.0.1:${PORT}/api/mcp/tools"
git log -1 --oneline
echo "DEPLOY OK"
