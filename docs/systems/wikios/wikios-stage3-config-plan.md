# WikiOS Stage 3 — Render-Service Isolation: Config Plan

**Status:** PLANNING ONLY. Nothing in this doc has been applied. Every nginx / `LocalSettings.php`
snippet below is a **proposal to review** and is marked **DO NOT APPLY without sign-off**.

**Goal (north star):** the public only ever sees WikiOS at `/wiki/*`; MediaWiki is demoted to a
locked-down **headless render + template + Lua + edit engine** reachable only as an API/asset
backend. No data changes, no parser changes — UI is hidden/redirected, everything reversible.

**Scope reality (from `wikios-independence-2b-3.md` §Stage 3):** this is **ops in the OUTER repo**
(`/etc/nginx/...`, `/ixwiki/config/LocalSettings.php`, `/ixwiki/mediawiki/...`), executed by a human
with sign-off. It is independent of Stage 2b. Cross-wiki external sources (iiwiki / althistory /
commons) are **separate origins and out of Stage 3 scope** — see Open Questions.

---

## 0. The one gotcha that drives everything

Rendered article HTML that WikiOS serves to anonymous browsers contains **absolute** asset URLs
pointing back at the local wiki. `lib/wiki-os/html-transformer.ts` and `lib/wiki-os/fix-editor-images.ts`
rewrite the parser output to `https://ixwiki.com/...`:

- `https://ixwiki.com/load.php?...` — ResourceLoader **CSS/JS** for infoboxes, refs, TemplateStyles.
- `https://ixwiki.com/wiki/Special:FilePath/<File>` — image resolution (also `lib/wiki-image-url.ts`,
  `lib/unified-flag-service.ts`, `components/.../ImageSearchGrid.tsx`).
- `https://ixwiki.com/images/...`, `/data/...`, `/thumb.php` — raw media + thumbnails.

**Therefore `load.php`, `Special:FilePath`, `/images/`, `/thumb.php` MUST stay publicly reachable
by anonymous GET even though they live under the "UI / Special:" surface we otherwise block.**
Over-blocking these = every infobox loses its styling and every flag/image 404s. This is the single
biggest hazard in Stage 3 and the allowlist below carves them out explicitly.

`action=compare` (diff) is **done client-side** (`lib/wiki-os/wikitext-diff.ts`) — MediaWiki's diff
endpoint is NOT needed. Reads (wikitext/history/revisions/redirects/categories) go through
**direct MySQL** in `lib/wiki-bridge.ts` (`mysql2`), NOT over HTTP — so blocking the web UI does not
touch them at all.

---

## 1. Enumeration — every MediaWiki surface the app touches

Env indirection (already the pattern — no hard-coded host in the hot paths):
`WIKIOS_MEDIAWIKI_API` (→ `/api.php`), `WIKIOS_PARSOID_URL` (→ `/rest.php/v1`),
`IXWIKI_LOCAL_PATH` (optional same-server `api.php` base), `NEXT_PUBLIC_MEDIAWIKI_URL` (browser base).
All default to `https://ixwiki.com`.

### 1a. LOCAL wiki — HTTP call sites (the ones Stage 3 nginx/LocalSettings affect)

