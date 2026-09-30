# Atlas / geospatial / maps audit (IxStats, branch `rose-garden`, 2026-09-30)

Read-only audit. Nothing in the repo was changed. Scratch scripts used for the measurements are in this folder
(`wg*.ts`). Where docs and code disagree, the code wins.

## TL;DR

- **The size is real: about 85k LOC across 10 code areas, with 86 test files (12.7k lines).** The strong parts are
  the MapLibre viewer, the vector editor (topology-aware border and subdivision editing, snapping, history), the
  SVG/PNG import pipelines (whole map and per country) and the transport network. The worldgen engine (UPG v2) also
  works.
- **Worldgen is a demo that stops at Labs.** It runs synchronously on the browser main thread at `/labs/map-pipeline`,
  and nothing it makes is saved. The admin wizard has no procedural option. The server path
  (`runPipeline{source:"procedural"}` → `importPipelineResult`) is only tested with mocks, and its feature ids are
  numbers, so it will very likely fail against Prisma. It also produces about 69k cells, not the 100k the docs claim,
  and 80 countries whatever you ask for.
- **"Geography is King" is not true in the economy.** The GDP, trade and infrastructure modifiers in
  `CountryGeoProfile` are shown in the UI but never read by the economy engine. `GeographicResource` has no writer.
  Geography reaches the simulation through only three paths: `landArea` (density), transport-network
  StorytellerEffects, and an opt-in "bottom-up" rollup that overwrites national population and GDP.
- **Realm isolation still leaks in the geo layer**, in cases the code audit missed: point terrain sampling, the
  hard-coded IxEarth ocean currents, the global world scale and map styles, and a dead API route. These add to AT-1
  and AT-2.
- **"Standalone IxWorld" is the full IxStates build with a hostname switch.** It needs the IxStates DB, Clerk and
  environment (including the Kokoro TTS config), and every map entity is tied to a `Country`. It is an embed and
  branding surface, not a separable product yet.
- **The "Atlas" name fits the code.** `buildVersion.ts` already defines `engines.atlas` as the "spatial foundation
  (worldgen, geo, maps) — powers IxWorld" and `apps.ixworld` as the app. The problem is that "IxWorld" is also the
  name of realm 0.

---

## 1. Inventory: what exists in code

LOC figures are from `wc -l` on `.ts/.tsx` files.

| Area | LOC |
|---|---|
| `src/lib/maps` | 15,635 (province importer alone 5,754) |
| `src/lib/worldgen` | 5,544 |
| `src/lib/country-geo` | 2,432 |
| SVG/PNG parsers in `src/lib/flags` | 1,302 |
| `src/lib/city-importer` | 1,048 |
| `src/components/maps` (Vexel excluded) | 40,092: editor 26,066, core 10,787, overlays and widgets 2,648 |
| `src/server/api/routers/geo` | 8,753 (37 files) |
| `countryGeo` + `transport` + `realms` routers and module | 2,379 |
| Map hooks | 4,529 |
| `src/app/admin/maps` | 2,690 |
| `src/lib/economy/{transport-generator,travel-time}.ts` | 1,503 |
| **Total** | **about 85k** |

Tests: `jest src/tests/lib/maps src/tests/lib/country-geo` passes 13 suites (80 tests). The worldgen
integration/export tests plus `src/tests/server/realms` pass 11 suites (198 tests). Note that the worldgen tests use
`TEST_CELLS = 3000`, not the production 100k.

