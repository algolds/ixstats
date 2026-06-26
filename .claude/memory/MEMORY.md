# IxStats Project Memory

## Product Vision
- [IxStates Product Vision & Platform Philosophy](project_ixstates_vision.md) — The canonical product philosophy for the platform pillars

## Working Preferences
- [Save plans to untracked plans/ dir](feedback_plans_dir.md) — design/plan docs go in project `plans/` (gitignored), mirror to harness plan file

## Versioning & Release Architecture
- [Versioning & Release Architecture](project_versioning_architecture.md) — OS-inspired model (1.0 "Ogma"), Version Registry in `src/lib/buildVersion.ts`, Apps/Engines/Systems single-integer scheme, renames (Glass Physics→Facet, Dynamic Island→Halo, LoreStash→Stash); canonical doc `revision.md`
- [Post-session version check](feedback_versioning_check.md) — after any major change, reference `revision.md` and ask the user whether a version should bump

## Operations
- [VPS Memory Audit June 2026](project_vps_memory_audit_2026_06.md) — freeze root cause = RAM oversubscription/swap thrash; steady-state RAM map, MariaDB/PHP-FPM/swap configs, IxStats prod 3550 not running
- [Disk Full → PG Recovery Mode](project_disk_full_pg_recovery.md) — "database system is in recovery mode" = root disk 100% full; diagnose + safe cleanup levers
- [Disk reclaim: IDE prune + slow-log fix](project_disk_reclaim_ide_slowlog.md) — June 2026 audit fixes: MariaDB slow-log flood (log_queries_not_using_indexes), unbounded IDE-server dirs (ide-server-prune.sh cron), cache levers; images=R2/block-storage note
- [Safe DB schema apply](reference_ixstats_db_apply.md) — use `db push` NOT `migrate dev` (drifted history + ~82-nation prod data); source `.env`, preview diff, push
- [Cloudflare purge token](reference_cloudflare_purge_token.md) — zone ID + Cache-Purge-scoped API token for maps.ixwiki.com; use for all CF cache ops (defense.conf token lacks the scope)

## Refactoring Process
- [tRPC Router Splitting](reference_router_splitting.md) — proven scripted process to split mega-routers without changing api.* paths: scout→ts-morph split→mergeRouters index→AST parity verify→eslint --fix. Scripts in `scripts/split-*-ast.ts` + `verify-router-splits.ts`. GOTCHA: line-grep undercounts procedures, verify at AST level.

## Achievements
- [Dynamic Percentile Scaling](project_achievements_dynamic_scaling.md) — pop/GDP achievements are percentile-based (rarity→percentile, achievement-scaling.ts); conditionJson from achievement-sync `determineCondition` is the authoritative eval source, NOT the definitions' condition fns (two-source gotcha)
- [Lorewards Sync Lag](project_lorewards_sync_lag.md) — calendar lagged bot (once-daily fullSync only; 3550 app down, live deploy is ixworld); fixed with */10 state-file sync in cron-runner.mjs (single cron owner); run TS under bun

## IxVault
- [Vault Cosmetics Architecture](project_vault_cosmetics_architecture.md) — `VaultStoreItem.effects` JSON is load-bearing; admin items had null effects → nothing rendered + yield boost = 0; fixed admin backend+form (June 2026)
- [Card Economy Rework](project_card_economy_rework.md) — unified card valuation (`card-valuation.ts`, max(floor,ns×premium)) + metagame bonus system (`vault-bonus.ts`, EARN_BONUS, 5 triggers); admin tabs at /admin/cards; rebalanced 56,908 cards (June 2026)

