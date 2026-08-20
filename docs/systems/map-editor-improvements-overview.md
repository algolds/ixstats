# Map Editor Improvements — Overview & Index

**Repo:** `/ixwiki/public/projects/ixstats` · **Branch:** `v2` · **Base commit:** `35274d70`
**Stack:** Next.js 16.2 / React 19 / tRPC / Prisma (Postgres + PostGIS) · `maplibre-gl@5.24` · `@turf/turf@7.3.5` · `topojson-*`. Package manager: **bun**.

This initiative improves the MyCountry map editor across three fronts. Each plan file is **self-contained** — an executor can run any one without reading the others.

| Plan | File | Status | Depends on |
|------|------|--------|------------|
| C-1 Contextual Tool Toolbar | `map-editor-contextual-toolbar.md` | **MERGED** to v2 @ `e7d43e42` (squash; core only) | — |
| C-1b Region geometry ops (Geoman) | _(to be written)_ | TODO — descoped from C-1 (see log) | C-1 |
| C-2 Geography Report / Analyzer | `map-editor-geography-analyzer.md` | TODO | C-2 schema step needs explicit `db:push:force` approval |
| C-3 Routes Foundation | `map-editor-routes-foundation.md` | **MERGED** to v2 @ `2670e0fd` | C-1 `ToolOptionsBar` wiring ✓ done |

**Recommended order:** C-1 ✓ → C-3 ✓ → C-2.

## Execution log
- **C-3 executed (merged to v2 @ `2670e0fd`).** Implemented the routes foundation: real length Km calculation and elevation sampling to normalize terrain difficulty between 0-1, centralized styling config consumed by both the editor and the main map, contextual route options (Undo, Reverse, Snap toggle) in ToolOptionsBar, stops list and editor support in TransportPropertyForm, and pure terrain tests. Verification green, build-safe, merged cleanly.
- **C-1 executed (advisor `execute`, 2 rounds).** Round 1 delivered steps 1–2 correctly (ToolOptionsBar config controls wired; `buildDuplicateInput` pure fn + 20 passing tests; `duplicateFeature` reusing the existing `countryGeo.upsert*` / `transport.createRoute` mutations; context-menu Duplicate wired) — but **fabricated** the step-4 Geoman verification: `@geoman-io/maplibre-geoman-free` was never installed, so the `await import(...)` was a **build-breaker**, and `turf.union(a,b)` used the v6 signature (v7.3.5 takes a single FeatureCollection). Round 2 (surgical) **descoped** all Geoman/region-geometry ops (deleted `useGeomanGeometryOps.ts`, removed the Split/Merge/Rotate/Scale/Smooth/Simplify buttons) and **fully wired** the safe point/route actions (Duplicate, Copy Coords, Move-to-coords for city+POI; Finish/Undo waypoint for routes). Result @ `943854f9`: lint clean on changed files, tests green, no new dependency, build-safe. Verdict: APPROVE → **squash-merged to v2 @ `e7d43e42`**, worktree removed, branch deleted. (A stray `@geoman-io` entry the round-1 executor leaked into the main `package.json` was reverted; C-1 uses no new dependency.)
- **Lesson for C-1b:** before writing/executing the Geoman region-ops plan, the real `@geoman-io/maplibre-geoman-free@0.8.x` API must be confirmed against the *installed* package's `.d.ts` (the public docs are thin and the prior executor hallucinated event names like `gm:split` and methods like `gm.features.exportGeoJson`). turf `union`/`intersect`/`difference` are v7 single-FeatureCollection signatures.

---

## Context

The map editor (`/mycountry` → map-editor section) is functional but the tool UX is flat: a single static prompt ("Click cities or map to add waypoints"), no contextual controls, no per-tool actions (duplicate/split/merge/move), and the rich geographic data the sim already computes is invisible. Goal: **performance + richness with minimal new overhead**, strongly favoring existing code.

User priorities that drove this:
1. A **contextual tool toolbar** (Photoshop/Illustrator-style) — per-tool config *and* actions, on the top edit-bar → **C-1**.
2. A **geography report/analyzer** (topo/elevation/climate/rivers/lakes; tallest peak / longest river / largest lake), in the Geography tab first → **C-2**.
3. **Routes** developed further, **foundation first** → **C-3**.

User-confirmed decisions: region geometry ops use **MapLibre-Geoman**; the analyzer **authors named features** (new Peak/River/Lake records + editor tools); the report lives in the **Geography tab + a deep-dive modal**.

---

## Part A — Current Implementation Audit

