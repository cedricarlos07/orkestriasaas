#!/bin/bash
# Best-effort adkit-mcp install for Openship bare runtime.
# Never runs apt-get during deploy — that can break openresty (port 80) on the VPS.
set -uo pipefail

if command -v adkit-mcp >/dev/null 2>&1; then
  echo "adkit-mcp already installed: $(command -v adkit-mcp)"
  exit 0
fi

if ! command -v pip3 >/dev/null 2>&1; then
  echo "WARN: pip3 missing — skip adkit during build. Run: pip3 install 'meta-adkit[mcp]' on the server once."
  exit 0
fi

if pip3 install --break-system-packages "meta-adkit[mcp]" 2>/dev/null \
  || pip3 install --user "meta-adkit[mcp]" 2>/dev/null; then
  if command -v adkit-mcp >/dev/null 2>&1; then
    echo "adkit-mcp installed: $(command -v adkit-mcp)"
    exit 0
  fi
  # --user installs may land outside PATH during build
  if [ -x "${HOME}/.local/bin/adkit-mcp" ]; then
    echo "adkit-mcp installed at ${HOME}/.local/bin/adkit-mcp"
    exit 0
  fi
fi

echo "WARN: meta-adkit install skipped/failed — Meta writes need adkit-mcp on the server PATH."
exit 0