| Subsystem | Status | Key paths | Evidence / notes |
|---|---|---|---|
| **Renderer / viewer** (globe↔Mercator, layers, labels, tools) | **Working** | `components/maps/core/IxWorldMap.tsx` (378), `MapContainer.tsx` (617), `core/hooks/*` (3,187), `lib/maps/map-engine.ts` (258), `map-config.ts` (680), `map-idb-cache.ts` | MapLibre `^6.11`. Per-role persistent instances (`map-engine.ts:28 MapRole = "world" \| "editor"`). |
| **Tiles / data delivery** | **Partial (no tiling)** | `geo/core/world-map.ts`, `layer-loader.ts`, `cache.ts`, `lib/maps/geojson-compress.ts` | Layers are served as whole GeoJSON per zoom bucket. Compression and LOD come from `cache.ts:25-66`, with an IndexedDB cache on the client. There are no vector tiles: grep for `ST_AsMVT\|pmtiles\|mbtiles` finds nothing, and there is no raster DEM or hillshade (`raster-dem\|hillshade\|setTerrain` finds nothing). Everything is fine at about 100 countries and scales badly to thousands of provinces or cities. |
| **Map editor** (country in place on `/maps`; world editor at `/admin/maps/editor`) | **Working, with gaps** | `components/maps/editor/*` (26k), `lib/maps/border-editor.ts` (1,383) + `topology-engine.ts`, `shared-vertex-builder.ts`, `territory-brush.ts`, `border-trace.ts`, `hooks/useBorderEditor.ts` (770), `hooks/useMapEditor.ts` (630) | Shared-vertex topology is built client-side (`useBorderEditor.ts:31`). Split/merge, brush, trace along rivers/coasts, and snapping all work. Border submits run `ST_IsValid` (`geo-validation.ts:280`), but nothing checks for gaps or overlaps between countries. Wiki tab and Layers tab still say "coming soon" (`EditorPanel.tsx:499,513`, AT-10). SmartPlacement is unwired (AT-11). Admin detection is system-owner only (`useMapEditorOverlayState.ts:140`, AT-13). About 10 `alert()` calls remain (AT-20). There is no GeoJSON/SVG export. |
| **Player edit review** | Working | `geo/editor/queue.ts`, `MapEditRequest` | Pending → approved flow for subdivisions, cities, POIs and border edits. |
| **Worldgen UPG v2** | **Working engine; Labs-only; not persisted** | `lib/worldgen/v2/*` (mesh, tectonics, terrain, coastlines, hydro-climate, quality-gate, politics, export; about 4.5k lines), `app/labs/map-pipeline/page.tsx` (152) | Ran here with bun (§A): 3–28 s per world, **69,162 cells** (not 100k), always 80 countries, 150 settlements, 1–3 continents when 6 are requested. The Lab calls `generateWorld` synchronously in `startTransition` on the client (`page.tsx:55-73`), so the browser freezes. There are no Web Workers in `src`. The Lab is not linked in navigation (`useNavigationItems.ts:110-120`). |
| **Procedural → realm/DB** | **Stub / likely broken** | `geo/editor/procedural.ts:80-210`, `lib/maps/map-pipeline.ts:221-239` | `PipelineWizard` offers only svg/png (`PipelineWizard.tsx:642,1009`). Worldgen features carry numeric `id`s and no `properties.featureId` (measured), but `importPipelineResult` writes `featureId = … ?? (feature.id as string)` into a `String` column (`procedural.ts:138-141`). Prisma rejects an Int there. The only test mocks the pipeline (`run-pipeline-png.test.ts:229`). Nothing turns states, settlements or rivers into `Country`, `City` or `NamedRiver` rows. `Realm.seed` and `generationParams` are never written. |
| **Terrain / elevation** | **Partial** (a 9-band vector hypsometry, not a heightfield) | `lib/maps/elevation-config.ts`, `country-geo/base-layer-query.ts`, `countryGeo.sampleTerrainAt` | Elevation is cumulative `altitudes` isoline polygons, and point sampling returns a band. `getTerrainAtPoint` (`base-layer-query.ts:55-65`) takes the **first** matching row. It is not realm-filtered and not ordered by zone, so with stacked contours or several realms it can return the wrong band or another world's band. That result feeds city elevation (`upsert.ts:73`) and route terrain difficulty (`routeMutations.ts:485`). |
| **Climate / biomes** | **Partial** | IxEarth: SVG `climate` layer coloured by fill (`geo-profile.ts`, `resolveClimateFromColor`). Worldgen: `hydro-climate.ts` (632) with 12 Trewartha biomes (`config.ts:123-133`) | The two pipelines use different property contracts. Worldgen climate features carry `biomeId,code,name`, while `getTerrainAtPoint` reads `climateId/climateName`, and no code in `src` writes those. `worldgen/climate-system.ts` (553) survives only for `map-config.ts` colours. |
| **Hydrology / rivers & lakes** | IxEarth: static layers + authored superlatives (**working**). Worldgen: simulated (**working in Labs**) | `rivers`/`lakes` MapLayers; `Peak`/`NamedRiver`/`NamedLake` + `geoFeatures.namedFeatures.ts`; `geo-profile.ts:213-275` (per-country PostGIS hydrology) | Named features have no effect on the simulation (pending-features §Atlas). Hydrology on generated worlds is lost at export: rivers become LineStrings with `flux` and `lengthKm`, and there is no watershed or navigability data. |
| **Borders / provinces** | **Working** | `Subdivision` model, `geoFeatures.subdivisions/*`, `lib/maps/province-generator.ts` (Voronoi auto-provinces), `lib/maps/province-importer/*` (SVG/PNG → provinces aligned to the country, 5.7k), `geoAdmin.parseProvinceUpload/commitProvinceImport` | The province importer is sophisticated (layer detection, text matching, topology simplification). Note that "geoAdmin" includes country-owner procedures (`cities.ts:138 standardMutationCountryOwnerProcedure`). |
| **Cities / settlements** | **Working** (manual and imported) | `City` model (27 fields), `geoFeatures.cities`, `countryGeo.upsertCity`, `lib/city-importer/*`, `geoAdmin.commitCityImport` | Worldgen settlements (`politics.ts:182-240`: habitability score, Onoma Markov names, pop = 10k + score·500k) are not exported as a layer or saved. |
| **Demographics on the map** | **Partial** | `City.population`, `Subdivision.population`, `country-geo/sync.ts:100-150` rollup, `countryGeo.distributeSubdivisionDemographics`, `populateFromWiki`, population choropleth | "Bottom-up" mode **overwrites** `Country.currentPopulation/currentTotalGdp/currentGdpPerCapita` with the sum of subdivisions. When there are no subdivisions it falls back to the sum of **city** populations, which puts urban population in place of the national figure (`sync.ts:136-152`). Age, ethnicity and other composition live in `Demographics` (`economy.prisma:81`, owned by the builder/MyCountry). `Demographics.regions` (a JSON string) is a second, unlinked "regions" model next to `Subdivision`. |
| **Import pipelines** | Whole-map SVG/PNG/JPEG: **working**. Per-layer SVG with rollback: **working**. GeoJSON/Shapefile/Azgaar: **none** | `lib/maps/map-pipeline.ts` (313), `lib/flags/svg-parser.ts`, `png-to-svg.ts` (potrace), `svg/coordinate-calibration.ts`, `geoAdmin.uploads/commits` (`SvgUpload` history + rollback), `app/admin/maps/_components/PipelineWizard.tsx` (1,147), `ColourNationMapper.tsx` | Georeferencing either calibrates against reference features or **assumes the image spans -180..180 × -90..90** (`coordinate-calibration.ts:129-140`). The wizard has no bounds or projection input. The whole-map pipeline extracts only `political` + `altitudes` (`map-pipeline.ts:191-218`). `azgaar-normalizer.ts` is misnamed: it normalises UPG v2 graphs, and the realms spec says "Azgaar import: explicitly not doing". There is no import of GeoJSON files (`accept=` shows only `.svg/.png/.jpg`). |
| **Transport / routes** | **Working** and feeds the economy | `lib/economy/transport-generator.ts` (848; A* on a terrain cost grid + Prim MST), `travel-time.ts` (655), `transport/*` routers, `server/shared/transport-sync.ts` → StorytellerEffects, `DeckTransportOverlay` | This is the one real geography→economy loop. AT-1: routes are always saved with `realmId` "default". The sea current/wind model is hard-coded IxEarth data (`travel-time.ts:335 OCEAN_CURRENTS`, 0 realm references). |
| **Geo profile / analytics** | **Partial** | `geo/core/geo-profile.ts` (563), `admin-ops.ts:recalculateGeoProfiles`, `lib/maps/geo-analytics.ts` (850) | Hydrology and neighbours use real PostGIS. Climate and elevation still use a **bbox overlap** estimate (`geo-profile.ts:84,110`). The batch recalc writes `riverKm:0, lakeAreaSqKm:0, neighborCount:0` (`admin-ops.ts:226-245`). PostGIS casts JSON at query time (`ST_GeomFromGeoJSON(geometry::text)`, 25 places) instead of using the `geom_postgis` columns. |
| **Sovereignty, story pins, labels, border history / time scrub** | Working (Storylines are a stub) | `geo/sovereignty.ts`, `features/storyPins.ts`, `labels.ts`, `core/border-history.ts`, `TimelineScrubber` | `Storyline` has 0 DB references (AT-14). |
| **Overlays** | Working | `lib/maps/overlay-registry.ts` (15 overlays: cities … canonDensity), `components/maps/overlays/*` | These mostly read IxStates data (economy, crises, diplomacy). |
| **Labs pipeline enrichment** | **Fabricated** | `lib/maps/pipeline/enrichment-pipeline.ts:96-190` | Examples: `isLandlocked = Math.abs(lng) % 3 === 0`, fixed 60/40 climate splits, and three fake resources per country (AT-9). `accuracy-normalizer`, `geographical-accuracy-analyzer` and `vector-synthesis` (657 lines) are reachable only through `pipeline/index.ts`, which has **0 importers**, so they are dead outside tests. |
| **Standalone IxWorld (maps.ixwiki.com)** | Working as a deployment; **not separable** | `lib/system/standalone-detection.ts` (23), `proxy.ts:123-137`, `app/maps/layout.tsx`, `scripts/deploy-ixworld.sh` (202) | One Next build with a hostname switch. The proxy only redirects `/` → `/maps`, and **all other IxStates routes are still served** on the maps host (`proxy.ts:125`). The deploy builds the whole app, runs `verify:environment` (DB, Redis, Kokoro), and uses shared Clerk (`accounts.ixwiki.com`). The deploy script still defaults to branch `v2` (`deploy-ixworld.sh:78-80`). |
| **Embeds** | Working | `/maps?embed=true&controls=…` (`app/maps/page.tsx`), iframe CSP allowance for `/maps`, `/wiki/`, `/countries/` (`proxy.ts:56-62`), widgets `CountryMapEmbed`/`CoordinatesMapEmbed`/`TerritoryMapWidget` (10 consumers) | Good for the flywheel (wiki ↔ maps). |
| **Realms (geo side)** | Working for PNG realms | `MapLayer.realmId` (column still named `worldId`, no FK to `Realm`), realm-scoped `getWorldMap`, labels/pins filtered through `country.realmId` | Adjacency is never built for PNG realms (`rebuildAdjacency` has no production caller, `borders.ts:526`, AT-16). |
| **Dead or unused models** | Dead | `WorldTemplate`, `ProceduralWorld`, `TransportNode/Segment/RouteSegment`, `Storyline` (0 refs); `Territory` (demo seed only); `ElevationZone` (archive script only); `GeographicResource` (read only, `resources.ts:17`, no writer); `SharedVertex` (written only, `procedural.ts:185-197`) | Confirms AT-15. Also dead: `app/api/maps/editor-source/[layer]/route.ts` (257 lines), which has **no callers** and whose `capitals` query spans all realms. |
| **Misfiled code** | — | `components/maps/vexel/*` (3,011 lines) is the **heraldry** editor (`api.heraldry`, `/labs/vexel`). `country-geo/special-stats-populator.ts` is card stats. `country-geo/policy.ts` auto-drafts executive policies when geography is created. | These inflate "maps" and couple it to MyCountry and Vault. |

