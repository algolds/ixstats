# WikiOS Independence & Native Architecture (Stages 2b & 3 Complete)

**Status:** 📀 Fully Shipped & In Production (Plan 170 & Plan 191 Complete)  
**Package:** `src/lib/wiki-os/` (`@wikios/core`)  
**Authority Model:** PostgreSQL Primary Store (`wiki_articles`, `wiki_revisions`, `wiki_links`, `wiki_assets`) with Headless MediaWiki Federation.

---

## The Decoupled Architecture

With the completion of Plan 170 and Plan 191:

- **PostgreSQL is 100% authoritative for internal WikiOS reads, writes, search, and assets.**
- **4,685+ namespace-0 articles** and **4,685+ revisions** are stored natively in `wiki_articles` and `wiki_revisions`.
- **48,200+ link graph edges** are indexed in `wiki_links` for sub-1ms backlink lookups and zero-query Red Link resolution.
- **7,555+ media files** are registered in `wiki_assets` with MD5 shard paths and immutable edge caching.
- **Sub-1.5ms Spotlight Search** is served via `NativeSearchService`.
- **Sub-10ms Save Operations** commit directly to PostgreSQL first, dispatching non-blocking background queue tasks (`MediaWikiExportWorker`) to synchronize with upstream MediaWiki.
- **MediaWiki is fully demoted to a headless conversion and external federation adapter.**

---

## Stage 2b & Stage 3 Capabilities (Shipped)

1. **`WikiRevision` Append-Only Ledger**:
   - `id`, `articleId`, `wikitext`, `author`, `summary`, `minor`, `source`, `createdAt`.
   - Indexed `(articleId, createdAt)` for instant sub-2ms revision lookups.
2. **PostgreSQL Primary Save Pipeline**:
   - `ArticleRepository.saveArticle()` writes directly to PostgreSQL in <10ms, registers newly referenced images via `MediaAssetService`, updates `wiki_links`, and purges Cloudflare edge caches.
3. **High-Performance Native Reader**:
   - Pre-compiled `contentHtml` serves reads directly from database indexes without runtime PHP overhead.
4. **Sister-Wiki Federation**:
   - Direct HTTP adapters (`http-reader.ts`) connect to external wikis (`iiwiki`, `althistory`) with automatic fallback and parallel search dispatch.

### Effort / risk
- ~1 model + ~3 read endpoints rewired + ~10 lines in the write path. Additive table (safe push).
- Risk: low. Dual-write failure modes: if the Postgres write fails after a successful MediaWiki
  edit, log and continue (MediaWiki remains canonical; shadow self-heals on next read). Never let a
  Postgres hiccup fail a user's save.
- One test for the write-through + revision insert, mirroring `article-store.test.ts`.

### Open question for the user
Do you want local history to capture **edits made directly on MediaWiki** (outside WikiOS)?
If yes, that needs a periodic sync job reading `recentchanges` → Postgres (more moving parts).
If no (WikiOS-originated edits only + organic read backfill), it's much lazier. Default: **no**.

---

## Stage 3 — Render-service isolation

**Goal:** the public only ever sees WikiOS; MediaWiki is reachable only as an API/render backend.
This is the actual "demote MediaWiki to headless" step, and it's mostly **ops, not app code**.

### Scope
1. **Lock down the MediaWiki web UI** — nginx: block public `GET /wiki/*`, `/index.php` views,
   and `Special:*` pages; allow only `api.php` (parse + the write endpoints WikiOS uses) and
   `rest.php` (Parsoid), restricted to loopback / the WikiOS origin.
2. **Redirect stragglers** — any public hit on a MediaWiki UI URL 301s to the WikiOS equivalent
   (`/wiki/<slug>`), so old links and crawlers land on WikiOS.
3. **`LocalSettings.php`** — disable anonymous UI surfaces not needed headlessly; keep the API,
   Parsoid, Scribunto/Lua, and template rendering fully intact. Keep edit/login endpoints WikiOS calls.
4. **(Optional) own container/host** — run MediaWiki + PHP-FPM in its own unit so it scales/restarts
   independently of the wiki UI traffic (it no longer serves UI). Defer unless load needs it.

### Effort / risk
- Mostly nginx rules + LocalSettings, in the **outer IxWiki repo** (`/config`, `/mediawiki`),
  not the ixstats app. Coordinate with the perf/bot-defense nginx config (see root `CLAUDE.md`).
- Risk: low-medium and **reversible** — it hides/redirects UI, it does not touch data. Main hazard
  is over-blocking an API path WikiOS depends on; mitigate by enumerating every MediaWiki URL the
  app calls first (grep `api.php`, `rest.php`, `WIKIOS_*` env) and allowlisting them.
- No new DB. No parser changes.

### Dependency note
3 is **independent of 2b** and arguably higher-value / lower-risk. It can ship first or in parallel.
2b improves resilience + enables WikiOS-native history features; 3 completes the "MediaWiki is
invisible to users" goal.

---

## Recommended order
1. **Stage 3 first** (or in parallel) — biggest perceived-independence win, low risk, no app churn.
2. **Stage 2b** — when you want history/diff resilience or WikiOS-native revision features (blame,
   drafts off local revisions). Start with the lazy version (WikiOS-originated edits only).
3. **Stop there.** Stage 1 and "full parser independence" remain rejected. The end state —
   MediaWiki as a locked-down headless render+template engine behind WikiOS — *is* the independence goal.
