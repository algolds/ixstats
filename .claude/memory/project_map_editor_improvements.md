---
name: project_map_editor_improvements
description: "Map editor audit + 3-plan initiative (contextual toolbar, geography analyzer, routes foundation) with decisions and non-obvious findings"
metadata: 
  node_type: memory
  type: project
  originSessionId: 927f3fd9-c0e4-4d9c-95e4-7a38b7c3a14f
---

Map editor improvement initiative (audited June 2026, v2, commit 35274d70). Plans materialized at `plans/map-editor-improvements-overview.md` + `plans/map-editor-{contextual-toolbar,geography-analyzer,routes-foundation}.md`.

**Status:** C-1 (contextual toolbar) executed via `/improve execute` and APPROVED — core landed in UNMERGED worktree branch `worktree-agent-a3620fd633780eeb3` @ `943854f9` (ToolOptionsBar wired, duplicateFeature + 20 tests, point/route actions). Geoman region-ops (split/merge/rotate/scale) DESCOPED → follow-up C-1b, because the executor FABRICATED the Geoman API (package was never installed → build-breaker). LESSON: verify `@geoman-io/maplibre-geoman-free@0.8.x` against the installed `.d.ts` before trusting any of its API; turf v7 `union`/`intersect`/`difference` take a single FeatureCollection (not two args). C-2/C-3 not started.

**Non-obvious findings (verify before relying):**
- `src/components/maps/editor/ToolOptionsBar.tsx` is a complete 385-line Photoshop-style contextual bar BUT is dead code — never imported. `EnhancedMapEditorContent.tsx:277` renders only `MapEditorToolbar`. Wiring it is the cheapest win.
- Context-menu "Duplicate" is a no-op (`EditorContextMenuWrapper.tsx:37`); no `duplicateFeature` in `useMapEditor.ts`.
- `geo.getCountryGeoProfile` (`geo/core/geo-profile.ts:22`) already computes area/climate(+temp/precip)/elevation/hydro/neighbors but NO UI shows it (Geography tab uses `countryGeo.getCountryGeoBundle` instead).
- BUG: `getCountryGeoProfile` hydro (rivers/lakes) is GLOBAL not per-country — `riverLayers`/`lakeLayers` fetched with no spatial filter (`geo-profile.ts:77-92,218-224`). Fix = PostGIS ST_Intersection clip (pattern already in the neighbors block lines 247-303).
- Polygon drawing is fully custom (`useSubdivisionDraw.ts` + `~/lib/border-editor`); no draw lib installed. So Geoman is a genuine new integration.

**User decisions (confirmed):** region geometry ops → adopt MapLibre-Geoman (`@geoman-io/maplibre-geoman-free` v0.8.3, MIT, lazy-load only); analyzer → author named features (new `Peak`/`NamedRiver`/`NamedLake` tables + editor tools), not approximations; report home → MyCountry Geography tab + deep-dive modal.

**Why:** user wants performance + richness reusing existing code. Most of priority #1 already exists unused.

**How to apply:** start with C-1 (wire ToolOptionsBar + duplicate handler) — fast, lays route-action groundwork. C-2 schema needs explicit `db:push:force` approval. Only new dep is Geoman. Reuses `@turf/turf`, `geo-math.ts`, existing tRPC mutations (`upsertSubdivision`/`deleteSubdivision`/`transport.createRoute`). Relates to [[project_maps_mycountry_integration]].
