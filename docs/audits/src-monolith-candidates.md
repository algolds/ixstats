# src/ Monolithic File Candidates (June 2026)

> ## Status (2026-09-29) — tracker
>
> Recomputed with `find src -name '*.ts*' | xargs wc -l` (≥800 lines). **Every file listed in the June tables below is resolved:** each is gone from its path (deleted, moved to JSON/DB seeds, or split into a directory) or now under 800 lines — e.g. `useBuilderState.ts` 557, `useMapEditor.ts` 630, `sports/resolver.ts` 124, `ThinkpagesPost.tsx` 224, `VaultCardsSection.tsx` 246, `WikiVisualEditor.tsx` 346, `types/ixstats.ts` 788, the two admin `page.tsx` files 8 each. No router ≥1,700 lines remains (largest: `routers/wikios/templates.ts`, 1,298).
>
> **Current ≥800-line files (54, of which 2 are tests) — the live tracker:**
>
> | Lines | File | Kind |
> |------:|------|------|
> | 2,372 | `src/app/admin/cards/LoreCardBatchAdmin.tsx` | component |
> | 1,802 | `src/app/admin/_components/CountryInspector.tsx` | component |
> | 1,511 | `src/lib/diplomacy/npc-personality.ts` | logic |
> | 1,471 | `src/lib/builder/client-calculations.ts` | logic |
> | 1,455 | `src/components/maps/editor/EditorMap.tsx` | component |
> | 1,440 | `src/app/admin/myleague/SportsOversightPanel.tsx` | component |
> | 1,435 | `src/lib/discord/ixtwitter-sync.ts` | logic |
> | 1,433 | `src/lib/cards/lore-card-generator.ts` | logic |
> | 1,383 | `src/lib/maps/border-editor.ts` | logic |
> | 1,298 | `src/server/api/routers/wikios/templates.ts` | router (≈69% static data) |
> | 1,289 | `src/lib/economy/auction-service.ts` | class-service |
> | 1,288 | `src/lib/notifications/hooks.ts` | hooks |
> | 1,275 | `src/lib/sports/transition.ts` | logic |
> | 1,266 | `src/components/maps/editor/hooks/useMapLayers.ts` | hook |
> | 1,225 | `src/components/shared/polls/poll-widget.tsx` | component |
> | 1,197 | `src/lib/maps/province-importer/parse-provinces.ts` | logic |
> | 1,157 | `src/app/admin/_components/platform/BotControlCard.tsx` | component |
> | 1,147 | `src/app/admin/maps/_components/PipelineWizard.tsx` | component |
> | 1,117 | `src/lib/government/tax/atomic-tax-components.ts` | data |
> | 1,073 | `src/app/admin/_components/platform/LorewardsBotSection.tsx` | component |
> | 1,048 | `src/app/admin/cards/NSImportSuiteAdmin.tsx` | component |
> | 1,037 | `src/lib/diplomacy/cultural-scenario-generator.ts` | logic |
> | 1,026 | `src/app/admin/users/UsersPanel.tsx` | component |
> | 1,005 | `src/components/wiki-os/editor/hooks/useWikiVisualFormatting.ts` | hook |
> | 1,002 | `src/components/mycountry/shared/modals/metric-details/PopulationDetailsModal.tsx` | component |
> | 992 | `src/components/wiki-os/margin/tabs/MarginThreadsTab.tsx` | component |
> | 991 | `src/lib/achievements/definitions.ts` | data |
> | 991 | `src/app/admin/vault/VaultUserDirectory.tsx` | component |
> | 963 | `src/components/executive/actions/MeetingScheduler.tsx` | component |
> | 948 | `src/components/ui/facet/swipeable/SwipeableRow.tsx` | component |
> | 920 | `src/lib/diplomacy/npc-cultural-participation.ts` | logic |
> | 902 | `src/lib/intelligence/live-data-transformers.ts` | logic |
> | 895 | `src/lib/economy/factory.ts` | data/logic |
> | 888 | `src/app/settings/_components/panels/PrivacySecurityPanel.tsx` | component |
> | 887 | `src/lib/maps/province-importer/topology.ts` | logic |
> | 885 | `src/components/wiki-os/editor/plate/wiki-html.ts` | logic |
> | 879 | `src/lib/maps/province-importer/alignment.ts` | logic |
> | 871 | `src/lib/onoma/language-families.ts` | data |
> | 871 | `src/lib/diplomacy/markov-engine.ts` | logic |
> | 859 | `src/components/wiki-os/reader/ArticleRenderer.tsx` | component |
> | 858 | `src/app/labs/onoma/components/sections/writing/GlyphForgeCanvas.tsx` | component |
> | 854 | `src/components/sports/league/LeagueCreator.tsx` | component |
> | 850 | `src/lib/maps/geo-analytics.ts` | logic |
> | 848 | `src/lib/economy/transport-generator.ts` | logic |
> | 847 | `src/lib/utils/format-utils.ts` | utils |
> | 830 | `src/app/labs/onoma/components/sections/LoanwordsSection.tsx` | component |
> | 826 | `src/components/maps/editor/hooks/useSubdivisionVertexEdit.ts` | hook |
> | 826 | `src/components/cards/display/CardBack.tsx` | component |
> | 814 | `src/app/setup/page.tsx` | component |
> | 809 | `src/hooks/useWikiNarrator.ts` | hook |
> | 802 | `src/lib/nationstates/api-client.ts` | logic |
> | 800 | `src/app/countries/_components/economy/EconomicModelingEngine.tsx` | component |
>
> (Tests excluded from the table: `national-issues-engine-characterization.test.ts` 865, `realms-claims.test.ts` 817.) `bun run audit:arch` currently flags 15 of these as new god files (see `AUDIT_2026-06-13.md` status).


