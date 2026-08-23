# WikiOS Core Engine (`src/lib/wiki-os/`)

**Status**: Primary & Default Encyclopedia Engine  
**Package**: `@wikios/core`  
**Runtime**: TypeScript 7.0, Bun 1.4+  
**Platform**: IxStates 1.4.0 Ogma (RC-1)  

---

## 1. Purpose & Architectural Vision

WikiOS is the **primary and default encyclopedia platform** for the IxStates ecosystem. It replaces traditional MediaWiki user-facing pages with a modern Next.js 16.3 / React 19 visual experience, while maintaining the traditional MediaWiki installation (`https://ixwiki.com/`) as a fully functional **classic/fallback experience**.

```
                               ┌──────────────────────────────────────────────────────────┐
                               │                    WikiOS Primary Hub                    │
                               │           (/wiki, /wiki/[slug], /wiki/categories)        │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                            ┌───────────────────────────────┴───────────────────────────────┐
                            ▼                                                               ▼
             ┌─────────────────────────────┐                                 ┌─────────────────────────────┐
             │       IxWiki Database       │                                 │   IIWiki & AltHistory       │
             │   (Direct MariaDB/Postgres) │                                 │  (Sister Community Realms)  │
             ├─────────────────────────────┤                                 ├─────────────────────────────┤
             │ • <2ms Binary SQL Reads     │                                 │ • Multi-Wiki HTTP Adapter   │
             │ • <10ms Atomic Writes       │                                 │ • 5-min Memory/LRU Cache    │
             │ • Direct Taxonomy Graph     │                                 │ • Circuit Breakers (403)    │
             │ • Zero MediaWiki PHP Lag    │                                 │ • Cross-Wiki Parse Proxy    │
             └──────────────┬──────────────┘                                 └─────────────────────────────┘
                            │
                            │ (Asynchronous Export Mirroring)
                            ▼
             ┌─────────────────────────────┐
             │    MediaWiki Export Worker  │
             │  (Attributed MariaDB Patch) │
             └──────────────┬──────────────┘
                            │
                            ▼
             ┌─────────────────────────────┐
             │    Classic MediaWiki (Web)  │
             │   (https://ixwiki.com/wiki) │
             └─────────────────────────────┘
```

---

## 2. Storage & Write Pipeline

1. **Read Path (<2ms)**:
   - Queries direct MariaDB binary socket connection pool (`mysql2/promise`) for raw wikitext, revisions, categories, and backlinks.
   - Leverages PostgreSQL (`WikiArticle`, `WikiCache`) for structured infoboxes, Lore Stash bookmarks, and sovereign country metadata.
2. **Write Path (<10ms)**:
   - Saves directly to PostgreSQL `ArticleRepository` in a single transaction.
   - Asynchronously enqueues `MediaWikiExportWorker` to mirror edits to MariaDB and legacy MediaWiki APIs, maintaining 100% data parity without blocking the user.
3. **Classic MediaWiki Fallback**:
   - `https://ixwiki.com/` remains accessible at all times for users preferring the classic MediaWiki Vector interface.
   - Any edits made on classic MediaWiki are immediately reflected in WikiOS via direct MariaDB database queries.

---

## 3. Directory Layout

```
src/lib/wiki-os/
├── adapters/
│   ├── ixstates/         # Sovereignty & nation eligible country service
│   ├── mediawiki/        # Core MediaWiki bridge & database readers
│   │   ├── bridge/
│   │   │   ├── mysql-reader.ts  # Direct MariaDB binary query engine (<2ms)
│   │   │   ├── http-reader.ts   # Resilient sister-wiki HTTP adapter (IIWiki/AltHistory)
│   │   │   └── dispatchers.ts   # Public multi-wiki dispatching engine
│   │   ├── article-store.ts     # PostgreSQL cache & shadow synchronization
│   │   └── sync-worker.ts       # Non-blocking MediaWiki background export worker
├── core/                 # Native search service & ArticleRepository
├── editor/               # PlateJS visual block editor & wikitext source editor
├── transformers/         # Infobox parsers, image URL hash math, wikitext compiler
└── templates/            # Custom template resolver & macro provider
```

---

## 4. Multi-Wiki Support

WikiOS provides first-class support for sister community wikis via the strict `WikiSource` union:

```ts
export type WikiSource = "ixwiki" | "iiwiki" | "althistory";
```

- **`ixwiki`**: Local high-speed database engine (MariaDB binary protocol + Postgres metadata).
- **`iiwiki`** & **`althistory`**: External community sister wikis with memory caching and circuit breaker protection.
- **`all`**: Parallel concurrent queries (`Promise.allSettled`) for unified cross-encyclopedia search.
