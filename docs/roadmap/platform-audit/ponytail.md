# Ponytail audit: IxStats `rose-garden` @ `e91e6b0b2` (2026-09-30)

> **Snapshot of `rose-garden` @ `e91e6b0b2` (2026-09-30).** Many findings here were fixed the same day in PR #48;
> see [README §0](README.md#0-status-since-the-audit-updated-2026-09-30-after-48) for current status.

Read-only pass. Nothing in the repo was modified. All helper scripts and raw outputs are in this folder:
`graph.ts` (file reachability incl. cron/scripts/tests roots), `symgraph.ts` (barrel-aware symbol reachability),
`symdead.ts` (export-name census), `procs.ts` + `callers.ts`/`callers2.ts` (runtime tRPC procedure list vs call sites),
and the outputs `symgraph-tests.tsv`, `symgraph-prod.tsv`, `uncalled2.tsv`, `procs2.tsv`, `arch.txt`, `components.json`.

**Builds on, doesn't redo:** `docs/roadmap/code-audit-2026-09-30.md` (MC-18, PL-18, WK-18, SL-6, SL-7, SL-25, AT-16, §8) and
`docs/audits/AUDIT_2026-09-23_bloat-slop.md` (plans 341–346, executed 2026-09-25). Where this audit disagrees with either, it says so.

## Contents

0. [Headline](#0-headline)
1. [Dead code](#1-dead-code)
2. [Duplication](#2-duplication)
3. [Monoliths](#3-monoliths)
4. [Dependencies](#4-dependencies)
5. [`ponytail:` markers (36)](#5-ponytail-markers-36)
6. [Prototypes & flags](#6-prototypes--flags)
7. [Top cut list](#7-top-cut-list)
8. [Method & caveats](#8-method--caveats)

---

## 0. Headline

- **About 21,100 lines in 134 `src/` files are unreachable** from any production root: Next entries, `server.mjs`,
  `cron-runner.mjs` → `jobs.ts`, `ws-backend.mjs`, `scripts/**` and `prisma/**`. Barrels are followed at the symbol level.
  Another 10 files (~2,300 lines) are reached **only by tests**. That's the next "Ponytail" cut.
- **Five big items make up ~10,000 of those lines:**

  | Item | Lines |
  |---|---|
  | The intelligence chain (`engine.ts` is dead too; the 09-23 audit restored it because `calculator.ts` imports it, but `calculator.ts` itself is dead) | 2,668 |
  | `lib/builder/client-calculations.ts` | 1,472 |
  | `components/analytics/` + `analytics-data-transformers.ts` | 2,286 |
  | The demo-seed service (its only caller, an archived script, has a broken `../src` import path) | 3,722 |
  | `lib/logging/user-analytics.ts` (flagged in PL-18 and plan 342, never deleted) | 731 |

- **The tRPC surface is lean.** Plan 341 did its job: only 8 of 961 procedures have no caller.
  - Excluding calls made from dead files adds **8 more**, and the `autosaveHistory` router (154 lines) dies whole.
- **Duplication hot spots:**

  | What | Copies |
  |---|---|
  | "id OR clerkUserId" user lookup | 13 |
  | wiki title → URL slug encoding | 85 sites in 60 files |
  | `spendByCategory` → `deriveBrokers` loop | 6 |
  | `level ≤ 20` staff rule | 7 (the `realms.access.ts` ponytail asked for sharing once a third caller appeared) |
  | bbox helpers | 5 |
  | point-to-segment projection | 3 |
  | domain-twin atomic pickers (economy vs government) | 2 |

- **`audit:wiring` is broken.** `overrides.minimatch: ^3.1.3` breaks `glob@10` with `export 'escape' not found in 'minimatch'`.
  The 09-23 audit said "verify"; it's confirmed broken.
- **`audit:arch` fails.** It reports 15 new over-ceiling files. 52 `src/` files are ≥800 lines.
- **Of the 36 `ponytail:` grep hits** (34 code markers and 2 README mentions):
  - 21 are still fine;
  - 10 should be revisited;
  - 5 are now wrong or moot: `realms.access.ts` (trigger fired), `geo/core/cache.ts` (says LRU, is FIFO), and the three in
    test-only `infobox-mapper.ts`.

---

## 1. Dead code

### 1.1 How "dead" was decided

A file is **dead** when no production root reaches it. The roots are:

- Next entry files;
- `src/proxy.ts`, `src/instrumentation.ts`, `src/env.ts`;
- `server.mjs`, `cron-runner.mjs`, `ws-backend.mjs`, `src/server/cron/jobs.ts` (its lazy `import()`s);
- everything under `scripts/` and `prisma/`.

Barrel `export *` edges count only when a consumer imports a name that the target actually exports. Every row below was then
hand-checked with `grep -rn` for:

- the file path;
- each exported name;
- `import(`/`require(`;
- string dispatch, e.g. `(ActivityHooks as any)[cat][hookName]` in `event-spine.ts`;
- `api.x.y` usage.

Raw list: `symgraph-tests.tsv` (tests counted as roots) and `symgraph-prod.tsv` (tests not counted).

### 1.2 Dead clusters (verified)

| # | Cluster | Files / lines | Evidence |
|---|---|---|---|
| D1 | **Intelligence engine chain** (see note below) | 8 / 2,668 | `calculator.ts` (576) has no importer. Its only symbol, `calculateIntelligence`, appears nowhere else. `engine.ts` (643) is imported only by `calculator.ts:8`. `live-data-transformers.ts` (903) is imported only by `calculator.ts:9`. The types chain is `types/intelligence-live.ts` (23), `intelligence-unified.ts` (17), `intelligence.ts` (324) and `base.ts` (67); `grep "types/intelligence\|types/base"` hits only `src/types/*` and the transformer. `server/api/schemas/intelligence.ts` (115) has no importer. `lib/intelligence/cache.ts` **is live** (`system/production-optimizations.ts:86`). |
| D2 | **`lib/builder/client-calculations.ts`** | 1 / 1,472 | Reached only through `export *` in `lib/builder/index.ts:6`. None of its 14 exported names (`calculateClientAtomicEconomicImpact`, `calculateUnifiedEffectiveness`, …) is imported anywhere. The same-named `detectConflicts`/`getComponentBreakdown` hits are different functions: `lib/government/atomic-utils` and `AtomicEffectivenessService` methods. |
| D3 | **Analytics dashboard** | 21 / 2,286 | `src/components/analytics/**` (20 files, 1,584): `grep "components/analytics"` hits only `lib/utils/index.ts` (a re-export). `lib/utils/analytics-data-transformers.ts` (694): 30 of its 31 names are unused. The one used name, `HistoricalDataPoint`, is a **separate** definition in `types/ixstats.ts:121`. Also `types/analytics-dashboard.ts` (8). |
| D4 | **Demo-seed service** | 15 / 3,722 | `DemoSeedService` has no live caller. The only reference is `scripts/archive/migrations/reset-for-live-preview.ts:20`, and its `../src/lib/...` path resolves to `scripts/archive/src/…` and cannot load. `routers/demo-mode.ts` only exposes `getDemoState`. **Keep** `demo-seed/seed-sports.ts` + `sports/*` (used by `sports/leagues/admin.ts:77` and `scripts/setup/seed-db.ts:66`). Knock-on: every "seed-only" model in audit §8 (`CrisisEvent`, `Treaty`, `MilitaryBranch`, …) has **no runnable writer at all**, so it is fully dead. |
| D5 | **Home-page trio** `app/_components/{LiveGameBanner,LeaderboardsSection,GlobalStatsOverview}.tsx` + `lib/utils/chart-utils.ts` | 4 / 1,206 | `app/_components/index.ts` re-exports all three, but `layout.tsx:13` imports only `Navigation, NavigationTransitionHandler`. `chart-utils.ts` (362): of its exports, only `formatGrowthRateFromDecimal` is used, by the dead trio. The one other name that looks used, `formatDuration` in `NSImportSuiteAdmin.tsx:46`, is an alias of `formatDurationMs`. |
| D6 | **`lib/logging/user-analytics.ts`** | 1 / 731 | Only `export *` in `lib/logging/index.ts:9`; no export name is used. Plan 342 / PL-18 listed it and it is still here. |
| D7 | **`lib/policies/recommender.ts`** | 1 / 702 | Only the `policies/index.ts` barrel; `getPolicyRecommendations`, `getTopPolicyRecommendations` and `getPolicyRecommendationsByType` are called only inside the file. It also sits over the arch ceiling (701 lines). |
| D8 | **MC-18 remainder** (still present) | 11 / 2,344 | `economy/atomic-tax-integration.ts` (477); `builder/tax-revenue-mapping.ts` (140); `activity/auto-post.ts` (283, `activity/index.ts:7` barrel only); `hooks/useBuilderAutoSync.ts` (223, superseded by `useGenericAutoSync`; its `government.create/update/checkConflicts` and `taxSystem.checkConflicts` calls are the only ones); `builder/…/government-preview/*` (5 files, 679); `WikiDeepScanPanel.tsx` (230); `LegislativePolicies.tsx` (137); `IssueCountBadge.tsx` (32); `templates/governmentTemplates.ts` + `archetypes/index.ts` (36). |
| D9 | **`lib/government/builder-validation.ts`** (partial) | ~590 of 640 | 32 of 35 exports are unused. Only the types `BudgetSummary` and `ValidationErrors` are imported (`government/builder/{BudgetMeter,BudgetAllocationList,DepartmentList}.tsx`). The `ValidationResult` hits in hooks are local types. Move the 3 types to `types/government.ts` and delete the rest. |
| D10 | **MyCountry primitives and atomic pieces** | 21 / 2,621 | Barrel-only, no named importer: `StatGauge` (402), `CardBackgroundImage` (200), `StateSeal` (153), `InlineWiki` (150), `SectionContextWidget` (105), `CountryMetricsGrid` (69), `CountryHeader` (51, a *different* file from `app/countries/[slug]/_components/CountryHeader.tsx`), `CutoutPanel` (46, only `SectionContextWidget`), `WikiSectionRow` (110), `NetworkOverviewCard` (134), `EconomicWelcomeModal` (73), and the economy/government atomic `CategoryFilter`, `ComponentSearch`, `TemplateSelector` + government `SynergyDisplay` (8 files, 883). Also **`AutosaveHistoryPanel.tsx` (299)**; see the note below. |
| D11 | **WikiOS leftovers** | 17 / 1,632 | `reader/StashButton.tsx` (428) + `StashManagerModal.tsx` (223): extracted in the WikiOS Ponytail pass, since orphaned, and `ArticleRenderer.tsx:254,540` re-implements stash inline. `shared/WikiOSArticleToolbarWidget.tsx` (214), `WikiOSBrandLockup` (109) and `WikiOSLogo` (39) are unused; the layout uses `WikiOSLogomark`. `adapters/ixstates/{content-extractor,ixworld-mapper}.ts` (279 + 207). 10 unused `index.ts` barrels under `lib/wiki-os/**` and `components/wiki-os/shared` (~150). |
| D12 | **Hooks** | 3 + partial / ~400 | `useWikiSectionMap.ts` (129) and `useWikiPreferences.ts` (47) are used only by dead `InlineWiki`. `useTaxBuilderState()` (the function itself; the file lives on for its re-exported type). Unused hook exports: `useWikiIntelligence` (`useDossier.ts`), `useEconomicComponent(Categories)`, `useGovernmentComponent(Categories)`, `useBatchFlags`, `useFlagPreloader`, `useFeatureAccess`, `usePremiumGate`, `useHasAnyPermission`, `useHasAllPermissions`, `useIsModerator`, `useIsBetaTester`. |
| D13 | **Misc lib** | 12 / ~1,450 | `media/sound-service.ts` (334); `media/image-cache-service.ts` (253); `city-importer/parser.ts` (264; the live code uses `svg-points`/`align-cities`); `vault/vault-type-guards.ts` (209; reached only via the unused `vault/{client,server}.ts`, and its `toUserId`/`StoreItem` hits are unrelated fields); `ai/sentiment-analysis.ts` (90); `military/config.ts` (104); `discord/client.ts` (62); `themes/theme-utils.ts` (30); `flags/client.ts`, `system/client.ts`; `app/builder/constants.ts` (`TAX_SYSTEM_TEMP_DISABLED`, 5); `components/ui/toggle.tsx` (62). |
| D14 | **Misc components** | 4 / ~340 | `builder/…/sections/BuilderHeader.tsx` (160, only `sections/index.ts`); `dev/DevCountryViewSelect.tsx` (135); `sports/core/SportsFocusOverlay.tsx` (19, SL-25); `ui/toggle.tsx`. |
| D15 | **Unused barrels** (safe once their targets go) | ~20 / ~200 | `lib/{discord,military,nationstates,websocket,ai,demo-seed,maps/pipeline,maps/province-importer}/index.ts`, `components/{audio,sports/match,admin/atomic-components}/index.ts`, `app/labs/onoma/components/glyphs/index.ts`, `types/builder/{suggestions,economic-inputs,country-reference}.ts`. The 09-23 audit restored `websocket/index.ts` as "used by server.mjs"; `server.mjs` imports `market-websocket-server.js` directly, not the barrel. |

**D1 note:** the 09-23 audit restored `engine.ts` because `calculator.ts` imports it, but that was wrong: `calculator.ts` is dead, so
`engine.ts` is too. The roadmap's "delete calculator + live-data-transformers" should also cover `engine.ts` and the types.

**D10 note:** the 09-23 log restored `AutosaveHistoryPanel` as "live in the country builder". Its only importer now is
`BuilderHeader.tsx:18`, and nothing imports `BuilderHeader` except the `sections/index.ts` barrel, so it has died since.

### 1.3 Test-only code (production-dead, pinned by a test)

| File | Lines | Pinned by | Call |
|---|---|---|---|
| `server/modules/atomic/services/component-mutations.ts` | 480 | `tests/server/modules/atomic/compound-mutations.test.ts` | No router imports `modules/atomic`. Delete with its test. |
| `components/shared/atomic/{UnifiedAtomicComponentSelector,UnifiedAtomicCard,themes}.tsx` | 695 | `tests/components/atomic-ui-characterization.test.tsx` | Superseded by `shared/atomic-picker/*`. Delete with the characterization test. |
| `lib/maps/pipeline/{vector-synthesis,accuracy-normalizer,geographical-accuracy-analyzer}.ts` | 660 | `tests/lib/maps/pipeline/enrichment-pipeline.test.ts` | An "enrichment" prototype that is never wired into `runMapPipeline`. |
| `lib/wiki-os/adapters/ixstates/infobox-mapper.ts` | 326 | `tests/lib/wiki-infobox-mapper.test.ts` | Holds 3 ponytail markers (§5). |
| `lib/wiki-os/core/{parser-functions,wiki-ast-guards}.ts` | 115 | `core-domain.test.ts`, `wiki-ast.test.ts` | Small; decide with the WikiOS owner. |
| `lib/{vault,cards,system}/{client,server}.ts` | ~150 | `tests/architecture/client-server-entrypoints.test.ts` | That test asserts the files **exist**, but no file imports them, so they are guard-pinned dead barrels. Either route consumers through them, or drop them together with the `exists` assertions. |

### 1.4 tRPC procedures with no caller

The procedure list comes from runtime `appRouter._def.procedures` (961 procedures). A procedure counts as called when any
non-test `src/`/`scripts/` file contains `.<router>.<proc>`, with multi-line chains joined first.

| Procedure | Status | Note |
|---|---|---|
| `users.createCountry` | test-only | Duplicates `countries.createCountry` (`countries/management/create.ts:35`), AT-16 |
| `achievements.unlock` | test-only | admin |
| `cache.getStats` | none | admin |
| `cards.getUserCards` | none | |
| `geoEditor.rebuildAdjacency` | none | AT-16; a missing feature, not dead code |
| `realms.myClaims` | none | AT-5; a missing UI, not dead code |
| `ixnayid.lookupForumUser`, `ixnayid.lookupWikiUser` | none | AT-16 |
| **Cascade** (callers exist only in dead files): `autosaveHistory.getAutosaveHistory`, `autosaveHistory.getAutosaveStats` | dies with D10 | The whole `routers/autosaveHistory.ts` (154) and its root mount go |
| **Cascade:** `countries.getWikiSections`, `wikios.getSectionContent` | dies with D10/D12 | `useWikiSectionMap`, `InlineWiki`, `WikiSectionRow` |
| **Cascade:** `government.create`, `government.update`, `government.checkConflicts`, `taxSystem.checkConflicts` | dies with D8 | Only `useBuilderAutoSync.ts` calls them. **Check before deleting:** the builder may submit through other names (`useBuilderSubmit`). |

`countries.getGlobalStats` and `admin.getSystemStatus` (external consumers) both have in-repo callers too, so neither was at risk.

### 1.5 REST routes with no in-repo caller

The `grep` covered `src`, `scripts`, `docs`, `*.mjs`, `*.sh` and `vercel.json`.

| Route | Lines | Note |
|---|---|---|
| `api/cron/validate-images` | 103 | Header says "add to vercel.json crons". `vercel.json` has none (Vercel deploys are disabled) and `jobs.ts` has no job for it. Dead unless an external cron hits it. |
| `api/equipment-images/resolve` | 146 | No reference anywhere |
| `api/wiki/generate-lore-card` | 85 | No caller. The admin flows use `lore-cards/*` tRPC. |
| `api/wiki/category-articles`, `api/wiki/categories` | 64 + 30 | No caller. The `wiki/categories` hits are the `/wiki/categories` *page*, not this API. |
| `api/admin/init-flags` | 66 | Test-only (`flag-warmers-realm.test.ts`) |
| `api/ixtime/{set-override,set-natural,health,sync-from-bot}`, `api/ixtime-status`, `api/lorewards/sync`, `api/mediawiki/[wiki]/api.php` | — | **Keep.** External consumers are documented (Discord bot, cron job `lorewards-*`, MediaWiki). |

### 1.6 Orphan pages (no inbound link)

| Page | Lines | Note |
|---|---|---|
| `/vault/lore-generator` | 146 | |
| `/vault/admin` | 66 | Duplicates the admin vault panel |
| `/explore/collections` | 29 | SL-25 |
| `/admin/diplomatic-{scenarios,options}/analytics` | 8 each | Render the same `AdminRouter` as the parent route |

The `/thinkpages/{feed,thinkshare,thinktanks}` redirect stubs are compatibility redirects; keep them, or move them to
`next.config.js` redirects once that file is tracked.

### 1.7 Dead branches inside live files

| File | Dead part | Lines |
|---|---|---|
| `lib/notifications/hooks.ts` (SL-6, confirmed) | 12 of 23 hooks appear only as `eventKey` strings in `events-registry.ts`: `onActivityRingGoal`, `onAdminAction`, `onBudgetAlert`, `onCrisisDetected`, `onDefenseEvent`, `onEconomicCalculation`, `onEconomicDataChange`, `onIntelligenceAlert`, `onPolicyChange`, `onSecurityEvent`, `onTierTransition`, `onTradeEvent` | ~660 |
| `lib/activity/hooks.ts` (SL-7) | 15 of 17 static producers never run. The only live ones are `Diplomatic.onEmbassyEstablished` (`embassies/establish.ts:183`) and `User.onAchievementUnlocked` (`achievements/service.ts:553`). The dynamic dispatch at `event-spine.ts:252-263` is also dead: none of the 3 `recordCountryEvent` callers (`intent.ts:270`, `maintenance-cron.ts:268`, `consequences.ts:380`) passes `activityHookName`. | ~570 (+15 in spine) |
| `lib/discord/ixtwitter-sync.ts:1033-1225` | Gated by `const FEED_TO_IXTWITTER_ENABLED = false` (§6), plus 7 dynamic-import call sites in `thinkpages/posts/**`. `backfillIxTwitterToThinkPages` (715-804) is called only by `scripts/archive/migrations/backfill-ixtwitter.ts`. | ~280 |
| `builder/…/tabs/utils/sectorCalculations.ts:190-205` and `SectorCard.tsx:145,212` | `locked` is hard-wired `false`, but `lockedBy` is still computed and the locked UI branches still render | ~25 |

---

## 2. Duplication

Each row: what repeats, where, and the proposed single home.

| # | Pattern | Copies (evidence) | Proposed home |
|---|---|---|---|
| X1 | **`spendByCategory` → `deriveBrokers`** | 6 near-identical loops: `routers/policies/crud.ts:61`, `elections/brokers.ts:20`, `national-issues/player.ts:81`, `intent.ts:47`, `lib/government/component-effects.ts:230`, `politics-drift-cron.ts:57`. Each loads active components plus `loadEffectiveBudget`, sums `allocatedPercent` by `department.category`, then calls `deriveBrokers`. | `lib/statecraft/power-brokers.ts`: `spendByDepartmentCategory(allocations)` plus `loadCountryBrokers(db, countryId, preloaded?)` (~60 lines saved) |
| X2 | **Resolve a user by internal id or Clerk id** | 13 `findFirst({ where: { OR: [{ id }, { clerkUserId }] } })`: `vault/_resolveUserId.ts:16`, `vault/vault-ledger.ts:56`, `vault-bonus.ts:144`, `vault-passive-income.ts:98`, `exchange-service.ts:53`, `cards/card-service.ts:446`, `messaging/message-operations.ts:310`, `wiki-os/core/article-repository.ts:139`, `users/preferences.ts:140,189`, `notifications/user.ts:256,366`, `lore-cards/admin.ts:59` (bulk). `resolveVaultUserId` exists, but only `vault/store.ts` uses it. | `server/modules/identity/resolve-user.ts`: `findUserByAnyId(db, idOrClerkId, select?)` / `requireUserByAnyId` |
| X3 | **Staff rule `role ∈ {owner,admin,staff} ∨ level ≤ 20`** | 7: `trpc/middleware.ts:390`, `trpc/impersonation.ts:40`, `realms/realms.access.ts:14`, `thinkpages/posts/posts/modify.ts:74,190`, `ns-import/decks.ts:235`, `system-validation.ts:87` | Export `isStaffRole(role)` from `lib/auth`, as the §5 marker asked |
| X4 | **JSON-column parsing** | `safeJSONParse` ×2, near-identical (`governmentComponents/serializer.ts:30`, `economicComponents/serializer.ts:42`, which differ only in log prefix and field list); `economy/data-mapper.ts:70 safeJsonParse`; `logging/user-logger.ts:88 safeParseMetadata` (private); `vault/vault-type-guards.ts:194 safeParseMetadata` (dead); `vault/exploit-corrections.ts:52 parseLedgerMetadata`; `legislation.ts:39 parseMeta`; ~115 inline `try { JSON.parse }`, 15 of them on `metadata` | `lib/utils/json.ts`: `parseJson<T>(raw, fallback)` + `parseJsonRecord(raw)`. Merge the two serializers into one `serializeAtomicComponent(domain)`. |
| X5 | **Wiki title → URL slug** | `encodeURIComponent(x.replace(/ /g, "_"))` at **85 sites in 60 files**; `country.slug ?? name.toLowerCase().replace(/ /g,"_")` in `identity.mappers.ts:21` **and** `ixnayid/core.ts:66`; `identity.feed.ts:64 underscoreSlug`; `CountryActionsMenu.tsx:208,590` uses `/\s/g` | Add `toWikiPath(title)` next to `toArticleSlug` in `lib/wiki-os/core/domain-types.ts`; reuse `countrySlug()` from `identity.mappers.ts` |
| X6 | **Nation/country name normalisation** | `normalizeNationName` defined **twice, identically** (`routers/ns-import/cards.ts:25`, `vault/exploit-corrections.ts:64`); `flags/normalization.ts:9 normalizeCountryName` (no underscore folding); `flags/svg-parser.ts:182 normalizeForMatching` (strips prefixes) | `lib/nationstates/names.ts` for the NS variant. Leave the flag matchers alone: they do a different job. |
| X7 | **Wiki plain-text cleaner aliases** | `cleanWikiMarkup` (the "single authoritative" cleaner, `wikitext-parser.ts:505`) is wrapped by `cleanWikitextExcerpt` (2 users), `cleanExcerpt` (5), `cleanWikitextForDisplay` (`cache-service.ts:14`, 3), `stripWikiMarkup` (`dossier-parser.tsx:236`, 1 internal use) and `cleanWikiSectionContent` (`integration.ts:109`, 2). A separate simpler `cleanWikiValue` lives in `infobox-parser.ts:145` (3 users), and `InlineWiki.tsx:19 cleanWiki` is dead. | Call `cleanWikiMarkup(raw, max)` directly and delete 4 aliases. Decide whether `cleanWikiValue` should delegate too. |
| X8 | **Geometry helpers** | bbox ×5: `border-editor.ts:325 calculateBBox` + `:791 getGeometryBBox`, `map-utils.ts:221 calculateBBox`, `flags/svg/topology-flattener.ts:45 calculateBoundingBox`, `editor/utils/map-helpers.ts:65 getGenericBBox`, plus inline loops (`useEditorSelectionState.ts:84`, `alignment.ts:391`) and `@turf/bbox`. Point→segment ×3: `border-editor.ts:522` (exported), `alignment.ts:836` (private copy), `topology.ts:725 closestPointOnSegment`; the bbox-pruned projection loop is repeated at `alignment.ts:525` and `topology.ts:770`. | `lib/maps/geo-math.ts`: `bboxOf(geom)`, `projectPointToSegment`, `nearestOnEdges(point, edges)` |
| X9 | **Atomic picker domain twins** | `components/mycountry/domains/{economy,government}/atomic/*`: 9 parallel files each (1,200 lines total), thin wrappers over `components/shared/atomic-picker/*`. A third implementation, `shared/atomic/*`, is test-only. `hooks/use{Economic,Government}ComponentsData.ts` (324 + 202) differ in 184 lines after name-normalising. Routers `economicComponents/*` (963) vs `governmentComponents/*` (620). | One `AtomicPicker domain="economy" \| "government"` over `shared/atomic-picker`; `useComponentLibraryData(domain)` |
| X10 | **Tax-component effectiveness data ×3** | `government/tax/atomic-tax-components.ts` (1,117, live), `builder/client-calculations.ts:744 TAX_COMPONENT_EFFECTIVENESS` (dead, D2), `economy/atomic-tax-integration.ts` (dead, D8) | Keep `atomic-tax-components.ts`; deleting D2 and D8 removes the other two |
| X11 | **SystemConfig reads** | ~40 direct `systemConfig.findMany/findUnique/upsert` calls in 18 files (`onoma/speech.ts` ×7, `sports/leagues/admin.ts` ×5, `vault/exchange-config.ts` ×4, `cards/{valuation,season,general-settings}.ts`, `sports/notify-config.ts`, …). `readConfigKeys`/`writeConfigKeys` already exist but are admin-private (`routers/admin/_config-kv.ts`). | Move `_config-kv.ts` to `server/modules/config/kv.ts` and migrate callers (plan 345's unfinished "SystemConfig helper") |
| X12 | **Relative time and timestamps** (after plan 345's 13→1) | `LoreBotFeedView.tsx:28 formatTimestamp` re-implements `timeAgo`. `MessagesChatPanel.tsx:32` and `MessagesBubble.tsx:78` are identical `formatTimestamp` copies. `formatBytes` ×2 (`LorewardsBotSection.tsx:292`, `SvgUploadManager.tsx:153`). 3 forum `formatTimeAgo = unix => timeAgo(unix*1000)` wrappers. `date-fns` `formatDistanceToNow` in 12 files is a second relative-time implementation. | `lib/format/compact.ts`: add `formatMessageTime` and `formatBytes`; accept unix seconds in `timeAgo` |
| X13 | **`HistoricalDataPoint` ×3** | `types/ixstats.ts:121`, `mycountry/shared/modals/metric-details/types.ts:114`, `utils/analytics-data-transformers.ts` (dead) | `types/ixstats.ts` |
| X14 | **Entry-process env loader ×3** | `loadEnvVariables()` in `server.mjs:13`, `ws-backend.mjs:25`, `cron-runner.mjs:23`, with slightly different file orders (`server.mjs` adds `.env.local.dev` in dev) | `scripts/lib/load-env.mjs`, imported by all three |
| X15 | **Two WebSocket stacks** | `socket.io` (`thinkpages-websocket-server.ts`, `socket-auth.ts`) and raw `ws` (`market-websocket-server.ts`), each initialised in both `server.mjs:110,125` and `ws-backend.mjs:76,85` | Consolidate on socket.io; drop `ws` + `@types/ws` (the 09-23 audit's #12, not done) |
| X16 | **Stash UI** | `ArticleRenderer.tsx:254-298,540` inlines stash mutations/queries that dead `StashButton.tsx` already implements (with an unused `_stashQuery`) | Delete `StashButton` and `StashManagerModal`, or reuse them. Don't keep both. |

---

## 3. Monoliths

### 3.1 `audit:arch` violations (exit 1, 15 new)

| File | Lines |
|---|---|
| `routers/wikios/templates.ts` | 1,298 |
| `admin/users/UsersPanel.tsx` | 1,026 |
| `wiki-os/editor/hooks/useWikiVisualFormatting.ts` | 1,005 |
| `intelligence/live-data-transformers.ts` (dead, D1) | 902 |
| `settings/…/PrivacySecurityPanel.tsx` | 888 |
| `wiki-os/editor/plate/wiki-html.ts` | 885 |
| `economy/transport-generator.ts` | 848 |
| `maps/editor/…/FeatureInspector.tsx` | 771 |
| `sports/club.ts` | 764 |
| `dashboard/…/WikiFeedCard.tsx` | 764 |
| `ixtime/core.ts` | 730 |
| `maps/core/hooks/useWorldMapInteractions.ts` | 714 |
| `mycountry/shell/DrillSheets.tsx` | 702 |
| `policies/recommender.ts` (dead, D7) | 701 |
| `hooks/map-editor/useMapFeatureMutations.ts` | 630 (ceiling 500) |

Deleting D1 and D7 clears two violations for free. Separately, 52 `src/` files are ≥800 lines, matching the roadmap's count.

### 3.2 Top 15 split proposals (live files, largest first)

| # | File (lines) | Shape today | Proposed split |
|---|---|---|---|
| 1 | `app/admin/cards/LoreCardBatchAdmin.tsx` (2,372) | One component from line 74 to the end | `admin/cards/lore-batch/`: `useLoreBatchCandidates` (fetch/cache), `CandidateTable`, `CandidateFilters`, `BatchRunPanel`, `PreviewDrawer`. Move fetch helpers into the generator (row 7). |
| 2 | `app/admin/_components/CountryInspector.tsx` (1,802) | One component, 4 `useEffect`s, local enums duplicating tier enums | `admin/country-inspector/`: `useInspectorCountry`, `TierSimulator` (reuse `lib/economy` tier enums instead of local `EconomicTier`/`PopulationTier`), `EffectsTable`, `FormulaFlowTab` (already lazy) |
| 3 | `lib/diplomacy/npc-personality.ts` (1,511) | One `NPCPersonalitySystem` class (279–1350) + types | `npc-personality/{types.ts, archetypes.ts, drift.ts, responses.ts, observable-data.ts}`. 8 exported types/helpers are unused; drop them first. |
| 4 | `components/maps/editor/EditorMap.tsx` (1,455) | One memo component (165–1455) | Continue plans 143–147: extract `useEditorMapLayers`, `useEditorCursor` (the ponytail block at 715), `useEditorPlugins`, and the JSX overlay into `EditorMapOverlays` |
| 5 | `app/admin/myleague/SportsOversightPanel.tsx` (1,440) | 4 inner components in one file | One file each: `AdminAdvancedControls` (69–260), `AINarratorLab` (261–830), `NotificationSettingsCard` (866–912), panel shell |
| 6 | `lib/discord/ixtwitter-sync.ts` (1,435) | Inbound sync + dead outbound + HTML→markdown | Delete outbound (1033–1225) and backfill (715–804). Split `ixtwitter/inbound.ts` (1–700), `discord/format.ts` (`htmlToDiscordMarkdown`, `formatThinkPagesEmbed`, 810–1435). Leaves ~1,100 in two files of ~550. |
| 7 | `lib/cards/lore-card-generator.ts` (1,433) | One class; `fetchArticleData` alone is ~550 lines (252–807) | `lore-cards/{article-fetch.ts, quality-score.ts, category-search.ts, image-resolve.ts, create-card.ts}`; keep the class as a thin façade |
| 8 | `lib/maps/border-editor.ts` (1,383) | 35 flat exports (8 unused) | Split `geometry-core.ts` (bbox/area/centroid/projection, the X8 home), `vertex-edit.ts`, `split-merge.ts`, `snapping.ts` |
| 9 | `lib/economy/auction-service.ts` (1,300) | One class; `broadcastAuctionComplete` repeated 4× (718, 918, 989, 1120) | `auctions/{create.ts, bid.ts, buyout.ts, complete.ts, cancel.ts, queries.ts}` + one `settleAuction()` shared by complete/buyout/cancel |
| 10 | `server/api/routers/wikios/templates.ts` (1,298) | Lines 23–1053 are static data; the router is ~245 lines | Move `CANONICAL_BUILTIN_TEMPLATES`, `CANONICAL_ALIASES_MAP` and `BUILTIN_TEMPLATE_SCHEMAS` to `lib/wiki-os/templates/builtin-data.ts` (their exports are unused outside, so they are module-private data). Router to ~250. |
| 11 | `lib/notifications/hooks.ts` (1,288) | 23 functions, 12 never called | Delete (or wire) the 12 dead hooks (~660, SL-6), then split by domain: `hooks/{government,social,system}.ts` |
| 12 | `lib/sports/transition.ts` (1,275) | `transitionSeasonAction` is one 830-line function (15–843) | `transition/{stage-advance.ts, promotion-relegation.ts, awards.ts, world-cup.ts}` |
| 13 | `components/maps/editor/hooks/useMapLayers.ts` (1,266) | One hook (34–1266) | One hook per layer family: `useBaseLayers`, `useSubdivisionLayers`, `useRouteLayers`, `useOverlayLayers`, via `geojson-layer-helpers.ts` (from plans 143–147) |
| 14 | `components/shared/polls/poll-widget.tsx` (1,225) | 15 compound parts + 3 cva blocks | `polls/widget/{context.ts, variants.ts, Root.tsx, Option.tsx, Results.tsx, Submit.tsx, index.ts}` (same `PollWidget` export) |
| 15 | `lib/maps/province-importer/parse-provinces.ts` (1,197) | `parseProvinceSvg` + 12 helpers | `province-importer/svg/{parse.ts, grouping.ts, naming.ts, geometry.ts}` |

**Data-table monoliths:** leave these flat and add them to `RELAXED_FILES`, since splitting static data buys nothing:
`government/tax/atomic-tax-components.ts` (1,117, of which 40–1000 is data), `achievements/definitions.ts` (991),
`diplomacy/cultural-scenario-generator.ts` (1,037, templates 128–245), `onoma/language-families.ts` (871).

---

## 4. Dependencies

### 4.1 Declared but unused

**None.** Every entry in `dependencies`/`devDependencies` has an import site or a tool role. The 09-23 prune (plan 343) held.
Notes on the ones that look unused at first:

- `potrace` has no `import` but is loaded at run time via `createRequire(...)("potrace")` (`lib/flags/png-to-svg.ts:161`). Keep.
- `@testing-library/dom` is a peer of `@testing-library/react`; the `@types/*` packages and the Jest/SWC/oxlint/prettier
  toolchain are tool-only. Keep.
- `jsdom` is a **runtime** dependency, used only by `lib/utils/sanitize-html.ts` for server-side DOMPurify. Correct as declared.
- `node-fetch-native` is used only in `src/setupTests.ts`. It could go if the test environment gets `fetch` another way. Low value.

### 4.2 Used but undeclared (phantom, resolving by hoisting)

| Package | Sites | Action |
|---|---|---|
| `@turf/{helpers,intersect,simplify,union,difference,area,buffer,bbox,centroid,kinks,voronoi,boolean-point-in-polygon,transform-rotate,transform-scale}` | 14 sub-packages in ~20 files | Declare them, and drop the `@turf/turf` meta-package. It is used only via `require("@turf/turf")` in `province-importer/topo-simplify.ts:126` for 8 functions, plus one archived script. This is the 09-23 audit's #19, not done. |
| `sharp` | `flags/png-to-svg.ts:43,55,113` (dynamic), `tests/fixtures/png-maps.ts` | **Declare.** It currently arrives only as an *optional* dependency of `next`. |
| `slate-react` | `shared/editor/GlassPlateEditor.tsx`, `useGlassPlateEditor.ts` | Declare (it comes via `platejs`) |
| `@tsparticles/engine` | `vault/CosmeticParticlesCanvas.tsx:6` (type) | Declare, or import the type from `@tsparticles/slim` |
| `@clerk/types` | 4 settings/auth files | Declare, or use `@clerk/nextjs` re-exports |
| `mdast` | `lib/markdown-document.ts` (types) | Declare `@types/mdast` |
| `dotenv` | 12 scripts (e.g. `audit/audit-vault-exploits.ts`) | Bun loads `.env` natively. Drop the imports, or declare it. |
| `glob` | `scripts/audit/audit-trpc-wiring.ts`, `audit-flag-urls.ts`, `audit-production-urls.ts` | Declare. The runtime is broken today: `overrides.minimatch: ^3.1.3` breaks `glob@10` (`export 'escape' not found in 'minimatch'`), so `bun run audit:wiring` fails. Remove the override or bump it to `^9`. |
| `@jest/globals` | 117 test files | Transitive from `jest`. Declare it for correctness. |
| `server-only` | 9 files | Transitive from `next`; mapped in jest. OK as is. |
| `xlsx`, `playwright`, `node-fetch`, `lucide-react` | `scripts/archive/**` only | These archived scripts can't run. See row 12 of the cut list. |

### 4.3 Libraries doing the same job

| Job | Libraries | Verdict |
|---|---|---|
| Relative time and date formatting | `date-fns` (17 files: `formatDistanceToNow` ×12, `format`, `subMonths`, `isValid`) vs `lib/format/compact.ts timeAgo` (canonical after plan 345) | Rewrite the 17 files to `timeAgo` + `Intl.DateTimeFormat` and drop `date-fns`. M effort, L risk. |
| WebSockets | `socket.io` + `socket.io-client` vs `ws` | Consolidate (X15) and drop `ws`, `@types/ws` |
| Geometry | `@turf/turf` meta vs scoped `@turf/*` | Scoped only (4.2) |
| Markdown | `react-markdown` + `remark-gfm` (2 files: `StoryPinModal.tsx`, `DocumentPage.tsx`); `markdown-document.ts` only parses frontmatter/headings over `mdast` | Not duplicates. Keep. |
| Rich text | `platejs`/`slate` (visual editors) + `@codemirror/*` (wikitext source editor) | Different jobs. Keep. |
| Sanitising | `dompurify` + `jsdom` only | Single stack. Good. |
| Icons | `iconoir-react` only (1,044 import sites); `lucide-react` appears only in an archived migration script | Single icon set. Good. |
| Animation | `motion` only; `no-framer-motion-imports.test.ts` guards it | Good |
| Particles | `@tsparticles/react` + `slim` for one 155-line component (+ the CSS workaround in §5 #10) | Reconsider: CSS/canvas cosmetics or a smaller lib. M. |

### 4.4 Config files are untracked

`next.config.js`, `postcss.config.js`, `bunfig.toml` and `ecosystem*.cjs` are gitignored (`.gitignore`, "keep on disk") and
**absent from this checkout**. So dependency use in configs (`@tailwindcss/postcss`, `postcss`) and the CHANGELOG's config claims
("ghost packages removed from next.config.js", "virtual-store = true in bunfig.toml") can't be verified from the repo.
This is the 09-23 audit's #17 and still stands.

---

## 5. `ponytail:` markers (36)

From `grep -rn -i "ponytail" src scripts *.mjs`: 34 code markers and 2 README mentions.
Verdicts: **fine**, **revisit** (reason given), **wrong/moot**.

| # | Location | Marker (short) | Verdict |
|---|---|---|---|
| 1 | `components/ui/dialog.tsx:68` | Never close on outside click | **Fine.** A global UX rule; `AlertDialog`/`Sheet` are unaffected. Revisit only if info-only dialogs need click-away. |
| 2 | `cards/designer/DesignerStage3D.tsx:8` | "simplified single-source card rendering wrapper" | **Fine**, but it's a label, not a shortcut with a trigger. Reword or drop the tag. |
| 3 | `maps/editor/hooks/state/useEditorSelectionState.ts:79` | Start route edit immediately | **Revisit.** A behaviour note, not a simplification. The bbox loop right after it (84–95) is one of the 5 bbox copies (X8). |
| 4 | `maps/editor/EditorMap.tsx:715` | Suppress hover while tool modes are active | **Fine.** Behaviour note (tag misuse). |
| 5 | `server/modules/realms/realms.access.ts:3` | "Mirrors adminMiddleware's rule; share it if a third caller appears" | **Now wrong.** The trigger fired long ago: the same rule is at 6 more sites (X3). Extract `isStaffRole()`. |
| 6 | `server/api/routers/legislation.ts:27` | Vote breakdown as JSON on `Policy` | **Fine.** (Bills can't pass anyway until MC-2.) |
| 7 | `server/api/routers/geo/core/cache.ts:90` | "Simple LRU size cap (32)" | **Wrong label.** `getCached` (76–86) doesn't refresh recency, so this is FIFO eviction. Fix: re-insert on hit (`delete` + `set`, 2 lines) or call it FIFO. |
| 8 | `hooks/useWikiNarrator.ts:648` | SpeechSynthesis can't retune mid-utterance | **Fine** |
| 9 | `builder/…/tabs/utils/sectorCalculations.ts:200` | Sectors never locked | **Revisit.** Finish the cut: `lockedBy` is still computed (lines 183–196) and returned, and `SectorCard.tsx:145,212` still renders locked UI that can't trigger. |
| 10 | `styles/globals.css:212` | Hide orphan tsparticles canvases | **Revisit.** The comment names the real fix ("pass the element ref"), and it's in-repo: `vault/CosmeticParticlesCanvas.tsx:151`. The CSS hides a symptom and particles are a 1-consumer dependency (§4.3). |
| 11 | `lib/wiki-os/transformers/wikitext-parser.ts:502` | "Single authoritative plaintext cleaner" | **Revisit.** True in logic, but 5 alias wrappers + `cleanWikiValue` + dead `InlineWiki.cleanWiki` undercut it (X7). |
| 12 | `lib/wiki-os/adapters/ixstates/infobox-mapper.ts:125` | Store `government_type` verbatim | **Moot.** The file is test-only (§1.3). Before deleting, confirm the live import path (`app/builder/lib/wiki-builder-assembler.ts`, `wiki-os/transformers/infobox-parser.ts`) keeps the verbatim rule, and move the comment there. |
| 13 | `…/infobox-mapper.ts:199` | Pure delegating parser | **Moot** (test-only file) |
| 14 | `…/infobox-mapper.ts:286` | Coordinates via shared parser | **Moot** (test-only file) |
| 15 | `lib/discord/ixtwitter-sync.ts:25` | "flag, not env — flip to re-enable feed → IxTwitter" | **Revisit.** It's a compile-time `false`, feed→Discord now lives in `discord/thinkpages-feed.ts`, and it keeps ~190 lines plus 7 router call sites alive. Delete the path; git history is the "flip". |
| 16 | `lib/gameplay-flags.ts:9` | Env flags at module load | **Fine.** But 3 of the 4 flags are off by default and missing from `.env.example` (§6). |
| 17 | `lib/README.md:5` | "ponytail modular architecture… 52 subpackages" | **Fine.** Doc prose; the count is right (52 dirs). |
| 18 | `lib/economy/auction-service.ts:27` | Best-effort WS; cron skips broadcasts | **Fine, but the comment overstates it.** Natural expiry settles *only* in cron, so expired auctions never broadcast `AuctionComplete`; only buyout and cancel do. Revisit when the Redis bridge (`thinkpages-broadcast-bridge.ts`) is generalised. |
| 19 | `lib/onoma/README.md:21` | Plan 126 table row | **Fine.** Doc prose. |
| 20 | `lib/onoma/ipa-overrides.ts:8` | localStorage, not synced | **Fine** |
| 21 | `lib/cards/lore-card-generator.ts:99` | `MIN_ARTICLE_LENGTH` lone knob | **Fine** |
| 22 | `lib/cards/card-metadata-resolver.ts:7` | "simplified single-source metadata parser" | **Fine.** Label only. |
| 23 | `lib/cards/valuation.ts:15` | No supply/demand multiplier | **Fine.** (Audit §10: the card-values cron currently does nothing.) |
| 24 | `lib/statecraft/legislative-vote.ts:9` | Pure-ideology voting | **Fine** |
| 25 | `lib/government/politics-drift-cron.ts:11` | Heuristic polling model | **Fine.** It holds one of the 6 X1 copies. |
| 26 | `lib/government/approval.ts:8` | Governing bloc = the largest party | **Fine**, but the file header (line 5) says "plus aligned partners", which contradicts both the marker and `computeApproval`. Fix the header. |
| 27 | `lib/builder/dossier-parser.tsx:231` | `stripWikiMarkup` uses the canonical cleaner | **Revisit.** A pure alias with one internal caller (line 324). Inline it (X7). |
| 28 | `lib/narrator/client.ts:142` | Flavor text doesn't need 16k tokens | **Fine** |
| 29 | `lib/maps/province-importer/alignment.ts:391` | Ring bbox pre-check | **Revisit** as duplication (X8): a hand-rolled bbox |
| 30 | `…/alignment.ts:525` | Bbox prune before segment projection | **Revisit** (X8): the same block is at `topology.ts:770`, and `projectPointToSegment` is copied at 836 |
| 31 | `…/topology.ts:770` | Bbox prune | **Revisit** (X8) |
| 32 | `lib/sports/notify-config.ts:33` | `prisma: any` so tx clients can pass | **Revisit.** Use `Pick<PrismaClient, "systemConfig">` or `Prisma.TransactionClient`, and read via the shared `readConfigKeys` (X11). |
| 33 | `lib/sports/season-cron.ts:611` | Bounded catch-up loop | **Fine** |
| 34 | `lib/sports/predictions.ts:49` | No house rake | **Fine** |
| 35 | `scripts/onoma/extract-lexicon.ts:11` | Shell out to the `mysql` CLI, "no driver dep" | **Fine but stale.** `mysql2` is now a devDependency (the `audit-wikios-parity.ts` scripts). The header's `bunx tsx` is also stale: `tsx` was removed, and 74 `tsx` mentions remain in scripts. |
| 36 | `scripts/onoma/extract-lexicon.ts:187` | Cache keyed by category | **Fine** |

**Summary:**

- Fine: 21 (#1, 2, 4, 6, 8, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 33, 34, 35, 36).
- Revisit: 10 (#3, 9, 10, 11, 15, 27, 29, 30, 31, 32).
- Wrong or moot: 5 (#5, 7, 12, 13, 14).

**Tag hygiene:** #2, #3, #4 and #22 use the tag as a label rather than for a deliberate shortcut with an upgrade trigger.
Recommend the convention `ponytail: <shortcut> — <when to upgrade>` so the tag stays greppable as debt.

---

## 6. Prototypes & flags

| Item | Where | State | Recommendation |
|---|---|---|---|
| `FEED_TO_IXTWITTER_ENABLED = false` | `discord/ixtwitter-sync.ts:26` | Hard-coded; gates 5 exported functions | Delete (§5 #15) |
| `STATECRAFT_SPINE` | `gameplay-flags.ts:36`; read at `national-issues/player.ts:269,313`, `engine.ts:228` | Default off, missing from `.env.example`, "ships dark until the loop is complete" | Keep, but list it in `.env.example`, or set a date to finish or remove the recon path |
| `ISSUES_ENFORCE_DEADLINES`, `ISSUES_AWARD_CREDITS` | `gameplay-flags.ts` | Default off, not in `.env.example` | Same |
| `NEXT_PUBLIC_ENABLE_WEBSOCKET` | `useThinkPagesWebSocket.ts:79` (dev-only gate) | Not in `.env.example` | Document it |
| `SPORTS_TTS_ENABLED` | `sports/commentary/narrator.ts:470` | Off unless `config.apiUrl` is set | Fine |
| `CRON_ENABLED_JOBS` | `cron-runner.mjs` | Empty means **no jobs run** (VT-15) | Operational decision (M1) |
| Env schema vars never read | `src/env.ts`: `ADMIN_EMAIL`, `CACHE_TTL_SECONDS`, `DISCORD_CLIENT_ID`, `ENABLE_CACHING`, `IXWIKI_IMAGE_BASE_URL`, `NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS` | Declared and validated, read nowhere | Delete from the schema (PL-19 env hygiene) |
| `TAX_SYSTEM_TEMP_DISABLED` | `app/builder/constants.ts` | Dead constant, dead file | Delete |
| Map "enrichment" pipeline | `lib/maps/pipeline/{vector-synthesis,accuracy-normalizer,geographical-accuracy-analyzer}.ts` | Test-only prototype, never in `runMapPipeline` | Delete with its test, or wire it |
| `shared/atomic/UnifiedAtomic*` | | Test-only; superseded by `shared/atomic-picker` | Delete with the characterization test |
| Demo-seed service | `lib/demo-seed/**` (not sports) | No runnable caller (D4) | Delete, or restore a working `scripts/setup/seed-demo.ts` if live-preview demos still matter |
| Labs routes | `/labs/{map-pipeline,onoma,vexel}` | All linked from nav | Keep |
| Orphan pages | `/vault/lore-generator`, `/vault/admin`, `/explore/collections`, `/admin/diplomatic-*/analytics` | No inbound links | Delete, or link them |
| Orphan REST | `api/cron/validate-images`, `api/equipment-images/resolve`, `api/wiki/{generate-lore-card,categories,category-articles}` | No caller; no Vercel cron | Delete, or add `validate-equipment-images` to `jobs.ts` if wanted |
| Dead env-driven barrel guard | `lib/{vault,cards,system}/{client,server}.ts` | Exist only to satisfy `client-server-entrypoints.test.ts` | Decide (§1.3) |
| `scripts/archive/` | 97 files, 19,488 lines | Not referenced by any package script. Several can't run: undeclared `xlsx`, `playwright`, `node-fetch`, `lucide-react`, and the broken `../src` import in `reset-for-live-preview.ts`. | Delete; git history keeps them. `CardDesigner.test.ts:45` mentions an archive script in a comment only. |

---

## 7. Top cut list

Ranked by lines removed ÷ risk. "Lines" means lines deleted net of any small helper added.
**Risk:** L = unreachable and verified; M = needs a product call or touches live code paths; H = schema or behaviour change.
**Effort:** S under half a day; M 1–2 days; L more.

| Rank | Item | Est. lines removed | Risk | Effort |
|---|---|---|---|---|
| 1 | Intelligence chain (D1): `lib/intelligence/{calculator,engine,live-data-transformers}.ts`, `types/{intelligence,intelligence-live,intelligence-unified,base}.ts`, `server/api/schemas/intelligence.ts`. Also clears 1 arch violation. | 2,668 | L | S |
| 2 | Analytics dashboard (D3): `components/analytics/**`, `lib/utils/analytics-data-transformers.ts`, `types/analytics-dashboard.ts`, plus `lib/utils/index.ts` re-exports | 2,286 | L | S |
| 3 | `lib/builder/client-calculations.ts` (D2) + `builder/index.ts:6` | 1,472 | L | S |
| 4 | MyCountry and WikiOS leftovers (D10 + D11 + D12 hooks), incl. `StashButton`/`StashManagerModal`, `AutosaveHistoryPanel` + `routers/autosaveHistory.ts` (+ root mount) | ~4,300 | L | M |
| 5 | Demo-seed service (D4, keeping `seed-sports` + `sports/`). Then reclassify the audit §8 "seed-only" models as fully dead. | 3,722 | M (confirm demo mode is retired) | S |
| 6 | MC-18 remainder (D8) + `builder-validation.ts` trim (D9) + the 4 builder-only procedures (§1.4) | ~2,900 | L–M (check `government.create/update` aren't used under other names) | S |
| 7 | Home-page trio + `chart-utils.ts` (D5) | 1,206 | L | S |
| 8 | `logging/user-analytics.ts` (D6) + `policies/recommender.ts` (D7; clears 1 arch violation) | 1,433 | L | S |
| 9 | Dead notification hooks (SL-6) and activity producers (SL-7), plus the spine's dead dispatch branch | ~1,245 | M (delete vs wire decision) | M |
| 10 | Misc lib and components (D13 + D14 + D15 barrels) | ~2,000 | L | S |
| 11 | Test-only prototypes + their tests (§1.3: `component-mutations`, `UnifiedAtomic*`, map enrichment trio, `infobox-mapper`) | ~2,160 src (+ tests) | L–M (tests deleted with them) | S |
| 12 | `scripts/archive/` | 19,488 | L | S |
| 13 | ixtwitter outbound path + backfill (§1.7, §5 #15) and 7 router call sites | ~300 | L | S |
| 14 | Orphan REST routes (§1.5) and orphan pages (§1.6) | ~560 | M (external callers unknown) | S |
| 15 | X1 `spendByCategory` → `loadCountryBrokers` | ~60 | L | S |
| 16 | X2 user-by-any-id helper (13 sites) | ~90 | M (auth-adjacent; add a test) | S |
| 17 | X3 `isStaffRole()` (7 sites; fixes §5 #5) | ~20 | M (authz) | S |
| 18 | X4 `parseJson` + merged component serializer | ~150 | L | M |
| 19 | X8 geometry helpers (bbox ×5, point-to-segment ×3) | ~150 | M (GIS behaviour; covered by `province-importer` tests) | M |
| 20 | X9 atomic picker domain twins + data hooks | ~900 | M | L |
| 21 | X7 wiki cleaner aliases, X12 time/bytes formatters, X13, X14 | ~250 | L | S |
| 22 | Dependencies: scoped `@turf/*` and drop `@turf/turf`; drop `date-fns`; `ws` → socket.io; declare the phantoms; fix the `minimatch` override so `audit:wiring` runs | ~600 + 3 deps | M | M |
| 23 | Monolith splits (§3.2); line-neutral, but they clear `audit:arch` | 0 net | M | L |

**Totals:**

- Rows 1–14 (straight deletions): ~24,500 lines in `src/` + 19,500 in `scripts/archive`.
- Rows 15–22 (consolidations): ~2,300 more.
- The whole-tree reachability check says ~21,100 unreachable plus ~2,300 test-only lines in `src/`. The row estimates add up to
  more than that because they overlap: rows 4 and 10 share files, and rows 6 and 9 include partial-file trims.

**Suggested order:**

1. Fix the `minimatch` override, so `audit:wiring` works again as a guard.
2. Rows 1–3 and 7–8 (pure L/S).
3. Row 4.
4. Row 12.
5. Rows 5, 6, 9 and 14 (need owner calls; see ROADMAP "Decisions needed" D-items).
6. The consolidations.

After each deletion batch:

- Run a **full, non-incremental** typecheck. The 09-23 log shows incremental gates missed 3 broken callers.
- Re-run `callers2.ts`, because deletions cascade into procedures, as §1.4 shows.

---

## 8. Method & caveats

### Tools run

- `bun run audit:arch`: exit 1, 15 violations (`arch.txt`).
- `bun run audit:components:json`: 37 unused components (`components.json`). All 37 fall inside my D-list.
- `bun run audit:wiring:json`: **crashes** (minimatch, §4.2), so a runtime procedure census replaced it.
- The `--dead-all` mode of `audit-components.ts` omits `cron-runner.mjs`, `ws-backend.mjs` and `scripts/`, so it over-reports:
  139 files, including live crons such as `season-cron.ts` and `server/cron/jobs.ts`. My `graph.ts` and `symgraph.ts` add
  those roots.
- `audit:coverage` was not run: schema coverage is already in audit §8.

### Known false negatives in `symgraph.ts`

A regex over some `import … from` text can span comments or strings. That once kept `types/intelligence.ts` and `types/base.ts`
alive, and a manual `grep` caught it. So the tool's dead list is a lower bound. Every row in §1 and §7 was grep-verified by
path, export name, dynamic import and string dispatch.

### Procedure census is lenient

A `.router.proc` substring anywhere, including comments, counts as a call. So there may be slightly more dead procedures than
listed. Calls made from dead files were excluded in `callers2.ts`.

### Not verified here

- Anything behind the gitignored configs (`next.config.js`, `postcss.config.js`, `bunfig.toml`, `ecosystem*.cjs`).
- External callers of REST routes, beyond the documented Discord bot, cron and MediaWiki consumers.
- Whether production data still has `isDemo` countries (relevant to D4).