| # | File | What it does | Entry point + action/path | R/W |
|---|------|--------------|---------------------------|-----|
| 1 | `lib/wiki-os/parsoid-client.ts:107` | render article HTML (primary) | `api.php?action=parse&prop=text\|categories\|revid` | R |
| 2 | `lib/wiki-os/parsoid-client.ts:84` | Parsoid HTML for editor roundtrip | `rest.php/v1/page/<title>/html` | R |
| 3 | `lib/wiki-os/parsoid-client.ts:191` | HTML→wikitext (save pipeline) | `rest.php/v1/transform/html/to/wikitext/<title>` | R (transform) |
| 4 | `lib/wiki-os/parsoid-client.ts:212` | wikitext→HTML (preview) | `rest.php/v1/transform/wikitext/to/html/<title>` | R (transform) |
| 5 | `lib/wiki-os/csrf-cache.ts:64` | bot login token | `api.php?action=query&meta=tokens&type=login` | R (token) |
| 6 | `lib/wiki-os/csrf-cache.ts:71` | bot login | `api.php` POST `action=login` | **W (session)** |
| 7 | `lib/wiki-os/csrf-cache.ts:92,159` | CSRF token (bot + user session) | `api.php?action=query&meta=tokens&type=csrf` | R (token) |
| 8 | `server/api/routers/wikios/editing.ts:308` | **article save** | `api.php` POST `action=edit` | **W** |
| 9 | `server/api/routers/wikios/editing.ts:232` | **image upload** | `api.php` POST `action=upload` | **W** |
| 10 | `server/api/routers/wikios/templates.ts:269` | template save + TemplateData sync | `api.php` POST `action=edit` | **W** |
| 11 | `server/api/routers/wikios/page-content.ts:473` | edit (page-content path) | `api.php` POST `action=edit` | **W** |
| 12 | `server/api/routers/wikios/page-content.ts:73` | cross-wiki render proxy | `api.php?action=parse` | R |
| 13 | `server/api/routers/wikios/search-categories.ts:291` | category/page edit | `api.php` POST `action=edit` | **W** |
| 14 | `server/api/routers/wikios/user-talk.ts:175,224,241,339` | talk read + post | `api.php?action=parse` (read section) + POST `action=edit` | R + **W** |
| 15 | `server/api/routers/wikios/watchlist-annotations.ts:256` | annotation write-back | `api.php` POST `action=edit` | **W** |
| 16 | `lib/wiki-search-service.ts` / `wiki-search-service.client.ts` | search / opensearch | `api.php?action=query` + `action=opensearch` | R |
| 17 | `lib/mediawiki-service.ts`, `lib/wiki-integration.ts` | misc query (page meta, images) | `api.php?action=query` | R |
| 18 | **browser** via `html-transformer.ts` / `fix-editor-images.ts` rewrites | infobox/ref CSS+JS | `load.php?...` (direct GET from user browser) | R (asset) |
| 19 | **browser** via image URL helpers | image resolution | `wiki/Special:FilePath/<File>`, `/images/`, `/thumb.php` (direct GET) | R (asset) |

Action tally over the wiki layer: **`action=query` ×24, `action=parse` ×5, `action=opensearch` ×1,
`action=edit/upload/login` (writes)**. `action=compare` is **not** used (client-side diff).

### 1b. Direct MySQL (NOT HTTP — Stage 3 does not touch these)

`lib/wiki-bridge.ts` (`mysql2/promise` pool): wikitext, history, revisions, redirects, category
members, user lookups. Used by `wiki` + `wikios` routers. Independent of the web UI lockdown.

### 1c. EXTERNAL wikis — OUT OF STAGE 3 SCOPE (different origins)

`app/api/mediawiki/{iiwiki,althistory,commons}/*` proxy routes + `app/api/mediawiki/ixwiki/*`
passthrough. These point at **iiwiki.com / althistory.fandom.com / commons** (and a self-proxy for
ixwiki images). They are separate origins; locking down the *local* MediaWiki UI does not affect them.
Note `ixwiki/api.php/route.ts` already SSRF-allowlists actions to `query` + `opensearch` only.

---

## 2. Classification

### (a) MUST remain exposed — the headless engine
- `api.php` actions: **`parse`, `query` (incl. `meta=tokens`, `prop=*`), `opensearch`, `login`,
  `edit`, `upload`** — restricted to loopback + the WikiOS/IxStats origin (see §3).
- `rest.php/v1/page/*/html` and `rest.php/v1/transform/*` — Parsoid render + roundtrip.
- `load.php` — ResourceLoader CSS/JS (**public GET**, required by served HTML).
- `wiki/Special:FilePath/*`, `/images/*`, `/thumb.php`, `/data/*` — media (**public GET**).
- Scribunto/Lua + all template/transclusion rendering: **untouched** — it's internal to the parser
  invoked by `action=parse` / Parsoid. No config change; just must not disable the extensions.

