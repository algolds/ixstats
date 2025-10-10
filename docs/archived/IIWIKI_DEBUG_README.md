# IIWiki API Debug Package

This package contains everything you need to debug and resolve the Cloudflare blocking issue with the IIWiki admin.

## 📋 What's Included

### 1. **Enhanced Logging** ✅
The iiwiki proxy now includes detailed logging that captures:
- Request timestamp and unique ID
- Server IP address (auto-detected)
- Complete request URL
- All request headers being sent
- Response status and headers
- Cloudflare-specific headers
- Full error details if request fails

**Location**: `/src/app/api/iiwiki-proxy/mediawiki/api.php/[...path]/route.ts`

### 2. **Test Script** 
Run this to capture logs for the admin:
```bash
./test-iiwiki-api.sh > iiwiki-test-results.txt 2>&1
```

This will create a file with complete test results you can share.

### 3. **Admin Documentation**
Comprehensive guide for the iiwiki admin:
- **IIWIKI_CLOUDFLARE_DEBUG.md** - Complete technical documentation
- **MESSAGE_TO_ADMIN.txt** - Ready-to-send message template

## 🚀 How to Use

### Step 1: Capture Current Logs
When your application tries to access iiwiki, the enhanced logging will automatically output:

```
========== IIWiki API Request ==========
[2025-10-08T14:30:00.000Z] Request ID: abc123
Server IP: 45.32.6.57
Target URL: https://iiwiki.com/mediawiki/api.php?action=query&format=json
Request Headers:
  User-Agent: IxStats-Builder
  Accept: application/json
  Accept-Language: en-US,en;q=0.9
  ...
========================================

========== IIWiki API Response ==========
[2025-10-08T14:30:00.000Z] Request ID: abc123
Response Status: 403 Forbidden
Response Headers:
  cf-mitigated: challenge
  server-timing: chlray;desc="..."
  ...
Cloudflare Headers:
  cf-mitigated: challenge
  cf-ray: ...
=========================================
```

### Step 2: Run Test Script (Optional)
```bash
chmod +x test-iiwiki-api.sh
./test-iiwiki-api.sh > test-results.txt 2>&1
```

This captures test results in a file you can attach when contacting the admin.

### Step 3: Contact Admin
1. Open `MESSAGE_TO_ADMIN.txt`
2. Copy the message
3. Attach `IIWIKI_CLOUDFLARE_DEBUG.md`
4. Optionally attach `test-results.txt`
5. Send to the iiwiki admin

## 📊 What the Logs Show

The enhanced logging will prove to the admin:

✅ **Exact IP Address**: `45.32.6.57` (auto-detected)  
✅ **Correct User-Agent**: `IxStats-Builder`  
✅ **Correct Path**: `/mediawiki/api.php`  
✅ **Cloudflare Challenge**: Response headers showing `cf-mitigated: challenge`  
✅ **403 Status**: Confirming the block

## 🔧 What the Admin Needs to Do

The admin needs to create a **WAF Skip Rule** in Cloudflare:

```
Expression: (ip.src eq 45.32.6.57 and http.request.uri.path contains "/mediawiki/api.php")
Action: Skip
Skip: All remaining custom rules, Rate limiting
Status: Enabled
Priority: 1
```

**Full instructions are in `IIWIKI_CLOUDFLARE_DEBUG.md`**

## ✅ Verification

After the admin configures Cloudflare, you should see:

```
========== IIWiki API Response ==========
Response Status: 200 OK
✓ Success - returned XXXX bytes
```

## 📝 Files Summary

| File | Purpose |
|------|---------|
| `IIWIKI_CLOUDFLARE_DEBUG.md` | Complete technical documentation for admin |
| `MESSAGE_TO_ADMIN.txt` | Ready-to-send message template |
| `test-iiwiki-api.sh` | Test script to capture diagnostics |
| `IIWIKI_DEBUG_README.md` | This file - usage instructions |

## 🆘 If Still Not Working

If the admin confirms they've added the rule but it's still not working:

1. **Check the logs** - They should show the exact Cloudflare headers
2. **Verify IP** - Confirm the server IP is still `45.32.6.57`
3. **Ask admin to**:
   - Verify rule is **Enabled** not draft
   - Check rule priority (must be #1 or before blocking rules)
   - Confirm using **Skip** action, not just Allow
   - Check for zone-level lockdown settings

## 📞 Getting Help

The logs now include a unique Request ID for each call. Reference this ID when discussing specific requests with the admin.

---

**Server IP**: 45.32.6.57  
**User-Agent**: IxStats-Builder  
**Status**: Enhanced logging active ✅

