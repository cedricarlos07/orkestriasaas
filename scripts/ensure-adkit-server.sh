#!/bin/bash
# One-time / manual adkit install on the Openship VPS (run as root or deploy user).
# Do NOT hook this into npm build — use deploy-ensure-adkit.sh there instead.
set -euo pipefail

if command -v adkit-mcp >/dev/null 2>&1; then
  echo "adkit-mcp: $(command -v adkit-mcp)"
  adkit-mcp --help >/dev/null 2>&1 || true
  exit 0
fi

if ! command -v pip3 >/dev/null 2>&1; then
  echo "pip3 required. Install python3-pip without touching openresty, then re-run."
  exit 1
fi

pip3 install --break-system-packages "meta-adkit[mcp]" || pip3 install --user "meta-adkit[mcp]"
command -v adkit-mcp
echo "OK — adkit-mcp ready for Orkestria Meta writes."
