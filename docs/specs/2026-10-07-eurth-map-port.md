# Eurth map in IxWorld — port spec

**Date:** 2026-10-07 · **Branch:** `rose-garden` · **Status:** Phases 1–3 built and applied to the local dev DB
(2026-10-07); prod steps are in `docs/systems/realms-eurth-onboarding.md` §4.7. Phase 5's backend (config, presets,
job, `realms.mapPipeline` API, CLI) and the admin panel (`/admin/realms` → Map, `/r/<realm>/manage` → Map pipeline) are
built: runbook `docs/systems/realm-maps.md`. "Later" is still open.
**Owner decisions (2026-10-07):** permission to use the Eurth map art is assumed; port everything needed so the
Eurth map lives in the IxWorld map system, which is the primary system. Source: github `a-seth-harrison/eurth-map`
(audit in this session; art © Stijn Vogels & Colucci Giovanni «Ionio», Alemi Cartographic Society, CC BY-NC-ND,
credited in the map's attribution line).

## Source facts

- All art is **full-globe equirectangular**, 2:1, same frame: `lon = x/W*360-180`, `lat = 90-y/H*180`.
- Files (paths in the eurth-map repo):
  - Base map without legend: `Overlays/Eurth-Geography-Map-10-3-2026 No Legend.png` (8000×4000).
  - Land/water mask: `Eurth Blank Map Borders.png` (8000×4000; land = pixel R+G+B < 720, per the repo's
    `overlay-tools/build_overlays.py`).
  - Climate (exact Köppen colours, for tracing): `Overlays/Eurth-Climate-Map.png` (8000×4000); the 19 zones (code,
    name, RGB, Wikipedia link) are in `eurth-map/src/data/climates.js`.
  - Display overlays (opacity baked in): `eurth-map/public/layers/climate.webp` (8000×4000),
    `tectonic.webp` (4000×2000), `currents.webp` (2000×1000).
  - Legends: `eurth-map/public/layers/legend-geo.webp`, `legend-geo-gray.webp`, `legend-climate.webp` (2050×403).
- Planet: Earth-sized, R = 6371 km. Web Mercator cuts at ±85.0511°: the polar strips are lost, as on IxWorld.

## Contracts (done — do not change shape without updating every consumer)

`src/lib/maps/realm-map-settings.ts` (`Realm.settings.map`):

- `rasterLayers?: RealmRasterLayer[]` — `{ id, label, kind: "base"|"overlay", version, maxZoom, order?, legend? }`
  (Phase 4 removed `defaultOn`: none is shown when a map opens; a stored flag is ignored). `id` matches `^[a-z0-9][a-z0-9-]{0,31}$`; `version` is a hex content hash; base layers are
  alternatives (one shown at a time), overlays are switches drawn in `order`. `realmRasterLayers()` sorts them.
- `climateKey?: { system, zones: [{ code, name, color: "#rrggbb", link? }] }` — the classification the realm's
  `climate` layer uses. Absent: IxWorld's Trewartha key.

`getRealmMapDisplay` (`src/server/modules/realms/realms.map.ts`, `api.realms.map.display`) returns, in addition
to what it had: `rasterLayers` (sorted), `climateKey` (or null), `layerTypes` (sorted active `map_layers` layer
types of the realm).

## Work

### Phase 1 — fixes on what exists

1. **Wiki article by page reference.** The country panel's intro (`src/server/api/routers/countries/wiki.ts`,
   `fetchWikiRichIntro`) looks the article up by display name, IxWiki first. Use `Country.wikiSource` +
   `wikiPageTitle` when set (realm nations), name lookup only as the legacy fallback; the link goes to that wiki.
2. **Capital in the click panel** (`CountryOverviewTab.tsx`): already fetched, never shown.
3. **Realm-aware layer controls** (`MapControls.tsx`): offer climate/rivers/lakes/altitude switches only when
   `display.layerTypes` has them (IxWorld always does); the climate legend reads `display.climateKey` when set.
4. **Geometry repair on write** (`src/lib/maps/realm-map-writer.ts` and its callers): `ST_MakeValid`, drop
   repeated points, and remove overlaps between a realm's political features (each was traced on its own and
   grown 2 px into the border, so neighbours overlap in thin strips; Aurora and Salvia self-intersect). Apply to
   Eurth's existing 119 features.
5. **Area measuring** next to distance in the measure tool, spherical, on the realm's radius.

### Phase 2 — raster art as tiles

- A library + script (`scripts/realms/build-realm-rasters.ts --realm <slug> --layer <id> --file <path> …`) that
  reprojects a full-globe equirectangular image to **Web Mercator XYZ tiles** (256 px WebP, z0..maxZoom; x maps
  linearly, only rows move), plus an optional legend image, into `MAP_RASTER_DIR` (default
  `<cwd>/data/map-rasters`, gitignored) under `<realmId>/<layerId>/<version>/`, then upserts the layer into
  `settings.map.rasterLayers`. `version` = content hash of the input. Grey base = brightest channel (the eurth-map
  way). maxZoom from the image width (8000 px → 5; overlays at their native size; MapLibre overzooms).
- Serve the tiles through the realm tile route (same access rules as vector tiles; versioned URLs are
  `immutable`).
- Viewer: raster sources/layers per `rasterLayers` (base under everything; overlays above the base, under the
  political layer); a base switch (each base + "None") and overlay switches in the layer controls; legends in the
  realm map key. **Art mode**: while a base raster is shown, political fills are transparent except hover/selection,
  strokes and the unclaimed hatch are hidden and country labels default off (the art carries names, flags and
  borders). Retire the single `baseImage` image source in favour of tiles (keep the setting readable).