---

## 2. Docs vs code

### `docs/systems/maps.md`

| Line | Claim | Reality | Evidence |
|---|---|---|---|
| 7 | "Status: 📀 Gold Master (100% Ready)" | SYSTEM_STATUS says it "replaces the August 'Gold Master (100%)' matrix" and rates the editor 🟡 Partial. Twenty AT rows are open. | `SYSTEM_STATUS.md:8-9,49`; `code-audit-2026-09-30.md:94-113` |
| 12-14 | "Geography … is the Tier-0 single source of truth driving the entire simulation… Climate & Biomes … determine agricultural yields, resource endowments, and economic growth modifiers" | `CountryGeoProfile.gdpModifier/tradeModifier/infraCostModifier` are written and **displayed only** (`GeoProfileContent.tsx:440-442`). No economy code reads them: `computeEconomicGeoModifiers` is called only in `geo-profile.ts:493` and `admin-ops.ts:235`. `GeographicResource` has no writer. The simulation's geographic inputs are `landArea` (`economy/calculations.ts:91`), transport effects (`transport-sync.ts`), `national-issues/snapshot.ts` (landlocked/coastline) and the bottom-up rollup. | grep results above |
| 13 | "neighboring adjacency derive[s] directly from PostGIS" | Live neighbour queries do use PostGIS (`geo-profile.ts:351`, `national-issues/neighbors.ts`). The stored `MapLayer.neighbors` is only filled by `rebuildAdjacency`, which is never called in production. | AT-16 |
| 17, 46 | "100,000-Cell Spatial Mesh" | The mesh drops cells by `cos(lat)` density (`mesh.ts:207`), so every seed measured gave **69,162 cells**. | §A |
| 47 | "Euler rotation vectors" | The plates use 2-D linear velocity vectors (`tectonics.ts:68`). There are no Euler poles. | |
| 35 | svg-parser "Extracts Inkscape layer groups (political, rivers, lakes, altitudes, climate)" | The parser can. The map pipeline asks only for `political` + `altitudes` (`map-pipeline.ts:191-218`). The other layers come in only through per-layer `SvgUploadManager` uploads. | |
| 38 | "Visvalingam-Whyatt geometry simplification (`@turf/simplify`)" | `@turf/simplify` is radial-distance + **Douglas-Peucker** (`node_modules/@turf/simplify/dist/esm/index.js:28-68`). The comment in `geojson-compress.ts:5,157` is also wrong. `@turf/simplify` is not a direct dependency; it comes in with `@turf/turf`. | |
| 50 | "12 Trewartha climate biomes" drive agriculture | This is only true inside the bbox-estimated profile. Worldgen biomes never reach the DB. | |
| 51 | "all 7 vector layers with shared topology" | True inside worldgen. After import the layers are independent rows, and `SharedVertex` is never read back. | AT-15 |
| 80 | "Transit & Trade Corridors: Friction-weighted pathfinding … following terrain contours" | Accurate (A* + MST, `transport-generator.ts:1-12`). The terrain costs, however, come from the non-realm-scoped band sampler. | |
| 103 | "`MapLayer`, `Territory`, `BorderHistory` are authoritative for geometry" | `Territory` is used only by the demo seed (`demo-seed/domains/seed-social-geo.ts:255`). The authoritative geometry is `MapLayer` plus the cached columns on `Country` (`country-geo/sync.ts`). | |
| 105 | Rollup modes "aggregate regional metrics into national indicators" | They aggregate only population and GDP. Bottom-up overwrites the national figures, and when there are no subdivisions it uses the sum of **city** populations. | `sync.ts:124-152` |
| 114 | "`geo/admin/` (`geoAdmin`) – SVG uploads, province and city imports" | The province and city imports are **country-owner** procedures, not admin ones. | `cities.ts:138` |
| — | *Undocumented:* dead `api/maps/editor-source/[layer]` route; hard-coded IxEarth ocean currents; the global `WorldScale` singleton (`geo-math.ts:35-47`, never set per realm); the 18 MB public source SVG `public/master-map-updated.svg`, whose only importer is an archived script | | |

