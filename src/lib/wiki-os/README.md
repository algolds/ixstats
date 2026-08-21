# WikiOS Engine Core (`src/lib/wiki-os/`)

**Architecture Status**: Graduated Standalone-Capable Engine  
**Target Package**: `@wikios/core` 

---

## 1. Purpose & Design Philosophy

`src/lib/wiki-os/` is the pure, standalone-capable core of **WikiOS** — a high-performance modern Next.js/React frontend and multi-tier storage engine for MediaWiki communities and worldbuilding archives.

### Strict Graduation Boundary
- **Zero Game Couplings**: This directory contains **NO** references to IxStates-specific game domain models (`Country`, `Card`, `LoreCategory`, `PointOfInterest`, `TaxPolicy`).
- **Pluggable Host Seams**: Any application-specific data (such as national dynamic stats or custom infobox transclusion) connects via pluggable interfaces (`TemplateDataProvider`, `WikiAuthContext`).
- **Headless MediaWiki**: Uses MediaWiki purely as a backend render and template execution service, while providing local high-speed (<5ms) cached reads and optimistic visual editing.

---

## 2. Component Architecture Map

```
src/lib/wiki-os/
├── config.ts              # Canonical configuration, loopback endpoints & sources
├── types.ts               # Canonical MediaWiki & WikiOS typed contracts (Branded types)
│
├── bridge/                # Modular direct MariaDB connector & multi-source router
│   ├── types.ts           # WikiSource, row schemas, L1 in-memory LRU cache
│   ├── mysql-pool.ts      # MariaDB connection pool & lifecycle management
│   ├── mysql-reader.ts    # Direct MariaDB raw SQL queries & fast-path fetchers (~38ms)
│   ├── http-reader.ts     # External MediaWiki (IIWiki/AltHistory/Commons) HTTP fetchers
│   ├── dispatchers.ts     # Multi-source routing dispatchers & wikitext helpers
│   └── index.ts           # Unified bridge barrel export
├── bridge.ts              # Backward-compatible forwarder stub (re-exports bridge/)
│
├── article-store.ts       # 4-tier resilient read pipeline & pre-rendered HTML cache
├── search-service.ts      # PostgreSQL full-text & trigram fuzzy search engine (<3ms)
├── html-transformer.ts    # Server-side HTML post-processor (Infobox, TOC, Notices)
├── parsoid-client.ts      # Headless Parsoid REST API bridge (loopback-accelerated)
│
├── template-resolver.ts   # Pluggable wikitext template provider registry
├── template-registry.ts   # Client-side TemplateData registry & parameter schema
│
├── draft-store.ts         # Canonical multi-mode (visual & source) draft persistence & recovery
├── fix-editor-images.ts   # Pre-save regex image transformer & sanitizer
├── wiki-write-service.ts  # CSRF-managed Action API write service
├── csrf-cache.ts          # MediaWiki CSRF token cache with automatic TTL refresh
├── wikitext-diff.ts       # LCS visual wikitext diff calculator
├── mediawiki-timestamp.ts # ISO 8601 <-> MediaWiki 14-digit timestamp converter
├── image-url.ts           # Client-safe MediaWiki image URL & thumbnail resolver
├── infobox-parser.ts      # Zero-dependency wikitext infobox & template tokenizer
├── safe-decode.ts         # Resilient URI decoding utility
├── url-compat.ts          # Canonical wiki URL rewriting & route resolution
├── wiki-embed-shared.ts   # Shared CSS/JS bundle definitions for interactive embeds
│
├── auth.ts                # Auth provider abstraction seam
├── use-wiki-auth.ts       # Client hook abstraction for identity & roles
└── storage.ts             # Host storage/identity resolution seam
```

---

## 3. Multi-Tier Resilient Read Pipeline (`article-store.ts`)

Article reads resolve through a 4-tier resilient waterfall:

```
[Tier 1: Fresh Postgres Shadow] (<3ms)
       │ (Cache Miss / Stale)
       ▼
[Tier 2: Direct MariaDB MySQL] (~38ms)
       │ (MySQL Unavailable / External Wiki)
       ▼
[Tier 3: MediaWiki Action API / Parsoid HTTP] (~400ms)
       │ (Network Down / 502 Bad Gateway)
       ▼
[Tier 4: Stale Shadow Fallback] (stale: true, <3ms)
```

1. **Tier 1 (Postgres Shadow)**: Pre-rendered and transformed HTML stored in PostgreSQL. Serves instant responses (<3ms) without touching MediaWiki.
2. **Tier 2 (Direct MariaDB)**: Direct fast-path read directly from the MediaWiki database (`page`, `revision`, `text`, `slots`) via `bridge/mysql-reader.ts` (~38ms).
3. **Tier 3 (Parsoid / Action API)**: HTTP fallback for live wikitext expansion and external federated wikis (IIWiki, AltHistory).
4. **Tier 4 (Stale Shadow)**: Guarantees 100% uptime by serving cached stale snapshots if all upstream data sources fail.

---

## 4. Draft Store & Persistence (`draft-store.ts`)

`draft-store.ts` provides a unified persistence layer for local unsaved edits across both visual and source editors:

- **Canonical Key Format**: `wikios_draft:${source}:${title}`
- **Dual-Storage Compatibility**: Transparently reads and writes to legacy keys (`wikios-draft-html-${title}`, `wikios-draft-${title}`) to prevent user data loss across updates.
- **Deduplicated Listing**: `listDrafts()` scans local storage, merges multi-format entries, and exposes active drafts to Halo/Dynamic Island and editors.

---

## 5. Standalone Extraction Runbook

To package WikiOS as an independent library (`@wikios/core`):
1. Export `src/lib/wiki-os/` as a dedicated package.
2. Provide host-app authentication via `auth.ts` (`WikiAuthContext`).
3. Connect custom game or business data via `template-resolver.ts` (`registerTemplateProvider`).
