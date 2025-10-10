# IIWiki Cloudflare Access Issue - Debug Information

## Current Status
The IxStats application is receiving **403 Forbidden** responses with Cloudflare challenge pages when attempting to access the IIWiki MediaWiki API.

## Server Details
- **Server IP**: `45.32.6.57`
- **Application**: IxStats-Builder
- **Target API**: `https://iiwiki.com/mediawiki/api.php`
- **User-Agent**: `IxStats-Builder`

## Expected Behavior
The application should be able to make automated API requests to `/mediawiki/api.php` without encountering Cloudflare challenges.

## Current Behavior
All requests receive a 403 response with a Cloudflare JavaScript challenge page, which cannot be completed by server-side applications.

## Sample Request
```bash
curl -v -A "IxStats-Builder" \
  -H "Accept: application/json" \
  "https://iiwiki.com/mediawiki/api.php?action=query&format=json&meta=siteinfo"
```

**Current Response**: HTTP/2 403 (Cloudflare Challenge Page)

## Cloudflare Response Headers Seen
```
HTTP/2 403
cf-mitigated: challenge
server-timing: chlray;desc="..."
```

## Requested Cloudflare Configuration

### Option 1: WAF Skip Rule (Recommended)
Create a WAF Skip Rule with the following configuration:

**Rule Name**: `Allow IxStats Builder API Access`

**Expression**:
```
(ip.src eq 45.32.6.57 and http.request.uri.path contains "/mediawiki/api.php")
```

**Action**: `Skip`

**Skip Options** (select all):
- ☑ All remaining custom rules
- ☑ Rate limiting
- ☑ Zone Lockdown
- ☑ Security level
- ☑ Browser Integrity Check
- ☑ Hotlink Protection

**Priority**: Set to run **before** any blocking rules (e.g., priority 1)

**Status**: ☑ Enabled

### Option 2: IP Access Rule (Alternative)
If the WAF rule doesn't work, use IP Access Rules:

1. Go to **Security** > **WAF** > **Tools** > **IP Access Rules**
2. Add new rule:
   - **IP Address**: `45.32.6.57`
   - **Action**: `Whitelist`
   - **Zone**: `iiwiki.com`
   - **Notes**: `IxStats-Builder API access`

### Option 3: User-Agent Allow Rule (Least Secure)
If IP whitelisting is not possible:

**Expression**:
```
(http.user_agent contains "IxStats-Builder" and http.request.uri.path contains "/mediawiki/api.php")
```

**Action**: `Allow`

## Testing the Configuration

After implementing the Cloudflare rule, you can test with:

```bash
# From the whitelisted server (45.32.6.57)
curl -A "IxStats-Builder" \
  "https://iiwiki.com/mediawiki/api.php?action=query&format=json&meta=siteinfo"
```

**Expected Response**: HTTP 200 with JSON data (not a challenge page)

## Verification Checklist

- [ ] IP `45.32.6.57` is correctly entered in the rule
- [ ] The path `/mediawiki/api.php` is correctly specified
- [ ] The rule is set to **Skip** (not just Allow)
- [ ] The rule is **Enabled** (not draft)
- [ ] The rule has higher priority than blocking rules
- [ ] The rule applies to the entire `iiwiki.com` zone

## Common Issues

### Issue 1: Rule Not Taking Effect
**Solution**: 
- Check rule priority - it must be evaluated before blocking rules
- Verify the rule is enabled, not just saved as draft
- Wait 1-2 minutes for Cloudflare cache to clear

### Issue 2: Still Getting 403
**Possible Causes**:
- Wrong IP address entered (verify: `45.32.6.57`)
- Rule expression has typos
- Different Cloudflare feature is blocking (e.g., Rate Limiting)
- Zone-level lockdown is active

### Issue 3: Path Not Matching
**Solution**:
- Use `contains "/mediawiki/api.php"` not equals
- The full path is: `/mediawiki/api.php?action=...`
- The expression should match any query string

## Expected API Usage

The IxStats application makes the following types of requests:

1. **Site Info**: `?action=query&meta=siteinfo`
2. **Search**: `?action=query&list=search&srsearch=...`
3. **Category Members**: `?action=query&list=categorymembers&cmtitle=Category:...`
4. **Page Content**: `?action=query&prop=revisions&titles=...`
5. **Image Info**: `?action=query&prop=imageinfo&titles=File:...`

All requests:
- Use User-Agent: `IxStats-Builder`
- Originate from IP: `45.32.6.57`
- Target path: `/mediawiki/api.php`
- Use HTTP GET method
- Request JSON format responses

## Request Rate
- Estimated: 10-50 requests per minute during active use
- Typical: 5-10 requests per minute
- Not a DDoS concern - normal MediaWiki API usage

## Contact
If you need additional information or see different IP addresses in logs, please contact the IxStats team.

---

**Last Updated**: 2025-10-08  
**Server IP**: 45.32.6.57  
**Application**: IxStats-Builder