### `src/lib/worldgen/README.md`

- Lines 9 and 67 say "100,000 cells"; the real count is about 69k.
- Lines 142-145 give an example with `countryCountRange: [60, 200]` and imply it controls the count. In fact capitals
  are capped at 80 (`politics.ts:73`, `isCapital = i < 80` at line 230), so every run gives 80. The params
  `useIxWorldTemplate`, `templateStrength`, `climateFidelity` and `languageFamilies` are accepted and ignored (0 uses
  in `v2/`).
- Line 72 describes the quality gate. It self-scores 95-96% even when the world has 1 continent against a target of
  4-9 (`quality-gate.ts:96-97`; measured).
- `engine.ts` and `v2/index.ts:67` still say "50K+ cells" and "Chaikin smoothing", while `export.ts` uses Catmull-Rom.
  The file headers contradict each other.

### `docs/systems/SYSTEM_STATUS.md`

- **Line 50, "Map pipeline (SVG/PNG/procedural) ✅ Live".** Procedural is not in the wizard and the import is untested
  and likely broken.
- **Line 51, "Worldgen ✅ Live".** By the file's own key, "Live" means "wired into navigation, works end to end". The
  Lab isn't in navigation and nothing is saved, so this row should be 🧪 Labs, which is how line 129 already lists
  it.