### (b) UI-only / public-facing — block or 301-redirect to WikiOS
- `index.php?title=...` article views and the pretty `/wiki/<Title>` reader URLs → **301 to
  `/projects/ixstats/wiki/<slug>`** (WikiOS equivalent) for humans/crawlers.
- `Special:*` pages **except** `Special:FilePath` (and arguably `Special:Redirect/file`) → block/redirect.
- Edit UI (`?action=edit|history|raw|info`, `Special:Search`, `Special:RecentChanges`, login UI,
  `Special:Preferences`, skins) → block/redirect. (App uses the **API**, not these UI URLs.)

---

## 3. Proposed nginx ruleset — **DO NOT APPLY without sign-off**

### Coexistence with bot-defense (root `CLAUDE.md`) — verified against the live vhost

The current `ixwiki.com` vhost (`/etc/nginx/sites-enabled/ixwiki.com`) already has discrete
`location` blocks we can fence around **without touching them**:

- `location = /load.php` (line ~131, FastCGI-cached) — **leave as-is** (asset, must stay public).
- `location = /api.php` (~152) — add origin/loopback gate here.
- `location ~ ^/rest\.php(/|$)` (~169) — add origin/loopback gate here.
- `location ^~ /images/`, `location = /thumb.php`, thumb regexes — **leave as-is** (assets).
- `location ^~ /wiki/` (~97) and `location @mediawiki` (~254) rewrites — add the 301 here.
- `location ~* ^/(MediaWiki|Special|Template|Help|Category|User|File|Talk):` (~102) — **carve out
  `Special:FilePath` then block/redirect the rest.**

Bot defense lives in `/etc/nginx/conf.d/ixwiki-bots.conf` (a `map $http_user_agent $bad_bot` in the
**http** context) + `ixwiki-dynamic-bots.conf` + the daemon. Our rules use a **separate** map var
(`$wikios_allowed`) and live **inside `location` blocks of the server**, so they run *after* the
bad-bot gate and never redefine or reorder it. **Do not edit `ixwiki-bots.conf` or
`ixwiki-dynamic-bots.conf`** — the defense daemon regenerates the dynamic file every 30s and would
clobber manual edits. Put all Stage 3 rules in a **new** file
`/etc/nginx/conf.d/ixwiki-wikios-stage3.conf` (http-context map) + minimal edits to the vhost
`location` blocks. Order in http context is by directive type, not file, so the new map coexists.

```nginx
# /etc/nginx/conf.d/ixwiki-wikios-stage3.conf   (PROPOSAL — DO NOT APPLY)
# Backend origins allowed to hit the headless API. Loopback always; the IxStats
# server-side fetches come from the app host. Browser-origin Parsoid is NOT used
# (all rest.php transform calls are server-side), so rest.php can be loopback-only.
geo $wikios_trusted_ip {
    default                 0;
    127.0.0.1               1;
    ::1                     1;
    10.0.0.0/8              1;   # adjust to the actual app<->wiki private range
}
```

