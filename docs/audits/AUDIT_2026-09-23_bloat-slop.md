# IxStats Bloat, Duplication & AI-Slop Audit — 2026-09-23

**Commit:** `97e5a945` (branch `rose-garden`) · **Scope:** whole `src/` tree (~790K lines TS/TSX), `prisma/`, `scripts/`, root config, `package.json` · **Mode:** ponytail-audit (complexity only) + improve lenses (perf, TS, Apple/Facet design) · **Method:** 13 parallel read-only auditors, one per system, each verifying "dead" claims by grep over `src/`, `scripts/`, `server.mjs`, `ws-backend.mjs`, `cron-runner.mjs`; every top finding re-verified by the coordinator against the code. Three census scripts (tRPC zero-callers, import-graph reachability from all pages/routers, Prisma model references) were run read-only.

**Not in this audit:** correctness bugs, security, and hot-path performance — those were audited on 2026-09-23 and are planned in `plans/323–340`. Findings already covered by an existing plan are cited by number, not repeated. Nothing was applied.

Companion plans: `plans/341` – `plans/346` (see §8).

---

## 1. Headline

| Metric | Value |
|---|---|
| Source under audit | ~790K lines (`src/`), 124K in tRPC routers, 256K in components |
| **tRPC procedures with zero callers** | **698 of 1,661 (42%)** across 94 mounts; **14 mounts are 100% dead**, 10 more ≥80% dead |
| Client code unreachable from any page/router (MyCountry alone) | 112 files / ~20K lines |
| Prisma models with zero `db.<model>` references | 43 of 331 (whole `exchange.prisma`, whole `c15t.prisma`) |
| Deletable with **no behaviour change**, HIGH confidence | **≈ 90K lines** (≈ 11% of `src/`) + 106 MB of tracked pipeline dumps/reports |
| Deletable incl. MED-confidence + consolidations | ≈ 130K lines (≈ 16%), ~540 files |
| Dependencies droppable now | 15 (4 runtime with 0 import sites, 1 Tailwind-v3 plugin, 7 ESLint devDeps, playwright, shadcn CLI, @types/dompurify) |
| Dependencies to reconsider | 8 (`@deck.gl/*` ×4 for one overlay, `@tsparticles/*` ×2 for one 155-line component, `ws` + `@types/ws` after WS consolidation) |
| Micro-typography (`text-[8–11px]`) | 4,249 sites; `uppercase tracking-wider` captions 1,220; `transition-all` 1,815; `backdrop-blur` 1,486; motion files without a reduced-motion guard 241 of 272 |

### The five systemic patterns

1. **Abandoned-refactor residue.** Every system carries the previous implementation next to the current one: plan 311's Zustand store created but never wired; plan 163's "legacy adapter" DM router with zero callers; `season-cron.ts` re-implementing the sports router lifecycle; two undo stacks and two property panels in the map editor; `quickActions` re-implementing `meetings` + `policies`; 8 near-identical MediaWiki proxy routes. The repo never deletes the loser.
2. **Generated router sprawl.** Routers were produced per-model, not per-feature. 42% of procedures have no client, whole mounts (`intelCore/Alerts/Analytics`, `roles`, `archetypes`, `wikiImporter`, `cardAnalytics`, `realmsPipeline`, `atomic*`, `unifiedAtomic`) exist for no UI, and business logic lives inside 190–600-line procedures against `arch.md`'s "thin routers" rule.
3. **Parallel taxonomies.** The "atomic component" idea exists as government × economy × tax triplicates (components, hooks, routers, rule tables ×7); rarity colours are defined in ≥10 places and disagree; sport metadata in 6; win-points rule in 6 (and they differ: 3 vs 2 points); haversine in 17; relative-time formatting in 14.
4. **Framework theatre.** A 574-line logger used 6 times beside 2,013 `console.*` calls; `safeRouter()` that cannot catch anything; 12+ cache classes; a CASL-style ability provider with no CASL; a promise mutex for synchronous `localStorage`; a 25.6K-line `ui/` folder of which ~4K is primitives; a 14-provider root layout where four providers have ≤2 consumers.
5. **Design slop as house style.** Sub-12px arbitrary text is the default caption size (2,409 `text-[10px]`), stacked translucent surfaces four deep, per-component rainbow palettes (2,358 hex literals in TSX), decorative `animate-pulse`/`Sparkles`/emoji, `transition-all` everywhere, and almost no `prefers-reduced-motion`. Plans 317/318/319 touched 26 files; the counts below show <10% coverage.

---

## 2. Top 30 cuts, repo-wide (ranked biggest cut first)

Format: `tag what to cut. replacement. [path] (~lines, confidence)`

