# WikiOS Independence & Native Architecture (Stage 2b shipped, Stage 3 pending cutover)

**Status:** Stage 2b shipped (Plan 170 & Plan 191). Stage 3 (render-service isolation) is **not cut over**. The old Stage 3 draft ([`wikios-stage3-config-plan.md`](wikios-stage3-config-plan.md), and its `stage3-nginx-cutover.conf` vhost, now deleted) is superseded by the WikiOS takeover kit of plan 417 (September 30, 2026); the ordered operator steps are in [`docs/operations/wikios-v1-cutover.md`](../../operations/wikios-v1-cutover.md).  
**Package:** `src/lib/wiki-os/`  
**Authority Model:** PostgreSQL Primary Store (`wiki_articles`, `wiki_revisions`, `wiki_links`, `wiki_assets`) with Headless MediaWiki Federation.

---

## The Decoupled Architecture

With the completion of Plan 170 and Plan 191 (Stage 2b):

- **PostgreSQL is authoritative for stored wikitext, revisions, the link graph and search.** Rendering, templates, Lua, uploads, image bytes, file-search and category-autocomplete fallbacks, author and creator data, and the Main Page still come from MediaWiki; assets are metadata pointers to `ixwiki.com/images`.
- **4,685+ namespace-0 articles** and **4,685+ revisions** are stored natively in `wiki_articles` and `wiki_revisions`.
- **48,200+ link graph edges** are indexed in `wiki_links` for indexed backlink lookups and zero-query Red Link resolution.
- **7,555+ media files** are registered in `wiki_assets` with MD5 shard paths (hash of the filename) and immutable edge caching.
- **Spotlight Search** is served via `NativeSearchService` (a Prisma `contains` query; no trigram or GIN index).
- **Sub-10ms Save Operations** commit directly to PostgreSQL first, dispatching non-blocking background queue tasks (`MediaWikiExportWorker`) to synchronize with upstream MediaWiki.
- **MediaWiki is demoted to a headless render (`action=parse`), export, and recent-changes source in the app.** Its public web UI is still live until Stage 3 cuts over.

---

## Stage 2b Capabilities (Shipped)

1. **`WikiRevision` Append-Only Ledger**:
   - `id`, `articleId`, `mwRevId`, `wikitext`, `contentHtml`, `author`, `authorId`, `summary`, `minor`, `source`, `parentRevisionId`, `byteSize`, `byteDelta`, `createdAt`.
   - Indexed `(articleId, createdAt)` for indexed revision lookups.
2. **PostgreSQL Primary Save Pipeline**:
   - `ArticleRepository.saveArticle()` writes directly to PostgreSQL in <10ms, registers newly referenced images via `MediaAssetService`, updates `wiki_links`, and purges Cloudflare edge caches.
3. **High-Performance Native Reader**:
   - `contentHtml` is served when present, but saves currently store it empty, so the next read renders through MediaWiki `action=parse` (PHP). The native ParserFunctions evaluator (`core/parser-functions.ts`, exercised only by tests, with inaccurate `#expr` and `#time`) was deleted in plan 415: MediaWiki's own ParserFunctions run in the private render engine.
4. **Sister-Wiki Federation**:
   - Direct HTTP adapters (`http-reader.ts`) connect to external wikis (`iiwiki`, `althistory`) with a circuit breaker and parallel search dispatch. Their pages open read-only via `/wiki/[slug]?source=…` (Sept 2026).
5. **Direct-edit capture**:
   - Edits made on classic MediaWiki are synced into PostgreSQL from `recentchanges` by `src/lib/wiki-os/services/auto-sync-service.ts`, run by the `wiki-recentchanges` cron job (`src/server/cron/jobs.ts`) and the `/api/wikios/inbound-sync` webhook.

> The sections below are the original Stage 2b/3 proposal, kept for history. Stage 2b shipped as a
> PostgreSQL-first design (MediaWiki is no longer canonical), and the open question was answered **yes**
> (see item 5).

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

## Stage 3 — Render-service isolation (pending)

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
