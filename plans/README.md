# IxStates — Plans & Roadmap

Single index for all working plans, PRDs, audits, and future ideas. This directory is
**gitignored** (local working notes). Completed/realized plans move to [`archive/`](archive/);
the live working set stays here.

> Refreshed June 2026 — platform **IxStates 1.1.1 "Ogma"** (Alpha), branch `v2`.
> Status legend: **ACTIVE** (open work) · **FUTURE** (proposed, not started) · **REFERENCE** (living doc) · **DONE** → moved to `archive/`.

---

## Active Initiatives

### WikiOS Independence — extract WikiOS into a reusable wiki engine
| Plan | Scope | Status |
|------|-------|--------|
| [WIKIOS.md](WIKIOS.md) | Master spec — WikiOS v1.0-alpha, core/plugin boundary, packaging | ACTIVE |
| [wikios-independence-2b-3.md](wikios-independence-2b-3.md) | Stage 2b + 3 scope (render-service isolation) | ACTIVE (scoping) |
| [wikios-stage3-config-plan.md](wikios-stage3-config-plan.md) | Stage 3 render-service config plan | ACTIVE (planning) |
| [wikios-longevity-workflow.md](wikios-longevity-workflow.md) | Longevity & packaging workflow | ACTIVE |

> Completed WikiOS workstreams (core boundary, extraction-blocker spike, workstream C exec/packaging) are in [`archive/`](archive/).

### Map Editor — Advanced World Systems
| Plan | Priority | Status |
|------|----------|--------|
| [map-editor-improvements-overview.md](map-editor-improvements-overview.md) | — | ACTIVE (index) |
| [103-shared-map-instance.md](103-shared-map-instance.md) | High | ACTIVE (planning) |

### MyLeague & MyClub Core Improvements — secure & optimize simulation platform
| Plan | Priority | Status |
|------|----------|--------|
| [064-myleague-myclub-consolidated.md](064-myleague-myclub-consolidated.md) | High | DONE (verified in code v2) |
| [065-myleague-emotional-layer.md](065-myleague-emotional-layer.md) | High | DONE |

### MyCountry Core Loops
| Plan | Scope | Status |
|------|-------|--------|
| [mycountry-core-loops-design.md](mycountry-core-loops-design.md) | Exec / Diplomacy / Politics loop closure (Phases 1–5 implemented; narrative+ledger spine) | ACTIVE |
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
