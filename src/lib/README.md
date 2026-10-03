# Library Architecture (`src/lib`)

**Last updated:** September 2026

`src/lib` hosts shared services, domain engines, calculation models, and platform infrastructure. Under the ponytail modular architecture, domain-specific logic, system services, and data utilities are organized into 52 subpackages (`src/lib/<domain>/`). About half of them expose a typed barrel (`index.ts`); the rest (e.g. `economy/`, `system/`, `vault/`, `maps/`, `realms/`, `onoma/`) are imported by file path.

Only **15 files** reside in the root of `src/lib/`.

---

## 1. Root Primitives (Global Only)

The root level of `src/lib/` is strictly reserved for platform-wide architectural primitives, runtime type safety, and global configurations:

| Layer | File | Description |
|---|---|---|
| **Core Architecture** | [`app-error.ts`](app-error.ts) | Universal `AppError` exception class with HTTP and tRPC status codes. |
| | [`prisma-error.ts`](prisma-error.ts) | Database error translation and duplicate/foreign key constraint handlers. |
| | [`buildVersion.ts`](buildVersion.ts) | Canonical single source of truth for platform versions, release names, and component capability integers (per `revision.md`). |
| | [`buildVersion.generated.ts`](buildVersion.generated.ts) | Automated pre-build git commit SHA generator output. |
| | [`base-path.ts`](base-path.ts) | Subdomain host inspector and URL prefix routing helper (`/projects/ixstates` vs standalone). |
| | [`enums.ts`](enums.ts) | Universal system-level enumeration constants. |
| **Shared Utilities** | [`color.ts`](color.ts) | Zero-dependency HSL/RGB/HEX color math and conversion. |
| | [`tier-utils.ts`](tier-utils.ts) | Membership and economic tier formatting/normalization. |
| | [`markdown-document.ts`](markdown-document.ts) | Parser for Markdown documents under `src/content/` (help, terms, privacy). |
| | [`audio-store.ts`](audio-store.ts) · [`playback-engine.ts`](playback-engine.ts) | Media player queue store and playback engine (narrator / MiniPlayer). |
| **Platform Config** | [`config-service.ts`](config-service.ts) | Database-backed `SystemConfig` settings cache and retrieval client. |
| | [`navigation-config.ts`](navigation-config.ts) | App shell navigation tree, topbar links, sidebar menus, and command palettes. |
| | [`event-bus.ts`](event-bus.ts) | Universal EventEmitter singleton for cross-cutting in-memory pub/sub events. |
| | [`gameplay-flags.ts`](gameplay-flags.ts) | Runtime evaluation for gameplay feature toggles and flags. |

---

## 2. Modular Subpackages Catalog

All domain logic is partitioned into dedicated subpackages in `src/lib/<domain>/`. Subpackages with a master `index.ts` barrel: `activity`, `ai`, `auth`, `builder`, `cache`, `country-geo`, `demo-seed`, `discord`, `heraldry`, `ixtime`, `logging`, `lorewards`, `media`, `military`, `national-issues`, `nationstates`, `notifications`, `policies`, `sports`, `themes`, `utils`, `websocket`, `wiki-os`. Highlights:

### Platform Infrastructure & Foundations
- **`src/lib/cache/`** — Redis/in-memory cache client, sliding window rate limiters, stampede protection, outbound HTTP cache, and tRPC response caching middleware.
- **`src/lib/system/`** — Structured JSON logging, query performance monitoring, boot-time system validations, connection pooling, V8 memory profiling, and process error handlers.
- **`src/lib/utils/`** — Universal Tailwind `cn()` merger, currency/number formatters, date utilities, chart math, CSV/PDF report exporters, and HTML sanitizers.
- **`src/lib/auth/`** — CASL permission definitions, ability builders, Clerk/Prisma user management, and system-owner security constants.
- **`src/lib/websocket/`** — Real-time Socket.IO servers, reconnection managers, marketplace streams, and intelligence broadcasts.
- **`src/lib/logging/`** — Security audit logs, user action tracking, and database logging middleware.

