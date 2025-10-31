#!/bin/bash
# Test script to capture IIWiki API logs for debugging Cloudflare issues
# Run this and share the output with the iiwiki admin

echo "=========================================="
echo "IIWiki API Test - Cloudflare Debugging"
echo "=========================================="
echo ""
echo "Server Information:"
echo "  IP Address: $(curl -s https://api.ipify.org)"
echo "  Date/Time: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo ""
echo "Testing direct access to iiwiki.com API..."
echo ""

# Test 1: Simple API query
echo "----------------------------------------"
echo "Test 1: Direct API Request"
echo "----------------------------------------"
echo "URL: https://iiwiki.com/mediawiki/api.php?action=query&format=json&meta=siteinfo"
echo "User-Agent: IxStats-Builder"
echo ""

curl -v -A "IxStats-Builder" \
  -H "Accept: application/json" \
  -H "Accept-Language: en-US,en;q=0.9" \
  "https://iiwiki.com/mediawiki/api.php?action=query&format=json&meta=siteinfo" \
  2>&1 | head -100

echo ""
echo ""

# Test 2: Search query (common use case)
echo "----------------------------------------"
echo "Test 2: Search Request"
echo "----------------------------------------"
echo "URL: https://iiwiki.com/mediawiki/api.php?action=query&list=search&srsearch=test"
echo "User-Agent: IxStats-Builder"
echo ""

curl -v -A "IxStats-Builder" \
  -H "Accept: application/json" \
  -H "Accept-Language: en-US,en;q=0.9" \
  "https://iiwiki.com/mediawiki/api.php?action=query&format=json&list=search&srsearch=test&srprop=snippet" \
  2>&1 | head -100

echo ""
echo ""
echo "=========================================="
echo "Summary for iiwiki Admin"
echo "=========================================="
echo ""
echo "The IxStats application is being blocked by Cloudflare when trying to access:"
echo "  - Path: /mediawiki/api.php"
echo "  - User-Agent: IxStats-Builder"
echo "  - Server IP: $(curl -s https://api.ipify.org)"
echo ""
echo "Expected Cloudflare Rule Configuration:"
echo "  Expression: (ip.src eq $(curl -s https://api.ipify.org) and http.request.uri.path contains \"/mediawiki/api.php\")"
echo "  Action: Skip"
echo "  Skip: All remaining custom rules, Rate limiting, Zone Lockdown, Security level"
echo ""
echo "Alternative (IP Whitelist):"
echo "  Go to Security > WAF > Tools > IP Access Rules"
echo "  IP: $(curl -s https://api.ipify.org)"
echo "  Action: Whitelist"
echo "  Zone: iiwiki.com"
echo ""
echo "=========================================="

