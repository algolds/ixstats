# WikiOS Engine Core (`src/lib/wiki-os/`)

**Architecture Status**: Graduated Standalone-Capable Engine  
**Target Package**: `@wikios/core` 

---

## 1. Purpose & Design Philosophy

`src/lib/wiki-os/` is the pure, standalone-capable core of **WikiOS** — a high-performance modern Next.js/React frontend and multi-tier storage engine for MediaWiki communities and worldbuilding archives.

### Strict Graduation Boundary
- **Zero Game Couplings**: This directory contains **NO** references to IxStates-specific game domain models (`Country`, `Card`, `LoreCategory`, `PointOfInterest`, `TaxPolicy`).
- **Pluggable Host Seams**: Any application-specific data (such as national dynamic stats or custom infobox transclusion) connects via pluggable interfaces (`TemplateDataProvider`, `WikiStorageDriver`, `WikiAuthContext`).
- **Headless MediaWiki**: Uses MediaWiki purely as a backend render and template execution service, while providing local high-speed (<5ms) cached reads and optimistic visual editing.

---

## 2. Component Architecture Map

```
src/lib/wiki-os/
├── config.ts              # Canonical configuration, loopback endpoints & sources
├── types.ts               # Canonical MediaWiki & WikiOS typed contracts (Branded types)
├── bridge.ts              # High-speed direct MariaDB/MySQL connector driver (~38ms)
├── image-url.ts           # Client-safe MediaWiki image URL & thumbnail resolver
├── infobox-parser.ts      # Zero-dependency wikitext infobox & template tokenizer
│
├── storage-driver.ts      # Storage interface (WikiStorageDriver, StoredArticle, StoredRevision)
├── drivers/
│   ├── postgres-driver.ts # PostgreSQL (Prisma-backed) storage driver
│   ├── sqlite-driver.ts   # Standalone SQLite storage driver (zero dependency)
│   └── memory-driver.ts   # In-memory storage driver for sandboxes and testing
│
├── article-store.ts       # 4-tier resilient read pipeline & pre-rendered HTML cache
├── wikios-cache.ts        # In-memory LRU + IndexedDB multi-tier cache layer
├── search-service.ts      # PostgreSQL full-text & trigram fuzzy search engine (<3ms)
├── html-transformer.ts    # Server-side HTML post-processor (Infobox, TOC, Notices)
├── parsoid-client.ts      # Headless Parsoid REST API bridge (loopback-accelerated)
│
├── template-resolver.ts   # Pluggable wikitext template provider registry
├── template-registry.ts   # Client-side TemplateData registry & parameter schema
│
├── sync-queue.ts          # Offline-first client background sync queue (0ms perceived saves)
├── draft-store.ts         # LocalStorage/IndexedDB visual editor autosave & recovery
├── fix-editor-images.ts   # Pre-save regex image transformer & sanitizer
├── wiki-write-service.ts  # CSRF-managed Action API write service
├── csrf-cache.ts          # MediaWiki CSRF token cache with automatic TTL refresh
├── wikitext-diff.ts       # LCS visual wikitext diff calculator
│
├── auth.ts                # Auth provider abstraction seam
├── use-wiki-auth.ts       # Client hook abstraction for identity & roles
├── storage.ts             # Host storage/identity resolution seam
│
└── __tests__/             # Engine unit test suites (Storage, Cache, Search)
    ├── search-service.test.ts
    ├── storage-driver.test.ts
    └── wikios-cache.test.ts
```

---

## 3. Storage Drivers (`drivers/`)

WikiOS abstracts storage through the `WikiStorageDriver` interface:

```typescript
import { setStorageDriver, MemoryStorageDriver } from "~/lib/wiki-os/storage-driver";

// In unit tests or sandboxes:
setStorageDriver(new MemoryStorageDriver());
```

| Driver | File | Best For |
|---|---|---|
| `PostgresStorageDriver` | `drivers/postgres-driver.ts` | Scaled production with PostgreSQL / Prisma |
| `SqliteStorageDriver` | `drivers/sqlite-driver.ts` | Zero-dependency standalone and embedded deployments |
| `MemoryStorageDriver` | `drivers/memory-driver.ts` | Ephemeral test runners and Jest suites |

---

## 4. Multi-Tier Resilient Storage Pipeline (`article-store.ts`)

Article reads resolve through a 4-tier waterfall:

```
[Tier 1: Fresh Postgres Shadow] (<5ms)
       │ (Cache Miss)
       ▼
[Tier 2: Direct MariaDB MySQL] (~38ms)
       │ (MySQL Unavailable / Offline)
       ▼
[Tier 3: MediaWiki Action API HTTP] (~400ms)
       │ (Network Down / 502 Bad Gateway)
       ▼
[Tier 4: Stale Shadow Fallback] (stale: true, <5ms)
```

---

## 5. Standalone Extraction Runbook

To package WikiOS as an independent npm library (`@wikios/core`):
1. Copy `src/lib/wiki-os/` to a dedicated package repository.
2. Ensure `package.json` specifies optional peer dependencies for `mysql2`, `@prisma/client`, or `better-sqlite3`.
3. Consumers provide their own auth provider via `auth.ts` and storage adapter via `storage-driver.ts`.