```nginx
# --- in server { } for ixwiki.com ---  (PROPOSAL — DO NOT APPLY)

# 1) api.php: allow only trusted IPs (loopback / app host). Public hits -> 403.
location = /api.php {
    if ($wikios_trusted_ip = 0) { return 403; }
    # ... existing fastcgi_* directives unchanged ...
}

# 2) rest.php (Parsoid): loopback/app-host only (all callers are server-side).
location ~ ^/rest\.php(/|$) {
    if ($wikios_trusted_ip = 0) { return 403; }
    # ... existing fastcgi_* directives unchanged ...
}

# 3) load.php / images / thumb.php: UNCHANGED — stay public (assets in served HTML).

# 4) Special:FilePath must survive — match it BEFORE the Special: block.
location ~* ^/wiki/Special:FilePath/ { try_files $uri @mediawiki; }   # asset path, public
location ~* ^/(?:wiki/)?Special:Redirect/file/ { try_files $uri @mediawiki; }  # if used

# 5) All other Special:/UI namespace pages -> 301 to WikiOS landing (humans/crawlers).
location ~* ^/(?:wiki/)?(MediaWiki|Special|Help|Talk):(.*)$ {
    return 301 https://ixwiki.com/projects/ixstats/wiki/$1:$2;
}

# 6) Article reader URLs -> 301 to WikiOS /wiki/<slug>.
#    Replaces the human-facing half of location ^~ /wiki/ and @mediawiki rewrites.
location ^~ /wiki/ {
    return 301 https://ixwiki.com/projects/ixstats$request_uri;   # /wiki/<Title> preserved
}

# 7) index.php direct article views -> 301 (api.php already gated above, separate location).
#    Match index.php?title=... GET views; leave POST/api untouched (app never POSTs to index.php).
location = /index.php {
    if ($request_method = GET) { return 301 https://ixwiki.com/projects/ixstats/wiki/; }
    # else fall through to existing php handler (defensive; app doesn't use it)
    # ... existing fastcgi_* ...
}
```

Notes:
- Use `return 301` (reversible, cacheable) not `rewrite`. Slug mapping: WikiOS `[slug]` accepts the
  MediaWiki title form (`url-compat.ts` normalizes), so `/wiki/<Title>` → `/projects/ixstats/wiki/<Title>`
  is a safe 1:1 redirect; underscores/spaces are handled app-side.
- `Template:`/`Category:`/`File:`/`User:` namespaces: redirect to WikiOS too **only if** WikiOS has a
  reader for them; otherwise leave to `@mediawiki` for now (lower priority). Confirm in pre-flight.
- Keep `nginx -t` green; reload (human) only after staging test.

---

## 4. Proposed `LocalSettings.php` changes — **DO NOT APPLY without sign-off**

Defense-in-depth so even a direct hit that slips past nginx renders nothing useful. Keep API,
Parsoid, Scribunto/Lua, edit/login/upload fully intact. Reviewable snippet (append near the end of
`/ixwiki/config/LocalSettings.php`):

```php
// === WikiOS Stage 3: headless lockdown (PROPOSAL — DO NOT APPLY without sign-off) ===

// Anonymous users get no UI: force login for the read UI, but the API stays open
// because the bot/user sessions authenticate via api.php?action=login (csrf-cache.ts).
// NOTE: $wgWhitelistRead must keep Special:FilePath reachable for image resolution.
$wgGroupPermissions['*']['read'] = false;
$wgWhitelistRead = [
    'Special:FilePath',     // images in served HTML
    'Special:Redirect',     // if used by image helpers
    'MediaWiki:Common.css', // ResourceLoader pulls these; keep readable
    'MediaWiki:Common.js',
];
// load.php / rest.php are not gated by $wgGroupPermissions['read']; they keep working.

// Editing still flows through api.php with a logged-in session — leave write perms as-is.
// (Do NOT set $wgGroupPermissions['*']['edit']=false expecting it to lock WikiOS out;
//  WikiOS edits as the authenticated user / bot, which retains edit rights.)

// Hide UI chrome / disable skins-as-product (cosmetic; API output unaffected):
$wgDefaultSkin = 'minerva';                 // or keep current; UI is hidden anyway
// Optionally disable anon account creation UI:
$wgGroupPermissions['*']['createaccount'] = false;

// Keep ENABLED (do not touch): Scribunto, Parsoid/RESTBase, TemplateData, the Action API
// ($wgEnableAPI defaults true), api.php write modules (edit/upload/login).
```

**Caution:** `$wgGroupPermissions['*']['read'] = false` makes *every* page require auth, including
what Parsoid/`action=parse` render for anonymous server-side fetches. WikiOS server fetches use the
**bot/user session** (csrf-cache.ts), so authenticated reads still work — **but verify in staging**
that `action=parse` from the bot session returns full HTML. If it complicates the render path, the
**nginx-only** approach (§3) is sufficient on its own; the LocalSettings change is optional hardening.
**Recommended order: ship nginx first, evaluate LocalSettings second.**