## MyLeague / MyClub (Sports)
- [MyLeague/MyClub Audit](project_myleague_audit.md) — shared sim helpers in `lib/sports/team-rating.ts` (don't re-dup into routers), sim idempotency claim-pattern, wages DERIVED from rating (no column), promotion/relegation+WorldCup already built in transition.ts, transfer escrow refund paths; + auto-advance cron internals & the June 2026 automation refinement (catch-up loop / matchIntervalDays cadence / feed-post)
- [Halo Live Activities](project_halo_live_activities.md) — iOS-style live match scoreboard in the Dynamic Island via DI plugin + deterministic shared-clock trace replay (no realtime backend); DI plugin gotchas

## Onoma (Namegen Lab)
- [Onoma TTS / Speech](project_onoma_tts.md) — DONE: meSpeak/eSpeak fully removed; swapped container to kokoro-fastapi (phoneme server); Onoma's translateToIPA now drives synthesis via /dev/generate_from_phonemes; 2-button UI
- [Onoma Markov Namegen](project_onoma_namegen.md) — `/labs/onoma` audit fixes (gitignored generated data trap, suffix-trie→Set dedup, hook/router mismatches) + corpus-bolster plan (051): SQL+API extract→compact dicts, category frontend / culture auto-classifier backend

## Builder / Editor
- [Builder Autosave & Persistence](project_builder_autosave_persistence.md) — 3 layers (localStorage / edit→Country / create→BuilderDraft table); the economics ownership bug that broke autosave + the `assertCountryAccess`/`assertTaxAccess` fixes (June 2026)

## Key Architecture Patterns

### MyCountry Single-Page Hub (Feb 2026)
- `MyCountryRouter` - Central hub in `src/components/mycountry/MyCountryRouter.tsx`
  - All page.tsx files render `<MyCountryRouter />` (identical)
  - Manages section state via `useState<MyCountrySection>`
  - URL sync via `window.history.pushState()` (no Next.js route transitions)
  - `popstate` listener for back/forward browser navigation
  - Wraps: MobileOptimized > AuthenticationGuard > CountryDataProvider > AtomicStateProvider
  - Defense section bridges context data to props (different auth pattern)
  - Map editor falls through to `router.push("/mycountry/editor")`
- `MyCountrySidebarNav` - Dual-mode nav (controlled + uncontrolled)
  - Controlled: `activeSection` + `onNavigate` props → renders `<button onClick>`
  - Uncontrolled: no props → uses `usePathname()` + renders `<Link href>`
  - Exports: `MyCountrySection` type, `NAV_ITEMS`, `getSectionFromPathname()`
- `MyCountrySidebarLayout` - Shared grid: `lg:grid-cols-4` (1 sidebar + 3 content)
  - Props: `heroSection`, `sidebarContent`, `alerts`, `children`, `activeSection?`, `onNavigate?`
- All Enhanced*Content have `activeSection?` + `onNavigate?` props passed to layout
- 7 sections: overview, executive, diplomacy, intelligence, defense, politics, map-editor

### Sidebar Widgets (Feb 2026)
- `sidebar-widgets/ExecutiveSidebarWidget` - meetings/policies via tRPC (amber theme)
- `sidebar-widgets/DiplomacySidebarWidget` - embassies/relations via tRPC (cyan theme)
- `sidebar-widgets/DefenseSidebarWidget` - security/military via tRPC (red theme)
- Intelligence page already had inline sidebar (VitalityIndex card)

### Metric Detail Modals
- Base: `BaseMetricDetailsModal` with 4-tab system (Overview, Trends, Comparison, Details)
- All modals take: `isOpen`, `onClose`, `countryId`, `countryName?`
- `useMetricDetailsModal` hook manages open/close state
- Modals wired in `MyCountryTabSystem.tsx` via `openMetricModal()` onClick handlers
- Available: GDP, Population, Labor, GovernmentSpending, Debt, DemographicsHealth

### Component Locations
- MyCountry components: `src/components/mycountry/`
- Sidebar widgets: `src/components/mycountry/sidebar-widgets/`
- Metric modals: `src/components/modals/metric-details/`
- Page files: `src/app/mycountry/*/page.tsx` (all render MyCountryRouter)
- Shared layout: `src/app/mycountry/layout.tsx` (only DevCountryViewProvider)

### Codebase Metrics (Feb 2026)
- tRPC routers: 61 (all registered in appRouter)
- Total endpoints: 927 (477 queries, 450 mutations)
- Prisma models: 206
- Components in src/components/: 645+
- Custom hooks in src/hooks/: 80
- App pages (page.tsx): 124
- Admin pages: 20 (54 admin tsx files total)
- Framework: Next.js 16.1.3, React 19.1.3, Prisma 6.19

## Completed Initiatives
- [Component Integration with MyCountry Systems](project_component_integration.md) — atomic components wired into sim/policies/issues: civil service capacity, rollout queue, staffing-shortage issues, policy prereqs; GOTCHA: implementationDate is IxTime not wall-clock (June 2026, v2)
- [ThinkShare Unified Messaging](project_thinkshare_refactor.md) — Full refactor from basic DMs to platform-wide messaging at /messages (Phase 1-3, April 2026)
- [IxStates Rename & Modular Monolith](project_ixstates_rename.md) — Renamed ixstats→ixstates, chose modular monolith over mono/polyrepo, routers grouped by domain (April 2026)

## Active Initiatives
- [Statecraft (MyCountry loop design)](project_statecraft.md) — branded gameplay loop: IN→SEE→OUT→RIPPLE, 3 levers Capacity/Treasury/Mandate, 3 arenas (fiat/consent/vote), never-lie recon fog driven by atomic build; doc `plans/mycountry-statecraft.md`
- [Lore-Alignment (gov/politics fidelity)](project_lore_alignment.md) — make MyCountry surface bespoke wiki canon, not a generic parliament; audit+plan in plans/mycountry-lore-alignment*.md; smoking gun = importer flattens government_type to 6 buckets
- [MyCountry Core Loops Design](project_mycountry_core_loops.md) — exec/diplomacy/politics: engines built but loops open; close via one narrative+ledger spine (recordCountryEvent reusing applyConsequence + generateDiplomaticNews + activity-hooks); only National Issues & Foreign Policy are closed loops today. Doc: plans/mycountry-core-loops-design.md
- [Map Editor Improvements](project_map_editor_improvements.md) — audit + 3 plans (contextual toolbar / geography analyzer / routes foundation); ToolOptionsBar is dead code, getCountryGeoProfile invisible + hydro bug, decisions: Geoman + named features. Plans in `plans/map-editor-*.md`
- [Maps↔MyCountry Integration](project_maps_mycountry_integration.md) — tier-0 single-source-of-truth (geography drives the sim); on v2, **all phases A–F complete**, remaining = runtime smoke-test + polish
- [WikiOS Initiative](project_wikios_initiative.md) — Modern Next.js frontend replacing MediaWiki UI, lives within IxStats, PlateJS editor, Parsoid backend
- [Forum Integration](project_forum_integration.md) — Native XenForo forum in IxStats, orange theme, hybrid routing, IxnayID SSO planned

### Critical Constraints
- NEVER run `tsc --noEmit` globally (crashes server, 7.2GB RAM)
- NEVER run `npm run typecheck:full` or `npm run check`
- Do NOT run the split typecheck scripts during work either — see [feedback_no_typechecks](feedback_no_typechecks.md); user runs those themselves
- Use `npm run dev` for incremental type checking
- Tailwind CSS v4, React 19, Next.js 16.1.3

## Live Preview Prep (June 2026)
- [Reset for live preview](project_live_preview_reset.md) — wiped transient gameplay state (issues/policies/meetings/intel/activity/country-notifications) across all 144 nations via `scripts/reset-for-live-preview.ts`; no demo (isDemo) data existed; hero map now capitals-only at default zoom + help modals added
- [IxWorld WS backend](project_ixworld_ws_backend.md) — realtime for the ixworld-only preview: dedicated ws-backend.mjs (PM2 ixstats-ws :3551, bun --conditions react-server) + nginx proxy of /ws/thinkpages,/socket.io,/api/market-ws; tRPC/SSE already worked; sampleAreaSqKm moved client-side