- **Line 48, "realm-scoped layers".** The layers themselves are realm-scoped, but terrain sampling, transport
  (AT-1), the capitals route, ocean currents, map styles (`MapStyleOverride` has no realm) and world scale are not.

### `docs/roadmap/ROADMAP.md`

- **Line 214 (M3 #13): "Procedural realm generation … (the pipeline already supports it)".** Overstated. The server
  pipeline runs the generator, but the import breaks on numeric ids and produces no `Country`, `City` or `Subdivision`
  rows. Generation also takes 3-28 s of synchronous CPU inside a tRPC request on the main Node process.

### `docs/architecture/realms-framework-spec.md`

- **Line 19**: "Only root records carry a realm: MapLayer, TransportRoute, SharedVertex". The `SvgUpload` history and
  `MapStyleOverride` also have no realm. The code audit treats this as a known gap only for transport.
- **Line 38, decision 9: "Map: Generated (UPG v2) or an uploaded image"**. Only uploaded images are reachable.
- **Lines 39 and 119-123, image maps**. Accurate. The one caveat is that the georeference is implicit whole-world
  equirectangular, which suits Eurth and is wrong for regional or non-equirectangular maps.

### `docs/systems/map-editor-improvements-overview.md`

The doc marks itself historical, which is fine, but it still cites removed paths as current audit facts:

- `src/lib/geo-analytics.ts`, `src/lib/geo-math.ts` and `src/lib/route-geometry.ts` do not exist (the first two are
  now under `src/lib/maps/`; route-geometry is gone).
- `useMapEditor.ts` is described as "~2019 lines"; it is 630.

### `src/app/maps/README.md`

- **Titles**: it says the maps site is "IxMaps" at maps.ixwiki.com, while `layout.tsx` titles it "IxWorld -
  Interactive World Map" and `page.tsx` titles it "IxMaps". One product has three names in code.
- **Procedure count**: "90 procedures" is roughly right; a grep finds 86 single-line procedure declarations.

### `CHANGELOG.md`

- **Line 1148**: describes a `src/lib/maps/` "barrel export (`index.ts`)" with route-network and route-geometry
  modules. None of these exist now.
- **Line 755**: says generators moved to `src/lib/worldgen/procedural/`, which does not exist. `climate-system.ts` is
  at `src/lib/worldgen/`, and Onoma naming is at `src/lib/onoma/`.
- **Line 1363**: "100K RBF Spline Vector Engine" badge (`MapPipelineControls.tsx:131`). There is no RBF code; the
  smoothing is Catmull-Rom.
- **Lines 1455-1456**: `SharedMapContext` single shared canvas. Replaced by `map-engine.ts` per-role instances, and no
  trace of the old context remains.

### Real but undocumented

- Province importer depth, including PNG province import.
- The city SVG importer (`lib/city-importer`).
- `createCountryFromShape`.
- The border-history time scrubber.
- The Onoma Markov naming inside worldgen (`politics.ts:214-230`).
- `country-geo/policy.ts`, which auto-drafts executive policies when geography is created. This is a cross-system
  side effect.

### Code-audit AT rows

Spot-checked and confirmed: AT-1, AT-9, AT-10, AT-13, AT-15, AT-16, AT-17.

**New findings not in the audit**:

- (a) `getTerrainAtPoint` is not realm-scoped and returns an arbitrary band when contours are stacked.
- (b) The procedural import breaks on numeric feature ids.
- (c) `editor-source` API route is dead and not realm-scoped.
- (d) Ocean currents and `WorldScale` are IxEarth-global.
- (e) `pipeline/{accuracy-normalizer,geographical-accuracy-analyzer,vector-synthesis}.ts` are dead.
- (f) The Labs worldgen blocks the main thread.
- (g) The bottom-up rollup falls back to city populations.

---

## 3. Distance to the goal

The goal is a geospatial engine that a worldbuilder would choose on its own merits and that also powers IxStates.
Gaps are ranked by impact, highest first.

1. **No saved worlds and no world-creation path.** Worldgen output is thrown away. There is no procedural option in
   the wizard, and the import breaks. `ProceduralWorld` and `WorldTemplate` exist but are never used, and
   `Realm.seed` is never written. Without this there is nothing to save, reopen, fork or share, which is the core loop
   for a worldbuilder. **Fix:** a background job (worker or cron queue) that generates, saves `ProceduralWorld`, and
   imports into a realm with string ids. It should create claimable nations from states, and `City` and `NamedRiver`
   rows from settlements and rivers.
2. **Geography doesn't drive the simulation.** The profile modifiers aren't read, resources are empty, and climate and
   elevation shares are bbox guesses. This is the "works better together" promise for IxStates. **Fix:**
   PostGIS-exact profiles on `geom_postgis`, then feed `gdpModifier`, `tradeModifier` and `infraCostModifier` into the
   economy the way transport-sync does. Also write `GeographicResource` from terrain.
3. **Mapping data must not depend on countries.** `City`, `Subdivision`, `POI`, `StoryPin`, `MapLabel` and `Peak`
   require `countryId`, and there is no `realmId` on them. A worldbuilder can't place a city in unclaimed land, a
   ruin, or a sea label. **Fix:** give them `realmId`, make `countryId` optional, and let spatial containment derive
   ownership.
4. **No real terrain model.** Elevation is 9 vector bands. There is no heightfield, hillshade, 3D terrain,
   raster-dem, or climate or river data you can query as rasters, and the sampler returns bands with realm leaks.
   Every serious map tool (Azgaar, Wonderdraft-class tools, WorldAnvil maps) has at least relief shading. Worldgen
   already computes per-cell heights that could be baked to a DEM or terrain-RGB.
5. **Interchange formats.** There is no GeoJSON, TopoJSON or Shapefile import, and no export at all. There is no
   Azgaar `.map` import, which is explicitly declined in the realms spec but is the largest existing worldbuilder
   community. There is also no georeferencing UI (bounds, projection, control points). Without these, nobody
   migrates in and nobody trusts that they can leave.
6. **Scale and delivery.** Whole GeoJSON per zoom bucket, `ST_GeomFromGeoJSON` casts at query time, and synchronous
   100k-cell generation in request handlers or on the client main thread. **Fix:** MVT or PMTiles from PostGIS, use
   the `geom_postgis` columns, and move heavy work to workers.
7. **Per-world configuration is global.** Planet scale (`geo-math.ts` `WorldScale`), ocean currents, map styles
   (`MapStyleOverride` keyed by theme only), the elevation-zone palette, the IxEarth SVG default config, ocean labels
   and the tour (AT-2) are all global. Each realm needs its own planet config.
8. **Editor integrity.** There are no gap/overlap checks between countries, and admin role detection is wrong
   (AT-13). Unfinished pieces include the inspector spec, Wiki tab, SmartPlacement, Storylines, `alert()` calls and
   the stale "Private Beta" banner.
9. **Demographics on the map are thin.** There is a population number per city or subdivision. The only rollup is
   bottom-up overwrite, with the city fallback bug. There is no density or urban/rural surface, and worldgen
   settlement populations are toy numbers (10k-560k, at most 150).
10. **Labs honesty.** Fabricated enrichment (AT-9), a quality gate that grades itself, the "RBF" label, and params
    that are silently ignored.

---

## 4. Taxonomy: does "Atlas" as one app fit the code?

**Mostly yes.** The code already has this split: `VERSIONS.engines.atlas = 5` "spatial foundation (worldgen, geo,
maps) — powers IxWorld" and `VERSIONS.apps.ixworld = 2` (`buildVersion.ts:38,47`). The admin UI says "Atlas World
Map" (`WorldStudioPanel.tsx:49,61`), and the SYSTEM_STATUS section is "Atlas & Realms". In the code, "Atlas" appears
15 times, "IxWorld" 74 times, "IxEarth" 46 times and "IxMaps" 6 times.