---

## 5. Migration + ROLLBACK procedure

Every step reversible; test on a **staging vhost** before prod.

1. **Stage vhost.** Copy `ixwiki.com` server block to a test server_name (e.g. `wikios-staging.ixwiki.com`
   or a port), add the §3 location edits + the new `ixwiki-wikios-stage3.conf`. `nginx -t`. Reload
   staging only.
2. **Pre-flight checklist (§6) against staging** — every must-keep URL returns 200 + WikiOS reads/
   edits/images work end-to-end.
3. **Cut over prod (human, with sign-off):**
   a. `cp /etc/nginx/sites-enabled/ixwiki.com /etc/nginx/sites-enabled/ixwiki.com.pre-stage3.bak`
   b. Apply the location edits; add `ixwiki-wikios-stage3.conf`.
   c. `nginx -t` → reload.
   d. (Optional, separate change) apply LocalSettings snippet; `cp LocalSettings.php LocalSettings.php.pre-stage3.bak` first.
4. **Rollback (any failure):**
   - nginx: `mv ixwiki.com.pre-stage3.bak ixwiki.com`, `rm ixwiki-wikios-stage3.conf`, `nginx -t && reload`.
   - LocalSettings: restore `LocalSettings.php.pre-stage3.bak`.
   - No data touched, no DB migration — rollback is pure file restore + reload. Caches (load.php
     FastCGI cache, parser cache) self-recover.
5. **Do NOT** touch `ixwiki-bots.conf` / `ixwiki-dynamic-bots.conf` / the defense daemon at any step.

---

## 6. Pre-flight allowlist — URLs that MUST keep working (verify before AND after cutover)

Run from the **app host** (trusted IP) unless marked *(public)*:

- [ ] `GET api.php?action=parse&page=Main_Page&prop=text|categories|revid&formatversion=2&format=json` → 200 JSON with `.parse.text`
- [ ] `GET api.php?action=query&meta=tokens&type=login&format=json` → 200, login token
- [ ] `POST api.php action=login` (bot creds) → `result: Success`
- [ ] `GET api.php?action=query&meta=tokens&type=csrf` (with session) → real csrf token (not `+\`)
- [ ] `POST api.php action=edit` (test sandbox page, bot session) → `result: Success`, `newrevid`
- [ ] `POST api.php action=upload` (tiny test file) → success
- [ ] `GET api.php?action=opensearch&search=Test` → suggestions
- [ ] `GET rest.php/v1/page/Main_Page/html` → 200 Parsoid HTML
- [ ] `POST rest.php/v1/transform/html/to/wikitext/Main_Page` → 200 wikitext
- [ ] `POST rest.php/v1/transform/wikitext/to/html/Main_Page` → 200 HTML
- [ ] *(public)* `GET load.php?modules=startup&only=scripts` → 200 JS
- [ ] *(public)* `GET wiki/Special:FilePath/Example.png` → 200/redirect to image
- [ ] *(public)* `GET images/...` and a `thumb.php` thumbnail → 200
- [ ] *(public)* `GET wiki/Some_Article` → **301** to `/projects/ixstats/wiki/Some_Article`
- [ ] *(public)* `GET wiki/Special:RecentChanges` → **301/403** (blocked UI)
- [ ] *(public, browser)* WikiOS article page renders with infobox CSS + images intact (the §0 gotcha)
- [ ] WikiOS editor: open → edit → save round-trips (exercises parse + rest.php transform + edit)

If any *(public)* asset line fails, **stop / rollback** — that's the over-block hazard.

---

## 7. Open questions / risks

1. **External cross-wiki origins out of scope.** `iiwiki.com`, `althistory.fandom.com`, `commons`
   (and the `app/api/mediawiki/*` proxies) are *other* sites. Stage 3 only locks down the *local*
   ixwiki MediaWiki. Confirm we're not expected to touch those — they're a separate workstream.
2. **`$wgGroupPermissions['*']['read']=false` vs server-side parse.** Must verify the bot/user
   session still gets full anonymous-equivalent HTML from `action=parse`/Parsoid in staging. If it
   complicates rendering, ship **nginx-only** (it already meets the "invisible to users" goal).
3. **Trusted-IP range for `$wikios_trusted_ip`.** Need the real app↔wiki path: same-host loopback
   only, or a private subnet? If IxStats fetches MediaWiki over the public `https://ixwiki.com`
   hostname (current default), those requests arrive from the **server's own egress IP** — confirm
   that IP is in the geo allowlist, or set `IXWIKI_LOCAL_PATH` to a loopback base so fetches stay
   internal. (Lazier + faster: point `WIKIOS_MEDIAWIKI_API`/`WIKIOS_PARSOID_URL` at `127.0.0.1`.)
4. **Namespace redirects (`Template:`/`Category:`/`File:`/`User:`).** Only 301 these to WikiOS if
   WikiOS has readers for them; otherwise leave to `@mediawiki`. Decide per-namespace in pre-flight.
5. **Crawler/SEO.** 301-ing `/wiki/*` to `/projects/ixstats/wiki/*` moves indexing to WikiOS — desired,
   but a temporary traffic/SEO blip. Keep redirects 301 (permanent) so link equity transfers.
6. **`Special:FilePath` regex ordering.** It must match before the Special: block in nginx; a typo
   there silently 404s every image. Covered by the pre-flight asset checks — treat as release-blocking.
7. **Defense-daemon interaction.** The daemon edits only `ixwiki-dynamic-bots.conf` and Cloudflare/
   fail2ban; it does not parse the vhost. Safe. But the new 301s will change the access-log URL mix
   (more 301s, fewer `/wiki/` 200s) — note this so the daemon's rate heuristics aren't misread.

---

**Reminder:** this document changes nothing. Stage 3 is human-executed ops in the outer repo, behind
the review gates in `wikios-longevity-workflow.md` (no prod config change without explicit go-ahead).

---

## 8. Sign-off & pre-flight status (June 22 2026)

**Signed off in principle** — approved to execute behind the cutover gate below. Nothing applied to
nginx/LocalSettings yet.

**Baseline pre-flight (read-only, run against live ixwiki.com):** all four must-keep public URLs
return **200** — `api.php?action=parse` (0.07s), `rest.php/v1/page/Main_Page/html` (0.19s),
`load.php` (0.71s), `wiki/Main_Page` (0.05s). Baseline healthy.

**Blocking prerequisite found (open question #3, confirmed):** WikiOS currently fetches MediaWiki over
the **public** `https://ixwiki.com` host (`WIKIOS_MEDIAWIKI_API`/`WIKIOS_PARSOID_URL` unset → defaults).
Loopback (`127.0.0.1`) returns **301** (http→https), so it is **not** a drop-in — needs an internal
http/https vhost or cert handling. **Therefore the api.php/rest.php lockdown CANNOT ship until WikiOS
is first repointed to an internal endpoint and verified.** Sequencing is mandatory:
1. Stand up / confirm an internal MediaWiki endpoint; set `WIKIOS_MEDIAWIKI_API` + `WIKIOS_PARSOID_URL`
   to it; verify WikiOS reader+editor still work end-to-end.
2. Apply the **redirect/UI-block** half (low risk — it only affects public human/crawler traffic).
3. Only then apply the **api.php/rest.php trusted-IP gating** half.
4. Each half on a staging vhost first; cut over in a low-traffic window with the §5 rollback staged.

**Not yet cut over because** the public redirect half effectively launches alpha WikiOS to *all* of
ixwiki.com (every inbound link/crawler) — a product-launch decision, not a silent config flip. Hold
for a deliberate launch window + explicit "cut over now."