- Eurth: build `geography` (base, default on), `geography-grey` (base), `climate`, `tectonic`, `currents`
  (overlays, in that order), with legends; credit line unchanged.

### Phase 3 — Eurth as IxWorld vector layers

- Extend the PNG import engine to trace into other layer types than `political`, with a fixed palette: `climate`
  (zone colours → `properties.fill` + zone code/name), `altitudes` (land as one band, IxWorld's lowest band style),
  `lakes` (water not connected to the ocean), `icecaps` (if the art separates ice).
- Script to import them for a realm from the source art; set Eurth's `climateKey` from `climates.js`.
- Zone readout: the pin tool / point queries name the climate zone through the realm's `climateKey` (today a
  Trewartha colour map); the country panel's Geography tab works for realm nations.

### Later

- Wire both scripts into the realm source sync (rebuild on a changed art hash).
- Capitals as map points (no coordinates exist yet).

## Phase 4 — IxWorld conformance (owner, 2026-10-07)

"Ensure the Eurth map conforms to IxWorld: everything should be the standard IxStates/IxWorld UI and UX." A realm
map looks and behaves like `/maps` for IxWorld; realm-only chrome goes unless IxWorld has the same thing.

| Gap found (side by side, 2026-10-07) | Target |
|---|---|
| Opens on the raster art in art mode | Opens on the standard vector style; the art is an optional base map in the layer panel (no `defaultOn`); art mode only while a viewer picks it |
| Political fills pale, hatched (unclaimed), no country colours | Same fill colouring path as IxWorld; no unclaimed hatch (the country panel already says "Unclaimed") |
| Bottom-left "Nations (N)" legend, raster key pills and a credit pill | Bottom-left as IxWorld (scale/coordinates only); the realm's credit line sits with the standard attribution (bottom-right); a raster key shows only while that raster layer is on |
| One flat land band | IxWorld's 8 altitude bands + coast band, from the art's hypsometric tints |
| No rivers | Rivers from the art, IxWorld river style |
| Pixel stair-steps on traced coasts, borders, zones | Smooth like IxWorld: coverage-preserving simplification (PostGIS `ST_CoverageSimplify`), shared edges stay shared |
| No ocean/sea labels | Realm labels for the art's oceans and seas, drawn exactly like IxWorld's ocean labels |
| Opens at 0°, 0° (open ocean) | A realm default view centred on its land |
| Panel: flag shows as a black box; region chip "Unknown" | Flag renders; no "Unknown" chip |
| No capitals or cities | Open: no coordinates exist (capitals only as names) |

## Phase 5 — One repeatable realm map pipeline, configured in the admin panel (owner, 2026-10-07)

"Ensure everything we are doing can be repeatable for any future realms" · "all of the config should also exist
with the realm admin panel". Nothing realm-specific lives in code: a realm's map is built from its **pipeline
config**, edited in the panel, filled from a **preset**, and run as a **background job**; the scripts are a CLI
over the same code.

- **Config** (`Realm.settings.map.pipeline`, zod in `src/lib/maps/realm-map-pipeline.ts`, client-safe):
  - `art`: named source images, each `{ repoPath }` (a file in the realm's source-sync repository at its ref) or
    `{ uploadId }` (uploaded through the map import upload route, stored by SHA-256 in `MAP_IMPORT_DIR`).
  - `rasters`: `[{ id, label, kind: base|overlay, order?, art, legendArt?, grey? }]` → `build-realm-rasters`.
  - `physical`: the layer engine's config (land, climate, geography art keys and thresholds, altitude bands,
    rivers, ice) → `import-realm-layers`; `climateKey` source (zones inline, or a repo/upload `climates.js`).
  - `labels`: `{ art?: key }` a JSON label file (format: `seed-realm-labels`), or none (edited in the map editor).
  - `flags`: `{ localize: boolean }` → `localize-realm-flags`.
  - `defaultView`: `"auto"` (centre of the land with the most nations) or none (kept as saved in the editor).
- **Presets**: a source preset (`src/lib/realms/sources/presets/*.json`) may carry `mapPipeline`; "Load preset"
  fills the pipeline config the same way it fills the source sync (fill empty, `force` overwrites). Eurth's is one
  preset; a new community map = a new preset JSON or settings typed in the panel.
- **Runs**: a `MapImportJob` of kind `map-pipeline` with `options { steps[], dryRun }`, run by the existing map
  import worker (lease `map-import:<realmId>`, stale recovery, progress/stage per step, result per step); layer
  writes keep their rollback snapshots. Steps, in order: `repair` (political geometry), `physical`, `rasters`,
  `labels`, `flags`, `defaultView`, `areas`. A dry run reports what each step would do.
- **Panel**: `/admin/realms` → **Map** tab (site admins, any realm) and `/r/<realm>/manage` → **Map** (founder and
  Map officers): preset, art files (repo path or upload), raster layers table, physical settings, labels, flags,
  default view, steps to run (dry run / apply), progress and run history.
- **CLI**: `bun scripts/realms/build-realm-map.ts --realm <slug> [--steps …] [--apply]` runs the same job in
  process; the per-step scripts stay as thin wrappers.
- **Docs**: a generic runbook `docs/systems/realm-maps.md` ("bring any realm's map into IxWorld"); the Eurth
  runbook keeps only Eurth's values and links to it.
