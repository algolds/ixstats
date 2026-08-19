# IxStates — Plans & Roadmap

Single index for all working plans, PRDs, audits, and future ideas. This directory is
**gitignored** (local working notes). Completed/realized plans move to [`archive/`](archive/);
the live working set stays here.

> Refreshed June 2026 — platform **IxStates 1.1.1 "Ogma"** (Alpha), branch `v2`.
> Status legend: **ACTIVE** (open work) · **FUTURE** (proposed, not started) · **REFERENCE** (living doc) · **DONE** → moved to `archive/`.

---

## Active Initiatives

### MyCountry Statecraft — Intent Engine vs. National Issues Architecture
| Plan | Scope | Status |
|------|-------|--------|
| [001-intent-vs-issues-rhythm-architecture.md](001-intent-vs-issues-rhythm-architecture.md) | Relationship of Intents/Directives & Issues, gameplay loop, ponytail architecture | PROPOSED |
| [002-intent-vs-issues-rhythm-verified-implementation.md](002-intent-vs-issues-rhythm-verified-implementation.md) | Verified implementation: dual spawn modes + toggle, Phase 3 progress, V2IssueDetail, grounded generator, bug fixes | APPROVED |

### WikiOS Independence — extract WikiOS into a reusable wiki engine
| Plan | Scope | Status |
|------|-------|--------|
| [WIKIOS.md](WIKIOS.md) | Master spec — WikiOS v1.0-alpha, core/plugin boundary, packaging | ACTIVE |
| [wikios-independence-2b-3.md](wikios-independence-2b-3.md) | Stage 2b + 3 scope (render-service isolation) | ACTIVE (scoping) |
| [wikios-stage3-config-plan.md](wikios-stage3-config-plan.md) | Stage 3 render-service config plan | ACTIVE (planning) |
| [wikios-longevity-workflow.md](wikios-longevity-workflow.md) | Longevity & packaging workflow | ACTIVE |

> Completed WikiOS workstreams (core boundary, extraction-blocker spike, workstream C exec/packaging) are in [`archive/`](archive/).

### Map Editor — Advanced World Systems & Performance Optimization
| Plan | Priority | Status |
|------|----------|--------|
| [map-editor-improvements-overview.md](map-editor-improvements-overview.md) | — | ACTIVE (index) |
| [103-shared-map-instance.md](103-shared-map-instance.md) | High | ACTIVE (planning) |
| [106-map-editor-state-decoupling.md](106-map-editor-state-decoupling.md) | High | DONE (React State Isolation) |
| [107-maplibre-source-diffing.md](107-maplibre-source-diffing.md) | High | DONE (GeoJSON Patch Engine) |
| [108-geometry-worker-offloading.md](108-geometry-worker-offloading.md) | High | DONE (Web Worker Geometry Math) |
| [109-sidebar-list-virtualization.md](109-sidebar-list-virtualization.md) | High | DONE (List Virtualization & CSS Containment) |
| [120-map-editor-selection-photoshop.md](120-map-editor-selection-photoshop.md) | High | DONE (Photoshop-grade selection) |
### Main IxWorld Map Viewer — Performance & Smoothness Optimization
| Plan | Priority | Status |
|------|----------|--------|
| [110-ixworld-projection-smoothness.md](110-ixworld-projection-smoothness.md) | High | DONE (Globe-to-2D Projection Blend) |
| [111-ixworld-progressive-lod-loading.md](111-ixworld-progressive-lod-loading.md) | High | DONE (Progressive LOD Streaming) |
| [112-ixworld-transient-hover-decoupling.md](112-ixworld-transient-hover-decoupling.md) | High | DONE (Transient Hover Decoupling) |
| [113-ixworld-worker-overlay-filtering.md](113-ixworld-worker-overlay-filtering.md) | High | ACTIVE (planning) |
| [114-google-maps-dynamic-river-styling.md](114-google-maps-dynamic-river-styling.md) | High | DONE (Dynamic River Hydrography) |
### Map Editor Backend & tRPC Data Pipeline Overhaul
| Plan | Priority | Status |
|------|----------|--------|
| [119-map-editor-overhaul-revised.md](119-map-editor-overhaul-revised.md) | High | ACTIVE (implemented: response-boundary truncation + shared invalidation keys; remaining phases deferred pending baselines) |
| [115-backend-geojson-compression-caching.md](115-backend-geojson-compression-caching.md) | High | ACTIVE (planning — superseded by 119) |
| [116-backend-async-spatial-sync-decoupling.md](116-backend-async-spatial-sync-decoupling.md) | High | ACTIVE (planning — superseded by 119) |
| [117-trpc-incremental-mutation-updates.md](117-trpc-incremental-mutation-updates.md) | High | ACTIVE (planning — superseded by 119) |
| [118-backend-precalculated-spatial-metrics.md](118-backend-precalculated-spatial-metrics.md) | High | ACTIVE (planning — superseded by 119) |

