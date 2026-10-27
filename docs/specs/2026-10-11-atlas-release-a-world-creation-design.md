# Atlas Release A — world creation for realm founders — design

**Last updated:** 2026-10-11 · **Status:** design approved by the owner, not built · **Depends on:**
[Release 0](2026-10-11-atlas-release-0-performance-design.md) · **Plan:** [Atlas ship plan](2026-10-11-atlas-ship-plan.md)

A founder generates their realm's world from a preset, or imports their own map and lets the generator fill the
rest, previews and rerolls it in the world editor, and applies it: physical layers, claimable nation slots with a
geography-derived baseline, and hillshade relief. Ixnay and Eurth get relief too. Closes ROADMAP M3 item 13 and
backlog AT-9 and AT-15.

## Decisions (owner, 2026-10-11)

| Topic            | Decision                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who creates      | **Assigned founders**, and officers with the `map` power (`canEditRealmMap`). Site admins create realms and assign founders as today. Never Ixnay                                                                                                                                                                                                                             |
| Sources          | **Presets** (Earth-like / Ixnay / Eurth, `WORLD_PRESETS`) and **the founder's own map**, whose missing layers (terrain, rivers, lakes, climate) are **generated to fit** its coastlines and borders. The map comes in through the existing Map import (PNG/SVG/GeoJSON, colour → nation mapping, server tracing); the World tab's "This realm's map" source then builds on it |
| Where            | **Inside the existing world editor** (`/maps?realm=<slug>`): a **World tab** in the dockable panel. No separate studio                                                                                                                                                                                                                                                        |
| Controls         | **Simple + Advanced:** preset or "Your map", seed + reroll, continents, land share, nations, warmer/colder, wetter/drier, development level; Advanced holds latitude band, size spread, islands, polar caps, hypsometry, rivers, lakes, coast complexity                                                                                                                      |
| Political output | **Nation slots** (unclaimed `Country` rows linked to their political features) with **generated suggested names** the claimant can keep                                                                                                                                                                                                                                       |
| Named features   | **None:** no cities, named rivers/lakes, peaks, labels or provinces                                                                                                                                                                                                                                                                                                           |
| Slot tools       | Rename & recolour, re-divide (count, size spread), merge / split / reshape, reserve (not claimable) or remove — with the existing editor tools after apply; re-divide is a World tab control                                                                                                                                                                                  |
| Claimed slot     | Territory + **derived baseline**: population from habitable land; GDP per capita from a founder-set **development level** varied ±25% by geography; the player re-tunes in the builder                                                                                                                                                                                        |
| Lock             | Regeneration and re-apply allowed **until the first claim** (pending or approved)                                                                                                                                                                                                                                                                                             |
| Relief           | **Hillshade** for generated worlds and for **Ixnay and Eurth** (inferred from their altitude bands)                                                                                                                                                                                                                                                                           |
| Old paths        | **Delete** `/labs/map-pipeline`, the procedural import path and the Labs-only pipeline code; add an **admin sandbox** (the same World tab with no realm)                                                                                                                                                                                                                      |
| Architecture     | **Browser generates, server imports** (approach 1): the generator runs in a Web Worker; "Use this world" uploads a bundle the server writes through the map-import job machinery                                                                                                                                                                                              |

## Flow

```
World editor on /maps?realm=<slug> → World tab
  ├─ Web Worker: generateWorld(preset + controls + seed [+ land mask and kept borders from this realm's map])
  │     → 7 layers as JSON strings, slots (key, suggested name, colour, cell count, area, habitability,
  │       development factors), packed cells (lng, lat, h as Float32)
  ├─ Preview: blob URLs → setData(url) on draft sources (MapLibre's worker parses; main thread ~2–3 ms)
  │     live layers hidden with visibility:none; "Draft" in the status bar; relief preview at 1024×512
  └─ Use this world → upload world bundle (gzipped JSON: layers, slots, cells, seed, params) via
                       /api/admin/map-import/upload → MapImportJob kind "world": dry run (diff) → apply

Apply (one transaction):
  layers → writePipelineLayers (all 7 types, rollback snapshot, founder-authorised)
  slots  → preset source: unclaimed Country rows (worldgen = true, claimable per slot), linked to their
           political features; previous unclaimed worldgen slots retired
           realm-map source: political features are kept as they are; each one with no country gets an
           unclaimed worldgen Country (its name from the feature) — imported regions become claimable
  Realm.seed, Realm.generationParams (params, engine version, development level)
  Realm.mapVersion += 1 (Release 0)
After commit: relief job step → hillshade raster layer `relief`
```

## Data model

- `Country.worldgen Boolean @default(false)` — created by world generation; a regeneration may retire only
  `worldgen` countries with no owner and no claim.
- `Country.claimable Boolean @default(true)` — reserved slots are `false`; `claimCountry` refuses them and realm
  nation listings and caps ignore them.
- `Realm.seed Int?` and `Realm.generationParams Json?` (exist, never written) are written on apply.
  `generationParams = { params, engineVersion, developmentLevel, source: "preset" | "realm-map" }`.
