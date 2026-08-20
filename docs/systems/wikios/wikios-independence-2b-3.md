# WikiOS Independence — Stage 2b + 3 Scope

**Status:** scoping only. Stage 0 (reads) and Stage 2 read-side (shadow store) are shipped.
See `plans/WIKIOS.md` → "MediaWiki Independence Path" for the full ladder.

## The hard ceiling (read first)

MediaWiki's parser resolves `{{templates}}` and Lua `{{#invoke:}}` from **its own database**.
Rendering any article requires every template/module it uses to live in MediaWiki. Therefore:

- Postgres can be authoritative for **article content we read/serve**.
- MediaWiki must stay authoritative for **templates, Lua modules, the link graph
  (`pagelinks`/`categorylinks`/`templatelinks`), search index, and rendering**.
- "Drop MediaWiki writes" (Stage 1) breaks all of the above. It stays rejected.

So the realistic endpoint is **MediaWiki demoted to a headless render+ecosystem engine**,
not removed. 2b makes Postgres a first-class durable read authority via *dual-write*;
3 hides MediaWiki's UI from the world. Neither reimplements the parser. That's the ceiling.

---

## Stage 2b — Local revisioned store + dual-write

**Goal:** WikiOS reads (current + history + diff) come from Postgres and survive MediaWiki
downtime; MediaWiki is kept coherent by writing to it too (dual-write).

### What it adds over shipped Stage 2
1. **`WikiRevision` model** — local revision history.
   `id, articleId→WikiArticle, mwRevId Int?, wikitext, author, summary, minor, parentMwRevId Int?, createdAt`.
   Index `(articleId, createdAt)`. Append-only.
2. **Dual-write on save** — in `saveToMediaWiki` (after the Action API edit succeeds):
   upsert `WikiArticle` + insert a `WikiRevision` row with the returned `newrevid`.
   MediaWiki edit stays the source of the canonical revid; Postgres mirrors it.
   *(Replaces the current "invalidate shadow" with "write-through shadow + revision".)*
3. **Read-through history/diff** — `getHistory`, `getDiff`, `getRevisionContent` gain the same
   pattern `getWikitext` already has: serve from Postgres, fall back to wiki-bridge MySQL,
   backfill. Gives history/diff the same MediaWiki-down resilience the current wikitext has.

### Non-goals (YAGNI)
- **Rendering from Postgres.** Dual-write keeps MediaWiki's copy identical, so `action=parse`
  already renders the right content. Rendering Postgres wikitext separately buys nothing until
  content can diverge — and dual-write prevents divergence. Skip.
- **Backfilling all history.** Organic backfill on read, same as Stage 2. A one-shot warm-up
  script is optional and can come later.
- **Making templates/modules Postgres-authoritative.** Impossible without a parser rewrite (see ceiling).

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