### MyLeague & MyClub Core Improvements — secure & optimize simulation platform
| Plan | Priority | Status |
|------|----------|--------|
| [064-myleague-myclub-consolidated.md](064-myleague-myclub-consolidated.md) | High | DONE (verified in code v2) |
| [065-myleague-emotional-layer.md](065-myleague-emotional-layer.md) | High | DONE |

### MyCountry Core Loops & v2 Architecture
| Plan | Scope | Status |
|------|-------|--------|
| [mycountry-bible-v2.md](mycountry-bible-v2.md) | Design & Product Bible v2 — Executive decision simulator | DONE (Verified) |
| [mycountry-v2-migration.md](mycountry-v2-migration.md) | IA, Layout & Component Migration (Phases 1–6 + 3 Bible Enhancements) | DONE (Verified) |
| [104-country-profile-ui-refresh.md](104-country-profile-ui-refresh.md) | Country Profile (/countries/[slug]) Facet UI/UX Refresh | ACTIVE (planning) |
| [105-country-profile-performance-optimization.md](105-country-profile-performance-optimization.md) | Country Profile (/countries/[slug]) Performance & Bundle Optimization | ACTIVE (planning) |
| [mycountry-core-loops-design.md](mycountry-core-loops-design.md) | Exec / Diplomacy / Politics loop closure (Phases 1–6 implemented; narrative+ledger spine) | DONE (Verified) |
| [050-diplomatic-goals-stances.md](archive/050-diplomatic-goals-stances.md) | Obfuscate diplomacy math, add Stances & Goals | DONE (Verified) |
| [051-unify-narrative-spine.md](archive/051-unify-narrative-spine.md) | Route actions through `recordCountryEvent` dispatcher | DONE (Verified) |
| [052-governance-ledger.md](archive/052-governance-ledger.md) | Country Change Log UI timeline | DONE (Verified) |
| [053-executive-inbox-split.md](archive/053-executive-inbox-split.md) | Split Issues into Crises vs Discourse | DONE (Verified) |
| [054-decisions-effects-bridge.md](archive/054-decisions-effects-bridge.md) | complete meeting flow + implement decisions + record metrics decisions | DONE (Verified) |
| [055-policy-treasury-debits.md](archive/055-policy-treasury-debits.md) | background cron deducting active policy maintenance costs from budget | DONE (Verified) |
| [056-proactive-policies-reactive-issues.md](056-proactive-policies-reactive-issues.md) | Proactive Policies & Reactive Issues Integration (Risk, Origin, CivCap) | ACTIVE (planning) |

### Animation & Craft Polish
| Plan | Scope | Status |
|------|-------|--------|
| [057-glass-button-performance-origin.md](057-glass-button-performance-origin.md) | Resolve double-transition conflicts and scale(0) ripple on GlassButton | DONE |
| [058-sidebar-layout-navigation-transition.md](058-sidebar-layout-navigation-transition.md) | Optimize sidebar layout navigation panel transition to 200ms ease-out | DONE |
| [059-enhanced-tooltip-transform-origin.md](059-enhanced-tooltip-transform-origin.md) | Dynamic transform origin for EnhancedTooltip based on relative coordinates | DONE |
| [060-intent-composer-press-responsiveness.md](060-intent-composer-press-responsiveness.md) | Increase active press depth scale to 0.97 and target transition properties | DONE |

### Public Preview
| Plan | Scope | Status |
|------|-------|--------|
| [ixstates-community-feedback-analysis.md](ixstates-community-feedback-analysis.md) | Discord community feedback analysis (roadmap input) | REFERENCE |

### IxCards & MyVault System Overhaul — Type Safety, Concurrency & UTC Calendar Fixes
| Plan | Scope | Status |
|------|-------|--------|
| [121-vault-card-type-safety-domain-branding.md](121-vault-card-type-safety-domain-branding.md) | Branded types, strict card schemas, and removal of Prisma `(db as any)` casts | DONE |
| [122-atomic-credit-ledger-concurrency-locks.md](122-atomic-credit-ledger-concurrency-locks.md) | Atomic conditional updates (`credits >= amount`) preventing negative balance race conditions | DONE |
| [123-daily-streak-utc-boundary-store-perks.md](123-daily-streak-utc-boundary-store-perks.md) | UTC calendar day streak calculations and O(1) store perk cache lookup | DONE |

### Dashboard & Core Hub — Performance, React & TypeScript Architecture Overhaul
| Plan | Scope | Status |
|------|-------|--------|
| [124-dashboard-performance-and-type-system-overhaul.md](124-dashboard-performance-and-type-system-overhaul.md) | `@ts-nocheck` elimination, 1,034-line god component decomposition, query staleTime tuning & feed item memoization | DONE |