### Simulation Engines & Mechanics
- **`src/lib/economy/`** — GDP growth models, tax calculators, fiscal policy engines, currency converters, auctions, and trade logistics.
- **`src/lib/government/`** — Government component synergies, budget allocation engines, election crons, and political drift simulations.
- **`src/lib/statecraft/`** — Goal classifiers, power broker influence networks, parliamentary whips, and reconnaissance simulations.
- **`src/lib/military/`** — Force projection calculators, unit deployments, conflict resolution engines, and readiness scoring.
- **`src/lib/intelligence/`** — Intelligence vitality metrics, network graphs, threat indicators, and operational planning.
- **`src/lib/diplomacy/`** — Embassy management, international incident tracking, bilateral relationship matrices, and treaty networks.
- **`src/lib/policies/`** — National policy catalog, reform effects synchronizers, and policy maintenance cron jobs.
- **`src/lib/national-issues/`** — National issue generator, dilemma option trees, and long-term socio-economic consequences.
- **`src/lib/builder/`** — Atomic nation builder state managers, dossier parsers, and bidirectional synchronization engines.
- **`src/lib/ixtime/`** — Custom IxTime simulation calendar, epoch synchronization, and economic time-scaling algorithms.

### Cards, Media & Social
- **`src/lib/cards/`** — Card minting service, pack opening sequence generators, holographic card foil shaders, market valuation models, and XP progression.
- **`src/lib/vault/`** — IxVault facade, atomic credit ledger transactions, daily login bonus streaks, and passive income distributors.
- **`src/lib/achievements/`** — Milestone definitions, quest trackers, achievement progression, and scaling reward formulas.
- **`src/lib/lorewards/`** — Wiki contribution bounty rewards, card value calculators, and passive card income workers.
- **`src/lib/activity/`** — Player activity feeds, event spine dispatchers, and notification event generators.
- **`src/lib/discord/`** — Discord Webhook notification dispatchers, rich embeds, and bot formatters.
- **`src/lib/nationstates/`** — Official NationStates XML API v12 client, deck synchronization processor, and shard parsers.
- **`src/lib/media/`** — Unsplash API integration, image palettes, sound FX triggers, and asset caching.
- **`src/lib/themes/`** — Facet design system themes, chromatic palettes, and charting color token mappings.
- **`src/lib/ai/`** — NLP sentiment analysis and AI text classification helpers.

### Maps, Geography & World Generation
- **`src/lib/maps/`** — MapLibre GL pipelines, GeoJSON compression, shared vertex topology engines, border tracing, and spatial indexers.
- **`src/lib/country-geo/`** — PostGIS spatial SQL queries, territorial compliance validation, and geographic boundary analyzers.
- **`src/lib/worldgen/`** — UPG v2 procedural Voronoi mesh generator, coastal hypsometry, Catmull-Rom splines, and marching squares.
- **`src/lib/realms/`** — Realms (multi-world) helpers: realm ids, slugs, and lore import; server-side realm services live in `src/server/modules/realms/`.

### Knowledge & Wiki Engine
- **`src/lib/wiki-os/`** — Decoupled native knowledge engine, authoritative PostgreSQL repository (`wiki_articles`, `wiki_revisions`, `wiki_links`), relational link graph (`LinkGraphService`), Canvas visual block editor, and the MediaWiki adapter/bridge (`adapters/mediawiki/bridge/`: PostgreSQL reads + live Action API over HTTP).

---

## 3. Import Conventions

Always import from domain packages using the path alias `~/lib/<package>` or `@/lib/<package>`:

```typescript
// ✅ Good: Clean package imports via barrel exports
import { formatCurrency, formatNumber, cn } from "~/lib/utils";
import { rateLimiter, globalCache } from "~/lib/cache";
import { ArticleRepository, LinkGraphService } from "~/lib/wiki-os";

// ✅ Also fine: packages without a barrel are imported by file
import { memoryConfig } from "~/lib/system/dev-memory-config";
import { IxStatsCalculator } from "~/lib/economy/calculations";

// ❌ Avoid: Importing from deep legacy root paths
import { formatCurrency } from "~/lib/format-utils"; // Removed — now ~/lib/utils
import { rateLimiter } from "~/lib/rate-limiter";     // Removed — now ~/lib/cache
```

---

## 4. Development Guidelines

1. **Pure Functions First**: Keep simulation and calculation functions pure and idempotent.
2. **Encapsulate Side Effects**: Confine database operations, Redis interactions, and outbound HTTP calls to services or cron workers within their respective subpackages.
3. **No Cross-Domain Monoliths**: If a helper is specific to a domain, place it in `src/lib/<domain>/`. If it is shared across all domains (like `cn` or `logger`), use `src/lib/utils/` or `src/lib/system/`.
4. **Unit Tests**: Place test files in the centralized tree at `src/tests/lib/<domain>/` (mirroring the source path). Run targeted tests with `bun run test -- <pattern>` or `bun run test:unit` for all of `src/tests/lib`.