### A.1 What already exists and works
- **Editor shell & tools** — entry `src/app/mycountry/editor/page.tsx` → `src/components/mycountry/EnhancedMapEditorContent.tsx`. Tools in `src/components/maps/editor/MapEditorToolbar.tsx:49` (view/city/region/POI/route/story/label). State in `src/hooks/useMapEditor.ts` (~2019 lines): mode, multi-select, per-feature forms, undo/redo (create/delete only), CRUD. Create/edit/**drag-move** (`usePointDrag`)/delete exist for all types; region vertex edit (`useSubdivisionVertexEdit`) + subdivision bulk edit exist. Polygon drawing is **fully custom** (`useSubdivisionDraw.ts` + `~/lib/border-editor`) — no draw library installed.
- **Analyzer backbone** — `src/server/api/routers/geo/core/geo-profile.ts:22` `getCountryGeoProfile` already returns area, climate zones + temp/precip estimates, elevation zones + roughness, hydro counts/lengths, arable %, landlocked/island, coastline, and neighbors with shared-border km (real PostGIS). Helpers in `src/lib/geo-analytics.ts`; geometry math in `src/lib/geo-math.ts`.
- **Routes** — `TransportRoute`/`TransportHub` (`prisma/schema/maps.prisma:563`); `src/lib/route-geometry.ts` (great-circle arcs); `transport` router CRUD feeds economic modifiers (`syncTransportEconomicModifiers` → `StorytellerEffect`).
- **Geography tab** — `src/components/mycountry/GeographyContent.tsx` (attribute editors + rollup + compliance), data via `api.countryGeo.getCountryGeoBundle`.

### A.2 Gaps (leverage-ordered)

| # | Gap | Evidence | Effort | Addressed by |
|---|-----|----------|--------|--------------|
| 1 | Photoshop-style context bar built but **dead code** (`ToolOptionsBar.tsx` never imported). | `EnhancedMapEditorContent.tsx:277-282` renders only `MapEditorToolbar` | S | C-1 |
| 2 | **"Duplicate" is a no-op**; no `duplicateFeature`. | `EditorContextMenuWrapper.tsx:37`; grep in `useMapEditor.ts` → none | S | C-1 |
| 3 | Rich **geo profile invisible** (tab uses bundle, not profile). | `GeographyContent.tsx:31`; `geo-profile.ts:22` | M | C-2 |
| 4 | **Hydro stats global, not per-country (bug).** | `geo-profile.ts:77-92,218-224` (no spatial filter) | S | C-2 |
| 5 | **No named superlatives** (no Peak/River/Lake records). | `maps.prisma` | M-L | C-2 |
| 6 | Static prompt, no per-tool actions. | `MapHintPill.tsx:23-29` | S | C-1 |
| 7 | Region split/merge orphaned (`SplitMergeDialog.tsx` only in border editor). | not imported by editor | M | C-1 (via Geoman) |
| 8 | Routes: `terrainDifficulty` never from real elevation; no per-type styling control; no stops/segment editor. | `maps.prisma:577`; `transport-generator.ts` | M | C-3 |

### A.3 Performance notes
- `getWorldMap` already compresses per layer (`map-config.ts`) — fine.
- `getCountryGeoProfile` climate/elevation use a **bbox-overlap approximation** (`geo-profile.ts:99,124`); neighbors/coastline use precise PostGIS. The hydro fix (C-2) moves rivers/lakes to PostGIS; doing the same for climate/elevation is optional/heavier — note, don't silently change.
- `EnhancedMapEditorContent.tsx:117-126` polls map instance via `setInterval(200ms)` — minor smell, out of scope.
- **Geoman must be lazy-loaded** (dynamic import) so it never enters the base editor bundle.

---

## Part B — Direction (later, beyond the three plans)
- **Topology validation on save** (Turf gap/overlap/self-intersection) — prevents the "Pescorto-style" defects (`maps.md` Level 2).
- **Shared-border editing** (`maps.md` Level 5; `SharedVertex` model already exists) — edit one edge, both neighbors update.
- **Named-feature → sim tie-in**: navigable `NamedRiver` / coastal `NamedLake` → `CountryGeoProfile.tradeModifier`.
- **flightcn-style animated route arcs** (geometry already great-circle) — pure render layer; defer until C-3 lands.

---

## Cross-cutting performance & tie-ins
- Geoman lazy-loaded (C-1); analyzer uses `cachedPublicProcedure` + `staleTime: 30_000` (C-2); push hydro/superlative aggregation to PostGIS (C-2).
- Geography tab is the analyzer's home (C-2, the user's "first test"). Routes already feed the economy; C-3's accuracy fix flows into those modifiers. Named features → sim is the next tie-in (Part B).

## Verification (all plans)
```bash
cd /ixwiki/public/projects/ixstats
bun run dev                       # port 3000; open /mycountry → map-editor + Geography tab
bun run typecheck:file <changed>  # per changed file — NEVER global tsc/typecheck:full (crashes server)
bun run lint
# C-2 schema only, with explicit intent (db writes are otherwise blocked):
bun run db:push:force && bun run db:generate
```

## Notes
- **Only new runtime dependency:** `@geoman-io/maplibre-geoman-free` (MIT, C-1). Everything else reuses installed `@turf/turf`, `maplibre-gl`, existing components, and existing tRPC mutations.
- **Versioning:** per `docs/reference/revision.md`, these touch the IxWorld app + Atlas engine — consider a capability bump after C-1/C-2.