### Onoma Linguistics & Procedural Engine — Optimizations, Performance & Roadmap
| Plan | Scope | Status |
|------|-------|--------|
| [125-onoma-production-basepath-and-server-batch-fixes.md](125-onoma-production-basepath-and-server-batch-fixes.md) | Fix production TTS basePath routing, batch dynamic require, and eliminate leading "uh/eh" vocalization | DONE |
| [126-onoma-centralize-generation-presets-and-ponytail-trim.md](126-onoma-centralize-generation-presets-and-ponytail-trim.md) | Centralize preset generation in `name-generator.ts`, trim dead `export.ts`, unify speech synthesis | DONE |
| [127-onoma-performance-code-splitting-and-lazy-lm.md](127-onoma-performance-code-splitting-and-lazy-lm.md) | Dynamic route code-splitting for `@xyflow/react` and lazy LM calibration to prevent slider jank | DONE |
| [128-onoma-typescript-strict-schemas-and-domain-branding.md](128-onoma-typescript-strict-schemas-and-domain-branding.md) | Strict Zod schemas for conlang versioning, safe Stash note metadata parsing, branded `IPAString` | DONE |
| [129-onoma-apple-motion-and-facets-refinement.md](129-onoma-apple-motion-and-facets-refinement.md) | Spring-damped layout expansion for NameResultCard, instant press compression, optical tracking | DONE |
| [130-onoma-sound-change-evolution-engine.md](130-onoma-sound-change-evolution-engine.md) | Feature: Historical sound shift rule interpreter and Proto-to-Daughter language evolution in Studio | DONE |
| [131-onoma-realtime-formant-spectrogram-visualizer.md](131-onoma-realtime-formant-spectrogram-visualizer.md) | Feature: Real-time Web Audio API FFT spectrum visualizer & 2D IPA Vowel Quadrilateral ($F_1/F_2$) | DONE |
| [132-onoma-customized-template-and-dictionary-phonetics.md](132-onoma-customized-template-and-dictionary-phonetics.md) | Feature: Customized IRL Culture & Template/Dictionary Phonetics with "Hello World" Benchmark | DONE |

---


## Future Ideas (proposed, not started)

| Idea | Plan | Notes |
|------|------|-------|
| **IxExchange v1** | [Exchange_v1_PRD.md](Exchange_v1_PRD.md) | Phase 1 (P0) shipped → `archive/`. Full v1 scope still future. |
| **MyLeague lore features** | [myleague-top5-features.md](myleague-top5-features.md) | Top-5 sports lore-integration proposals |
| **Smart terrain snapping** | [048-smart-terrain-snapping.md](048-smart-terrain-snapping.md) | P2 map feature — border generator |
| **Maritime route editor** | [049-maritime-route-calculator.md](049-maritime-route-calculator.md) | P3 map feature — transit calculator |

---

## Reference / Living Docs

| Doc | Purpose |
|-----|---------|
| [local-dev-windows-setup.md](local-dev-windows-setup.md) | WSL2 / Windows local-dev setup walkthrough (linked from root `README.md`) |
| [src-monolith-candidates.md](src-monolith-candidates.md) | Ongoing refactor backlog — large files that are split candidates |
| [st.md](st.md) | Game loops and design conceptual framework |

---

## Archive

102 completed/realized/superseded plans live in [`archive/`](archive/) — kept for context, not maintained.
Highlights: live-preview feedback fixes (Plan C-3), geography report analyzer (Plan C-2), shared-edge topology engine (Plan 045), conlang modularization (Plan 091), security hardening (Plan 090), cache invalidation (Plan 089), routes overhaul (Plans 046-050), territory brush (Plan 029/047), builder auto-sync (Plan 052), map layer panel memoization (Plan 053), map feature grouping (Plan 054), map progressive zoom filtering (Plan 051), Exchange Phase 1 (built), MyCountry executive/builder/UX audits (shipped), versioning
architecture (→ `docs/reference/revision.md`), geo-core + country-geo-service splits (done),
WikiOS core-boundary + workstream C (done), VPS stabilization/memory audits (done), the June 2026
codebase audit, and map-topology-engine v1 (superseded by Plan 045).

## Map Editor — Dependency & Rejected Notes

- **Plan 047 (Territory Painting Brush)** depends on **Plan 045 (Shared-Edge Topology Editor)**: the brush
  modifies borders of adjacent regions in real-time and relies on the topology engine's cascaded coordinate
  matching to prevent gaps, overlaps, and slivers on save. All other map-editor plans are independent.
- **Rejected — full DB schema refactor for topology**: decoupling all boundaries into independent
  vertices/edges in Postgres requires complex PostGIS migrations on ~82 nations of production data. The
  client-side hybrid extraction is fast, lightweight, and preserves standard GeoJSON schemas.

## Conventions

- A plan earns a slot here only while it has **open work**. When realized, move it to `archive/` and update this index.
- Findings considered and **rejected** belong in the relevant plan's own "Rejected" section.
- Cross-link to the canonical doc when a plan graduates to a shipped system (e.g. versioning → `docs/reference/revision.md`).
