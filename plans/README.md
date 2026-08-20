# IxStates — Plans & Roadmap

Single index for all working implementation plans and future proposals. This directory is
**gitignored** (local working notes). Completed/realized plans move to [`archive/`](archive/);
canonical documentation and specs live in [`docs/`](../docs/).

> Refreshed August 2026 — platform **IxStates 1.1.1 "Ogma"** (Alpha), branch `v2`.
> Status legend: **ACTIVE** (open work) · **FUTURE** (proposed, not started) · **DONE** → moved to `archive/`.

---

## Active Implementation Plans

### Public Country Profiles (`/countries/[slug]`) Facet Modernization & Performance
| Plan | Priority | Scope | Status |
|------|:--------:|-------|--------|
| [104-country-profile-ui-refresh.md](104-country-profile-ui-refresh.md) | P1 | Country Profile (/countries/[slug]) Facet UI/UX Refresh | ACTIVE (planning) |
| [105-country-profile-performance-optimization.md](105-country-profile-performance-optimization.md) | P1 | Country Profile Bundle & Query Cache Optimization | ACTIVE (planning) |

### Shared Map Engine & High-Performance Spatial Pipeline
| Plan | Priority | Scope | Status |
|------|:--------:|-------|--------|
| [shared-map-engine-plan.md](shared-map-engine-plan.md) | P1 | Role-Keyed Warm Map Instance Pool (Instant Route Transitions) | ACTIVE (planning) |
| [113-ixworld-worker-overlay-filtering.md](113-ixworld-worker-overlay-filtering.md) | P2 | Web Worker Overlay Culling during Rapid Map Zoom | ACTIVE (planning) |
| [119-map-editor-overhaul-revised.md](119-map-editor-overhaul-revised.md) | P2 | Measurement-First Map Editor Overhaul (Response Truncation Shipped) | ACTIVE |

### Runtime Modernization & Dependency Optimization (Bun 1.4)
| Plan | Priority | Scope | Status |
|------|:--------:|-------|--------|
| [140-bun-1-4-modernization-and-typescript-audit.md](140-bun-1-4-modernization-and-typescript-audit.md) | P1 | Bun 1.4 Native Capabilities, Ponytail Pruning & TS Acceleration | ACTIVE (planning) |

---

## Future Feature Proposals (proposed, not started)

| Idea | Plan | Priority | Notes |
|------|------|:--------:|-------|
| **Smart terrain snapping** | [048-smart-terrain-snapping.md](048-smart-terrain-snapping.md) | P2 | Map feature — border snap to river/coastline lines |
| **Maritime route editor** | [049-maritime-route-calculator.md](049-maritime-route-calculator.md) | P3 | Map feature — ocean current & wind transit calculator |

---

## Canonical Documentation & Reference (relocated to `docs/`)

- **WikiOS Architecture & Longevity**: [`docs/systems/wikios/`](../docs/systems/wikios/) (`WIKIOS.md`, `wikios-independence-2b-3.md`, `wikios-stage3-config-plan.md`, `wikios-longevity-workflow.md`)
- **Statecraft & Product Philosophy**: [`docs/systems/statecraft/`](../docs/systems/statecraft/) (`mycountry-vision-audit.md`, `statecraft-game-loops.md`, `ui-demos/`)
- **Community Feedback & Research**: [`docs/research/community-feedback-analysis.md`](../docs/research/community-feedback-analysis.md)
- **Map Editor Architecture**: [`docs/systems/map-editor-improvements-overview.md`](../docs/systems/map-editor-improvements-overview.md)
- **MyLeague Lore Features**: [`docs/systems/myleague-top5-features.md`](../docs/systems/myleague-top5-features.md)
- **Refactoring Backlog**: [`docs/audits/src-monolith-candidates.md`](../docs/audits/src-monolith-candidates.md)
- **Local Dev Setup**: [`docs/processes/local-dev-windows-setup.md`](../docs/processes/local-dev-windows-setup.md)

---

## Archive

154 completed/realized/superseded plans live in [`archive/`](archive/) — kept for context, not maintained.
Highlights: Plans 001/002 & 056 (Statecraft Intent & Issues loop closure), Plans 133–139 (Gold Master cleanup, AST splits, Radix/economy dead code purges), Plans 125–132 (Onoma engine features and performance), Plans 121–124 (Vault, streaks, dashboard performance), Plans 106–120 (Map editor optimizations, diffing, workers), Plans 057–060 (Animation and craft polish), live-preview feedback fixes (Plan C-3), geography report analyzer (Plan C-2), shared-edge topology engine (Plan 045), conlang modularization (Plan 091), security hardening (Plan 090), cache invalidation (Plan 089), routes overhaul (Plans 046-050), territory brush (Plan 029/047), builder auto-sync (Plan 052), map layer panel memoization (Plan 053), map feature grouping (Plan 054), map progressive zoom filtering (Plan 051), Exchange Phase 1 (built), MyCountry executive/builder/UX audits (shipped), versioning
architecture (→ `docs/reference/revision.md`), geo-core + country-geo-service splits (done),
WikiOS core-boundary + workstream C (done), VPS stabilization/memory audits (done), the June 2026
codebase audit, and map-topology-engine v1 (superseded by Plan 045).

## Conventions

- A plan earns a slot here only while it has **open work**. When realized, move it to `archive/` and update this index.
- Findings considered and **rejected** belong in the relevant plan's own "Rejected" section.
- Cross-link to the canonical doc when a plan graduates to a shipped system (e.g. versioning → `docs/reference/revision.md`).
