# WikiOS system documentation

Last updated: August 22, 2026  
Status: Release candidate (Plan 170 complete)  
Hierarchy: Top-level app WikiOS (`WIKIOS_VERSION = 1`). Canvas sub-system `CANVAS_VERSION = 1`.  

WikiOS is the knowledge and worldbuilding engine for IxStates. PostgreSQL is the primary database for articles, revisions, link graphs, and categories. Reads take under 2ms and writes take under 10ms. Upstream MediaWiki operates as a background export and compatibility adapter (`src/lib/wiki-os/adapters/mediawiki/`).

---

## Architecture and subsystems

```
┌────────────────────────────────────────────────────────────────────────┐
│                   WIKIOS APP (src/app/(wiki-os)/)                      │
├──────────────────┬──────────────────┬─────────────────┬────────────────┤
│ 1. Reader & Nav  │ 2. Canvas Editor │ 3. Audio Player │ 4. Commons Hub │
│ PostgreSQL CRUD, │ Visual block-    │ Kokoro TTS      │ Media assets,  │
│ Link graph, TOC, │ based rich text  │ narrator, Halo  │ SVG heraldry,  │
│ Stash bookmarks  │ editor (v1)      │ audio equalizer │ Blurhash cards │
└──────────────────┴──────────────────┴─────────────────┴────────────────┘
```

### 1. PostgreSQL core engine (`src/lib/wiki-os/core/`)
- **Primary storage.** Articles (`WikiArticle`) and revisions (`WikiRevision`) live in PostgreSQL.
- **Pre-compiled HTML.** `contentHtml` serves reads directly from database indexes in under 2ms.
- **Relational link graph (`wiki_links`).** Stores directed edges for backlink queries in under 1ms and flags red links without extra lookups.
- **Two-tier search.** Combines prefix trigram matching (<1.5ms) with weighted `tsvector` full-text search.

### 2. Canvas visual editor
- **Version.** `CANVAS_VERSION = 1`
- **Capabilities.** Block-based visual document editing, infobox template builders, tables, bidirectional AST translation, and source/visual mode toggles.
- **Draft store.** `src/lib/wiki-os/editor/draft-store.ts` handles client-side autosave with `wikios_draft:${source}:${title}` keys.

### 3. Article narration
- **Engine.** Kokoro TTS synthesis.
- **Halo integration.** Audio waveform in compact pill, scrubber track, and section jump markers in expanded view (`src/components/halo/wiki/`).

### 4. Security and edge defense (`src/lib/wiki-os/guardian/`)
- **Cloudflare Turnstile.** Verifies human edits without CAPTCHAs.
- **Zero-Trust access.** Validates service tokens (`CF-Access-Client-Id`) for background jobs and migrations.
- **Edge CDN cache purge.** Fires non-blocking zone purges when articles change.
- **AbuseFilter.** Rejects mass page blanking (>70% text deletion) and homoglyph impersonation.

### 5. MediaWiki adapter (`src/lib/wiki-os/adapters/mediawiki/`)
- **Background mirror.** Writes save locally in under 10ms, then `MediaWikiExportWorker` queues an upstream Action API write with exponential backoff.
- **Migration CLI.** `scripts/wiki/migrate-mediawiki.ts` imports `.sql` and `.xml` dumps into PostgreSQL.

### 6. Stash
- **Version.** `STASH_VERSION = 1`
- **Capabilities.** Bookmarks, reading lists, text annotations, and research trays shared across WikiOS, Forum, and ThinkPages.

### 7. Lorewards
- **Capabilities.** Text length and quality scoring, daily/weekly awards (`LorewardEntry`), streak calendar (`StreakCalendar.tsx`), and milestone badges.

---

## Backend routers (`src/server/api/routers/wikios/`)

The WikiOS router is split into sub-routers merged with `mergeRouters`:

- `page-content.ts`. Article HTML rendering, table of contents extraction, and simulation macro resolution.
- `editing.ts`. PostgreSQL primary saves, link graph indexing, background MediaWiki sync, and rollbacks.
- `history.ts`. Revision history, diff generation, and rollback metadata.
- `search-categories.ts`. Autocomplete search and recursive CTE category queries.
- `user-talk.ts`. Backlinks and user discussion threads.
