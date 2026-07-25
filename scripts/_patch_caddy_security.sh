#!/bin/bash
# Adds security response headers to the orkestria.top Caddy site block.
# Idempotent: re-running replaces the managed header block.
set -euo pipefail

CADDYFILE=/etc/caddy/Caddyfile
BACKUP="/etc/caddy/Caddyfile.bak.$(date +%s)"

if grep -q "ORKESTRIA_SECURITY_HEADERS" "$CADDYFILE"; then
  echo "already patched — rewriting to pick up changes"
fi

cp "$CADDYFILE" "$BACKUP"
echo "backup: $BACKUP"

python3 - "$CADDYFILE" <<'PY'
import re, sys

path = sys.argv[1]
src = open(path, encoding="utf-8").read()

BLOCK = """
    # ORKESTRIA_SECURITY_HEADERS (managed by scripts/_patch_caddy_security.sh)
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(self)"
        Cross-Origin-Opener-Policy "same-origin"
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-src https://js.stripe.com https://hooks.stripe.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
        -Server
    }
"""

# Strip any previously managed block so the script stays idempotent.
src = re.sub(
    r"\n[ \t]*# ORKESTRIA_SECURITY_HEADERS.*?\n[ \t]*header \{.*?\n[ \t]*\}\n",
    "\n",
    src,
    flags=re.S,
)

marker = "https://orkestria.top, https://www.orkestria.top {"
if marker not in src:
    sys.exit("orkestria site block not found — aborting")

src = src.replace(marker, marker + BLOCK.rstrip("\n"), 1)
open(path, "w", encoding="utf-8").write(src)
print("patched")
PY

echo "=== validating ==="
caddy validate --config "$CADDYFILE" --adapter caddyfile

echo "=== reloading ==="
systemctl reload caddy
sleep 2
systemctl is-active caddy

echo "=== live headers ==="
curl -sI https://orkestria.top | grep -iE "strict-transport|x-frame|x-content-type|referrer-policy|content-security|permissions-policy" || echo "NO HEADERS SEEN"
