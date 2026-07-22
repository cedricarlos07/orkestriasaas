#!/bin/bash
# Best-effort MCP subprocess installs for Openship bare runtime.
# Never runs apt-get during deploy — that can break openresty (port 80) on the VPS.
set -uo pipefail

if command -v adkit-mcp >/dev/null 2>&1; then
  echo "adkit-mcp already installed: $(command -v adkit-mcp)"
else
  if command -v pip3 >/dev/null 2>&1; then
    if pip3 install --break-system-packages "meta-adkit[mcp]" 2>/dev/null \
      || pip3 install --user "meta-adkit[mcp]" 2>/dev/null; then
      command -v adkit-mcp >/dev/null 2>&1 && echo "adkit-mcp installed: $(command -v adkit-mcp)"
    else
      echo "WARN: meta-adkit install skipped/failed — Meta writes need adkit-mcp on PATH."
    fi
  else
    echo "WARN: pip3 missing — skip adkit during build."
  fi
fi

if python3 -m adloop --help >/dev/null 2>&1; then
  echo "adloop MCP already available: python3 -m adloop"
  exit 0
fi

if ! command -v pip3 >/dev/null 2>&1; then
  echo "WARN: pip3 missing — skip adloop during build. Run: pip3 install adloop && adloop init on the server once."
  exit 0
fi

if pip3 install --break-system-packages adloop 2>/dev/null \
  || pip3 install --user adloop 2>/dev/null; then
  if python3 -m adloop --help >/dev/null 2>&1; then
    echo "adloop installed — run adloop init once on the server for Google OAuth"
    exit 0
  fi
fi

echo "WARN: adloop install skipped/failed — Google via AdLoop needs: pip install adloop && adloop init"
exit 0
