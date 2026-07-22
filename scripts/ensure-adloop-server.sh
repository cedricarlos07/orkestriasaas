#!/bin/bash
# One-time / manual AdLoop self-hosted install on the Openship VPS (run as root or deploy user).
# Do NOT hook this into npm build — use deploy-ensure-adkit.sh there instead.
set -euo pipefail

if python3 -m adloop --help >/dev/null 2>&1; then
  echo "adloop MCP: python3 -m adloop"
  exit 0
fi

if ! command -v pip3 >/dev/null 2>&1; then
  echo "pip3 required. Install python3-pip without touching openresty, then re-run."
  exit 1
fi

pip3 install --break-system-packages adloop || pip3 install --user adloop

if ! python3 -m adloop --help >/dev/null 2>&1; then
  echo "adloop install failed — check pip output above."
  exit 1
fi

echo "OK — adloop installed. Next (once per server):"
echo "  adloop init"
echo "  # headless: open the OAuth URL printed by the wizard in your browser"
echo "  # config → ~/.adloop/config.yaml (or set ADLOOP_CONFIG in Orkestria env)"
echo ""
echo "Orkestria env:"
echo "  ADLOOP_MCP_COMMAND=python3"
echo "  ADLOOP_MCP_ARGS=-m adloop"
echo "  ADLOOP_CONFIG=/root/.adloop/config.yaml"
