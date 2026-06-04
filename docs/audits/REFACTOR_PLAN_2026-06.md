# IxStats Refactor Plan — remaining items (June 2026)

Companion to [AUDIT_2026-06.md](./AUDIT_2026-06.md). Phases 0–4 + the `animated-number`/`useFlag` wrapper migrations are already done. This plan covers everything left, **grounded in a 6-agent code investigation** (real consumer counts, signature compatibility, and per-component split seams verified against the tree). Sized by effort/risk so it can be executed incrementally.

Legend — Risk/Effort: **L**ow / **M**edium / **H**igh.

---

## Tier A — Safe, high-confidence (do first, minimal risk)

| Item | What | R | E |
|------|------|---|---|
| A1 | **Delete `lib/economic-data-templates.ts`** — verified **0 consumers**; pure re-export of `economy-factory`. | L | XS |
| A2 | **Delete deprecated `extractTextLabels` in `lib/province-importer/parse-provinces.ts`** (lines ~982–991) — **0 consumers**; callers already use `extractAllTextLabels`. | L | XS |
| A3 | **Delete disabled polling blocks** in `mycountry/components/RealTimeDataService.tsx` (~225–257) and `mycountry/hooks/useDataSync.ts` (~449–454). Investigation confirms both are **redundant dead code** — tRPC already handles refetching; `useDataSync` is the live sync path. Remove the commented blocks (keep the active `forceRefresh`/`forceUpdateStatus` paths). | L | S |
| A4 | **Merge `types/intelligence-unified.ts` → `types/unified-intelligence.ts`** — facade (11 consumers) folded into the source of truth; repoint the 11 imports. Pure type move, no runtime change. | L | S |
| A5 | **SimpleFlag — 10 inline consumers** (feed, cards, dynamic-island, dashboard, lorewards inline). Drop-in `UnifiedCountryFlag` with mapped `size`. Safe (auto-width acceptable next to text). | L | M |

## Tier B — Worthwhile, needs care (review/QA each)