The naming problem is that **IxWorld is also realm 0** (`Realm.id="default"`, slug `ixworld`) and IxEarth is its
planet. The data supports this naming:

- **Atlas** for the app and engine.
- **IxWorld** reserved for the realm.
- **IxEarth** for its geography.
- Drop "IxMaps".

"ACE" has no footprint in code (0 references).

**Belongs in Atlas**:

- Renderer
- Editor
- Import pipelines (whole map, per layer, province, city)
- Worldgen
- Terrain, climate and hydrology
- Named features
- Borders and subdivisions geometry
- Sovereignty geometry
- Border history
- Labels and story pins (as map annotations)
- Georeferencing
- Per-realm planet config
- Transport network geometry and pathfinding: `transport-generator.ts` and `travel-time.ts` currently live in
  `src/lib/economy/`. Move them to Atlas and leave only the economic effect sync (`transport-sync.ts`) in
  MyCountry/economy.

**Belongs out of Atlas**:

- `components/maps/vexel/*` belongs to heraldry (Vexel/IxVault).
- `country-geo/special-stats-populator.ts` belongs to cards.
- `country-geo/policy.ts` belongs to MyCountry directives. It should be an event consumer, not something Atlas calls.
- The choropleth, crisis and diplomacy overlays are IxStates data drawn *on* Atlas. Keep them as plugins through
  `OVERLAY_REGISTRY` and have IxStates own them.

