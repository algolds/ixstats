# WikiOS System Documentation

**Last updated:** August 2026  
**Status:** Production Ready (Release Candidate) — WikiOS v1  
**Hierarchy:** Top-level App **WikiOS** (`WIKIOS_VERSION = 1` in Version Registry). Canvas sub-system `CANVAS_VERSION = 1`.

WikiOS is the modern Next.js reading, authoring, and knowledge platform within IxStates that replaces the traditional MediaWiki frontend UI. It combines a rich visual block editor (PlateJS), MediaWiki Parsoid API synchronization, direct MariaDB fast-path read-through (<38ms), PostgreSQL shadow caching (<3ms), multimedia commons exploration, and natural voice article narration.

---

## Architecture & Subsystems

```
┌────────────────────────────────────────────────────────────────────────┐
│                   WIKIOS APP (src/app/(wiki-os)/)                      │
├──────────────────┬──────────────────┬─────────────────┬────────────────┤
│ 1. Reader & Nav  │ 2. Canvas Editor │ 3. Audio Player │ 4. Commons Hub │
│ PlateJS parser,  │ Visual block-    │ Kokoro TTS      │ Image explorer,│
│ Parsoid sync,    │ based rich text  │ narrator, Halo  │ SVG heraldry,  │
│ Stash bookmarks  │ editor (v1)      │ audio equalizer │ MediaWiki sync │
└──────────────────┴──────────────────┴─────────────────┴────────────────┘
```

### 1. Canvas (Visual Wiki Editor)
- **Version**: `CANVAS_VERSION = 1` (sub-system under WikiOS)
- **Capabilities**: Block-based visual document editing powered by PlateJS, infobox template builders, interactive tables, bidirectional wikitext translation, and seamless source/visual mode switching.
- **Draft Persistence**: Unified in `src/lib/wiki-os/draft-store.ts` with canonical `wikios_draft:${source}:${title}` keys and automatic legacy key recovery.

### 2. Article Narrator (Onoma Voice Integration)
- **Engine**: Kokoro TTS (`kokoro-fastapi` / `kokoro-web`) phoneme synthesis.
- **Dynamic Island (Halo)**: Live audio equalizer waveform in compact pill, scrubber track and heading jump markers in expanded view (`src/components/halo/wiki/`).

### 3. MediaWiki Decoupling & 4-Tier Resilient Storage Engine
- **Centralized Primitives**: All MediaWiki network queries strictly use `IxStats-Builder` user-agent (`src/lib/wiki/config.ts`).
- **4-Tier Waterfall Pipeline** (`src/lib/wiki-os/article-store.ts`):
  1. **Tier 1 (Postgres Shadow)**: Pre-rendered and transformed HTML served in **<3ms**.
  2. **Tier 2 (Direct MariaDB Raw SQL)**: Fast-path database reads via `src/lib/wiki-os/bridge/mysql-reader.ts` (~38ms).
  3. **Tier 3 (MediaWiki Action API / Parsoid HTTP)**: Upstream live wikitext transformation & external federated wikis (IIWiki, AltHistory).
  4. **Tier 4 (Stale Shadow Fallback)**: 100% uptime guarantee during upstream network or database downtime.

### 4. Stash (Save for Later)
- **Version**: `STASH_VERSION = 1` (formerly "LoreStash")
- **Capabilities**: Cross-system article bookmarking, reading lists, offline access, text highlights/annotations, and research trays available across WikiOS, Forum, and ThinkPages.
- **Modular Interface**: Located in `src/app/stashes/` with subcomponents in `src/components/wiki-os/stashes/`.

### 5. Repository & Commons
- **Version**: `REPOSITORY_VERSION = 2` (WikiOS Commons image explorer)
- **Router**: `src/server/api/routers/commons.ts` & `src/server/api/routers/heraldry/`
- **Capabilities**: Asset search, SVG coat of arms inspector, and license attribution tracking.

---

## Modular Backend Routers (`src/server/api/routers/wikios/`)

The core WikiOS router is domain-split into sub-routers combined via `mergeRouters`:

- `page-content.ts` – Article HTML rendering, TOC extraction, Postgres shadow read-through, and dynamic placeholder resolution (<700 lines)
- `editing.ts` – Parsoid wikitext/HTML conversion, page saving, file uploads, and rollbacks
- `history.ts` – Revision history, diffing, and rollback metadata
- `search.ts` – PostgreSQL full-text and trigram fuzzy search (<3ms)
- `templates.ts` – Local template registry and TemplateData metadata
- `user-talk.ts` – User talk pages, contributions, and backlinks ("What Links Here")
- `watchlist-annotations.ts` – User watchlist and inline text annotations
- `stash.ts` – User stashes, collections, and bookmark counts

---

## Core Engine Architecture (`src/lib/wiki-os/`)

- `bridge/` – Modular direct MariaDB connector & multi-source router (`mysql-pool.ts`, `mysql-reader.ts`, `http-reader.ts`, `dispatchers.ts`, `types.ts`, `index.ts`)
- `article-store.ts` – Multi-tier shadow storage, history recording, and pre-rendered HTML cache
- `draft-store.ts` – Canonical multi-mode (visual & source) draft persistence & recovery
- `html-transformer.ts` – Server-side HTML post-processor (Infobox, TOC, Notices)
- `parsoid-client.ts` – Headless Parsoid REST API bridge (loopback-accelerated)
- `search-service.ts` – PostgreSQL full-text & trigram search engine

---

## Data Models

Defined in `prisma/schema/wiki.prisma`:
- `WikiArticle`: Authoritative shadow metadata, namespace, title, revision ID, pre-rendered HTML cache (`htmlContent`, `htmlSyncedAt`)
- `WikiRevision`: Immutable revision history with author, timestamp, diff summary
- `WikiTemplate`: Structured TemplateData parameters and schema
- `LoreWard`: User awards earned through wiki contribution milestones
- `Stash`: User-created collections and reading lists
- `StashItem`: Bookmarked articles, forum threads, and lore cards linked to `Stash`
- `StashAnnotation`: User text selections and inline notes on saved wiki articles

---

## Related Documentation

- [Onoma Voice & Kokoro TTS Guide](./onoma-voice-guide.md)
- [Halo Dynamic Island System](./dynamic-island.md)
- [Social & Collaboration System](./social.md)
- [API Reference: WikiOS Routers](../reference/api-complete.md#wikios-router)