Scan of `src/` for the largest hand-written files, curated for refactoring. Data/seed/type files
that are *inherently* flat are excluded (splitting them adds indirection for no benefit). Companion
to the router-modularization work (see CLAUDE.md → "tRPC Router Modularization").

**Method:** `find src -name '*.ts*'` ≥800 lines, classified by function/method density + class
detection (the naive density heuristic mislabels class-based services as "data" — corrected by
counting class methods).

---

## Excluded — keep monolithic (data / seed / types)

Pure data tables, seed fixtures, and type definitions. **Do not split.**

| Lines | File |
|------:|------|
| 4,200 | `src/lib/demo-seed/seed-fallbacks.ts` |
| 3,433 | `src/lib/small-arms-equipment.ts` |
| 2,327 | `src/lib/atomic-government-data.ts` |
| 2,223 | `src/components/government/templates/governmentTemplates.ts` |
| 1,940 | `src/lib/atomic-economic-data.ts` |
| 1,838 | `src/lib/military-equipment-extended.ts` |
| 1,777 | `src/lib/demo-seed/seed-sports.ts` |
| 1,553 | `src/types/unified-intelligence.ts` |
| 1,392 | `src/lib/demo-seed/clone-subsystems.ts` |
| 1,314 | `src/lib/agenda-taxonomy.ts` |
| 1,211 | `src/components/ui/flight-airports.ts` |
| ~1,000 each | `src/types/economy-builder.ts`, `src/types/ixstats.ts`, `src/app/builder/data/archetypes/{historical,modern}.ts`, `src/lib/procedural-archive/language-families.ts` |

---

## Candidates — logic / service files

Extract pure functions / split responsibilities into focused `lib/` modules; keep original as a thin
re-export to preserve imports.

| Lines | File | Notes |
|------:|------|-------|
| 2,953 | `src/app/builder/utils/atomicGovernmentIntegration.ts` | ⚠️ logic + embedded mapping data — extract the data first |
| 2,496 | `src/lib/mediawiki-service.ts` | |
| 2,463 | `src/lib/sports/resolver.ts` | |
| 2,054 | `src/lib/diplomatic-scenario-generator.ts` | |
| 1,994 | `src/lib/wiki-bridge.ts` | |
| 1,808 | `src/lib/wiki-search-service.ts` | |
| 1,722 | `src/app/builder/hooks/useBuilderState.ts` | hook — split by concern |
| 1,682 | `src/hooks/useMapEditor.ts` | hook |
| 1,510 | `src/app/builder/services/UnifiedValidationService.ts` | class-service |
| 1,178 | `src/lib/diplomatic-encryption.ts` | 2 classes / 28 methods |
| 1,136 | `src/lib/predictive-analytics-engine.ts` | class / 40 methods |

(Also: `vault-service.ts`, `auction-service.ts`, `card-service.ts`, `intuitive-economic-analysis.ts`,
`national-issues-engine.ts` — all class-based services in the 900–1,400 line range.)

---

## Candidates — large React components

Apply the >500-line modular standard: logic → `lib/`, state → `hooks/`, UI → focused sub-components
under `components/domain/feature/`, original becomes a thin orchestrator.

| Lines | File |
|------:|------|
| 2,292 | `src/app/admin/wiki/WikiPanel.tsx` |
| 2,253 | `src/components/diplomatic/EmbassyNetworkVisualization.tsx` |
| 2,072 | `src/components/thinkpages/ThinkpagesPost.tsx` |
| 1,868 | `src/app/admin/diplomatic-scenarios/page.tsx` |
| 1,802 | `src/components/countries/DiplomaticIntelligenceProfile.tsx` |
| 1,753 | `src/app/admin/economic-components/page.tsx` |
| 1,649 | `src/components/wiki-os/editor/WikiVisualEditor.tsx` |
| 1,633 | `src/components/vault/sections/VaultCardsSection.tsx` |
| 1,630 | `src/app/admin/_components/StorytellerControlPanel.tsx` |

⚠️ `src/components/ui/flight.tsx` (1,957) and `src/components/ui/map.tsx` (1,761) are large but are
self-contained visualization primitives — likely intentional, lower priority.

---

## Routers (separate `mergeRouters` pattern — mostly done)

Remaining flat routers ≥1,700 lines: `diplomaticScenarios.ts` (2,063), `countries/management.ts`
(1,945), `wikios.ts` (1,883), `vault.ts` (1,735), `geo/editor.ts` (1,734), `geo/features.ts` (1,726),
`intelligence/core.ts` (1,700). The already-split `diplomacy/*` and `thinkpages/*` sub-files are fine.

---

## Recommendation

Highest ROI / lowest risk: the **logic/service files** (clean function extraction, easy to verify).
Components are higher maintainability value but need individual judgment (no universal correctness
guarantee like `mergeRouters`), so do them a few at a time with manual verification. Start a
service-file batch via workflow (one agent each, extract pure functions → `lib/`, thin re-export),
then tackle components deliberately.
