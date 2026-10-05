# Map Editor Improvements — Overview & Index

> **Retired 2026-10-05** to [docs/history/](../README.md). June–August editor plans, all shipped or superseded; see [maps.md](../../systems/maps.md).

**Repo:** `/ixwiki/public/projects/ixstats` · **Branch:** `v2` · **Base commit:** `35274d70`
**Stack:** Next.js 16.2 / React 19 / tRPC / Prisma (Postgres + PostGIS) · `maplibre-gl@5.24` · `@turf/turf@7.3.5` · `topojson-*`. Package manager: **bun**.

This initiative improves the MyCountry map editor across three fronts. Each plan file is **self-contained** — an executor can run any one without reading the others.

> **Status (2026-09-29): historical — C-1, C-2 and C-3 are shipped.** Written in June 2026 against the retired `v2` branch (the integration branch is now `rose-garden`). The per-plan files it names were not kept in the repo, and the paths and line numbers in Part A are the June 2026 layout — e.g. `EnhancedMapEditorContent.tsx` no longer exists; the editor is `src/components/maps/editor/MapEditorOverlay.tsx` (country editor in place on `/maps`, world editor at `/admin/maps/editor`). Current stack: Next.js 16.3, `maplibre-gl` 6.11, `@turf/turf` 7.4. Geoman was never added: region union/subtract/intersect shipped on turf instead (`pathfinderOperation` in `src/hooks/map-editor/useMapEditorTransforms.ts`).

> **Update (2026-09-30): performance, UX and completion pass.** Current behaviour is documented in [maps.md → Map Editor Studio Architecture](../../systems/maps.md#map-editor-studio-architecture-adminmapseditor-mycountrymap-editor-in-place-on-maps) (sections 3–4). In short:
> - **Bugs fixed:** Ctrl+Z undid twice (plugin and overlay both handled it); undoing or dragging a point rewrote the feature with placeholder values ("Updated City", capital flag cleared); story pins and labels were undone through the POI procedures; region reshapes were never saved (`updateSubdivisionGeometry` was a no-op) and "Save" would have written every region; region undo ignored geometry; route and river drawing never collected clicks; the split tool always split with an empty line; the gaps toggle computed nothing; duplicating a capital created a second capital; border-editor shortcuts were shown but not wired and the feature-tool letters fired inside the border editor.
> - **Finished stubs:** scatter cities, regional capitals for empty regions, snap to region border / coastline, bulk region edit, create-region-from-gap, the Wiki scanner tab (AT-10), smart-placement terrain and suggestions plus the inspector's snap-to-coast (AT-11), GeoJSON import/export, draft recovery, themed confirmations (AT-20), admin-role users get the admin tools (AT-13), and `/mycountry/map-editor` is now a full-screen editor instead of falling through to the Executive home.
> - **Performance:** frame-batched transient store for pointer state; hover, lasso and cascade previews batched per frame; feature layers re-upload only when data or visibility values change; stable plugin context; rulers isolated; one debounced invalidation per edit burst; hidden mobile/desktop panels no longer mounted.

| Plan | File | Status | Depends on |
|------|------|--------|------------|
| C-1 Contextual Tool Toolbar | `map-editor-contextual-toolbar.md` | **MERGED** to v2 @ `e7d43e42` (squash; core only) | — |
| C-1b Region geometry ops (Geoman) | _(never written)_ | **Superseded** — union/subtract/intersect shipped via turf without Geoman; split/merge live in the border editor (`geoEditor.splitCountry` / `mergeCountries`) | C-1 |
| C-2 Geography Report / Analyzer | `map-editor-geography-analyzer.md` | **DONE** @ `94f23058` — `Peak`/`NamedRiver`/`NamedLake`, `geoCore.getCountryGeoProfile` superlatives + per-country PostGIS hydro, `GeographyReportModal` | C-2 schema step needs explicit `db:push:force` approval |
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
- **Topology validation on save** (Turf gap/overlap/self-intersection) — prevents the "Pescorto-style" defects. *Partial (2026-09): border submits run PostGIS validity checks (`validateGeometryValid`) and subdivisions are clipped to their country; no cross-country gap/overlap check.*
- **Shared-border editing** (`SharedVertex` model already exists) — edit one edge, both neighbors update. *Done: `useBorderEditor` + `src/lib/maps/shared-vertex-builder.ts`, `topology-engine.ts`.*
- **Named-feature → sim tie-in**: navigable `NamedRiver` / coastal `NamedLake` → `CountryGeoProfile.tradeModifier`. *Not started: `computeEconomicGeoModifiers` (`src/lib/maps/geo-analytics.ts`) does not read named features.*
- **flightcn-style animated route arcs** (geometry already great-circle) — pure render layer. *Done: `DeckTransportOverlay` (deck.gl `ArcLayer` / `TripsLayer`).*

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
- **Only new runtime dependency (planned, never added):** `@geoman-io/maplibre-geoman-free` (MIT, C-1). Everything else reuses installed `@turf/turf`, `maplibre-gl`, existing components, and existing tRPC mutations.
- **Versioning:** per `docs/reference/revision.md`, these touch the IxWorld app + Atlas engine — consider a capability bump after C-1/C-2.
