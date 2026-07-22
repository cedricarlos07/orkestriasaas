#!/bin/bash
# Ensures adkit-mcp is on PATH for Orkestria Meta writes (Openship bare runtime).
set -euo pipefail
if command -v adkit-mcp >/dev/null 2>&1; then
  echo "adkit-mcp already installed: $(command -v adkit-mcp)"
  exit 0
fi
if ! command -v pip3 >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y -qq python3 python3-pip
  else
    echo "pip3 missing and apt-get unavailable — install meta-adkit[mcp] manually"
    exit 0
  fi
fi
pip3 install --break-system-packages "meta-adkit[mcp]" || pip3 install "meta-adkit[mcp]"
command -v adkit-mcp