**Demographics**:

- **Split it.** The spatial distribution of people (city and subdivision population, density surfaces, settlement
  placement) is Atlas.
- National composition (age, ethnicity, religion, rates in `Demographics`) and the economic figures
  (`Country.currentPopulation`) are MyCountry.
- The rollup (`country-geo/sync.ts`) is the contract between the two. It should be one interface
  (Atlas reports spatial totals; MyCountry reconciles them), not Atlas writing national figures directly.
- Also merge or retire `Demographics.regions` in favour of `Subdivision`.

**Realms** are platform, not Atlas. A realm *has* an Atlas world, but claims and ownership are Passport and Realms
concerns. The code keeps them apart: `server/modules/realms` doesn't import maps code.

---

## 5. Standalone potential

**Today: an embeddable, rebranded view of IxStates, not a standalone product.** The rendering and editing core is
reusable in principle. `worldgen/v2`, `province-generator`, `border-editor`, `topology-engine` and `geojson-compress`
are pure TS; `map-engine` and the IxWorldMap props take `layers` directly, which is how the Lab renders a generated
world without the DB. But everything past rendering is tied to IxStates internals.

**Blockers**, most serious first:

1. **Data model.** Every feature entity has a required `countryId` → `Country`, and `Country` is the heavy IxStates
   economic entity. `MapLayer.countryId` links political features to it. Mutations check country ownership
   (`standardMutationCountryOwnerProcedure`). A standalone user would have to create IxStates countries to place a
   city.