1. `delete` 14 fully-dead tRPC mounts + 25 whole dead router files (intel core/alerts/analytics 5,191; roles 953; archetypes 966 incl. lib; wikiImporter 1,683 incl. analyzer; cardAnalytics 643; cardXp 46; realmsPipeline 276; geo/admin/templates 364; thinkpages/messaging 396; thinktanks/messages 395; diplomaticScenarios/player 484; intelligence briefings+feed 362; diplomacy/inbox 234; diplomatic-intelligence 536; onoma/batch 222; sports playoffs+race 409; economics profile+fiscal 365; policies integration+effects+schedules 533; meetings actionItems+proceedings 273; atomicEconomic 138; quickactions 2,186 → repoint 3 procs). Nothing. [`src/server/api/root.ts:159-283`] (~17,300 lines, HIGH) → **plan 341**
2. `delete` the remaining ~450 zero-caller procedures inside live mounts (countries 27, thinkpages 29, wikios 35, policies 22, meetings 22, security 22, admin 18, transport 15, …). Nothing. [`plans/341-zero-caller-procedures.txt`] (~13,000 lines, HIGH in-repo; check Discord bot/IxMaps for HTTP callers first) → **plan 341**
3. `delete` unreachable MyCountry subtrees: `domains/government/tax/` (30 files, 5,523), `government/builder/` + `GovernmentBuilder.tsx` + `useGovernmentBuilder` (2,783), `economy/historical-charts/` + hook + transformer (1,942), `defense/military/` + `UnitManager` (1,274), `domains/intelligence/` + `useDiplomaticAnalytics` + `usePolicyAnalytics` (1,834). Nothing — the import-graph BFS from all pages finds no path. (~13,400 lines, HIGH) → **plan 342**
4. `delete` barrel-only libraries: `lib/government/government-mappings/` + `atomic-government-integration.ts` (3,017), `lib/economy/{index,calculation-groups,fiscal-calculations,multimodal-routing,tax-calculator,tax-suggestions-engine,unified-atomic-tax-integration}.ts` (3,851), `lib/statecraft/{cross-pillar-engine,synergy-calculator,index}` (948), `lib/intelligence/{engine,broadcast-service,transformers,index}` (1,136), `lib/diplomacy/index.ts`. Their only importers are `index.ts` barrels that nothing imports. (~9,000 lines, HIGH) → **plan 342**
5. `delete` `/labs/sandbox` (a personal CS-tutorial, 4,075 lines, anonymous-accessible, listed in Halo) and `/labs/design-bible` (3,276-line superseded spec). Move prose to `docs/`. [`src/app/labs/{sandbox,design-bible}`] (~7,350, HIGH) → **plan 344**
6. `delete` 106 MB of tracked artifacts: 22 GeoJSON dumps (93 MB) in `scripts/archive/geojson_dumps/`, `scripts/reports/` + `data/political-audit/` (52 files, 13 MB). Untrack + ignore; regenerate on demand. (‑106 MB of a 186 MB `.git`, HIGH) → **plan 343**
7. `delete` 46 uncataloged one-off scripts at `scripts/` root (7,226 lines) + 16 unreferenced `scripts/audit/*.ts` (~5,000) + their committed output JSON/MD + 26 `package.json` scripts whose targets don't exist. (~12,000 lines, HIGH) → **plan 343**
8. `delete` logging framework: `src/lib/logging/` (2,345) + `lib/system/logger.ts` (484, 1 importer) + `logger.server.ts` (0) + `routers/user-logging.ts` (10/11 dead) — 6 `logger.*` calls vs 1,603 `console.*`; keep `console-capture.ts`. Also delete the 322 `catch { console.error; throw }` wrappers — `errorFormatter` already logs. (~4,900 lines, HIGH) → **plan 342**
9. `native` Help centre: 55 hand-written JSX articles (938 `<li>`), terms (786) and privacy (479) as JSX; `react-markdown` is installed. One `[...slug]` route over `.md`; also fixes 13 orphan articles unregistered in `HelpExplorer.tsx:38`. (‑7,000 net, MED) → **plan 344**
10. `dup` the "simulate one match → persist → bump standings" block hand-copied 9× (routers ×5, `season-cron.ts`, `world-cup.ts` ×2, seeds ×2) with divergent win-points (3 vs `league ? 3 : 2`); `season-cron.ts` (902) is a second lifecycle; `server.mjs:342` imports a non-existent `sports-cron.js`. One `simulateAndPersistMatch()`. (~1,700 lines, HIGH) → **plan 345**
11. `dup` MediaWiki proxy: 4 wikis × (`[...path]` + `api.php`) = 8 routes, 1,785 lines, pairwise diff 94–331 lines; plus 3 image proxies (580 lines) sharing CORS/placeholder boilerplate. One `[wiki]/[...path]` pair + config map; one image proxy. (~1,800 lines, HIGH) → **plan 344**
12. `dup` cards: rarity→colour in ≥10 files that **disagree** (UNCOMMON is emerald/green/blue); 5 holographic covers redeclaring `getHoloOpacity/getHoloGradient/getEffectiveRarity` (2,457 lines incl. `holographic-effects.ts`), `CardDisplay.tsx:338,379` renders two of them on one card; 6 hand-rolled particle systems + tsparticles. (~2,000 lines, HIGH) → **plan 345**
13. `dup` `syncResourcePoolModifiers` defined 6× (`server/shared/geo-resource-sync.ts` survivor; `geo/features/{cities,labels,storylines,storyPins,pois}.ts` copies, 4 dead); haversine hand-rolled at 17 sites while `lib/maps/geo-math.ts:97 distanceKm` exists. (~860 lines, HIGH) → **plan 345**
14. `dup` builder: `UnifiedAtomicStateManager` + `AtomicBuilderStateManager` never instantiated (1,400); `builderStore.ts` 0 importers (plan 311 stopped halfway); `EnhancedSlider/Toggle` barrel-only (708); `economy-types.ts` re-declares 18 interfaces from `types/builder.ts`; 5 concurrent persistence channels + a 6th via `localStorage["builder_imported_data"]`; 350 lines of crypto-currency rows in a fictional-nation builder. (~4,000 lines, HIGH) → **plan 342**
15. `yagni` deck.gl (4 packages, ~140 MB installed) for one overlay (`DeckTransportOverlay.tsx`) that already has a MapLibre-native path in the same file; `@tsparticles/*` (2 packages) for one 155-line component. Flip defaults off, then delete. (‑6 deps, ~600 lines, MED — product call)
16. `delete` 12 zero-importer `ui/` files (`tier-badge` 450, `confetti`, `glare-card`, `texture-card`, `spotlight-new`, `item`, `empty`, `toggle`, `icon-swap`, `spinner`, `magicui/blur-fade`, `facet/swipeable/useSwipeableDI`) + `consent-manager/` + `c15t-backend.config.ts` residue + `UnifiedAtomicCard.tsx` + `useCursorSpotlight.ts`. (~1,750, HIGH) → **plan 342**
17. `yagni` `ui/` is 25.6K lines, ~4K of which are primitives: `modals/metric-details/*` 5,297, `poll-widget.tsx` 1,225 (sole consumer uses 6 of 14 parts), `log-viewer`+`json-viewer` 1,474, `SwipeableRow`+`useSwipePhysics` 1,390 hand-rolled pointer physics (motion's `drag` exists), `flight-airports.ts` gone but `tier-badge` etc. remain. Move feature code to its domain; replace swipe physics with `motion` `drag`. (~10K moved, ~1,150 deleted, MED)
18. `delete` social: Plan-163 legacy `thinkpages.messaging` adapter + module backing (700), `lib/activity/hooks.ts` 14 of 17 methods dead (775), `lib/notifications/hooks.ts` 9 dead hooks + 6 dead API methods (560), `useLiveNotifications()` body (320, only `useNotificationBadge` is used), `_components/ActivityFeed.tsx` (352), `WikiFeedCard` vs `InlineWikiArticlePreview` 423 identical lines, 4 byte-identical `dashboard/*/page.tsx`. (~3,500, HIGH) → **plan 342**
19. `delete` WikiOS: `wikiImporter` router + `content-analyzer.ts` (1,683, in #1); ~461 orphaned `wikios-*` CSS classes (2,000–3,800 of 12,227 CSS lines); `templates.ts` router is 69% static data with 0 importers of its three exported constants (1,000 lines to move, 300 to delete); `/wiki/*` vs `/util/*` byte-identical pages (395); `plateNodesToAst` path with no production caller (280). (~4,500, HIGH/MED)
20. `delete` diplomacy/intel tail: `diplomaticScenarios` 14 of 22 dead, `crisisEvents` 8 of 10, `diplomaticEmbassies` missions/budget 7 of 8 (1,800 lines, MED — may be planned UI), `NPCPersonalitySystem` 4 dead public methods (386), `IxTimeSyncManager` + `AccuracyVerifier` (1,250) consumed only by a `"use client"` admin visualizer so their `child_process` path can never run. "Encrypted diplomatic messaging" is a boolean column and three never-written fields — fix the help copy. (~4,000, MED)
21. `yagni` `safeRouter()` wraps 94 static imports in a try/catch that cannot throw; `wiki` mount is an alias of `wikios` with 0 callers; `intelligence/` mounted five times. Plain object literal. [`root.ts:17-27,255`] (~130, HIGH) → **plan 341**
22. `yagni` `DATABASE_READONLY` mode exempts 195 of 331 models (59%), dev-only, 8 copy-pasted interceptors — use a Postgres role. [`src/server/db.ts:60-353`] (~290, MED)
23. `delete` 43 Prisma models with zero references: all of `exchange.prisma` (13), all of `c15t.prisma` (8, no `c15t` package exists), `media.prisma` (4), scenario-template quartet, encryption trio, `TaxCalculation`, `SectoralOutput`, `AtomicEconomicImpact`, `GovernmentSynergy`, `Post`, `CardTrade`, `NSImport`, … plus the 4 archetype models orphaned by #1. (~800 schema lines; operator-gated migration, MED)
24. `dup` three parallel "atomic component" taxonomies (government/economy/tax): 8 file-for-file component pairs in `domains/{government,economy}/atomic/`, paired hooks, paired `lib/*/atomic-utils`, 4 flat `atomic*.ts` routers (0–3 callers) vs `*Components/` routers, and ≥7 synergy/conflict/effectiveness rule tables for one enum. Keep the government copy as the generic, parameterise on `ComponentType`. (~6,000, MED — L effort)
25. `stdlib`/`dup` relative-time formatting hand-rolled at 14 sites, `Intl.RelativeTimeFormat` used 0 times; `hashString`/`simpleHash` ×7; `Math.random().toString(36)` ids at 15+ sites (`crypto.randomUUID`); `JSON.parse(JSON.stringify())` ×9 (`structuredClone`); `hexToRgb` ×3 despite `lib/color.ts`; `escapeHtml` ×4; vowel set ×9 in onoma. (~500, HIGH) → **plan 345**
26. `dup` admin: `SystemConfig` key/value read+upsert loop copied in 6 router files (12 procs → 2); econ vs gov admin hook/dialog/panel differ by 18–30 lines; bot process control twice; `IxnayIDCard` (457) vs `AccountIdentityPanel` (755) same 8 procs; `setup/page.tsx` (805) re-implements `CountryNationPanel`; 10 alias route dirs incl. `/admin/wiki` which renders the dashboard; `routers/roles` dead; 5 dead `users/admin.ts` procs; 5th error boundary. (~2,500, HIGH)
27. `delete` config residue: 7 ESLint devDeps (oxlint is the linter; `eslintConfig` key ignored by ESLint 10), duplicate `prettier` config, `tsconfig.json` not extending base (30 duplicated options, `server-only` aliased to a **jest mock** in the prod tsconfig), `next.config.js` `// @ts-nocheck` + 12 ghost `optimizePackageImports` + dead `webpack()` block under Turbopack, `sideEffects` pointing at a file that doesn't exist, `@nevil5249/shadowcraft` (Tailwind-v3 plugin, one class used that it doesn't even generate). (‑9 deps, ~250 lines, HIGH) → **plan 343**
28. `yagni` root layout stacks 14 providers; `AbilityProvider` (2 consumers, CASL-style with no CASL), `ExecutiveNotificationProvider` (2), `CuelumeSoundProvider` (an effect, 0 consumers), `GlobalLinkTooltipProvider` (no context), `MediaThemeProvider`/`MediaContextProvider` (wiki-only). `RackFocusBlurWrapper` applies `filter: blur(10px)` to `<main>` on every navigation. Add one `<MotionConfig reducedMotion="user">` while there (fixes 241 files). [`src/app/layout.tsx:66-109`] (~400, HIGH) → **plan 346**
29. `design-slop` the caption wall: 4,249 `text-[8–11px]` (admin 736, mycountry 595, maps 570, labs 570, wiki-os 404), 1,220 `uppercase tracking-wider|widest`, `text-xs` 6,367 vs `text-sm` 2,295. Apple floor is 11pt; Facet has no sub-`text-xs` tier. Codemod to `text-xs` + one `<Eyebrow>` primitive. (line-neutral, HIGH) → **plan 346**
30. `design-slop` glass-on-glass 4–5 deep (`DrillSheets.tsx:487→519→563→582`, `LoreCardBatchAdmin.tsx` 24 blurs); 1,486 `backdrop-blur`; 2,358 hex literals in TSX (spec §10 bans them); 3,605 `dark:` overrides (spec bans them); 1,815 `transition-all`; 371 `bg-gradient-to-*`; 219 `Sparkles`; 259 `animate-pulse`; 713 emoji-as-icon; 0 `MotionConfig`. Full breakdown in §4. → **plan 346**

---

## 3. Per-system findings

Each section: verdict, then ranked findings in `tag cut. replacement. [path] (~lines, confidence)` form, then net. Findings covered by an existing plan are omitted or cited.

### 3.1 Server infrastructure, tRPC root, data layer (~135K lines)

**Verdict:** generated ceremony around a real API. 698/1,661 procedures dead; 14 mounts 100% dead; a logging framework nobody calls; 12+ cache classes; three deploy entrypoints (plan 330 owns the broken one).

1. `delete` 698 zero-caller procedures; 14 dead mounts (`archetypes` 13/13, `intelAnalytics` 12/12, `intelCore` 11/11, `intelAlerts` 11/11, `roles` 10/10, `wikiImporter` 6/6, `unifiedAtomic` 6/6, `atomicTax` 6/6, `atomicEconomic` 6/6, `diplomaticIntelligence` 5/5, `cardAnalytics` 5/5, `realmsPipeline` 3/3, `diplomaticInbox` 2/2, `cardXp` 1/1); ≥80% dead: `atomicGovernment` 11/12, `quickActions` 20/22, `policies` 22/25, `userLogging` 10/11, `cache` 8/9, `scheduledChanges` 7/8, `demoMode` 7/8, `smallArmsEquipment` 13/15, `meetings` 22/29, `wikiCache` 9/12. (~30,000, HIGH in-repo)
2. `delete` `src/lib/logging/` + `lib/system/logger*.ts` + `routers/user-logging.ts`; keep `console-capture.ts`. (~3,900, HIGH)
3. `delete` 43 unreferenced Prisma models (see §2 #23). (~700 schema lines, MED)
4. `yagni` `safeRouter()`; `wiki` alias mount; triple intelligence mount. [`root.ts:17-27,82-86,222-226,255`] (~130, HIGH)
5. `yagni` `DATABASE_READONLY` (59% of models exempt, dev-only). [`db.ts:60-353`] (~290, MED)
6. `dup` 12+ cache implementations; dead now: `CacheUtils`, `CacheDecorators`, `ExternalApiCacheService` class, `generateContentHash`. [`lib/cache/advanced-cache-system.ts:361-492`] (~130 now, ~1,000 with consolidation, MED)
7. `delete` `lib/websocket/server.ts` (296, `getIntelligenceServer` 0 consumers), `with-reconnect.ts` (98, 0), `websocket/index.ts` barrel (0). Not in 333. (~400, HIGH)
8. `delete` `lib/config.ts` "Global Developer Configuration Registry" (278) — sole consumer is its own test. (~330, HIGH)
9. `dup` staff/admin check copied 6× (`trpc/middleware.ts:356`, `impersonation.ts:29`, `system-validation.ts:87`, `security/defense.ts:286,308`, `api/onoma/tts/route.ts:144`, `hooks/usePermissions.ts:128`); survivor `isPrivilegedCountryWriter`. (~40, HIGH)
10. `slop` unreachable `if (!user)` branch in `adminMiddleware` [`trpc/middleware.ts:300-322`]; regex "WAF" on Prisma-parameterised inputs [`:385-415`]; 3 identical cache middlewares [`:430-451`]; 12 procedure builders, 3 with one use [`trpc/procedures.ts:60-71`]. (~100, HIGH)
11. `slop` `proxy.ts`: unused `ENABLE_COMPRESSION`, `X-RateLimit-Identifier` header nobody reads, `X-XSS-Protection` no-op, duplicate spoof check in `middleware()`/`simpleMiddleware()`, `console.log` per sign-in redirect. (~30, HIGH)
12. `delete` `package.json` `sideEffects` → nonexistent `performance-monitor.ts`; `country-flag-icons` 0 imports. (HIGH)
13. `stdlib` `hashString` ×7, `Math.random().toString(36)` ×15, `JSON.parse(JSON.stringify())` ×9, inline sleep ×5. (~150, HIGH)
14. `yagni` `env.ts` 5 keys read nowhere, 5 `IXWIKI_DB_*` read via `process.env` bypassing validation (check against 339). (~40, MED)
15. `slop` `db.ts:403-416` fires `syncAchievements` as an import side-effect; 7 static-only "Service" classes as namespaces. (MED)
16. `yagni` `server/shared/geo-resource-sync.ts`, `transport-sync.ts` have one importer each; `loadEnvVariables()` copied verbatim 3× across entrypoints (`--env-file` exists). (LOW)

Lean already: `src/trpc/`, `rate-limit-identity.ts`, `impersonation.ts`, `lib/auth/`, `server/cron/`, `server/bridges/`.
**Net: ‑36,000 lines, ‑1 dep, ‑60 files.**

### 3.2 MyCountry, Executive, Statecraft, government/economy/tax/military domains (~115K lines)

**Verdict:** the shell (`MyCountryRouter`, `CommandSurface`, `DrillSheets`, rails, `shared/tabs`) is hand-crafted and restrained. Everything under it is generated: 112 files / ~20K lines unreachable from any page; 99 of 247 procedures dead; three CRUD taxonomies writing the same tables; ~8 parallel effectiveness/synergy tables.

1. `delete` `domains/government/tax/` — unreachable (only a test imports it). [30 files] (~5,750, HIGH)
2. `delete` 99 zero-caller procedures (`meetings/proceedings.ts` 7, `policies/integration.ts` 5, `economics/profile.ts` 5, `economics/fiscal.ts` 5, `countries/wiki.ts` 6, `militaryEquipment/images.ts` 3, …). (~3,500, HIGH)
3. `delete` `lib/government/government-mappings/` (2,583) via dead `atomic-government-integration.ts` (434). (~3,030, HIGH)
4. `dup` `quickactions/` (2,186) re-implements `meetings/` + `policies/`; 3 of 20 procs called; two divergent `activatePolicy` (160 vs 193 lines). Repoint 4 call sites. (~2,100, HIGH)
5. `delete` `lib/economy/{calculation-groups,fiscal-calculations,multimodal-routing,tax-calculator,tax-suggestions-engine}.ts` — imported only by `lib/economy/index.ts`, which nothing imports. (~2,520, HIGH)
6. `delete` `lib/economy/unified-atomic-tax-integration.ts` (1,307): 15/17 exports unused, the 2 used feed 2 dead procs. (~1,510, HIGH)
7. `delete` `domains/economy/historical-charts/` + `useHistoricalEconomicData` + `historical-transformers.ts`. (~1,950, HIGH)
8. `delete` `GovernmentBuilder.tsx`, `useGovernmentBuilder.ts`, `government/builder/*` (8), `atoms/SubBudgetManager.tsx`. (~2,180, HIGH)
9. `delete` `domains/defense/military/` + `UnitManager.tsx`. (~1,280, HIGH)
10. `delete` `lib/statecraft/cross-pillar-engine.ts`, `synergy-calculator.ts` (barrel-only). (~950, HIGH)
11. `delete` `usePolicyAnalytics.ts` + `domains/intelligence/policy-analysis/`. (~1,085, HIGH)
12. `dup` 4 flat `atomic{Economic,Tax,Government}.ts` + `unifiedAtomic.ts` routers (0–3 callers) vs `*Components/` routers. (~1,150, HIGH)
13. `delete` `shared/primitives/tabs/{InteractiveMetric,VitalityRingsDisplay,PolicyBadgeGrid,AnimatedTabContent,TabMotionConfig}.tsx` — 0 JSX usages. (~1,290, MED)
14. `dup` government vs economy atomic component sets: 8 file-for-file pairs, paired hooks, paired `atomic-utils`. (~1,500 net, MED)
15. `dup` ≥7 synergy/conflict/effectiveness rule tables for one `ComponentType` enum. (~2,000, MED)
16. `delete` `countries/atomic.ts` 4/5 dead; `routers/mycountry/` 7/11 dead; `useCountryGovernment.ts` (only `STALE_TIME` imported); `LegislativePolicies.tsx`; `V2Drill*` aliases. (~1,050, HIGH)
17. `slop` business logic in routers: `taxSystem/calculations.ts:calculateLiveTax` 393-line proc with 5 nested loops; `militaryEquipment/catalog.ts:updateCatalogEquipment` 134; `policies/crud.ts:activatePolicy` 193. (~600 relocated, HIGH)
18. `slop` 347 `// ====` banners; 225 `console.*`; 122 `catch → console.error`; 209 "Unified/Comprehensive/Advanced" identifiers. (~650, HIGH)
19. `ts` same interfaces re-declared per file (`EconomicProfileData` ×2, `FiscalSystem(Data)` ×4, `GovernmentComponent` ×2, `CulturalExchange` ×4). `inferRouterOutputs`. (~150, HIGH)
20. `slop` `AssetManager.tsx:510-545` six `...(value as any)`; `useInternalStability.ts:28-46` returns Tailwind classes and `React.createElement` from a data hook; 5 one-query wrapper hooks. (~330, HIGH)
21. `stdlib` `auction-service.ts:150,387`, `intent-summation.ts:91` hand-rolled ids with deprecated `substr`. (HIGH)
22. `perf` `meetings/meetings.ts` 5 `findMany`/0 `take` (`user.findMany` for notification fan-out). (MED)
23. `design-slop` 86 hex + 40 `rgb(` (`TaxCategoryForm.tsx:75-78` 18 hex); 257 rainbow palette hits in 87 files in a gold-themed area (`StatGauge.tsx:34-50` 8-colour enum); 157 uppercase micro-labels; decorative `animate-pulse` on `AlertTriangle` (`BudgetMeter.tsx:60`); invisible gradients `from-card to-card/95` (`BorderThreatPanel.tsx:198,245`); 120 KPI grids; 209 `motion.*` sites, 3 `useReducedMotion`. (MED)

**Net: ‑26,000 lines, ‑150 files.**

### 3.3 Country Builder, Editor, Countries pages, imports (~55K lines)

**Verdict:** plan 001 landed (`useBuilderState.ts` is 557 lines); plan 311 stopped halfway (store created, never wired; hooks it should replace still live). Dead scaffolding from abandoned refactors ≈5.5K lines. The docs/audits monolith list is stale (`UnifiedValidationService.ts`, `atomicGovernmentIntegration.ts`, `data/archetypes/` no longer exist).

1. `delete` `UnifiedAtomicStateManager` + `AtomicBuilderStateManager` — never instantiated; keep `SYNERGY_RULES`/`CONFLICT_RULES`. [`lib/builder/unified-atomic-state.ts` 1,019; `atomic-state.ts:~120-544`] (~1,400, HIGH)
2. `delete` `archetypes` router + `lib/archetypes/` — 13 procs, 0 callers; orphans 4 Prisma models (`core.prisma:742-810`). (~970 + 4 models, HIGH)
3. `delete` 7 of 14 exports in `lib/builder/client-calculations.ts` (1,471). (~900, HIGH)
4. `delete` `stores/builderStore.ts` (0 importers). (183, HIGH)
5. `delete` `primitives/enhanced/EnhancedSlider.tsx` (454, 8 lint-disables) + `EnhancedToggle.tsx` (254) — barrel-only. (~710, HIGH)
6. `dup` atomic-economic-modifier switch ×3 (`client-calculations`, `lib/economy/atomic-integration.ts` 0 importers, `.server.ts` survivor). (~280, HIGH)
7. `delete` `builderIntegrationService.ts` `GOVERNMENT_FIELD_MAPPINGS`/`TAX_FIELD_MAPPINGS` → only feed 2 uncalled helpers. (~200, HIGH)
8. `dup` `app/builder/lib/economy-types.ts` re-defines 18 interfaces already in `types/builder.ts`. (~230, HIGH)
9. `yagni` `ALL_CRYPTO_CURRENCIES` (~350 lines of Bitcoin/Dogecoin) in a fictional-nation builder; `stdlib` `ALL_FIAT_CURRENCIES` 160 rows → codes + `Intl.DisplayNames`; `POPULAR_CURRENCIES` third subset. [`currencyData.ts:18-531`] (~500, HIGH)
10. `yagni` three "concept" country-profile renderings (`Command` 452/`Atlas` 360/`Editorial` 260) + `CountryConceptSwitcher` — a shipped A/B. Not in 319. (~700, MED)
11. `dup` `/countries` vs `/explore` browse UIs (~1,750 explore-only lines, `ComparisonCharts.tsx` 32 hex); no nav link to `/explore`. (~1,500, MED)
12. `dup` 5 persistence channels + `localStorage["builder_imported_data"]` (6th). 311 covers only the EventEmitter services. Survivor: `updateCountry` + `builderDraft`. (~600 + 4 mutations, MED)
13. `delete` `useEconomyBuilderSync.ts` — 311 lists it, executor didn't. (198, HIGH)
14. `dup` `extractEvidence`/`findBestMatch`/`PatternMatch` ×2–4 across wiki-*-parser files; 4 numeric-string parsers; `detectConflicts` ×3; 3 `theme-utils.ts` + `builder-theme.ts` + `archetypeTheme.ts` (global charts import "builder" theme). (~500, MED)
15. `yagni` `lib/government/builder-validation.ts` exports 31 functions, 3 have external callers. (HIGH)
16. `slop` `enhanced/` naming vestigial (no non-enhanced sibling); 63 banners; 74 `Enhanced|Unified` identifiers; 79 lint suppressions on unused destructures (`useGovernmentBuilder.ts` ×9); 150 `console.*` (`nationstates/api-client.ts` 50); `useBuilderAutoSync.ts:8` imports a type from `~/server/services` (arch violation); `xRef.current = x` effects ×7. (HIGH)
17. `ts` `asJsonPayload<T>` is `as unknown as T` with a name (7 sites); `countries/[slug]/_types` 12 hand-written interfaces; 4 re-export shims in `types/builder/`. (MED)
18. `perf` `GlobalBuilderLoading.tsx` 379-line animated loading screen on every builder route transition. (~350, MED)
19. `design-slop` 0 reduced-motion guards in 147 tsx; `transition-all` 140; `animate-pulse` 39 (decorative at `BuilderStudioHeader.tsx:270`, `FoundationHero.tsx:449`); gradient text `ArchetypeGrid.tsx:141`; 103 hex. (MED)

**Net: ‑9,500 lines, ‑25 files, ‑4 models.**

### 3.4 IxWorld Maps, Map Editor, Worldgen/Atlas (~100K lines)

**Verdict:** the runtime core (`map-engine.ts`, `geo-math.ts`, `overlay-registry.ts`, `load-maplibre.ts`, 5 real plugins) is hand-crafted and lean. Around it: five feature routers share a copy-pasted 130-line helper + haversine + Zod schema + identical 27-banner skeleton; 39 of 129 geo procedures dead; two undo systems, two property panels, two welcome modals, two SVG stacks, six MapLibre bootstrap sites; god-hooks (`useMapEditor` 29×`useState`, `useProvinceImporter` 29×) and a 1,448-line `EditorMap.tsx` with 57 props — none of which plans 001–004 cover.

1. `delete` 39 zero-caller geo procedures: whole `admin/templates.ts` (5), whole `realms-pipeline.ts` (3), `editor/procedural.ts` 5/7, `features/storylines.ts` 5/6, `linkage/validation.ts:autoLinkAllCountries`, `subdivisions/crud.ts:getSubdivisionStats`, `wiki.ts:scanWikiForPlaces`, `admin/provinces.ts:validateProvinceImport`, `editor/queue.ts:getMyEditHistory`, `core/overlays.ts:getTradeRouteGeoJSON`, `core/stats.ts` ×3, `core/point-queries.ts` ×2, `admin/uploads.ts:uploadSvg` (superseded by REST), … (~1,993, HIGH)
2. `dup` `syncResourcePoolModifiers` ×6; `pois.ts` calls its own copy instead of `server/shared/geo-resource-sync.ts`. (~660, HIGH)
3. `delete` `lib/maps/pipeline/` (1,350) + `components/maps/pipeline/` (674) reachable only via dead `realms-pipeline.ts`, `/labs/map-pipeline`, tests. Plan 310 assumes this router is live — it is not. (MED, product)
4. `yagni` deck.gl ×4 for `DeckTransportOverlay.tsx` (453); MapLibre-native path already in `TransportOverlay.tsx`. Flip `enableDeckGl` default off. (‑4 deps, ~500, MED)
5. `dup` haversine ×17 vs `geo-math.ts:97 distanceKm`. (~200, HIGH)
6. `perf` `lib/maps/border-editor.ts:712` synchronous `require()` of `topo-simplify`, which `require`s `@turf/turf` (full barrel, untyped) ×4 + 3 topojson packages into the editor client chunk. `@turf/kinks|area|simplify` submodules + `await import()`. (HIGH)
7. `slop` 742 banner comments; 5 feature routers + `sovereignty.ts`, `editor/queue.ts`, `editor/procedural.ts` carry the identical 27-banner skeleton. (~700, HIGH)
8. `dup` MapLibre bootstrap ×6 (`map-engine.ts:107` + `CoordinatesMapEmbed.tsx:105`, `useCountryMapEmbedLayers.ts:109`, `MapPickerModal.tsx:103`, `SvgPreviewMap.tsx:45`, `PreviewSection.tsx:84`); "grey out other countries" block ×3. (~230, HIGH)
9. `dup` `geojson-layer-helpers.ts` used by 2 overlays while `useMapLayers.ts` hand-rolls 26 `addSource`/51 layer literals/12 `getLayer` guards. (~300, MED)
10. `yagni` god-hooks: `useMapEditor.ts` (630, 29 `useState`), `useProvinceImporter.ts` (783, 29), `useMapState.ts` (339, 18); `EditorMap.tsx` (1,448, 57-prop interface, 4 global listeners). (L effort)
11. `dup` two undo stacks (`border-undo.ts` + `useBorderEditor` vs `useMapHistory` + `useHistoryReversalExecutor` + `HistoryPanel`); `useMapHistory` returns 14 keys with redundant pairs; `useHistoryReversalExecutor.ts:20-42` re-instantiates 19 mutations that `useMapFeatureMutations` already holds; undo-of-delete recreates with a new id so redo targets a stale id (**bug**). Ctrl+Z handled twice (`useMapEditorOverlayState.ts:410`, `SelectPlugin.ts:44`). (MED)
12. `ts` `types/maps/editor-domain.ts` (184) re-declares `FeatureType` + all `*Feature` interfaces from `hooks/map-editor/editor-types.ts`, already drifted (missing `"gap"`). Delete. (HIGH)
13. `dup`+`native` two hand-rolled welcome modals (`MapWelcomeModal` 432, `MapEditorWelcomeModal` 358), neither uses `ui/Dialog`. (~400, HIGH)
14. `dup` two property-editing surfaces (`FeaturePropertyPanel` + 7 forms ~1,660 vs `FeatureInspector` + `DocumentInspector` 1,131); `PropertiesPanelContent.tsx:333-492` falls back between them. (MED, product)
15. `dup` `coordinatesSchema` Zod tuple ×6; `native` `findFirst → update|create` loops in `geo-resource-sync.ts:79-113`, `transport-sync.ts:143-165` → unique index + `upsert`. (HIGH)
16. `perf` 41 of 146 `findMany` lack `select`/`take`; `geo/core/country.ts:106-139` 8 select-less `findMany` per country. Not in 336. (HIGH)
17. `dup` `shared/layer-cache.ts:45-79` re-implements `lib/cache/cache.ts`. (MED)
18. `delete` `lib/maps/index.ts` (39-line master barrel, 0 importers) + `route-geometry.ts` reachable only through it. (HIGH)
19. `delete`/move labs-only `components/maps/vexel/` (3,011, heraldry editor) and `pipeline/` (674). (MED, product)
20. `dup` two SVG→GeoJSON stacks (`lib/flags/svg-parser.ts` 1,326 vs `province-importer/svg-*` ~1,770); `svg-path-parser` `createRequire`d with hand-written types in both. (MED)
21. `stdlib` `map-update-bus.ts:22-48` class → `EventTarget`; `editor-prefs.ts` two identical get/set pairs. (~95, HIGH)
22. `slop` `console.log` in `ProvincePreviewLayer.tsx` ("MOUNTED"), `layer-loader.ts:33-46`; `getSystemHealth` in 3 routers (geo copy dead); `(mod as any).default as any` maplibre shim ×2; 12 files import `@turf/<sub>` packages not declared. (HIGH)
23. `design-slop` 572 `text-[9|10|11px]` (`DocumentInspector.tsx` 34, `FeatureInspector.tsx` 29); 147 uppercase labels; identical `animate-pulse` string in 3 property forms; `z-[9999]` ×4; 93 hex in TSX; 33 per-instance global listeners. (MED)

Lean already: `overlay-registry.ts`, `plugins/`, `load-maplibre.ts`, `map-idb-cache.ts`, `geo-math.ts`, `story-pin-icons.ts`, `api/maps/editor-source`.
**Net: ‑5,200 (HIGH) to ‑11,000 lines, ‑4 deps, ‑12 to ‑20 files.**

### 3.5 IxVault, Cards, Market, Lorewards, Achievements (~65K lines)

**Verdict:** the most generated-feeling system: ~65K lines for 6 rarities and 8 cosmetics. 62/227 procedures dead; rarity colour defined in ≥10 places and disagreeing; 2,457 lines of holographic code across five files; seven particle implementations; admin panels as single 700–2,400-line functions. The lib core (`vault-ledger`, `category-*`, `definitions.ts`) is coherent.

1. `delete` 62 zero-caller procedures incl. all of `cardAnalytics` (643), `cardXp` (46), 9 `lorewards.*`, 13 `cards.*`, 10 `cardMarket.*`, 7 `vault.*`, 6 `nsImport.*`, 5 `crafting.*`. (~3,400, HIGH)
2. `dup` rarity→colour ×10 (disagreeing); `getRarityGlow` ×2; rarity→number ×7 (`Stage4_QuickActions.tsx:40` and `:240` identical in one file). Survivor `lib/cards/display-utils.ts`. (~350, HIGH)
3. `dup` 5 holographic covers + `holographic-effects.ts` (703); `CardDisplay.tsx:338,379` stacks two. (~1,500, HIGH)
4. `delete` `CardGrid.tsx` (253, 0 importers) while `vault/collections/[slug]/page.tsx:236` ships a "CardGrid Component —" placeholder. (HIGH)
5. `slop` `LoreCardBatchAdmin.tsx` one 2,288-line function, 28 `useState`, 12 procedures, two tabs inlined, 7 `as any`. Split ≥4. (~400 net, HIGH)
6. `native` `@tsparticles/react` + `slim` (~10 MB, 40 packages) for `CosmeticParticlesCanvas.tsx` (155 lines, 18–28 sprites, 5 styles) → CSS `@keyframes` on 6 `<svg>`. (‑2 deps, ~120, HIGH)
7. `yagni` `vault-service.ts` (129): 16 one-line delegations, 47 call sites. `pack-opening-service.ts`: 3 empty "silenced" sound methods, unused `RARITY_SOUNDS`, never-written `audioContext`. (~260, HIGH)
8. `yagni` MYTHIC/DIVINE tiers absent from Prisma but carried in 14 files (`rarity-materials.ts` 60 lines). (~120, HIGH)
9. `delete` `lib/achievements/card-rewards.ts` 5 of 6 exports dead (280); 5 dead barrels (`lib/cards/{client,server}.ts`, `lib/vault/{client,server}.ts`, `lib/achievements/index.ts`); `QUEST_PATHS` (137, no consumer); 8 dead `display-utils`/`holographic-effects` exports; dead `stat-config`/`exchange-config`/`ool-parser`/`lorewards/sync` exports. (~800, HIGH/MED)
10. `dup` 6 hand-rolled particle generators (`Stage2_PackExplosion`, `GlassSplashEffect`, `Stage3_CardReveal`, `CraftingAnimation`, `VaultParticleExplosionModal`, `pack-opening-service.generateParticles`). One `<Burst>`. (~400, MED)
11. `ts` `lib/cards/enums.ts` (118) hand-mirrors Prisma enums ("MUST match the Prisma schema exactly"); `vault-theme.ts:5` re-declares `CardRarity`; `vault-type-guards.ts` (208) duplicates brands from `types/cards-display.ts`, 8 brands with 0 uses. (~330, HIGH)
12. `yagni` 6 wrapper hooks with one caller (`useCollections` with `c: any`, `useRecentActivity`, `useVaultBalance`, `useVaultStats` — fires a **mutation on mount**, `useAuctionBid`, `useAuctionWebSocket` 6 `as any`). (~250, MED)
13. `slop` `useActiveCosmetics.ts:118-190` `useState`+`useEffect`+20-line structural-equality guard = a `useMemo`; 2 `window` listeners per instance, instantiated per forum row. (~90, HIGH)
14. `shrink` fat routers: `trading/offers.ts:respondToTrade` one 366-line proc (331 owns atomicity, not size); `ns-import/cards.ts` 746 lines, 22 inline Prisma calls; `achievements/progress.ts` 444 lines for 1 proc. (~800 to lib, MED)
15. `dup` `auction-service.ts` refund-previous-bidder block `:352-362` ≈ `:526-536`. (MED)
16. `slop` 60 `console.log/info` in prod lib paths; 81 lint-disables; 145 `as any`; god components `NSImportSuiteAdmin` 1,048, `VaultUserDirectory` 991, `CardBack.tsx` 826 (60-line `RARITY_THEMES` ×6 + inline SVG), `VaultStoreControl` 748, `TradeOfferModal` 669. (MED)
17. `delete` `lib/wiki-os/adapters/ixstates/lore-card-generator.ts` 4-line `export *` shim imported by 10 files. (HIGH)
18. `slop` `createtradeOffer` casing typo locked into the public API. (LOW)
19. `design-slop` glow-on-everything: `AvatarGlow.tsx:44-69` pulse + `shadow-[0_0_15px_#f97316]` + `animate-ping`; `NeonFrameOverlay.tsx:49-57` three `❄` emoji bouncing; `CardBack.tsx:99-200` six `medallionGlow` + conic foil gradients per tier; 74 gradients, 20 glow shadows, 217 blurs, 201 `transition-all`, 632 `text-xs`, 100 `rgba(`, 0 reduced-motion guards. (MED)

Lean already: `lib/achievements/definitions.ts` (78 data entries with predicates).
**Net: ‑8,000 lines, ‑2 deps, ‑22 files.**

### 3.6 Concord: Diplomacy, Intelligence, Crises, NPC, IxTime, Heraldry (~53K lines)

**Verdict:** 185 procedures across 13 mounts, 119 (64%) dead. Three whole mounted routers plus four more are 100% dead — ~5.6K of the 5.7K-line intelligence router tree is unreachable, and the UI tree that would consume it is unreferenced. "Diplomatic encryption" is a boolean column. The living core (embassies, exchanges, alliances, heraldry, IxTime core) is real; the UI is visually restrained.

1. `delete` `intelCore`, `intelAlerts`, `intelAnalytics` routers + mounts (34 procs, 0 callers). [`routers/intelligence/{core,alerts,analytics}`, `root.ts:85-87,218-220`] (~5,200, HIGH)
2. `delete` `intelligenceBriefing` 7/7, `intelligence/feed.ts` 6/6 (incl. `initializeSampleData` seeder in a prod router), `diplomaticInbox` 2/2, `diplomaticIntelligence` 5/5 + its test. (~1,380, HIGH)
3. `delete` `domains/intelligence/` component tree (14 files) + `useDiplomaticAnalytics`. (~1,530, HIGH)
4. `delete` `lib/intelligence/engine.ts` + `broadcast-service.ts` + `transformers.ts` + barrel — 0 real uses. (~1,100, HIGH)
5. `delete` `diplomaticScenarios/player.ts` 3/3 dead, `publicProcedure`, 5× `Math.random()` fake data. (484, HIGH)
6. `delete` 11 more dead `diplomaticScenarios` procs; 8/10 `crisisEvents`; 41 dead procs in live mounts (`diplomaticCore` 9, `diplomaticEmbassies` 8 — all mission/budget/upgrade, `diplomaticPolicies` 8, `diplomaticCultural` 4, `npcPersonalities` 7, `heraldry` 5). (~3,500, MED — some may be planned UI)
7. `yagni` `IxTimeSyncManager` + `IxTimeAccuracyVerifier` (1,250) consumed only by `"use client"` `IxTimeVisualizer.tsx`; the `child_process`/`ixwiki-notify.sh` path can never execute; `DEFAULT_TARGETS` read by nothing. Not in 334. (~1,250, MED)
8. `dup` two scenario generators (`CulturalScenarioGenerator` vs router-inline copy in dead `player.ts`); `intelAlerts.*AlertThreshold` duplicates `notifications.*AlertThreshold` (only the latter has a caller); `sendSecureMessage` ×2, both dead. (counted above, HIGH)
9. `delete` "encrypted messaging" theatre: `DiplomaticMessage.encryptedContent/encryptionVersion/encryptedKey` never written; help copy promises encryption (`help/social/thinkshare/page.tsx:85`). Drop columns, fix copy; flag for security reviewer. (HIGH)
10. `delete` `NPCPersonalitySystem` 4 dead public methods (386); `yagni` static-only class where 9 `predict*Response` methods are one weighted-score template with different weights (~370 → weight table). (~700, MED)
11. `delete` `markov-engine.ts` 6 unused exports (~500, MED); dead barrels `lib/diplomacy/index.ts`, `lib/intelligence/index.ts`; `useIntelligenceWebSocket.ts` 3 wrapper hooks with 0 callers (base hook consumed only by `GovernmentBuilder`/`TaxBuilder` — both dead per §3.2); 7 dead `IxTime` static methods; `types/ixtime.ts` 6-line re-export. (~600, HIGH)
12. `slop` single-procedure router files of 500–700 lines (`impact.ts` 592/1, `severance.ts` 515/1, `exchanges/missions.ts` 555/1, `establish.ts` 675/2); 230 banners; 63 "Enhanced/Unified" names; 61 `catch → INTERNAL_SERVER_ERROR` rewraps discarding the error class; 113 `console.*`. (~450, HIGH)
13. `stdlib` hand-rolled ids with deprecated `substr` ×3. (HIGH)
14. `dup` 4 per-feature websocket hooks (329/343/410/104 lines) each hand-roll connect/reconnect while `lib/websocket/with-reconnect.ts` exists unused. (~600, LOW)
15. `delete` `npc-cultural-participation.ts` (920) imported only by a dead proc (needs one read). (LOW)
16. `design-slop` 189 palette utilities + 30 hex (charts, embassy sheet); `whileHover={{scale:1.05, rotate:-2}}` on exchange cards; `animate-pulse` empty-state icons; 8 emoji in a data table; 0 reduced-motion guards in 42 files. (MED)

Lean already: heraldry lib (1.2K, tested), alert thresholds (live), `ixtime/core.ts`.
**Net: ‑16,000 lines (10.3K HIGH), ‑45 files.**

### 3.7 MyLeague / MySports (~31K lines)

**Verdict:** per-sport resolvers are *not* copy-paste (15–28% shared) — plan 322's adapter framing misdiagnoses the duplication. The sprawl is one level up: the simulate-and-persist block is copied 9× and has drifted (cron passes no rosters; win-points differ); `season-cron.ts` is a second lifecycle; ~3,900 lines provably dead; UI has 51 hand-written row interfaces and 0 `inferRouterOutputs`. The "seed-sports.ts 1,777 lines" lead is stale (72 lines now).

1. `dup` simulate-and-persist ×9 (`matchDay.ts:133-330,515-690`, `fullseason.ts:215-350,445-480`, `playoffs.ts:100-160`, `season-cron.ts:273-440`, `world-cup.ts:323,409`, `seed-soccer.ts:190`, `seed-boxing.ts:155`). Not in 320. (~900, HIGH)
2. `dup` win-points rule diverges (`increment: 3` ×6 vs `season-cron.ts:449` `league ? 3 : 2`); `ARCHETYPE_CONFIGS` and plan 322's `scoringRules` both define it and neither is read. (**correctness**, HIGH)
3. `delete` `season-cron.ts` second lifecycle (902); `server.mjs:342` imports non-existent `sports-cron.js` and reads a field the real function never returns while `server.mjs:12` imports the real module unused. (~800, HIGH)
4. `delete` 10 zero-caller procs (whole `playoffs.ts` 275, whole `race.ts` 134, `cancelTransferListing`, `exportLeagueData`, `generateMatchPreview/Report`, `getLeagueHistory`, `getRecords`, `getTeams`, `withdrawTransferBid`) + 2 procs only ever `.invalidate()`d. (~1,000, HIGH)
5. `delete` 6 barrel-only components (`PlayerStats`, `ScheduleView`→`MatchSchedule`, `AthleteDetailSheet` (superseded by `SportsFocusPanel`), `EntityLink`, `MatchPredictionWidget`) + both barrels. (~1,320, HIGH)
6. `delete` `lib/sports/world-cup.ts` (506) — live world cup is `transition.ts:843`; only a test imports it. (~640, HIGH)
7. `shrink` `transition.ts:transitionSeasonAction` one 829-line function (depth 9, 56 awaits, 30 `as any`). (MED; 315 if named there)
8. `dup` sport metadata ×6 (`presets.ts` ×2, `definitions/*`, `theming.ts` ×2 — `accentHsl` **disagrees** with `presets.accentColor`, page-local `SPORT_EMOJIS`, `SportsSeederPanel`). (~250, HIGH)
9. `yagni` `lib/sports/definitions/` (9 files, plan 322 step 1): only `surfaceType`/`periods` read by 2 files; `terminology`, `rosterSlots`, `scoringRules` have 0 consumers. (~300, HIGH)
10. `dup` 3 standings tables; 3 hand-written match-row shapes (`MatchEvent`, `MatchdayTapeItem`, `ScheduleMatch`) mapped in `LeagueRouter.tsx:227-300`; 12 of 20 exports in `lib/sports/types.ts` dead (`StandingRecord` drifted from Prisma). (~400, HIGH)
11. `dup` `computeTeamRatingVector` forked in `demo-seed/sports/sports-helpers.ts:97` (seeded teams rated by a different formula than live); `hashString` ×5; `computePlayerAvg` ×3. (~90, HIGH)
12. `delete` `feed-bulletins.ts:130-340` 211-line regex fallback for pre-marker posts (backfill already ran — confirm in DB). (MED)
13. `dup` 3 simulation-control decks; `SportsOversightPanel.tsx` (1,440) = 4 components incl. a 576-line `AINarratorLab`; `LeagueRouter`/`ClubRouter` share a 43-line URL-sync block; within-file home/away mirror blocks in `basketball.ts` (72%) and `baseball.ts` (64%). (~600, MED)
14. `slop` `const resRec = result as any` ×7 on an already-typed result; `ctx.db as any` ×37; 181 `as any`; 30 `notify.success` toasts for trivial actions; READMEs name 7 components that don't exist. (HIGH)
15. `perf` `sportRivalry.findFirst` per match inside every loop + 2 `getTeamModifiers`; `season-cron.ts:273` 13 awaits per iteration. Not in 336. (HIGH)
16. `slop` `SportsBulletinCard.tsx:39` builds `/myclub/${league.id}` — a league id sent to the team route (**broken link**); churned 14×. (HIGH)
17. `design-slop` `team.color ?? "#3b82f6"` ×39; 30 emoji-as-icon sites + `getSportEmoji` in 6 files; `Sparkles animate-spin`, pulsing "LIVE SIMULATOR"/Trophy; `theming.ts:27-134` per-sport `glowColor`/`surfaceGlowClass`; 0 reduced-motion. (MED)

Lean already: `league-covers.ts` (60 lines) — not a JSON candidate.
**Net: ‑6,000 lines, ‑22 files.**

### 3.8 Social: ThinkPages, Dashboard, Feed, Messages, Forum, Activities, Notifications, Polls (~52K lines)

**Verdict:** UI is mostly hand-crafted (composer/post split sane, one `useNotify`, gradients/glow nearly absent). The server/lib side is where the bloat lives: two generations of messaging code; notification and activity "hook" libraries ~70% never invoked; the main live-notification hook has no consumer. `CLAUDE.md`'s `DashboardRouter`/`ThinkPagesRouter` description is stale (neither exists in that form).

1. `delete` Plan-163 legacy `thinkpages.messaging` router (396, 8 procs, 0 callers; `presence.ts:50` is `publicProcedure`) + module-only backing (`getConversationsLegacy`, `createConversationByCountries`, `updatePresence`, `formatThinkpagesConversation/Message`, `service.ts` wrappers, contracts) + `api-parity.test.ts`. Survivor `api.messages.*` (58 sites). (~700, HIGH)
2. `delete` `lib/activity/hooks.ts` — 6 static classes, 17 methods, 3 called; `auto-post.ts` 2 generators 0 callers. (~775, HIGH)
3. `delete` `lib/notifications/hooks.ts` 9 hooks whose only reference is a string key in `events-registry.ts` (a UI toggle table, not a dispatcher); `api.ts` 6 `notify*` methods 0 callers. Admin "Events Registry" advertises toggles for events that can never fire. (~560, HIGH)
4. `delete` `useLiveNotifications()` body (`:53-374`) — no consumer; only `useNotificationBadge` is imported. Not in 324. (~320, HIGH)
5. `delete` `thinktanks/messages.ts` (395, 6 procs, no UI). (MED-HIGH)
6. `delete` `_components/ActivityFeed.tsx` (352, barrel-only). (HIGH)
7. `dup` `WikiFeedCard.tsx` (761) vs `InlineWikiArticlePreview.tsx` (646): 423 identical lines, `UnifiedFeedItem.tsx:178,260` renders both for one item (16× churn). (~400, HIGH)
8. `yagni` `ui/poll-widget.tsx` (1,225) 14-part compound API with `inline|popover|dialog`; sole consumer uses `inline` + 6 parts. (~400, HIGH)
9. `delete` zero-caller procs in `activities` (10 incl. `testMutation`) and `notifications` (3). (~600, MED)
10. `dup` `modules/messages/services/message-mutations.ts:persistMessageTx` (`any`-typed) vs `modules/messaging/message-operations.ts:sendMessage`; only its own test imports it. (~90 + test, HIGH)
11. `stdlib` relative-time hand-rolled 10× in scope alone + `useRelativeTime` + 2 exported copies; 0 `Intl.RelativeTimeFormat`. (~150, HIGH)
12. `delete` 4 byte-identical `dashboard/{feed,trends,diplomacy,world}/page.tsx` (18 lines each; router never reads pathname; nothing links to them). (HIGH)
13. `dup` `ixtwitter-sync.ts` two HTML→markdown converters + `backfillIxTwitterToThinkPages` (only an archived script calls it; 328 adds a lock to dead code). (~190, MED)
14. `dup` poll/link-preview/visualization rendering repeated in `StandardPostView.tsx:376-395` and `HeroPostView.tsx:285-292` while `PostBody.tsx` already accepts those props and neither caller passes them. (~40, HIGH)
15. `dup` `take: limit+1 / pop() / nextCursor` idiom ×9 (+3 `skip` variants). (~45, HIGH)
16. `yagni` `modules/forum/index.ts` 4 barrel-only exports; `NotificationAPIService` singleton class; `modules/messaging/service.ts` 172-line pass-through façade (`return await this.queries.X` ×18). (MED)
17. `slop` 65 `notify.success` for trivial actions ("Reaction added!", "GIF added to post", "Pin Toggled"); 37 exclamation strings; 206 `console.*` (`lib/activity/*` 46); 165 banners; `DashboardRouter.tsx:21-23` sets `document.title` while every page calls `usePageTitle`. (HIGH)
18. `native` `EmojiPicker.tsx` (685, 337 hand-typed emoji) re-implements the OS emoji keyboard. (LOW, product)
19. `slop` 9 hand-rolled `popstate` routers repo-wide (`MessagesRouter`, `MyCountryRouter`, `ClubRouter`, `LeagueRouter`, `BuilderRouter`, `StudioRouter`, `AdminNavigationContext`, …) — one `useSectionRouter` hook. (~300, MED)
20. `design-slop` 277 palette classes + 10 hex; 260 micro-text sites; 191 `transition-all`; ~8 decorative `animate-pulse` (`SportsBulletinCard.tsx:132`, `DashboardPlayerWidget.tsx:295,374`). Gradients/glow clean. (MED)

**Net: ‑4,900 lines, ‑13 files.**

### 3.9 WikiOS, Halo, MediaWiki bridge, narrator (~85K lines incl. 12K CSS)

**Verdict:** the engine (`lib/wiki-os/wikitext/*`, `wiki-ast.ts`, `transformers/*`) is hand-crafted, well-tested, and plans 195–208/301–305 already removed most parser duplication. Bloat is at the edges. Corrections: `mediawiki-service.ts`/`wiki-bridge.ts`/`wiki-search-service.ts` were deleted in `8376d0a5`; the "slate imported in laborCalculations/AwardsManager" lead is the Tailwind colour string, not the package; Halo is a shipped cross-app overlay (8 consumers), not a lab, but its rename from DynamicIsland is half-finished.

1. `delete` `wikiImporter` router (1,127, 0 callers) + `adapters/ixstates/content-analyzer.ts` (556, sole consumer). (~1,700, HIGH)
2. `delete` ~461 `wikios-*` CSS classes referenced by no TS/TSX (checked literal tokens + 3 dynamic bases): est. 2,000–3,800 of 12,227 lines; `!important` ×374. (MED)
3. `dup` 8 MediaWiki proxy routes → one `[wiki]/[...path]` + `[wiki]/api.php` with a 4-entry config map (deltas: commons allows `parse`, iiwiki needs `IxStats-Builder` UA). Do with/before 335. (~1,400, HIGH)
4. `yagni` `templates.ts` router 69% static data (`CANONICAL_BUILTIN_TEMPLATES` :31-318, `CANONICAL_ALIASES_MAP`, `BUILTIN_TEMPLATE_SCHEMAS` :383-1062) exported, 0 importers, 14/29 names duplicated in `master-presets.ts`. (~1,000 moved, ~300 deleted, HIGH)
5. `perf` article reader is `"use client"` + `getArticleHtml.useQuery`, no `generateMetadata` — the product's core content paints after JS + a tRPC round-trip; no HTML for crawlers. Server-render `wiki/[slug]/page.tsx`. Not in 307/200. (HIGH)
6. `dup` `/wiki/contributions/[user]` vs `/util/contributions/[user]` (diff = one href), `/wiki/categories/[...slug]` vs `/util/categories/[...slug]` (byte-identical). Plan 198 promised redirects. (~395, HIGH)
7. `delete` `plateNodesToAst` + `plateLeavesToAstInlines` — no production caller (`serializePlateToWikitext` is the live path). (~280, HIGH)
8. `delete` `shiki` (0 import sites; a type alias name and a JSDoc mention). (‑1 dep, HIGH)
9. `shrink` `ArticleRenderer.tsx` 842 lines, 39 hooks, 26 handlers, 2× `dangerouslySetInnerHTML`. (~400 net, MED)
10. `dup` `useWikiVisualFormatting.ts` (1,005, 23 `useCallback`) never imports `shared/editor/SlateSerializer.ts` (`toggleMark`/`toggleBlock`). (~200, MED)
11. `delete` Halo dead exports (`DynamicDiv`, `DynamicTitle`, `DynamicDescription`, `useScheduledAnimations`, `BlobContext`, `HaloOuterWrapper`, `useDIPluginView`, `useAllDIPlugins`, "backward compatibility" re-export block); `slop` rename half-done — aliases (`DynamicIsland` ×9, `useDynamicIslandSize` ×9, `DynamicContainer` ×15) are what's consumed, canonical `Halo*` names have 1 use each. (~250, HIGH)
12. `dup` `escapeHtml` ×4, `escapeAttr` ×2; 4 pass-through renames of `cleanWikiMarkup` + hand-rolled 5-regex `cleanWiki` in `InlineWiki.tsx:19`. (~75, HIGH)
13. `delete` `thinkpages/GlassPlateEditor.tsx` 5-line shim; 8+ stale `// src/...` path headers; `wiki-search-service.test.ts` misnamed; `docs/systems/halo.md` lists nonexistent `plugins/_template/`; plan 200 §3 items 1–2 already done. (HIGH)
14. `slop` 118 `catch → console.*`; 165 `console.*` (`pg-reader.ts` 19, proxies 34); 127 banners; 45 name-slop identifiers (`WikiOSUnifiedSidebar`, `EnhancedCategoryBrowser`, `intelligent-lore-cache`, `UniversalTemplateModal`, `Sculpted*`). (MED)
15. `yagni` single-consumer wrapper hooks `useWikiPreferences` (46), `useWikiPrefetch` (94), `useWikiScanner` (331). (~100, MED)
16. `dup`? narrator UI in both `halo/plugins/wiki/components/WikiNarratorPlayer.tsx` (661) and `wiki-os/reader/ArticleCompanionHUD.tsx` (406) share 31 identifiers; `useWikiNarrator.ts` 799 lines, 12 effects, 1 consumer. (LOW confidence on dup, needs a human)
17. `perf` 12 of 23 `findMany` in `routers/wikios/*` lack `take`. (LOW-MED)
18. `native` 9 `'use client'` leaves with zero hooks (`ArticleCategories`, `ArticleFooter`, `IxWikiLogo`, …); 104/112 wiki-os files client — the lever is #5. (LOW)
19. `design-slop` `transition-all` ×382, uppercase+tracking ×124, hex ×140 + `rgba(` ×90, `animate-pulse` ×43, gradients ×44, glow ×15, "gold particle explosion" on article mount (`ArticleHeader.tsx:106,398`; 8 `loreward-particle-*` CSS rules). (MED)

Verified not duplicates: the "three bridges" are two with distinct jobs; CodeMirror + Plate/Slate is the intended dual editor (305 DONE); `wiki-ast-converter.astToWikitext` wraps `wikitext/serializer`; `wikiCache` router has 3 UI callers.
**Net: ‑6,500 lines, ‑1 dep, ‑14 files.**

### 3.10 Admin CMS, Labs, Studio, Settings, Help, Passport/IxnayID, Setup, Legal (~124K lines)

**Verdict:** a real hand-built operator surface (47 route dirs) but ~10 dirs are aliases/tabs, two are dead ends (`/admin/wiki` renders the dashboard), four `_components` god-files at 1,000–1,800 lines, an unconsumed 953-line RBAC router beside two competing seed procedures, business logic in 190–250-line procedures. `src/app/labs/` ships a 3,495-line personal CS tutorial and a 3,276-line superseded spec to anonymous users. Help/terms/privacy are 10.6K lines of JSX prose. Admin reads generated: 108 KPI grids, 704 non-semantic colour utilities, 11 hand-rolled spinners, 463 uppercase micro-labels.

1. `delete` `/labs/sandbox` (page 3,421 + `challenges/*.ts` 337 + `hello-world/` 243; no auth gate — `proxy.ts:18-40` lists `/labs` in neither matcher; Halo `halo-registry.ts:371`; imports admin internals `page.tsx:39-42`). (~4,075, HIGH)
2. `delete` `/labs/design-bible` (2,700-line component; superseded per `plans/archive/mycountry-bible-v2.md:3`; imports `@xyflow/react` + CSS; `any`-typed). Move prose to `docs/`. (~3,276, HIGH)
3. `delete` `routers/roles/` (953, 10 procs, 0 app callers; `UserRolesPanel` uses `api.admin.*`/`api.users.*`; `initializeRoleSystem` duplicates `users/admin.ts:setupDatabase` with a different permission list). (~953 + test, HIGH)
4. `native` help centre (55 JSX pages, 938 `<li>`, 68 hardcoded `text-slate-*`, `linkClass` ×4) + terms/privacy JSX → one `[...slug]` markdown route; 13 orphan articles unregistered in `HelpExplorer.tsx:38`. (‑7,000 net, MED)
5. `yagni` `/studio` (17 files, 1,962; zero inbound links; single proc; per-section gradient palette `studio-theme.ts:37-55`). Not in 310. (MED)
6. `dup` `settings/IxnayIDCard.tsx` (457, mounted in Clerk `UserButton` page) vs `AccountIdentityPanel.tsx` (755) — same 8 `api.ixnayid.*` procs; 6-line shim + 3 unused barrels in `settings/`. (~460, HIGH)
7. `shrink` 12 admin "settings" procs = 6 copies of the `systemConfig.findMany` + per-key `upsert` loop (`system.ts:122/200`, `stash.ts:25/72`, `cron.ts:7/30`, `thinkpages.ts:47/103`, `users.ts:99/152`, `wiki.ts:298/325`) → `getConfigKeys(ns)`/`setConfigKeys(ns, map)`. (~350, MED)
8. `delete` `users/admin.ts` dead procs `setupDatabase` (:110-203), 4× `*AdminFavorite*` (:204-378). (~270, HIGH)
9. `delete` alias/dead admin dirs: `settings/`≡`platform/`, `user-management/`≡`users/`, `user-logs/`≡`logs/`, `worldstudio/`≡`maps`; `autosave-monitor/`, `world-settings/`, `style-editor` are tabs; `wiki/` and `facet-materials-lab/` have **no** `AdminRouter` case → render `LiveAdminDashboard`. (~10 dirs, HIGH)
10. `dup` `useEconomicComponentsAdmin` vs `useGovernmentComponentsAdmin` (18-line diff), `EconomicSynergyDialog` vs `GovernmentSynergyDialog` (23), `*ComponentsPanel` (4); bot process control + log viewer in both `BotControlCard.tsx:76-164` and `LorewardsBotSection.tsx:192-228`; `admin/worldEvents.ts` diplomatic-option CRUD duplicates `diplomacy/core/options.ts`. (~700, HIGH)
11. `slop` business logic in routers: `admin/users.ts:syncDiscordGuildMembers` 199 lines of Discord REST in a *query* (:362-561); `admin/countries/import.ts:importRosterData` 250; `users/country-linking.ts:createCountry` 246; `godMode.ts:updateCountryData` 190. (~1,000 relocated, MED)
12. `slop` try/catch→`console.error`→rethrow: `admin/system.ts` 12, `users/admin.ts` 6, `users/profile.ts` 9, `users/country-linking.ts` 9. (~150, HIGH)
13. `shrink` `users/preferences.ts` unblock/unmute/removeKeyword byte-identical except error string (6 procs → 2); `useAdminHandlers.ts` 10 injectable mutation params none of 3 callers pass; `setup/page.tsx` (805) re-implements `CountryNationPanel` (363); `admin/_components/ErrorBoundary.tsx` is the 5th error boundary. (~600, HIGH)
14. `slop` `security/military.ts:159-462` 9 procs = CRUD × {branch, unit, asset}; dead `_`-prefixed declarations ×7; `changelog/page.tsx` hardcodes 2 releases and is `"use client"` to filter them; `labs/layout.tsx` `"use client"` bare `<div>`; `AbilityProvider` CASL-style with no CASL, 2 consumers. (~400, MED)
15. `delete` `@tanstack/react-table` (0 import sites). `slop` `admin/README.md` lists 3 absent dirs, omits 2; `admin-endpoint-security-map.md` documents 30 of 96 procs while guards are uniform (107 `adminProcedure`). (HIGH)
16. `perf` `AdminSidebarLayout` mounts `SystemStatusWidget` (3 queries) on every admin route while `LiveAdminDashboard` re-queries `getSystemStatus`. (LOW)
17. `design-slop` 11 hand-rolled spinners with per-site colours while `GlobalLoader` exists; 108 `grid-cols-3/4/5` KPI grids across 70 files; 704 non-semantic colour utilities + 274 hex (`LoreCardBatchAdmin.tsx` 55, `settings/_lib/sections.ts:46-66` per-section palette); 463 uppercase micro-labels; 549 `transition-all`; pulsing status dots ×7; spinning `Sparkles` (`SportsOversightPanel.tsx:786`); 140 emoji. Admin is not named in 317/318. (HIGH)

**Net: ‑17,000 to ‑20,000 lines, ‑1 dep, ‑95 files.**

### 3.11 UI primitives, Facet design system, app shell, global styles (~26K lines + 20.6K CSS)

**Verdict:** `ui/` is 25.6K lines, ~4K of which are actual shadcn/Radix primitives (in good shape, hand-curated); the rest is feature code parked in a "primitives" folder. ~1,430 lines across 12 files have zero importers. The Facet spec is well-written; the repo has drifted hard from it ("zero hex / no `dark:` overrides" vs 2,358 hex and 3,605 `dark:`; "250 ms ceiling / transform+opacity only" vs 57 `animate={{width|height}}` and 263 durations ≥300 ms). The strongest generated-dashboard tell in the product is typography. The worktree diff on 11 `ui/` files (`[:where(&)_svg]:size-4` + `icon-sizing.test.ts`) is a coherent specificity fix — finish and commit it.

1. `native` `SwipeableRow.tsx` (946) + `useSwipePhysics.ts` (444) hand-rolled pointer/rAF drag, 0 uses of motion's `drag`, 4 importers → `motion.div drag="x" dragConstraints dragElastic onDragEnd`. (~1,400 → ~250, MED)
2. `delete` 12 zero-importer files (§2 #16) + `consent-manager/` + `c15t-backend.config.ts` + `useCursorSpotlight.ts` + `UnifiedAtomicCard.tsx` (0 importers). (~1,750, HIGH)
3. `design-slop` sub-12px type: `text-[10px]` 2,409, `[11px]` 1,072, `[9px]` 639, `[8px]` 129; by dir admin 736, mycountry 595, maps 570, labs 570, wiki-os 404, sports 153, builder 121, ui 120; 1,220 `uppercase tracking-wider/widest`; `text-xs` 6,367 vs `text-sm` 2,295. (HIGH)
4. `yagni` 14 providers in `layout.tsx:66-109,141-150`: `AbilityProvider` (2), `ExecutiveNotificationProvider` (2), `MediaThemeProvider` (5, all wiki), `CuelumeSoundProvider` (a `useEffect`, 0 consumers), `GlobalLinkTooltipProvider` (no context, 320 lines); 78 commits on `layout.tsx`. (HIGH)
5. `delete` `@nevil5249/shadowcraft` (Tailwind-v3 plugin in a v4 build; one `shd-vault-recess` use that isn't in the plugin's class list). (‑1 dep, HIGH)
6. `design-slop` glass stacked 4–5 deep (`DrillSheets.tsx:487→519→563→582`, `IssueDetailBrief.tsx`, `EconomyDrillDown.tsx`, `LoreCardBatchAdmin.tsx` 24 blurs); `backdrop-blur` 1,486 (admin 323, mycountry 201, wiki-os 124). Inner cards inside a sheet/dialog should be opaque `bg-card` — change the default in `facet-container.tsx:60-62`. (MED)
7. `design-slop` motion without reduced-motion: 241 of 272 motion files unguarded; `<MotionConfig reducedMotion="user">` used 0 times — one line in `layout.tsx` fixes the tree. Motion by dir: mycountry 45, builder 34, wiki-os 26, ui 25, cards 22. (HIGH)
8. `design-slop` spec violations: 3,605 `dark:` lines in 545 files; 2,358 hex in TSX (themes 603, maps 231, lib/maps 180, ui 140, labs 136, mycountry 109); 719 hardcoded palette classes inside `ui/` (`tier-badge` 46, five metric modals 28–36 each, `status-indicator` 24); 57 `animate={{width|height}}`; 31 `initial={{ scale: 0 }}`. (HIGH)
9. `design-slop` repo-wide counts 317/318 didn't cover (26 files touched): `bg-gradient-to-*` 371 (mycountry 42, ui 37, cards 35, builder 28, vault 24); `Sparkles` 219 (admin 67, vault 21, maps 15, builder 15, wiki-os 14); `bg-clip-text` 22 (labs 12, ui 2 — both logos); `animate-pulse` 259 (mycountry 41, maps 32, builder 28, wiki-os 22, dashboard 21); emoji 713 (thinkpages 349, mycountry 83, admin 74; `ui/trend-indicator.tsx:10-12` uses 📈📉➡️ as icons); glow `shadow-[0_0_` 66; `transition-all` 1,815 in 589 files (labs 264, wiki-os 246, mycountry 184, admin 172); `animate-spin` 449; `duration-300+` 351. (HIGH)
10. `dup` three toast systems (`ui/toast.tsx` `useToast` façade → `toastQueueStore` while 13 files call `sonner` directly). Pick sonner. (~144, MED)
11. `dup` relative-time ×3 in shared code; `hexToRgb` ×3 despite `lib/color.ts:137` (`health-ring.tsx:8`, `map-config.ts:344`; a `color-mix()` removes the JS); `MetricCard.tsx` ×3, `MetricsPanel.tsx` ×2 (24-line files, same with one prop); 6 byte-identical `loading.tsx` (Next inherits the root boundary). (~450, HIGH)
12. `delete` `lib/themes/theme-utils.ts` 11 of 15 exports 0 refs (~220); `context/theme-context.tsx` `useThemeValues`/`useStatusColors`/`useChartTheme` 0 consumers (~150); `HaloPrimitives.tsx` dead exports (~200). (HIGH)
13. `stdlib`/`native` `useMediaQuery` = `useState`+`useEffect`+listener → `useSyncExternalStore` (SSR-safe, no flash); 4 inline `matchMedia` + 4 inline `innerWidth < 768` copies; `lib/event-bus.ts` singleton over `EventEmitter` with `payload: any` ×3 → `EventTarget`; `useControllableState` copies a Radix internal (3 importers). (~120, HIGH)
14. `perf` `RackFocusBlurWrapper` applies `filter: blur(10px)` + `will-change: filter` to `<main>` on every client navigation (700 ms settle) on both shells. Delete. [`_components/RackFocusBlurWrapper.tsx:29-38`, `layout.tsx:86,93`] (HIGH)
15. `slop` `FacetContainer` mirrors `depth` prop into state and re-syncs in an effect (`facet-container.tsx:108-160`); `'use client'` on hook-less leaves (`table.tsx`, `switch.tsx` 13-line re-export, `GrowthArrow`, `help-icon`, `number-flow`); 81 lint-disables, 72 banners, 16 `as any`, 3 `Unified*` files in `ui/`. (HIGH)
16. `yagni` feature code in `ui/`: `modals/metric-details/*` 5,297 (6 importers, all mycountry/dashboard/maps), `poll-widget` 1,225 + `FeedPollWidget` 291 (thinkpages), `log-viewer` 791 + `json-viewer` 683 (admin), `LegalDocumentLayout` 322, `UnifiedCountryFlag` 290. Move; `ui/` drops to ~15K with no code change. (MED)
17. `delete` registry tourism: `components.json` lists 10 third-party registries; leftovers with ≤1 importer: `apple-cards-carousel` 343, `intro-disclosure` 635, `comet-card` 201 (3D tilt + glare + shimmer), `text-reveal` 213, `animated-theme-toggler`; `mycountry-logo` 241 + `ixstats-logo` 164 for two logos with gradient text. (~1,800 candidate, MED)
18. `yagni` `@audio-ui/react` + `components/audio/` (428) + `audio-store.ts` (664) + `playback-engine.ts` (111) + `components/media/` (874) + `MediaContextProvider` in root + `<MiniPlayer/>` — one consumer (`WikiNarratorPlayer.tsx`). Mount inside the wiki plugin, lazy-load. (~2,000 out of the shell, MED)
19. `design-slop` Halo/DynamicIsland: `DynamicIslandEffects.tsx` "multi-layer colorful background glow" with rainbow gradients + shimmer; `CompactView.tsx:187,249` bells pulse permanently; 86 `transition-all`, 20 gradients, 0 reduced-motion; the metaphor is phone hardware on a web nav bar (Apple "familiarity") implemented as a 10.7K-line, 51-file plugin framework for a notification pill. (LOW-MED on metaphor, HIGH on counts)
20. `dup` CSS: `.facet-depth-4`, `.facet-card-themed` each defined in 4 style files; `theming.css` (1,542) vs `themes.css` (403) vs `domains.css` (375) vs `facet/*.css` (2,240). (MED)
21. `delete`? `components/analytics/` (20 files, 1,584) has one importer (`EmbassyNetworkVisualization.tsx`) — confirm which chart survives. (LOW)

**Net: ‑9,500 lines, ‑2 deps (shadowcraft; @audio-ui out of the root bundle), ‑30 files.** Design-slop codemods are line-neutral.

### 3.12 Onoma (onomastics lab, phonology, TTS) (~44K lines incl. 13K JSON, 23K lab UI)

**Verdict:** the engine core (`markov-chain`, `phonology`, `kokoro-phonemes`, `sound-shifts`, `ipa-overrides`) reads hand-ported with real behavioural tests. Around it: a `types.ts` where 16 of 29 exports are dead, a test suite organised by plan number, 22 dead variables hidden behind `no-unused-vars` disables, the generation pipeline duplicated client- and server-side, the Kokoro config read copy-pasted 8×. The pre-audit hunches (`rng.ts`/`template-resolver.ts`/`cultural-profiles.json` duplication, "dozens of unused sliders") did not hold. Highest 90-day churn in the repo (64 commits).

1. `delete` `routers/onoma/batch.ts` (222) — re-implements `useOnomaGenerator.generate` server-side **and has 0 callers** (coordinator-verified). (HIGH)
2. `dup` Kokoro config read (`systemConfig.findMany startsWith "onoma.kokoro."` → Map → `http://` prefix → bearer) ×6 in `speech.ts` + ×2 in `tts/route.ts`; already drifted (`getSpeechConfig` reads `"onoma."`). One `loadKokoroConfig(db)`. (~90, HIGH)
3. `delete`/move worldgen code misfiled in onoma: `markov-naming.ts` (442, imports `~/lib/worldgen/rng`) + `language-families.ts` (871); sole consumer `worldgen/v2/politics.ts:18-19`. (‑1,313 from scope, HIGH)
4. `delete` 17 dead `types.ts` exports (`LanguagePackId`, `SVGPathString`, `ConlangWord`, branded `to*` helpers, `SpeciesPreset`, `GroupPreset`, `GeneratorPreset`, `GenerationResult`, `OnomaNavItem`, `GrammarProfileData`, `NameBankEntry`, `TrainingMode`, …); `types.ts` churned 20× to maintain dead shapes. (~120, HIGH)
5. `delete` `onoma-audit-initiatives.test.ts` (321) — describe blocks named "Initiative 125…132", re-tests six dedicated suites; line 188 is a type-only assertion. (HIGH)
6. `yagni` `borrowWords` and `compileAndTranslate` are pure string transforms with no DB access shipped as tRPC mutations (`loanwords.ts:111-168`, `syntax.ts:142-271`). Move to lib. (~190, HIGH)
7. `delete` 22 dead variables behind `no-unused-vars` disables (`group-generator.ts:13,85,298,356,358`; `StashSection.tsx:51,103,123`; `StudioWorkshop.tsx:50,52,59,64`; …). (~60, HIGH)
8. `native` `findFirst({id,userId})` → `update`/`delete` ×8 → `updateMany/deleteMany({where:{id,userId}})` + count check. (~60, HIGH)
9. `dup` `computeShannonEntropy` ≈ `calculateEntropy`, `computeBigramFrequencies` ≈ `getNgramFrequencies(words,2)`; vowel set ×9 (`loanwords.ts:137` lists "u" twice); `isVowel` ×5; `capitalize` ×6; `PHONOTACTIC_PRESETS` 0 importers, drifted from `FAMILY_PHONOTACTICS`. (~115, HIGH)
10. `shrink` `handleTts` one 390-line function; GET/POST parsing duplicated; `mergeMp3Buffers` = `Buffer.concat`; double-caches per-sentence and whole-text audio 30 days. `generatePresetName` 30-branch if-chain; `group-generator` 11 near-identical switch functions. Two 35-line voice switches → one `Record`. (~280, MED)
11. `perf` `getSpeechConfig.useQuery` subscribed in 10 components incl. every `NameResultCard` (4 grid sites); `useNameBank()` instantiated 14×; `window.addEventListener` per card; `generate` fires two logging mutations per run. (MED)
12. `slop` `NameResultCard` syncs `isSaved` prop → state in an effect, 9 `useState`, `useMemo` on a string-length ladder (→ `clamp()`/`cqi`); `useStudioState` two effects on `initialWords` both calling `generateNames` behind `exhaustive-deps` disables; circular import `group-generator ↔ name-generator`; 8 `*GameIcon` adapters 0 usages. (~100, MED)
13. `ts` `useNameBank.saveEntry` hand-types an 18-field param (→ `inferRouterInputs`); `GrammarProfileData.wordOrder: "SVO"|…|string` collapses to `string`; `NameBankEntry`/`GrammarProfileData` duplicate Prisma; `STANDARD_CULTURES` duplicates the `CulturalProfile` union; `types.ts` holds ~200 lines of nav config + 3 pathname routers. (MED)
14. `slop` tautological tests (22 `.length > 0` assertions across 22 generator functions); README embeds a plan changelog and claims "everything runs in the browser" (contradicted by #1/#6); `.gitignore` lists `kokoro-cache/` twice. (LOW)
15. `design-slop` `text-[10px]/[11px]` ×324, `uppercase` ×176 (`glyphs/page.tsx` ×4); 106 hex (`glyphs/page.tsx` 36, `SECTION_COLORS`, `OnomaFooter.tsx:41-74`); `rgba(0,145,255)` glow beside the `onoma-primary` token; `transition-all` ×194; glass-on-glass in `StudioNameSets`/`MarkovVisualizer`; `TextureOverlay` on every result card; 📁 emoji folder icon. Positive: `useReducedMotion` ×24. (MED)
16. **For a human:** `tts/route.ts:336,364` reuses the full `ipa` for every sentence of a multi-sentence text (each segment synthesises the same phonemes); `getKokoroAdminConfig:86` returns the API key to the client (323–340 territory).

**Net: ‑1,500 deletable + ‑1,313 moved out of scope, ‑4 files.** Not verified: `glyphs/page.tsx` (689) + `GlyphForgeCanvas.tsx` (858) vs `WritingSection`/`OrthographySandbox` overlap; `compareProfiles` vs `compareDynamicWordLists`.

### 3.13 Cross-cutting: dependencies, tooling, scripts, tests, types, docs

**Verdict:** tooling is heavier than the app needs — 1,900 packages / 1.8 GB `node_modules` (incl. ~120 MB of orphan packages absent from `bun.lock`: `react-icons`, `jspdf`, `html2canvas`), two linters, two test runners, two prettier configs, two eslint configs, 26–31 dead `package.json` scripts. `.git` is 186 MB, ~106 MB of it tracked outputs. Core build config (`next.config.js`, `postcss.config.js`, `eslint.config.js`, `prettier.config.js`, `components.json`, `bunfig.toml`, `docker-compose.yml`, `ecosystem*.cjs`) is **gitignored**, so a fresh clone cannot build. Several stale leads corrected: `demo-seed` giants (`seed-fallbacks.ts` is a 14-line barrel; demo-seed is server-only), `small-arms-equipment.ts`, `flight-airports.ts`, `procedural-archive/`, `unified-intelligence.ts` no longer exist; plan 199's seven test deletions are done.

1. `delete` untrack 22 GeoJSON dumps (93 MB) `scripts/archive/geojson_dumps/`; `scripts/reports/` + `data/political-audit/` (52 files, 13 MB). (‑106 MB, HIGH)
2. `delete` 26 `package.json` scripts with missing targets (`ts:*` ×9 → nonexistent tsconfigs, `typecheck:components|quick|full|diag`, `load:*` ×12 → gitignored dir, `db:sync*` ×4 → missing shell scripts, `add-system-owner`, `ixtwitter:backfill`, `clerk:config`); `preproduction` chains into missing `load:all`; `CLAUDE.md`/`README.md` advertise the broken `db:sync`. (HIGH)
3. `delete` 46 uncataloged one-off scripts at `scripts/` root (7,226 lines, dated Sep 6–23) + committed outputs; 16 unreferenced `scripts/audit/*.ts` (~5,000; README still says "invoke via tsx", removed). Only 7 of 46 root scripts are wired. (~12,000, HIGH)
4. `delete` retire ESLint: 7 devDeps (~14 MB), `lint:eslint*`, `eslint.config.js`, dead `eslintConfig` key (ignored by ESLint 10); the two ESLint-only rules are already guarded by `tests/architecture/client-server-entrypoints.test.ts` + `audit-arch.ts`. Duplicate `prettier` config (package.json wins; `prettier.config.js` dead). (‑7 deps, HIGH)
5. `delete` runtime deps with 0 import sites: `@tanstack/react-table`, `country-flag-icons` (22 MB), `shiki` (4 MB), `tslib` (`importHelpers` inert under `noEmit`; SWC inlines); `@nevil5249/shadowcraft`; devDeps `playwright` (+core 19 MB; sole use an archived script), `@types/dompurify` (deprecated stub), `shadcn` (20 MB CLI → `bunx`). (‑8 deps, HIGH)
6. `delete` logging stack (`logger.ts` 484/1 importer, `user-analytics.ts` 730/1 export, `user-middleware.ts:createUserLoggingMiddleware` 0 uses); 496 `catch { console.error }` in `src/server`, 322 rethrow into `errorFormatter` which logs again. (~2,300, HIGH)
7. `slop` 2,013 `console.*` outside tests: 462 `console.log` (14 guarded; `compiler.removeConsole` strips them in prod → dev-only noise), 22 emoji-prefixed; top files `nationstates/api-client.ts` 50, `ixtwitter-sync.ts` 30, `production-optimizations.ts` 28. (HIGH)
8. `native` `useVisibleRefetch.ts` (6 sites) reimplements TanStack's default `refetchIntervalInBackground: false`. (~45, HIGH)
9. `stdlib` 14 hand-rolled relative-time formatters, 0 `Intl.RelativeTimeFormat`; not in 313. (~200, HIGH)
10. `dup` `ComponentType`/`EconomicComponentType`/`TaxComponentType` in `enums.prisma` AND `lib/enums.ts` (277 lines; 37 vs 29 importing files) AND `lib/economy/data/types.ts:27`; `CardRarity` ×3. Survivor: Prisma. (~300, HIGH)
11. `ts` `types/ixstats.ts` 53 exports, 18 imported; 35 dead incl. hand-written Prisma mirrors (`Country`, `SystemConfig`, `EconomicProfile`, …) and generic theatre (`ApiResponse`, `PaginatedResponse`, `Optional`, `RequiredKeys`); `types/builder.ts` (248) 0 importers. (~700, HIGH)
12. `delete` `lib/websocket/server.ts` (296, 0 importers, raw `ws` + emoji logs) + barrel; two websocket stacks (socket.io ×2, raw `ws` ×1) → socket.io, drop `ws`/`@types/ws`. 333 covers auth only. (~600, ‑2 deps, MED)
13. `yagni` `prisma/schema/c15t.prisma` 8 models, 0 references, no `c15t` package; `c15t-backend.config.ts` is `export default {}`. (MED, operator drop)
14. `shrink` `tsconfig.json` doesn't `extends` base (~30 duplicated options); 6 redundant `paths` subsumed by `~/*`; `server-only` aliased to a **jest mock** in the prod tsconfig; `types: ["node","jest"]` leaks jest globals app-wide; excludes nonexistent files. (~45, HIGH)
15. `delete` `next.config.js`: `// @ts-nocheck`; 12 ghost `optimizePackageImports` (`react-icons/*` ×4, `@tabler/icons-react`, `@base-ui-components/react`, 6 uninstalled Radix packages); `serverExternalPackages: "jspdf"` (not a dep); dead `webpack()` block under Turbopack; `esmExternals: true` is default. (~40, HIGH)
16. `ts` undeclared imports resolving only by hoisting (`bunfig.toml: peer = false`): `geojson` types in 99 files (declare `@types/geojson`), `node-fetch-native` in `setupTests.ts` (Node ≥20 has `fetch`), `eslint-plugin-react*` in `eslint.config.js`. (HIGH)
17. `slop` gitignored build config (`.gitignore:118-126,170-174`); `ws-backend.mjs` both tracked and ignored; 12 of 164 ignore patterns duplicated. (owner decision)
18. `native` `use-outside-click.tsx` 1 importer while 9 files hand-roll `handleClickOutside` (Radix `Popover`/`DropdownMenu` already dismiss). (~150, MED)
19. `perf` `@turf/turf` full bundle (628 KB) for 3 functions via `require` → submodules; drop the `"@turf/turf"` paths hack. (MED)
20. `slop` docs count drift everywhere: `api-complete.md` says 94 routers/1,680 endpoints; real 95 mounts (94 keys), 1,661 procs, 331 models, 18 `.prisma`, 254 pages, 986 components, 104 hooks. `CLAUDE.md:70-71` (90/1,450+/296/15) contradicts `CLAUDE.md:119` (12 files); `AGENTS.md:6` "typecheck ~2s" vs `CLAUDE.md` "crashes the 8GB server"; `AGENTS.md` (274) vs `CLAUDE.md` (217) near-duplicates, both gitignored; 30 `src/**/README.md` (3,618 lines) — two spot-checked, both stale. Delete hard-coded counts or extend `docs:sync`. (HIGH)
21. `yagni` two test runners (Jest canonical; `test:unit` = `bun test`, flaky per the test audit); 5 tests outside `src/tests/`. `validate:script-targets` exists and is tested but never run against the real `package.json`. `lint` always exits 0; `lint:strict` allows 2,100 warnings; `.oxlintrc.json:120-200` disables ~40 rules for `src/components/**`. (MED; 326 adjacent)
22. `slop` `package.json` residue: `sideEffects` → nonexistent file, `ct3aMetadata`, `db:studio` == `db:studio:prod`, jest `transformIgnorePatterns` lists absent `node-fetch`. `overrides.minimatch: ^3.1.3` pins v3 globally while overridden `glob@10` needs `^9` — verify. (HIGH/LOW)
23. `slop` `icon-sizing.test.ts` (untracked) is a regex-over-source lint in Jest: keep, move to `tests/architecture/`.

**Dependency verdicts** (import sites over `src`, `*.mjs`, `scripts`, `prisma`, `next.config.js`):

| Verdict | Dependencies |
|---|---|
| **drop now** (0 sites) | `@tanstack/react-table`, `country-flag-icons`, `shiki`, `tslib`, `@nevil5249/shadowcraft`, `playwright`, `@types/dompurify`, `shadcn`, `eslint`, `eslint-config-next`, `typescript-eslint`, `eslint-plugin-unused-imports`, `@eslint/eslintrc`, `@tanstack/eslint-plugin-query`, `@oxlint/migrate` |
| **replace** | `@turf/turf` → `@turf/kinks`, `@turf/unkink-polygon`, `@turf/helpers` (+ declare the 12 `@turf/<sub>` packages already imported); `ws` + `@types/ws` → socket.io after WS consolidation |
| **declare** | `@types/geojson` (99 files), `@clerk/backend` (333), rewrite 17 `framer-motion` imports to `motion` (339) |
| **reconsider** (1 site each, heavy) | `@deck.gl/*` ×4 (one overlay with a native fallback), `@tsparticles/react` + `slim` (one 155-line component), `@audio-ui/react` (2 files, one consumer chain) |
| **keep** | everything else; `mysql2` (scripts), `ts-morph` (4 scripts), `react-markdown`+`remark-gfm` (1 site; will gain the help centre), `cmdk`, `cuelume`, `dompurify`, `d3-delaunay`, `svg-path-parser`, `papaparse`, `topojson-*`, `@codemirror/*`, `platejs`, `slate`, `react-virtuoso`, `@number-flow/react`, `@chenglou/pretext` |

**Net: ‑16,000 lines (‑36,000 if `scripts/archive` moves out), ‑15 deps (+2 to declare), ‑110 files, ‑106 MB.**

### 3.14 REST routes (coordinator spot-check)

- `dup` MediaWiki proxy ×8 (§3.9 #3) — 2,365 lines across 12 files incl. the generic `api/mediawiki/route.ts` (427) with a module-scope `setInterval` rate limiter re-implementing `lib/rate-limit`. (HIGH)
- `dup` `proxy-discord-image` (194) / `proxy-ns-image` (128) / `download/external-image` (258) share CORS headers, placeholder SVG, cache maps. One `image-proxy` with a host allowlist. (~400, HIGH)
- `dup` 6 `ixtime/*` routes (377 lines) vs the tRPC ixtime surface — not compared; flag for a human.

---

## 4. AI-slop catalogue (repo-wide)

### 4.1 Code patterns

| Pattern | Count | Worst offenders |
|---|---|---|
| tRPC procedures with zero callers | 698 / 1,661 | `wikios` 35, `thinkpages` 29, `countries` 27, `policies` 22, `meetings` 22, `security` 22, `quickActions` 20/22 |
| Section banner comments (`// ====`, `// ───`) | ~1,900 (maps 742, mycountry 347, diplomacy 230, social 165, wiki-os 127, ui 72, builder 63, cards 62) | 5 geo feature routers carry an identical 27-banner skeleton; `intelligence/core/dashboard.ts:30-31` two banners with nothing between |
| "Enhanced / Unified / Advanced / Comprehensive / Smart" identifiers | ~600 (mycountry 209, builder 74, diplomacy 63, cards 55, wiki-os 45) | `UnifiedAtomicStateManager` (dead), `EnhancedSlider` (dead), `UnifiedTaxEffectiveness` (dead), "Rarity Material Physics Engine" |
| `catch { console.error(...); throw }` | 496 in `src/server` (322 rethrow into `errorFormatter`, which logs again) | `admin/system.ts` 12, `users/*` 24, mycountry 122, wiki-os 118, diplomacy 61 (rewrapped as `INTERNAL_SERVER_ERROR`, discarding the class) |
| `console.*` outside tests | 2,013 (462 `console.log`, 14 env-guarded, 22 emoji-prefixed) | `nationstates/api-client.ts` 50, `ixtwitter-sync.ts` 30, `production-optimizations.ts` 28, `lib/activity/*` 46 |
| `eslint/oxlint-disable` | 1,103 | builder 79 (`useGovernmentBuilder.ts` ×9 for unused destructures), `ui/` 81, cards 81, onoma 22 hiding dead variables |
| `as any` / `: any` | 3,454 (plan 314) | sports 181 (`ctx.db as any` ×37, `resRec = result as any` ×7 on typed values), wiki-os 263 `as any`, cards 145, `asJsonPayload<T>` = named `as unknown as T` |
| Hand-written types mirroring Prisma / tRPC output | dozens | `lib/enums.ts` (277, "MUST match the Prisma schema exactly"), `lib/cards/enums.ts`, `types/ixstats.ts` (35 dead), sports 51 row interfaces / 0 `inferRouterOutputs`, `maps/editor-domain.ts` drifted, `EconomicProfileData` ×2, `FiscalSystem` ×4, `CulturalExchange` ×4 |
| Wrapper hook around one `useQuery` | ~20 | `useCountryEconomicData` (28 lines), `useWikiPreferences`, `useVaultBalance`, `useAuctionBid`, `useEquipmentMutations`→one consumer, `useLocalActions`→one consumer |
| `useState`+`useEffect` to derive state | ≥10 named | `useActiveCosmetics.ts:118-190` (with a 20-line equality guard), `FacetContainer` depth mirror, `NameResultCard` `isSaved`, `useBuilderAutoSync.ts:48`, 7 `xRef.current = x` effects |
| Static-only "Service" classes / façades | ≥15 | `NPCPersonalitySystem` (19 static), `ActivityHooks` (6 classes), `VaultService` (16 one-line delegations), `messaging/service.ts` (18 pass-throughs), 7 wiki-os services, `NotificationAPIService` singleton |
| Barrels with zero importers | ≥12 | `lib/economy/index.ts`, `lib/government/index.ts`, `lib/statecraft/index.ts`, `lib/intelligence/index.ts`, `lib/diplomacy/index.ts`, `lib/maps/index.ts`, `lib/websocket/index.ts`, `components/sports/index.ts` + `core/index.ts`, `lib/cards/{client,server}.ts`, `lib/vault/{client,server}.ts`, `lib/achievements/index.ts`, `settings/_components/index.ts` ×3 |
| Hand-rolled stdlib | — | relative-time ×14 (`Intl.RelativeTimeFormat` 0 uses), `hashString` ×7, `Math.random().toString(36)` ids ×15+ (2 with deprecated `substr`), `JSON.parse(JSON.stringify())` ×9, inline sleep ×5, `hexToRgb` ×3, `escapeHtml` ×4, `capitalize` ×6, vowel set ×9, `useMediaQuery` inline ×8, `handleClickOutside` ×9, `EventEmitter` singleton wrappers ×2, promise mutex for sync `localStorage`, `mergeMp3Buffers` = `Buffer.concat`, 600-char letter class instead of `\p{L}` |
| Toast on trivial actions | 65 in social alone, 30 in sports | "Reaction added!", "GIF added to post", "Pin Toggled", "Tactics updated successfully" |
| Tests that test nothing / test dead code | — | `onoma-audit-initiatives.test.ts` (plan-numbered), 22 `.length > 0` generator assertions, `diplomaticIntelligence.test.ts`, `api-parity.test.ts`, `world-cup.test.ts`, `global-config.test.ts`, `atomic-selectors.test.tsx` — each the only reference to the code it tests |
| Docs that describe code that doesn't exist | — | `myleague/README.md` + `myclub/README.md` (7 phantom components), `builder/README.md` (dead hook), `admin/README.md` (3 absent dirs), `docs/systems/halo.md`, `onoma/README.md` ("everything runs in the browser"), `docs/audits/src-monolith-candidates.md` (3 phantom files), CLAUDE/AGENTS/README counts |

### 4.2 Design patterns (Apple/Facet lens)

| Pattern | Count | Breakdown / worst | Facet/Apple rule broken |
|---|---|---|---|
| Sub-12px arbitrary type `text-[8–11px]` | **4,249** | admin 736, mycountry 595, maps 570, labs 570, wiki-os 404, sports 153, builder 121, ui 120 | Apple 11pt floor; Facet has no tier below `text-xs` |
| `uppercase tracking-wider/widest` captions | 1,220 (+463 admin `uppercase` labels, 157 mycountry) | design-bible 55, sandbox 34, `BotControlCard` 29 | Typography "hierarchy from weight+size+leading", not caps |
| `transition-all` | **1,815** in 589 files | labs 264, wiki-os 246, mycountry 184, admin 172, maps 119, builder 102 | Animate only `transform`/`opacity`; ≤250 ms |
| `backdrop-blur` | 1,486 | admin 323, mycountry 201, wiki-os 124, sports 87, builder 77 — nested 4–5 deep in `DrillSheets.tsx:487→582`, `LoreCardBatchAdmin.tsx` (24) | "Never stack two light translucent materials" |
| Hex literals in TSX | 2,358 | themes 603, maps 231, lib/maps 180, ui 140, labs 136, mycountry 109, admin 95 (+274), countries 76 | Facet §10 "zero hex"; semantic tokens only |
| `dark:` overrides | 3,605 lines in 545 files | — | Facet §10 "without manual `dark:` overrides" |
| Non-semantic palette classes (`text-purple-500`, `from-pink-…`) | admin 704, social 277, mycountry 257, sports 259, diplomacy 189, onoma 77; `ui/` 719 | `StatGauge.tsx:34-50` 8-colour prop enum in a gold-themed area; `settings/_lib/sections.ts:46-66` per-section palette; 39 `team.color ?? "#3b82f6"` | Colour themes per surface (Gold/Blue/Emerald/Amber/Orange) |
| `bg-gradient-to-*` | 371 | mycountry 42, ui 37, cards 35, builder 28, vault 24, wiki-os 23, labs 22, halo 20; invisible `from-card to-card/95` (`BorderThreatPanel.tsx:198`) | Plan 318 touched 14 files |
| Gradient text `bg-clip-text` | 22 | labs 12, both logos (`mycountry-logo.tsx:159`, `ixstats-logo.tsx:142`) | Restraint |
| `Sparkles`/`Sparks`/`Star` decoration | 219 | admin 67, vault 21, maps 15, builder 15, wiki-os 14, sports 13 (spinning `Sparkles` `SportsOversightPanel.tsx:786`, `MatchCommentary.tsx:172`) | Plan 318 |
| Decorative `animate-pulse` | 259 | mycountry 41, maps 32, builder 28, wiki-os 22, dashboard 21; on `AlertTriangle` (`BudgetMeter.tsx:60`), empty-state icons, status dots ×7, permanently pulsing bells (`CompactView.tsx:187,249`), "LIVE SIMULATOR" badge | Feedback must have a cause |
| `animate-spin` / `animate-bounce` | 449 / 17 (`❄` emoji bouncing in `NeonFrameOverlay.tsx:49-57`) | — | — |
| Glow shadows `shadow-[0_0_…]` | 66 (+ per-tier `medallionGlow`, `surfaceGlowClass`, `rgba(0,145,255)` glows) | builder 15, wiki-os 11, vault 11, cards 8; `AvatarGlow.tsx:44-69` pulse + glow + `animate-ping` | Restraint |
| Emoji as UI icon | 713 | thinkpages 349, mycountry 83, admin 74, wiki-os 37, maps 37, sports 30 (`🏠`/`✈️` home/away, `⚽`/`🏈`), `ui/trend-indicator.tsx:10-12` 📈📉➡️, 📁 folder in onoma | `iconoir-react` is the sole icon library |
| Motion without reduced-motion guard | 241 of 272 motion files; `<MotionConfig reducedMotion="user">` 0 uses; `useReducedMotion` 24 (all onoma) | 57 `animate={{width|height}}`, 31 `initial={{scale:0}}`, 263 durations ≥300 ms, `whileHover={{scale:1.05, rotate:-2}}` cards | Apple §14; Facet §8 "never from scale(0)", 250 ms ceiling |
| Full-page `filter: blur()` on navigation | 1 (`RackFocusBlurWrapper`, both shells) | 700 ms settle, `will-change: filter` on `<main>` | Compositor-only properties |
| Dashboard-itis KPI grids `grid-cols-3/4/5` | admin 108 (70 files), mycountry 120 (100 files) | `AutosaveMonitoringDashboard.tsx:191`, `NotificationTestCard.tsx:193` | Purpose / simplicity |
| Hand-rolled spinners with per-site colours | 11 in admin (indigo-600, indigo-500, amber-400, orange-500…) while `GlobalLoader` exists | — | Familiarity |
| Particles / confetti / explosions | 7 particle implementations in cards+vault; "gold particle explosion" on every article mount (`ArticleHeader.tsx:106,398`); `confetti.tsx` (dead) | — | Delight is the result, not confetti |
| Card-in-card-in-card | `CardDisplay.tsx:338,379` renders two holographic covers on one card; `CardBack.tsx:99-200` six glow + conic foil layers per tier | — | One material per stack |
| Copy slop | 37 exclamation-mark strings in social; "Comprehensive achievement system", "Rarity Material Physics Engine", "Enhanced color hierarchy" | — | Plain language |
| Phone-hardware metaphor on web nav | Halo/DynamicIsland: 10.7K lines, 51 files, plugin framework for a notification pill; rainbow "multi-layer colorful background glow" | — | Familiarity (metaphor neither too literal nor borrowed from another device) |

Positive signals: MyCountry shell (`CommandSurface`, rails, `shared/tabs`) uses bounce-0 springs and semantic tokens; social UI has 0 `bg-clip-text` and 0 glow; onoma has 24 `useReducedMotion`; the shadcn core in `ui/` is hand-curated; the Facet spec itself is good — the code just ignores it.

---

## 5. Reconciliation with `plans/`

- **Half-executed plans (finish or revert):** 311 (store created, never wired; `useEconomyBuilderSync` listed for deletion still live); 001 landed; 199 test deletions done; 322 built `definitions/` whose `terminology`/`rosterSlots`/`scoringRules` have 0 consumers; 202/305 done; 200 §3 items 1–2 already done but the plan carries no status.
- **Plans that assume dead code is live:** 310 (assumes `realmsPipeline` router is live — it has 0 callers); 328 (adds a lock to `backfillIxTwitterToThinkPages`, whose only caller is an archived script); 324 (patches `useLiveNotifications.ts:89`, whose body has no consumer); 320 (adds snapshots to `matchDay.ts` only, leaving 8 other copies of the block); 315/316 (would decompose `cross-pillar-engine.ts`, `unified-atomic-tax-integration.ts`, `government-mappings/` — all dead).
- **Plans whose file lists are too narrow for the counts:** 306 (none of the 12 dead `ui/` files, 5 dead card barrels, dead sports components), 312 (residue schemas only — not the 698 procedures), 313 (colour math — not the 14 relative-time copies, 3 `hexToRgb`, or the rarity palettes), 317/318/319 (26 files vs the counts in §4.2), 336 (hot paths — not the 41 select-less geo `findMany`, sports per-match N+1, meetings fan-out).
- **Plan 330 note:** also delete `server.mjs:338-350` (phantom `sports-cron.js` import) and the `loadEnvVariables()` triplicate.
- **Plan 335 note:** do the MediaWiki proxy collapse (§3.9 #3) first or with it — otherwise eight allowlists get patched.
- **Stale docs that will mislead executors:** `docs/audits/src-monolith-candidates.md` (3 phantom files), CLAUDE.md router/model/component counts and `DashboardRouter`/`ThinkPagesRouter` description, `AGENTS.md` vs `CLAUDE.md` contradictions, 30 `src/**/README.md`.

## 6. Considered and rejected / lean already

- `league-covers.ts` — 60 lines, not a JSON/DB candidate.
- `lib/achievements/definitions.ts` — 78 data entries with predicate lambdas; data, keep.
- `lib/demo-seed/` — server-only (routers + scripts), not in the client bundle; `seed-fallbacks.ts` is a 14-line barrel.
- `useCountry*` hook family (11) — only `useCountryEconomicData` is a thin wrapper and it adds a mapper.
- `useControllableState` — reasonable 35-line copy of a transitive Radix internal.
- The three WikiOS "bridges" — two with distinct jobs; CodeMirror + Plate/Slate — intended dual editor (305).
- Alert thresholds — live (rows written by `notifications.updateAlertThreshold`, evaluated in `countries/management/lifecycle.ts`).
- `(widget)/forum/cards` CSS-in-JS — justified (no Tailwind in embeds).
- `security/` router — game-domain military CRUD, lean beyond the triplet sprawl.
- Heraldry lib, `ixtime/core.ts`, `src/trpc/`, `lib/auth/`, `server/cron/`, `server/bridges/`, `overlay-registry.ts`, map plugins, `load-maplibre.ts`, `geo-math.ts` — lean.
- The worktree diff on 11 `ui/` files + `icon-sizing.test.ts` — a correct specificity fix, not slop; commit it.
- `mysql2`, polling intervals, `getMapBundle` prefetch — already rejected in the 323–340 index.
- Onoma pre-audit hunches (`rng.ts` ×3, `template-resolver.ts` ×2, `cultural-profiles.json`+`.ts`, "dozens of unused sliders") — shims/different concerns; not findings.

## 7. Not audited / needs a human

- **External HTTP callers of tRPC** (Discord bot at `/ixwiki/shared/bots/discord`, MediaWiki extensions, IxMaps): grep those repos for every mount key in `plans/341-zero-caller-procedures.txt` before executing plan 341. In-repo evidence is HIGH; out-of-repo is unknown.
- Bodies not line-read: `useMapLayers.ts` (1,266), `FeatureInspector.tsx`, `parse-provinces.ts`/`alignment.ts` (GIS eye needed), `pg-reader.ts` (1,002), `MarginThreadsTab.tsx`, `production-optimizations.ts` (623), `svg-parser.ts` (932), `lore-cards/wiki.ts` vs `lore-card-generator.ts`, `ns-import/cards.ts` vs `lib/nationstates/import-service.ts`, `components/cards/trading/*` vs `VaultTradingTab`, `glyphs/page.tsx` + `GlyphForgeCanvas.tsx` vs `WritingSection`, `useBuilderEditMode` vs `useBuilderSubmit`, `EnhancedNumberInput` vs `ui/number-flow`, `almanac.ts`, `talent.ts`, `commentary/narrator.ts`, `xenforo-service.ts`, `routers/meetings/*`, admin storyteller/NPC/template panel bodies, `scripts/archive/` (118 files), the 30 `src/**/README.md`.
- Product decisions: which government-template JSON is canonical (660 vs 2,277 lines); `/explore` and `/studio` deep links; deck.gl 3D arcs; tsparticles cosmetics; `vexel/` and `pipeline/` (labs-only by import graph); the three country-profile "concepts"; `WikiNarratorPlayer` vs `ArticleCompanionHUD`; `EmojiPicker`; MYTHIC/DIVINE tiers; embassy missions/budget procs (dead but possibly planned UI).
- Operator checks: prod row counts for the 4 archetype tables, 43 unreferenced models, c15t tables; whether any `thinkpages` post lacks the JSON marker before deleting the markdown fallback; `overrides.minimatch` vs `glob@10`.
- Correctness smells surfaced incidentally (route to a normal review, not this audit): map undo-of-delete recreates with a new id so redo targets a stale id; sports win-points 3 vs 2 by code path; `SportsBulletinCard.tsx:39` sends a league id to the team route; `tts/route.ts:336,364` reuses the full IPA per sentence; `getKokoroAdminConfig:86` returns the API key to the client; `useVaultStats.ts:44` fires a mutation on mount; `buildTaxSyncPayload` drops `selectedAtomicTaxComponents`; "encrypted messaging" promised in help copy but never implemented.
- MediaWiki/PHP, Discord bot, IxMaps legacy — out of scope.
- Complexity metrics (cyclomatic/cognitive) were not measured; the 500–829-line single functions named above (`transitionSeasonAction`, `calculateLiveTax`, `respondToTrade`, `handleTts`, `impact.ts`, `severance.ts`) certainly exceed the <22 threshold.

## 8. Execution

Six plans written against `97e5a945` (see `plans/README.md` for status and dependencies):

| Plan | What | Lines | Confidence |
|---|---|---|---|
| 341 | Delete the 14 dead tRPC mounts, 25 whole dead router files, `safeRouter`, `wiki` alias; census script kept as a guard | ~17K + tail to ~30K | HIGH (in-repo) |
| 342 | Delete unreachable client subtrees, barrel-only libraries, dead hooks/UI files, logging framework | ~45K | HIGH |
| 343 | Repo hygiene: untrack 106 MB, delete one-off scripts and dead package scripts, drop 15 deps, retire ESLint, fix config residue | ~12K, ‑106 MB, ‑15 deps | HIGH |
| 344 | Delete labs sandbox/design-bible/studio; help/terms/privacy to markdown; collapse MediaWiki proxies 8→2 and image proxies 3→1 | ~12K | HIGH/MED |
| 345 | Collapse the top duplicate implementations (sports persist block + cron, `syncResourcePoolModifiers`, haversine, relative-time, rarity palette, SystemConfig loops, `quickActions`→`meetings`) | ~4K | HIGH/MED |
| 346 | Facet anti-slop mechanical pass: `MotionConfig`, sub-12px codemod, `transition-all`, nested glass default, decorative pulse/sparkle/emoji, provider flattening | line-neutral | HIGH |

Order: 343 (cheap, unblocks a clean tree) → 341 → 342 → 344 → 345 → 346. 341 and 342 are independent of each other but 342's dead-lib deletions get easier after 341 removes their only callers.

## 9. Execution log — 2026-09-25 (branch `audit/bloat-cleanup`, 9 commits on top of `97e5a945`)

Gates used: `typecheck:ui|server|trpc|db` (exit 0 at every commit, but incremental — see the `4c32fda0` row: a full non-incremental run was needed to catch three broken callers), full Jest suite (the same 12 suites fail as at baseline; one pinning test added), oxlint (198 → 178 warnings; the 5 errors are pre-existing rules-of-hooks violations). No build was run (owner instruction).

| Commit | Plan | Done | Deliberately not done |
|---|---|---|---|
| `be512a3e` | 343 | 106 MB untracked; 31 one-off + 15 audit scripts deleted; 34 dead package scripts removed; 15 deps dropped, `@types/geojson`/`node-fetch-native` declared; ESLint stack retired; `tsconfig.json` extends base; `next.config.js` ghost entries removed; validator test asserts zero missing targets | `router-residue.ts` kept (a test imports it); `webpack()` block and `esmExternals` left in `next.config.js` (build not verifiable here) |
| `50c02633` | 341 | 14 dead mounts, 16 whole dead router files, `lib/archetypes`, `content-analyzer`, `safeRouter`, `wiki` alias; `sync-reference-docs.ts` parses the plain object; census script kept in `plans/341-census.ts` | the ~450 zero-caller procedures inside live files (Step 8), `quickActions` (3 live procs, inputs differ from `meetings`), `crisisEvents` (2 live) |
| `d34f0e8b` | 344 | labs sandbox/design-bible, `/studio` UI, 4 alias admin dirs + link repointing, unrouted `admin/wiki/page.tsx` + `facet-materials-lab/page.tsx` shells; MediaWiki proxies 12 files → 4 (`_config.ts`, `[wiki]/[...path]`, `[wiki]/api.php`, ixwiki media); image proxies share `_lib/image-proxy.ts` | help/terms/privacy → markdown (product sign-off on callouts); `studio` router stays (admin/realms calls it); `download/external-image` is a different concern and was left alone |
| `90e31195` | 342 | ~45K lines of unreachable subtrees, barrel-only libraries and zero-importer files; partial trims of `theme-utils`, `theme-context`, `useLiveNotifications` | restored after verification: `lib/intelligence/engine.ts` (used by `calculator.ts`), `websocket/{index,with-reconnect}.ts` (used by `server.mjs`/market client), `lib/{vault,cards}/{client,server}.ts` (Plan 162 guard), `admin/wiki/components` (three panels import it), `AtomicGovernmentComponents.tsx` and `government/builder/{DepartmentList,BudgetAllocationList,BudgetMeter,AutosaveHistoryPanel}` (live in the country builder) — the agents' "dead" calls were wrong for these |
| `0ce1cb0d` | 345 + 346 | `syncResourcePoolModifiers` 6→1, haversine 12→1, relative-time 13→1 (pinned test), rarity palette `vault-theme.ts` folded into `display-utils`, sports win-points consistent (3) with dead archetype configs removed; `MotionConfig reducedMotion="user"`, `RackFocusBlurWrapper` deleted, `CuelumeSoundProvider` un-nested, `FacetContainer` prop→state mirror removed; codemod script added | sports simulate-and-persist 9→1 (sports suites fail at baseline — needs a harness first), `quickActions`→`meetings`, admin SystemConfig helper (≈60 lines of real savings), the other 8 rarity tables, moving wiki/media providers to the wiki layout |
| `4c32fda0` | 341 (fix) | restored `economics/{fiscal,profile}.ts` and `meetings/proceedings.ts` — the census missed `api.economics.updateFiscalSystem`, `api.economics.updateEconomicProfile` and `api.meetings.addAgendaItem`; the per-commit typecheck gates are incremental (`assumeChangesOnlyAffectDirectDependencies`) and never rechecked the callers until a codemod touched `MeetingScheduler.tsx`. Full non-incremental ui/server/trpc runs (tsbuildinfo cleared) now exit 0 | `meetings/actionItems.ts` stays deleted (no callers, mount-specific grep); the rest of the 341 deletions were re-verified with `api.<mount>.<proc>` greps — `messages.*`/`notifications.*` hits are same-named live procedures, not regressions |
| `33c9f0a8` `1b771fd5` `71403ac0` | 346 | `initial={{ scale: 0 }}` (6), `text-[8–11px]` → `text-xs` (3,696 sites / 637 files), `transition-all` → explicit property list (1,510 sites / 524 files); each is one revertable commit | `labs/onoma` excluded; decorative `animate-pulse`/`Sparkles`/emoji sites, hex → tokens, `dark:` overrides, glass nesting defaults (need per-site judgement) |

Correctness smells surfaced during execution (not fixed, route to a normal review): `server.mjs:338-350` still imports the non-existent `sports-cron.js`; `tts/route.ts` reuses the full IPA per sentence; map undo-of-delete stale id; `SportsBulletinCard.tsx` league id on the team route; `getKokoroAdminConfig` returns the API key to the client.

Follow-ups now unblocked: plans 315/316 should be re-scoped (their target engines no longer exist); plan 311 is moot (the store it created was deleted as unused); plan 320 should target one `simulateAndPersistMatch` once the sports suites are green; plan 335 patches one `WIKIS` map instead of eight allowlists.
