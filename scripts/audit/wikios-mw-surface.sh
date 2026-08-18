#!/usr/bin/env bash
# Enumerate all MediaWiki HTTP endpoints WikiOS calls.
# Run before any Stage 3 nginx change to verify the allowlist is complete.

set -eo pipefail

echo "=== api.php actions ==="
grep -rn 'action=' src/lib/wiki-os/ src/server/api/routers/wikios/ 2>/dev/null \
  | grep -oE 'action=[a-zA-Z0-9_-]+' | sort | uniq -c | sort -rn || true

echo ""
echo "=== rest.php / Parsoid paths ==="
grep -rn 'rest\.php\|PARSOID_BASE' src/lib/wiki-os/ 2>/dev/null \
  | grep -oE '/[a-zA-Z0-9_/-]+' | sort -u || true

echo ""
echo "=== Env vars controlling MW URLs ==="
grep -rn 'WIKIOS_PARSOID_URL\|WIKIOS_MEDIAWIKI_API\|WIKIOS_MEDIAWIKI_BOT\|IXWIKI_LOCAL_PATH\|NEXT_PUBLIC_MEDIAWIKI_URL' src/ .env* 2>/dev/null \
  | grep -v node_modules | grep -v '.next/' || true

echo ""
echo "=== Browser-reachable asset paths (load.php, images, thumb.php) ==="
grep -rn 'load\.php\|/images/\|/thumb\.php\|Special:FilePath' src/lib/wiki-os/ src/components/wiki-os/ 2>/dev/null \
  | grep -v node_modules | head -20 || true
