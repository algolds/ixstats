# Library Architecture (`src/lib`)

**Last updated:** August 2026 (Phase 8 `/ponytail` Modular Architecture)

`src/lib` hosts shared services, domain engines, calculation models, and platform infrastructure. Under the `/ponytail` modular architecture, all domain-specific logic, system services, and data utilities are organized into isolated, self-contained subpackages with typed barrel exports (`index.ts`).

Only **14 global primitives** (Core Architecture, Type Normalization, and Platform Configuration) reside in the root of `src/lib/`.

---

## 1. Root Primitives (Global Only)

The root level of `src/lib/` is strictly reserved for platform-wide architectural primitives, runtime type safety, and global configurations:

| Layer | File | Description |
|---|---|---|
| **Core Architecture** | [`app-error.ts`](file:///home/jxsig/projects/ixstats/src/lib/app-error.ts) | Universal `AppError` exception class with HTTP and tRPC status codes. |
| | [`prisma-error.ts`](file:///home/jxsig/projects/ixstats/src/lib/prisma-error.ts) | Database error translation and duplicate/foreign key constraint handlers. |
| | [`buildVersion.ts`](file:///home/jxsig/projects/ixstats/src/lib/buildVersion.ts) | Canonical single source of truth for platform versions, release names, and component capability integers (per `revision.md`). |
| | [`buildVersion.generated.ts`](file:///home/jxsig/projects/ixstats/src/lib/buildVersion.generated.ts) | Automated pre-build git commit SHA generator output. |
| | [`base-path.ts`](file:///home/jxsig/projects/ixstats/src/lib/base-path.ts) | Subdomain host inspector and URL prefix routing helper (`/projects/ixstates` vs standalone). |
| | [`enums.ts`](file:///home/jxsig/projects/ixstats/src/lib/enums.ts) | Universal system-level enumeration constants. |
| **Type Normalization** | [`type-guards.ts`](file:///home/jxsig/projects/ixstats/src/lib/type-guards.ts) | Generic runtime type guards for strings, numbers, arrays, and objects. |
| | [`interface-standardizer.ts`](file:///home/jxsig/projects/ixstats/src/lib/interface-standardizer.ts) | Schema normalizer for priority codes and category labels. |
| **Platform Config** | [`config-service.ts`](file:///home/jxsig/projects/ixstats/src/lib/config-service.ts) | Database-backed `SystemConfig` settings cache and retrieval client. |
| | [`navigation-config.ts`](file:///home/jxsig/projects/ixstats/src/lib/navigation-config.ts) | App shell navigation tree, topbar links, sidebar menus, and command palettes. |
| | [`event-bus.ts`](file:///home/jxsig/projects/ixstats/src/lib/event-bus.ts) | Universal EventEmitter singleton for cross-cutting in-memory pub/sub events. |
| | [`gameplay-flags.ts`](file:///home/jxsig/projects/ixstats/src/lib/gameplay-flags.ts) | Runtime evaluation for gameplay feature toggles and flags. |

---

## 2. Modular Subpackages Catalog

All domain logic is partitioned into dedicated subpackages in `src/lib/<domain>/`. Each subpackage provides a master `index.ts` barrel export:

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
- **`src/lib/maps/`** — Mapbox GL pipelines, GeoJSON compression, shared vertex topology engines, border tracing, and spatial indexers.
- **`src/lib/country-geo/`** — PostGIS spatial SQL queries, territorial compliance validation, and geographic boundary analyzers.
- **`src/lib/worldgen/`** — UPG v2 procedural Voronoi mesh generator, coastal hypsometry, Catmull-Rom splines, and marching squares.

### Knowledge & Wiki
- **`src/lib/wiki/`** — MediaWiki API client (`IxStats-Builder` UA), wikitext infobox parsers, search indexers, and lore card generators.
- **`src/lib/wiki-os/`** — Native PlateJS wiki editor store, block parsers, and Parsoid synchronization layer.

---

## 3. Import Conventions

Always import from domain packages using the path alias `~/lib/<package>` or `@/lib/<package>`:

```typescript
// ✅ Good: Clean package imports via barrel exports
import { formatCurrency, formatNumber, cn } from "~/lib/utils";
import { rateLimiter, globalCache } from "~/lib/cache";
import { logger, devMemoryConfig } from "~/lib/system";
import { IxStatsCalculator } from "~/lib/economy";
import { MilitaryForceCalculator } from "~/lib/military";
import { WikiApiClient } from "~/lib/wiki";

// ❌ Avoid: Importing from deep legacy root paths
import { formatCurrency } from "~/lib/format-utils"; // Deprecated
import { rateLimiter } from "~/lib/rate-limiter";     // Deprecated
```

---

## 4. Development Guidelines

1. **Pure Functions First**: Keep simulation and calculation functions pure and idempotent.
2. **Encapsulate Side Effects**: Confine database operations, Redis interactions, and outbound HTTP calls to services or cron workers within their respective subpackages.
3. **No Cross-Domain Monoliths**: If a helper is specific to a domain, place it in `src/lib/<domain>/`. If it is shared across all domains (like `cn` or `logger`), use `src/lib/utils/` or `src/lib/system/`.
4. **Unit Tests**: Place test files in `src/lib/<domain>/__tests__/` or alongside source code (`foo.test.ts`). Run targeted tests with `bun run test -- <pattern>`.
