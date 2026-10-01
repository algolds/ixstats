# WikiOS Core Engine (`src/lib/wiki-os/`)

**Status**: Primary & Default Encyclopedia Engine  
**Package**: in-repo module (`~/lib/wiki-os`), not a published package  
**Runtime**: TypeScript 7.0, Bun 1.4+  
**Platform**: IxStates 1.4.0 Lobster Crosby (Release Candidate)  

---

## 1. Purpose & Architectural Vision

WikiOS is the **primary and default encyclopedia platform** for the IxStates ecosystem. It replaces traditional MediaWiki user-facing pages with a modern Next.js 16.3 / React 19 visual experience, while maintaining the traditional MediaWiki installation (`https://ixwiki.com/`) as a fully functional **classic/fallback experience**.

```
                               ┌──────────────────────────────────────────────────────────┐
                               │                    WikiOS Primary Hub                    │
                               │           (/wiki, /wiki/[...slug], /util/categories)        │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                            ┌───────────────────────────────┴───────────────────────────────┐
                            ▼                                                               ▼
             ┌─────────────────────────────┐                                 ┌─────────────────────────────┐
             │   IxWiki (PostgreSQL store) │                                 │   IIWiki & AltHistory       │
             │ wiki_articles / _revisions  │                                 │  (Sister Community Realms)  │
             ├─────────────────────────────┤                                 ├─────────────────────────────┤
             │ • <2ms Pre-compiled Reads   │                                 │ • Multi-Wiki HTTP Adapter   │
             │ • <10ms Atomic Writes       │                                 │ • 5-min Memory/LRU Cache    │
             │ • Direct Taxonomy Graph     │                                 │ • Circuit Breakers (403)    │
             │ • recentchanges Inbound Sync│                                 │ • Cross-Wiki Parse Proxy    │
             └──────────────┬──────────────┘                                 └─────────────────────────────┘
                            │
                            │ (Asynchronous Export Mirroring)
                            ▼
             ┌─────────────────────────────┐
             │    MediaWiki Export Worker  │
             │  (Action API, bot session)  │
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
   - Reads articles, wikitext, revisions, categories, and backlinks from PostgreSQL (`WikiArticle`, `WikiRevision`, `WikiLink`, `WikiCategory*`) via `ArticleRepository` and `adapters/mediawiki/bridge/pg-*.ts`. There is no direct MariaDB connection (the `mysql2` pool was removed on 2026-08-25).
   - Uses the MediaWiki HTTP Action API (`action=parse`) as a headless renderer for templates/Lua, and PostgreSQL (`WikiCache`) for structured infoboxes and country metadata.
2. **Write Path (<10ms)**:
   - Saves directly to PostgreSQL `ArticleRepository` in a single transaction.
   - Asynchronously enqueues `MediaWikiExportWorker` (in-process queue) to mirror edits to classic MediaWiki through the Action API using the bot session, without blocking the user. Authorship is kept in `WikiRevision.author`; upstream per-user actor attribution is not implemented.
3. **Classic MediaWiki Fallback**:
   - `https://ixwiki.com/` remains accessible at all times for users preferring the classic MediaWiki Vector interface.
   - Edits made on classic MediaWiki are pulled into PostgreSQL by `services/auto-sync-service.ts` (`runAutoSyncCycle`), run by the `wiki-recentchanges` cron job and the authenticated `/api/wikios/inbound-sync` webhook.

---

## 3. Directory Layout

```
src/lib/wiki-os/
├── adapters/
│   ├── ixstates/         # Sovereignty & nation eligible country service
│   ├── mediawiki/        # Core MediaWiki bridge & database readers
│   │   ├── bridge/
│   │   │   ├── pg-reader.ts     # PostgreSQL article/wikitext reader (+ pg-search, pg-activity, pg-taxonomy, pg-site)
│   │   │   ├── http-reader.ts   # Resilient sister-wiki HTTP adapter (IIWiki/AltHistory)
│   │   │   └── dispatchers.ts   # Public multi-wiki dispatching engine
│   │   ├── article-store.ts     # PostgreSQL cache & shadow synchronization
│   │   └── sync-worker.ts       # Non-blocking MediaWiki background export worker
├── core/                 # ArticleRepository, link graph, native search, media assets, WikiAST
├── editor/               # Draft store & local cache (Plate editor UI lives in src/components/wiki-os/editor/)
├── services/             # auto-sync-service.ts (recentchanges inbound sync)
├── transformers/         # Infobox parsers, image URL hash math, WikiAST ↔ wikitext converter
├── wikitext/             # Wikitext parser & serializer
└── templates/            # Custom template resolver, presets & preview cache
```

---

## 4. Multi-Wiki Support

WikiOS provides first-class support for sister community wikis via the strict `WikiSource` union:

```ts
export type WikiSource = "ixwiki" | "iiwiki" | "althistory";
```

- **`ixwiki`**: Local PostgreSQL store; the only editable source.
- **`iiwiki`** & **`althistory`**: External community sister wikis read over HTTP with a 5-minute circuit breaker for offline/403 hosts. In the reader they open via `/wiki/<title>?source=…` and are read-only (links, Watch, edit route and `?margin` follow the page's wiki).
- **`all`**: Parallel concurrent queries (`Promise.all`) for unified cross-encyclopedia search (`api.wikios.search`).