- Dropped: `ProceduralWorld`, `WorldTemplate`, `Realm.templateId` (no references; AT-15).
- Applied locally (`db:push:force`); production rollout is the owner's.

## Server

- **Upload.** The existing route accepts a gzipped world bundle (gzip magic + schema). Caps: the route's 40 MB,
  ≤ 200k cells, ≤ 500 slots. A full 66k-cell world is ~5 MB of layers (2 MB gzipped) plus ~0.8 MB of cells.
- **Job kind `world`** in `map-import.jobs.ts`, under the per-realm lease, progress and cancel:
  - _guards:_ `canEditRealmMap`; not Ixnay; not archived; no pending or approved claim (re-checked inside the apply
    transaction, so a claim submitted mid-job wins);
  - _dry run:_ zod-validate the bundle, validate geometry with the realm writer's validation, return the diff
    (layers created/changed/retired, slots created/retired, and a warning that hand edits since the last generation
    will be replaced);
  - _apply:_ the transaction above; the rollback snapshot is extended to cover generated countries, so a rollback
    restores the previous slots.
- **Derived baseline** — a pure function in `src/lib/worldgen/` (unit-tested), used by both the worker (preview
  numbers) and the server (country creation):
  - population = Σ over the slot's land cells of cell area × density, density by climate group and terrain
    (habitable lowland temperate/tropical high; desert, ice, highland low), scaled so a world averages a realistic
    density for its development level;
  - GDP per capita = development level base (developing 6,000 · industrial 20,000 · modern 45,000) × geography factor
    (coast, river access, climate) clamped to 0.75–1.25;
  - written through `buildBaselineCountryData` with `freeNationSlug` and the realm's `nationDefaults`.
- **Claims.** `claimCountry` checks `claimable`. Generated slots are linked to their features at creation, so an
  approval already carries the territory; nothing else in the claim flow changes.

## World tab (UI)

Built from the existing editor shell (`MapEditorOverlay`, `EditorPanel` tabs, status bar, Layers panel,
`importWizardContent` takeover), Facet styles, Maps tint.

- **World tab** (new `TabId`), shown to the realm's map editors on any realm except Ixnay:
  - Source: segmented Preset (Earth-like / Ixnay / Eurth) · **This realm's map** (enabled once the realm has a
    political layer; otherwise it links to Manage → Map import). The worker fetches the realm's political and
    background layers from the layer route, rasterises them to a land mask (and altitude bands, when present, as a
    height guide), and generates only the physical layers around them;
  - seed with reroll; sliders: continents, land share, nations, warmer/colder, wetter/drier; development level;
  - **Advanced** (collapsible): the remaining generator params;
  - live stats: land share, continents, climate mix, slot count, baseline range;
  - **Use this world** → panel takeover with the import wizard's dry-run diff, progress and result.
- **Preview** draws on the editor's map as draft sources; reroll terminates the previous worker and keeps the last
  preview until the new one lands; stage messages in the status bar.
- **After apply** slots are ordinary features and countries: merge/split/reshape with the existing border tools;
  rename and recolour in the Properties inspector, which gains a **Claimable** toggle; delete removes an unclaimed
  worldgen slot.
- **Relief** is a row in the Layers panel (on by default) and in `/maps` layer toggles.
- **Locked** state: the tab explains why (claims exist) and links to the claims.
- **Entry points:** Manage → Map gets "Generate or regenerate the world" → `/maps?realm=<slug>&edit=world`;
  `/admin/maps` gets a Studio link → `/admin/maps/editor?sandbox=1` (World tab only, no apply, plus a calibration
  readout against the Ixnay and Eurth reference stats in `WORLD_PRESETS`).
- **Draft recipe** (seed, params, source) is kept in browser storage per realm; reopening restores the preview. No
  server-side drafts.

## Generator changes (in this release)

- **Generate to fit:** `generateWorld` accepts an optional land mask (a sampler over an equirectangular raster) and
  a kept-borders flag. With a mask, the terrain stage takes land from the mask instead of growing continents
  (mountains, hypsometry and everything downstream unchanged; altitude bands, when given, bias the relief ranking),
  and with kept borders the politics stage is skipped and the export omits the political layer.
- **Derived baseline** module (above), shared by worker and server.

## Generator performance (in this release)

Measured 2026-10-11 at 66,626 cells: 1.45–1.55 s per world (mesh 0.43–0.50 s, export 0.43–0.46 s, terrain 0.23 s).
Targets on the same machine: **first generation ≤ 1.0 s, slider change ≤ 0.6 s, reroll ≤ 0.9 s.**

- **Mesh cache:** the worker caches the mesh by `(seed, cellCount, lloydIterations)`, so slider changes skip it
  (0.56 s at 100k requested cells: 180 ms base + ~76 ms per Lloyd pass).
- **Export:** polygon merge matches vertices by quantised integer keys instead of `toFixed` strings (merging all
  land: 64 ms today; export runs ~5 such merges).
- **Terrain:** per-cell unit-sphere coordinates and shape/coast noise computed once into typed arrays instead of per
  Dijkstra edge.
