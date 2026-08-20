# src/ Monolithic File Candidates (June 2026)

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
