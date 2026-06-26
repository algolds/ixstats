---
name: reference-cloudflare-purge-token
description: Cloudflare API token + zone ID for purging maps.ixwiki.com edge cache
metadata: 
  node_type: memory
  type: reference
  originSessionId: ccdecc75-54d0-41b7-ae73-f5eb846d2d91
---

Cloudflare cache-purge credentials for the IxWiki/maps.ixwiki.com zone.

- **Zone ID:** `4de8fc4d5b7b66ba56e39ecc66fb3e05`
- **API token (Cache Purge scope):** stored server-side only, NOT in git. Read it from
  `/etc/ixwiki-defense.conf` → `CF_PURGE_API_TOKEN` (root-readable). The `CF_API_TOKEN`
  in the same file only has Firewall/WAF scope and returns "Authentication error" on `purge_cache`.

> Secrets never go in synced memory — GitHub push protection blocks the push. On the server,
> source the conf to use the token; on other machines, fetch from the password manager if needed.

Purge everything:
```bash
source /etc/ixwiki-defense.conf   # provides CF_PURGE_API_TOKEN + CF_ZONE_ID
curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
  -X POST -H "Authorization: Bearer $CF_PURGE_API_TOKEN" \
  -H "Content-Type: application/json" --data '{"purge_everything":true}'
```

Context: maps.ixwiki.com is behind Cloudflare with long edge TTLs (`max-age=2678400`, 31 days) on static assets — missing files get their 404 cached hard, so after deploying new static assets (e.g. pack SVGs under `/images/packs/`) you must purge. See [[project_vault_cosmetics_architecture]].