| Item | What | R | E |
|------|------|---|---|
| B1 | **SimpleFlag — 8 visualizer consumers** (rubiks cubes ×2, waving-flag, random/interactive/pattern grids, animated-bg, lorewards podium). These rely on `object-cover` + fixed cells; `UnifiedCountryFlag` defaults to `object-contain`+`w-auto`. Fix: pass `className="object-cover"` (tailwind-merge overrides the internal class) and/or `fitContainer`. **Requires visual QA** (before/after screenshots) — I can't run the app. After B1+A5 land, delete `SimpleFlag.tsx`. | M | M |
| B2 | **Flag-service consolidation** — merge `country-flag-service.ts` (2 consumers) + `wiki-commons-flag-service.ts` (1) into `unified-flag-service.ts`; dedupe the duplicated `COUNTRY_MAPPINGS`. Investigate/likely-delete `flag-debug.ts` (0 consumers) and `flag-prefetch-initializer.ts` (0 direct imports — verify it isn't a side-effect import in instrumentation before deleting). **Keep** `server-flag-cache.ts` (server-only), `flag-color-analysis.ts`, `flag-color-extractor.ts` (8 consumers), `flag-service.ts` barrel. Net: 9 → ~5 files. | M | M |
| B3 | **Intel-hook consolidation** — 7 → 4 hooks: fold `useRealTimeIntelligence`→`useIntelligenceWebSocket`, `useWikiIntelligence`→`useIntelligenceData`, inline `useIntelligenceMetrics`. Keep `useUnifiedIntelligence` (orchestrator) + `useOptimizedIntelligenceData` (perf layer). Touches ~10 consumer files. | M | M |
| B4 | **economy `utils.ts` format wrappers** (9 uses / 6 files) — **signatures differ** (`formatCurrency(amt, precision)` vs `(value, currency, showDecimals)`; `formatPercentage` is decimal vs raw %). NOT a drop-in. Either keep the wrappers (they're harmless and correct) or fix all 6 call sites carefully. **Recommend: keep** unless you want them gone — the risk (subtle number-format changes) outweighs removing a deprecation tag. | M | M |

## Tier C — Large refactors (component splits, behavior-preserving)

Per the CLAUDE.md modular standard (lib → hooks → focused UI → thin orchestrator). None overlap your active `builder/` work. Ordered by **ROI (impact ÷ risk)**:

| # | Component | Lines | R | Split target (verified seams) |
|---|-----------|-------|---|------|
| C1 | `PlatformActivityFeed.tsx` | 894 | **L** | → `lib/activity-formatting.ts`, `lib/activity-data-transformer.ts`, 4 hooks (`useActivityFeed/Engagement/Filtering/Flags`), 3 UI (`ActivityItem`, `TrendingTopicsSection`, `ActivityFilters`), thin orchestrator. **Best starting point.** |
| C2 | `EnhancedCommandCenter.tsx` | 1,493 | M | → `useSmartDashboardMode`, `useMyCountryTabState`, `lib/dashboard-content-builder.ts`, 4 mode UIs (`Discover/MyCountry/Activity/Admin`), orchestrator. |
| C3 | `navigation.tsx` | 1,589 | M | → `lib/scroll-detection.ts`, `lib/navigation-config.ts` (12 contextual menus), 4 hooks (`useNavigationScroll/ResponsiveNav/NavigationItems/MobileMenuOverflow`), 3 UI, orchestrator. |
| C4 | `admin/military-equipment/page.tsx` | 2,562 | H | → `lib/equipment-catalog-utils.ts`, `lib/manufacturer-utils.ts`, 5 hooks (catalog/manufacturer/mutations/analytics), 5 UI (Catalog/Manufacturers/Analytics tabs + 2 form dialogs), ~150-line page. |
| C5 | `mycountry/MyCountryTabSystem.tsx` | 3,048 | H | → `lib/growth-calculations.ts`, `lib/wiki-integration.ts`, `useMyCountryMetrics`, `useMyCountryNavigation`, tab UIs (`TabsList/OverviewTab/WikiSection`), `UpgradeTeaser`, ~150–200-line orchestrator. |

Each is its own PR with typecheck + visual QA. C1 first proves the pattern at low risk.

## Tier D — Data migrations (substantial, optional)

| Item | What | R | E |
|------|------|---|---|
| D1 | **`small-arms-equipment.ts` (3,432 L, 370+ items) → DB** — 7 consumers (mainly the router + hooks). Needs Prisma model(s), a seed script, and router/hook rewiring. | M | H |
| D2 | **`military-equipment-extended.ts` (1,837 L, 250+ items) → DB** — 34 consumers (`useMilitaryEquipmentCatalog` + components). Same shape as D1, more consumers. | M | H |
| — | **Keep as code:** `seed-fallbacks.ts` (dynamic generators, 3 consumers) and `atomic-government-data.ts` (121 consumers, heavily used) — do **not** migrate. | — | — |

## Tier E — Low-value (recommend skip / wontfix)

Investigation verdicts: **B7** (diplomatic selects — country lookups already use `select`; low value), **B8** (feed in-memory sort — O(n log n) on ≤150 items, fine), **F5** (memo on giant components — negligible win; superseded by the C-tier splits), **F9** (8-provider nesting — standard pattern, low value). **F8** (PlatformActivityFeed query waterfall) is the only one rated *needs-decision* — a real but minor prefetch opportunity, best folded into **C1**.

---

## Decisions (locked 2026-06-03)
- **Scope:** everything, including Tier D data→DB migrations.
- **Component splits:** all of C1–C5.
- **B4:** migrate the economy `utils.ts` call sites (not leave).
- **Verification:** user runs `bun run typecheck` per PR; Claude does not run typechecks or auto-commit (builder/ work is uncommitted). Each tier grouped for separate staging/PR.

## Recommended sequence
1. **Tier A** (one PR — all safe deletes + inline SimpleFlag + type merge).
2. **B1** SimpleFlag visualizers (PR, with your visual QA) → delete `SimpleFlag.tsx`.
3. **C1** PlatformActivityFeed split (proves the modular pattern; absorbs F8).
4. **B2 / B3** flag-lib + intel-hook consolidations (independent, parallelizable).
5. **C2 → C3 → C4 → C5** component splits, one PR each, lowest-risk first.
6. **D1 / D2** data→DB migrations, only if desired (each needs schema + seed + rewire).
7. B4 (keep) and Tier E (skip) unless you say otherwise.

## Verification per phase
- You run `bun run typecheck` (full sequential) and review the log after each PR — I won't run typechecks.
- Visual QA on B1 (flag visualizers) and the C-tier splits (`/verify` or manual screenshots).
- Each item is an isolated commit/PR on `v2` so anything can be reverted independently.

---

## COMPLETION LOG (June 2026)

Executed and verified — 59 changed files, **every relative import resolves**, 0 dangling importers for any deleted file; agent splits behaviour-proven (C5 tab bodies byte-identical to HEAD via normalize-diff; scoped ESLint 0 errors).

| Item | Result |
|------|--------|
| Tier A | dead deletes, disabled polling, 10 inline SimpleFlag |
| B1 | full 18-consumer SimpleFlag → UnifiedCountryFlag; `SimpleFlag.tsx` deleted |
| B2 | flag libs: 2 dead files deleted; service merges **correctly skipped** (not thin wrappers — distinct singletons/types/CoA logic; "duplicated mappings" hypothesis false) |
| A4/B3 | intel: `IntelligenceMetric` collision found to be a **non-issue** (`unified-intelligence.ts` has 0 real importers); documented adapter; deleted dead `useIntelligenceData.ts` (487L); incompatible hook merges skipped |
| C1 | PlatformActivityFeed 894→**181** |
| C2 | EnhancedCommandCenter 1493→**494** |
| C3 | navigation 1589→**226** |
| C4 | military-equipment page 2562→**271** |
| C5 | MyCountryTabSystem 3048→**265** |

**Deferred (NOT executed):**
- **B4** economy format wrappers — 50+ sites; `format-utils` lacks the null→"N/A" guard. Keep wrappers (recommended) or migrate sites with explicit null handling.
- **D1/D2** static-data→DB — needs the dev DB (see below).

## D1/D2 — RE-SCOPED after deeper investigation (do NOT execute blind)

Closer reading shows these are **not** clean "static const → DB" migrations — both are tangled with existing DB/fallback machinery, so a blind migration risks breaking the live equipment features:
- **D2** `military-equipment-extended.ts`: `hooks/useMilitaryEquipmentCatalog.ts` **already** queries `api.militaryEquipment.getCatalogEquipment` (a DB-backed catalog). The static file (`EXPANDED_MILITARY_DATABASE`) + `military-equipment.ts` consts are used **only as a client-side fallback** when the DB returns empty. "Migrating" = seeding into the existing model + removing the fallback — needs the DB to know what's already there.
- **D1** `small-arms-equipment.ts`: served by a **658-line, ~15-procedure router** (`getAll/getByKey/getStatistics/getAllManufacturers/search/getByPriceRange/incrementUsage` + admin CRUD). `incrementUsage` (a `protectedProcedure` that mutates usage) implies existing hybrid DB state. Rewiring every procedure to DB is large and must be validated against the real DB.

**Recommendation:** do D1/D2 in a focused session **with the dev DB reachable**, so the existing models/state can be inspected, the seed verified row-by-row, and the rewired router/hook tested end-to-end (the small-arms browser + equipment catalog). This is the one place blind execution is not safe. Original (now-superseded) sketch retained below for reference.

## D1/D2 — original sketch (superseded — see above)

**Why deferred:** `small-arms-equipment.ts` (370+ items, 13 category consts, per-category-varied spec shapes; served by `routers/smallArmsEquipment.ts`) and `military-equipment-extended.ts` (250+ items; via `hooks/useMilitaryEquipmentCatalog.ts`) have no existing Prisma model. Migrating requires a faithful model + flattening seed + a router/hook returning the **exact** shape the UI consumes — unverifiable without running migrate+seed against the DB and typechecking the client. A silent field-mapping error would break the small-arms browser / equipment catalog in production.

**Plan (per file):**
1. **Schema** (`prisma/schema/military.prisma`): `SmallArmsEquipment` (id, category, name, manufacturerKey, era, `specs Json`, + always-present scalars) + `SmallArmsManufacturer` (key, name, country, `specialty Json`); mirror for `MilitaryEquipmentExtended`. `Json` for the irregular per-category spec blobs.
2. **Seed** (`prisma/seeds/`): import the existing TS consts (keep files as seed source), flatten each category const → rows, `createMany`.
3. **Rewire**: `routers/smallArmsEquipment.ts` + `useMilitaryEquipmentCatalog.ts` query the DB and re-assemble the exact UI return shape (verify field-by-field before switching).
4. **Run (user):** `bunx prisma migrate dev --name add_equipment_catalogs` → seed → exercise the browser/catalog → only then drop the TS import.

Implementable in a follow-up where the dev DB is reachable for verification.