- **Transfer:** layers leave the worker as JSON strings; the main thread makes blob URLs (needs `blob:` in CSP
  `connect-src`, `src/lib/security/csp.ts:32`); draft sources use `tolerance ≥ 0.5`, `buffer 32–64`, `maxzoom 7–8`;
  the preview lives in a ref, outside React state, `worldMapLayers` and `useMapData`; hover hit-testing pauses while
  previewing.

## Relief

One pure module (`src/lib/worldgen/relief.ts`), used by the worker (preview) and the server (tiles):

- **Heights from cells:** rasterise the cell triangulation (d3-delaunay) to a 2048×1024 equirectangular Float32 grid,
  wrapping triangles across the antimeridian; ~80 ms.
- **Heights from bands** (Ixnay, Eurth): draw the stored altitude bands in zone order as SVG and rasterise with
  `sharp` at 2048×1024 (from the `geometry` column, not `geom_postgis`, which has antimeridian slivers); 8 threshold
  distance transforms (two-pass chamfer) interpolate each band between its floor and ceiling; ~0.2 s.
- **Detail:** a precomputed tileable 256² fBm texture scaled by ruggedness and altitude.
- **Hillshade:** NW light at 45°, slope scaled by metres per pixel at each latitude; shadows black with alpha up to
  ~0.55, lit slopes white with alpha up to ~0.2, flat land and sea transparent; ~135 ms.
- **Tiles:** through `realm-rasters.build` as raster layer `relief` (kind `overlay`, so it sits under the political
  fill and over elevation/climate), **z0–5** only (MapLibre overzooms), WebP quality 70 / alpha 60, **fully
  transparent tiles skipped** (~57%) with the raster route answering a missing relief tile with one cached
  transparent tile. Measured: 292 tiles, 0.6 MB, 2.7 s; versioned by hash so an unchanged world never rebuilds.
- **Runs:** for generated worlds after the apply transaction (job worker thread); for Ixnay/Eurth as a new `relief`
  step of the realm map pipeline (`scripts/realms/build-realm-map.ts --steps relief`; Ixnay needs a site admin).
  Preview runs the same module at 1024×512 in the worker and shows it as an image source.

## Removed

- `src/app/labs/map-pipeline/`, `src/components/maps/pipeline/` (controls, telemetry).
- `src/lib/maps/pipeline/*` (normalizers, accuracy analyzer, vector synthesis, fake enrichment) and their test,
  after grepping for importers.
- The `procedural` source of `geoEditor.runPipeline` and the admin `importPipelineResult` endpoint (its writer module
  stays and is reused).
- `src/lib/worldgen/engine.ts` and the legacy `PackedGraph` types; callers use `worldgen/v2` directly.
- `ProceduralWorld`, `WorldTemplate`, `Realm.templateId`; navigation entries to removed pages.

## Failure handling

- **Worker:** crash or timeout → inline error with Retry; the last good preview stays. Reroll terminates the
  previous worker.
- **Upload/job:** validation errors are returned by the dry run with the failing field; guards return explicit
  reasons (locked by claims, archived, Ixnay, no permission).
- **Apply:** all-or-nothing transaction; a claim that lands during the job aborts it with "A nation was claimed
  while the world was being applied".
- **Relief** builds after the transaction; a failure leaves the world applied, the job reports the failed step, and
  the World tab offers **Rebuild relief** (reruns the `relief` step).
- **Rollback** restores the previous layers and slots through the extended snapshot.

## Testing

TDD per task.

- Pure units: derived baseline, height rasterisation (incl. the seam), band-to-height inference, hillshade on
  synthetic grids, bundle schema, slot → country mapping, polygon-merge integer keys (parity with the string-key
  output on a fixed world).
- Server, in the style of `src/tests/server/maps/map-import-apply.test.ts`: `world` job dry run and apply;
  permissions (founder and `map` officer allowed; others, Ixnay, archived refused); lock (pending/approved claim
  blocks; mid-job claim aborts); rollback restores slots.
- Claims: a non-claimable slot is refused; an approved worldgen slot keeps its feature link.
- Generator: the existing preset-fidelity suite (`presets.test.ts`) plus a timing check that slider changes reuse
  the cached mesh.
- UI: World tab component test (locked state, controls, takeover); a browser run of the whole flow with the
  signed-in e2e helpers on the `ixstats_wv1` clone (generate → apply → claim → relief visible).
- Gates: lint, `typecheck:*`, touched tests; no builds.

## Acceptance

A test founder on a test realm generates an Ixnay-like world, rerolls, applies, reserves one slot and renames
another, then a test player claims a slot and sees its territory and baseline on their nation; relief shows on the
generated realm, Ixnay and Eurth; generation never runs on a web request; the generator targets above hold.

## Docs

SYSTEM_STATUS (worldgen Labs → Live under Atlas & Realms), `docs/systems/maps.md`, `src/lib/worldgen/README.md`,
backlog (close AT-9, AT-15), ROADMAP M3 item 13. The Atlas engine version bump and changelog entry are decided at
merge (`docs/reference/revision.md`).
