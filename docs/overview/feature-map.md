# Feature Map & Inventory

**Last updated:** June 2026

This document inventories the primary code areas. Use it when auditing coverage, mapping dependencies, or planning refactors.

## App Router (`src/app`)

### IxWiki (Integrated Product)
| Route | Purpose |
| --- | --- |
| `/w` | Wiki integration tools and info |

### IxVault (Integrated Product)
| Route | Purpose |
| --- | --- |
| `/vault` | IxVault — cards, collections, crafting, trading, marketplace, packs, lore cards, NS import |

### MyCountry ★ (Core System)
| Route | Purpose |
| --- | --- |
| `/mycountry` | Executive command suite |
| `/mycountry/executive` | Executive decision-making |
| `/mycountry/diplomacy` | Diplomatic operations hub |
| `/mycountry/intelligence` | Analytics and intelligence feeds |
| `/mycountry/defense` | Military and security operations |
| `/mycountry/map-editor` | Player border and feature editing |

### ThinkPages (Core System)
| Route | Purpose |
| --- | --- |
| `/thinkpages` | Social knowledge sharing (ThinkShare, ThinkTanks, IxTwitter) |

### Achievements & Awards (Core System)
| Route | Purpose |
| --- | --- |
| `/achievements` | Achievement explorer and detail views |

### MyCountry Builder (Core System)
| Route | Purpose |
| --- | --- |
| `/builder` | Nation creation and editor flows |

### Admin CMS (Core System)
| Route | Purpose |
| --- | --- |
| `/admin` | Administrative dashboards and tooling |
| `/admin/maps` | Admin map management, SVG upload, world generation |

### Navigation Hubs
| Route | Purpose |
| --- | --- |
| `/` | Auth-aware landing (splash page vs command center) |
| `/dashboard` | Signed-in overview widgets and cards |
| `/dashboard/diplomacy` | Dashboard diplomacy section |
| `/dashboard/feed` | Dashboard activity feed |
| `/dashboard/trends` | Dashboard trends section |
| `/leaderboards` | Global rankings and comparative stats |

### IxWorld (Integrated Product — standalone at maps.ixwiki.com)
| Route | Purpose |
| --- | --- |
| `/maps` | World map viewer |

### Infrastructure
| Route | Purpose |
| --- | --- |
| `/help` | In-app documentation hub |

### Auth / Onboarding
| Route | Purpose |
| --- | --- |
| `/setup`, `/sign-in`, `/sign-up` | Onboarding and auth surfaces |

> Additional experimental/test routes live under `/test-*` and internal tooling paths.

## Component Libraries (`src/components`)
- `achievements/`, `analytics/`, `charts/`, `countries/` – domain dashboards and data viz
- `diplomatic/`, `defense/`, `economy/`, `tax-system/` – specialised modules for systems guides
- `mycountry/` – shell, intelligence tabs, compliance dialogs, quick actions
- `thinkpages/`, `thinkshare/` – social layouts, feeds, collaboration primitives (ThinkShare, ThinkTanks are ThinkPages sub-systems)
- `maps/core/`, `maps/editor/`, `maps/widgets/` – MapLibre world map, border editor, embedded widgets (27 components)
- `ui/`, `shared/`, `magicui/`, `controls/` – base UI elements and utility widgets

## Hooks & Services
- Hooks in `src/hooks` and `src/app/**/hooks` coordinate client state (e.g., `useMyCountryCompliance.ts`, `usePageTitle.ts`, `useMapData.ts`, `useBorderEditor.ts`, `useMapEditor.ts`, `useMapPinInfo.ts`, `useCountryMapEmbed.ts`)
- Services under `src/app/mycountry/services`, `src/services`, and `src/lib` encapsulate data fetches, caching, and job orchestration

## tRPC Routers (`src/server/api/routers`)
**83 routers / 1,329 procedures**. Key files:

### IxVault (Integrated Product)
```
vault.ts               cards.ts               card-packs.ts
card-market.ts         card-analytics.ts       cardImages.ts
crafting.ts            trading.ts              lore-cards.ts
ns-import.ts
```

### MyCountry & Subsystems (Core System)
```
mycountry.ts           intelligence.ts          unified-intelligence.ts
diplomatic-intelligence.ts  diplomatic.ts       security.ts
sdi.ts                 government.ts            elections.ts
economics.ts           enhanced-economics.ts    eci.ts
atomicEconomic.ts      atomicGovernment.ts      atomicTax.ts
unifiedAtomic.ts       taxSystem.ts             resources.ts
transport.ts           meetings.ts              nationalIssues.ts
crisis-events.ts       policies.ts              scheduledChanges.ts
quickactions.ts        historical.ts
```

### Other Routers
```
achievements.ts        activities.ts           admin.ts
archetypes.ts          countries.ts            optimized-countries.ts
customTypes.ts         formulas.ts             thinkpages.ts
notifications.ts       roles.ts                users.ts
user-logging.ts        wikiCache.ts            wikiImporter.ts
forum.ts               geo.ts                  demoMode.ts
autosaveHistory.ts     autosaveMonitoring.ts
```
- Auth-aware context lives in `src/server/api/trpc.ts`
- Middleware: rate limiting (`~/lib/rate-limiter`), user logging (`~/lib/user-logging-middleware`)

## Database & Data Flow
- Prisma schema: `prisma/schema.prisma` (206 models)
- Seed scripts: `scripts/setup/`
- ETL & audits: `scripts/audit/` (wiring verifier, CRUD sweeps, economic calculators)
- PostgreSQL database: `localhost:5433/ixstats` (migrated from SQLite in October 2025)
- Legacy SQLite backups: `prisma/backups/sqlite-legacy/`

## Realtime Infrastructure
- `server.mjs` boots Next.js and attaches Socket.IO in production
- WebSocket logic: `src/lib/websocket-server.ts`
- Client integration: intelligence dashboards, diplomatic feeds, and live notifications

## Help & Documentation Surfaces
- `/help` React pages with shared layouts in `src/app/help/_components`
- Markdown docs in `docs/` (this directory)
- Feature-level READMEs stored alongside implementation (e.g., `src/app/mycountry/README.md`)

Keep this map aligned with real files. When adding new directories or routers, update the tables above so downstream docs and automation stay accurate.