2. **Tenancy.** There is no concept of a user-owned private map project. Realms are admin-created
   (`realms.adminCreateRealm`), have no private visibility (decision 19), and hold only one world each.
3. **Deploy.** Same build and env as IxStates. `verify:environment` needs DB, Redis and Kokoro; Clerk is shared; the
   whole app is served on the maps host (`proxy.ts:125-137` guards only `/`). The standalone flag is a hostname
   check.
4. **UI coupling.** `components/maps` calls 15 tRPC namespaces: geo* plus `countries`, `transport`, `users`,
   `realms`, `wikios`, `commons`, `resources`, and `heraldry` via Vexel. Core UI imports `lib/economy`, `lib/ixtime`,
   `lib/wiki-os`, ThinkPages websocket and message hooks (see the grep list of 21 files). The popup, info panel and
   welcome modal assume IxStates countries.
5. **IxEarth assumptions**:
   - The default SVG config (`IXEARTH_SVG_CONFIG`) and world scale.
   - Ocean currents.
   - Ocean labels and the tour.
   - A 9-zone palette fixed to the IxWiki legend.
   - 28 files reference IxEarth.

**The path**:

1. Define an Atlas domain (World → Layers/Features with an optional `polityRef`). IxStates `Country` becomes one
   consumer that binds a polity to a country.
2. Add world-scoped config (scale, styles, currents, palette).
3. Split the maps route shell from IxStates chrome (`MapContainer` data hooks behind an adapter).
4. Add import/export (GeoJSON, TopoJSON, Azgaar) and saved procedural worlds.

With those in place the same code could ship as Atlas standalone and still be the map layer of IxStates. That is the
flywheel the owner describes.

---

## Appendix A: worldgen measurements

Run in this container with bun, default params (`scratchpad/audit/wg*.ts`):

| seed | ms | cells | countries | rivers | lakes | continents | land % |
|---|---|---|---|---|---|---|---|
| 42 | 8,569 | 69,162 | 80 | 94 | 93 | 1 | 35 |
| 777 | 5,351 | 69,162 | 80 | 86 | **0** | 3 | 34 |
| 1 | 22,869 | 69,162 | 80 | 101 | 61 | 1 | 31 |
| 100 | 3,183 | 69,162 | 80 | 88 | 64 | 1 | 31 |
| 256 | 28,202 | 69,162 | 80 | 97 | 74 | 2 | 35 |
| 12345 | 3,321 | 69,162 | 80 | 82 | 76 | 1 | 32 |

- The quality gate reported 95-96% for seeds 100, 12345 and 777.
- Layer JSON sizes for one world are about 3.5-4.1 MB uncompressed. Seed 42: altitudes 1.1 MB, climate 1.3 MB, rivers
  0.7 MB.
- Every layer's features have numeric `id` and no `properties.featureId`, for example political `{_id:"state_1", id:1,
  …}`.
