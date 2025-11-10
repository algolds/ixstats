# IIWiki API Integration Guide

## ⚠️ CRITICAL: iiwiki Cloudflare Protection

**iiwiki.com has Cloudflare protection that BLOCKS proxy requests but ALLOWS direct API access.**

### The Problem
- ❌ Proxy routes (e.g., `/api/iiwiki-proxy`) get **403 Forbidden** errors
- ❌ Requests without correct User-Agent get **403 Forbidden** errors
- ❌ Server-to-server proxying triggers Cloudflare challenge pages

### The Solution
✅ **ALWAYS** access iiwiki API directly
✅ **ALWAYS** use User-Agent: `"IxStats-Builder"` (exact string, no version numbers)
✅ **NEVER** use the iiwiki proxy routes

---

## Correct Configuration

### 1. Base URL
```typescript
// CORRECT ✅
const iiwikiUrl = "https://iiwiki.com/mediawiki/api.php";

// WRONG ❌ - Old URL, no longer works
const iiwikiUrl = "https://iiwiki.us/mediawiki/api.php";

// WRONG ❌ - Proxy gets blocked by Cloudflare
const iiwikiUrl = "/api/iiwiki-proxy/api.php";
```

### 2. User-Agent
```typescript
// CORRECT ✅ - Exact string that iiwiki allows
headers: {
  "User-Agent": "IxStats-Builder"
}

// WRONG ❌ - Version info causes 403
headers: {
  "User-Agent": "IxStats-Builder/1.0 (...)"
}

// WRONG ❌ - Different app name causes 403
headers: {
  "User-Agent": "IxStats-WikiImporter/1.0"
}
```

### 3. Request Headers (Full Example)
```typescript
const response = await fetch("https://iiwiki.com/mediawiki/api.php?action=query&...", {
  headers: {
    "User-Agent": "IxStats-Builder",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
  },
});
```

---

## Using Centralized Configuration

### Import from `mediawiki-config.ts`
```typescript
import { WIKI_SOURCES, getMediaWikiApiUrl, getWikiUserAgent } from "~/lib/mediawiki-config";

// Get iiwiki configuration
const iiwikiConfig = WIKI_SOURCES.iiwiki;
// {
//   name: "IIWiki",
//   baseUrl: "https://iiwiki.com",
//   apiEndpoint: "/mediawiki/api.php",
//   userAgent: "IxStats-Builder"
// }

// Get full API URL (automatically uses direct access for iiwiki)
const apiUrl = getMediaWikiApiUrl("iiwiki");
// Returns: "https://iiwiki.com/mediawiki/api.php"

// Get User-Agent
const userAgent = getWikiUserAgent("iiwiki");
// Returns: "IxStats-Builder"
```

### Making API Calls
```typescript
import { WIKI_SOURCES } from "~/lib/mediawiki-config";

async function fetchFromIIWiki(query: string) {
  const config = WIKI_SOURCES.iiwiki;
  const url = `${config.baseUrl}${config.apiEndpoint}?action=query&...`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": config.userAgent, // "IxStats-Builder"
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`iiwiki API error: ${response.status}`);
  }

  return await response.json();
}
```

---

## Files Updated for iiwiki Compatibility

### Core Configuration
- ✅ `/src/lib/mediawiki-config.ts` - Centralized wiki configuration
  - Updated User-Agent to `"IxStats-Builder"`
  - Fixed iiwiki URL to `"https://iiwiki.com"`
  - Added `getMediaWikiApiUrl()` with iiwiki direct access

### Services
- ✅ `/src/lib/wiki-search-service.ts` - Image search service
  - Changed to direct iiwiki access
  - Updated User-Agent to `"IxStats-Builder"`

- ✅ `/src/server/api/routers/wikiImporter.ts` - Wiki importer
  - Updated User-Agent to `"IxStats-Builder"`
  - Already using direct access ✓

### Error Handling
- ✅ `/src/lib/image-download-service.ts` - Enhanced error messages
- ✅ `/src/components/MediaSearchModal.tsx` - User-friendly error display

---

## Testing iiwiki Access

### Command Line Test
```bash
# Test direct access (should work ✅)
curl -s "https://iiwiki.com/mediawiki/api.php?action=query&format=json&list=allimages&aiprefix=Flag&ailimit=2" \
  -H "User-Agent: IxStats-Builder" \
  -H "Accept: application/json" | jq '.'

# Should return JSON with image list
```

### From Application
```typescript
// After rebuild, test via tRPC:
const result = await api.thinkpages.searchWiki.query({
  query: "flag",
  wiki: "iiwiki",
  limit: 3
});

// Should return images without 403 errors
```

---

## Troubleshooting

### Still Getting 403 Errors?
1. **Check User-Agent**: Must be exactly `"IxStats-Builder"` (no quotes in actual header)
2. **Check URL**: Must be `https://iiwiki.com`, not `iiwiki.us`
3. **Check Proxy**: Should NOT go through `/api/iiwiki-proxy`
4. **Rebuild**: TypeScript changes require rebuild: `npm run build && pm2 restart ixstats`

### How to Verify Configuration
```typescript
import { WIKI_SOURCES } from "~/lib/mediawiki-config";

console.log("iiwiki config:", WIKI_SOURCES.iiwiki);
// Should show:
// {
//   baseUrl: "https://iiwiki.com",
//   apiEndpoint: "/mediawiki/api.php",
//   userAgent: "IxStats-Builder"
// }
```

### Logs to Check
```bash
# Check for Cloudflare blocks
pm2 logs ixstats | grep -i "cloudflare\|403\|iiwiki"

# Check successful iiwiki requests
pm2 logs ixstats | grep "WikiImageSearch.*iiwiki"
```

---

## Summary: Never Do These Things

❌ **NEVER** use `/api/iiwiki-proxy` routes
❌ **NEVER** use User-Agent with version numbers
❌ **NEVER** use `iiwiki.us` (old URL)
❌ **NEVER** make iiwiki calls without checking `mediawiki-config.ts`

✅ **ALWAYS** use direct access: `https://iiwiki.com/mediawiki/api.php`
✅ **ALWAYS** use User-Agent: `"IxStats-Builder"`
✅ **ALWAYS** import config from `~/lib/mediawiki-config`
✅ **ALWAYS** rebuild after TypeScript changes

---

## Questions?

If you encounter 403 errors from iiwiki:
1. Check this guide
2. Verify `mediawiki-config.ts` settings
3. Confirm you're using direct access (not proxy)
4. Rebuild and restart the application
