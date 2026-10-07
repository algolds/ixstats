# 🗺️ Atlas — Spatial Geography & Cartographic Studio

**Last updated:** 2026-10-07

**Parent App Suite:** Atlas (app version 2 — `VERSIONS.apps.ixworld`, exported as `IXWORLD_VERSION`; `IxWorld` is the in-code app name)  
**Engine:** Atlas Spatial Engine (`ATLAS_ENGINE_VERSION = 5`)  
**Subsystems:** Interactive World Map, Vector Map Editor Studio, Spatial Geographic Analyzer  
**Primary Action:** `MAP` | **Domain Accent:** Sky Blue (`#0EA5E9` / `--color-blue-500`)  
**Routes:** `/maps` (players edit their own nation in place), `/mycountry/map-editor` (the same country editor, full-screen), `/admin/maps/editor` (world editor), standalone `maps.ixwiki.com` | **Status:** see [SYSTEM_STATUS.md](SYSTEM_STATUS.md) (interactive map ✅ Live; map editor, pipeline and worldgen 🟡 Partial or 🧪 Labs)  

Atlas is the spatial, cartographic, and worldbuilding studio for IxStates. Built on **MapLibre GL JS**, it powers interactive vector globe maps, procedural realm generation, grounded manual IxEarth cartography, admin GIS suites, and precision player territory editors.

### Core Foundation: "Geography is King"
In IxStates, geography is the source of truth for borders, area and adjacency. Its reach into the economy is narrower than the aspiration:
- **Topological Ground Truth**: Live neighbour queries use PostGIS spatial geometry (`ST_Touches`, `ST_Intersection`; `geo/core/geo-profile.ts`, `national-issues/neighbors.ts`). The stored `MapLayer.neighbors` column is rebuilt from PostGIS after every map import that carries political regions (the realm map import, its rollback and `importPipelineResult`, so imported realms get neighbours too) and by the admin `rebuildAdjacency` mutation (`lib/maps/adjacency.ts`).
- **Climate & Biomes**: The bbox-estimated geo profile derives `CountryGeoProfile.gdpModifier`, `tradeModifier` and `infraCostModifier` (`computeEconomicGeoModifiers`, `src/lib/maps/geo-analytics.ts`). These are written and displayed only (`GeoProfileContent.tsx`); no economy code reads them. The simulation's geographic inputs are `landArea`, transport effects (`transport-sync.ts`), the national-issues snapshot (landlocked, coastline) and the bottom-up rollup. **Geographic resources** (AT-9): the admin **Recalc** action (`geoCore.recalculateGeoProfiles`) also rewrites the country's `GeographicResource` rows from PostGIS (`src/lib/maps/geographic-resources.ts`): freshwater for its three longest rivers and three largest lakes inside the border, a fishery on the coast (the border not shared with a neighbour) when `coastlineKm > 0`, and farmland weighted by each clipped climate zone's agriculture factor. `quantity` is the measured size on a fixed scale (1000 km of river, 1000 km² of lake, 2000 km of coast, the arable share); only farmland gets a `quality` (its mean agriculture factor), so the Geography tab shows quality for farmland only. There is no geology data, so no mineral, oil, gas or forest resources are written. Like the profiles, they are display only. The Labs pipeline (`/labs/map-pipeline`) still shows sample profiles and resources (labelled as such): a generated world has no `Country` rows to attach real values to.
- **Dual Pipeline Architecture**: The Atlas Engine unifies two distinct cartographic streams under one high-performance WebGL renderer:
  1. **Grounded Manual IxEarth Pipeline**: Exact affine transformation ($25625 \times 15729$ viewBox $\to$ WGS84 coordinates), manual hypsometric contour stacking, topological seam-locking, and 12 Trewartha climate biomes.
  2. **Procedural UPG v2 Vector Pipeline**: ~100,000-seed Voronoi spatial mesh (`WorldGraph`; ~69,000 cells after latitude thinning), 5 Lloyd iterations, coastal hypsometric damping, and Catmull-Rom spline vector subdivision (2 passes for polygons, 3 for rivers).

---

## Prerequisite Map Conversion & Processing Pipeline

Raw map graphics (SVG vector files or PNG raster maps) undergo a multi-pass parsing, affine coordinate transformation, topological repair, and compression pipeline (`src/lib/maps/map-pipeline.ts`, `src/lib/flags/svg-parser.ts`, `src/lib/maps/geojson-compress.ts`). A realm's political map from a flat-colour image, an SVG of nations or GeoJSON goes through the [realm map import engine](#realm-map-import-engine) instead. The pipeline's own PNG input (`runPipeline` with `source: "png"`, traced colour by colour with `potrace` in `src/lib/flags/png-to-svg.ts`) is no longer offered by the wizard.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   PREREQUISITE MAP CONVERSION PIPELINE                   │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ Source File  │ SVG Parsing  │ Affine WGS84 │ Antimeridian │ Compression  │
│ (SVG / PNG   │ Bezier       │ Transformation│ & Topology  │ DP Truncate  │
│ raster)      │ flattening   │ (px → deg)   │ Seam lock    │ Dedup points │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

1. **Vector SVG Parsing (`svg-parser.ts`)**: Server-side parsing with `@xmldom/xmldom` and `svg-path-parser`. Can extract Inkscape layer groups (`political`, `rivers`, `lakes`, `altitudes`, `climate`), flattens Bezier curves, and tells outer rings from holes by containment, not winding (`src/lib/maps/ring-assembly.ts`): a ring inside an odd number of rings is a hole of the smallest ring containing it, so a lake stays a lake whichever way it was drawn, and an island in it is land again. A path's explicit `fill-rule: nonzero` follows the windings instead, as a browser draws it. Output is RFC 7946 (outer rings counter-clockwise, holes clockwise), and every area helper subtracts holes. The PNG path's potrace output and the province importer (per shape) go through the same assembly. The map pipeline (`map-pipeline.ts`) asks only for `political` and `altitudes`; the other layers arrive through per-layer `SvgUploadManager` uploads.
2. **Affine WGS84 Transformation (`src/lib/flags/svg-coordinate-config.ts`)**: Converts 2D SVG pixel viewBox space (`25625 × 15729` for IxEarth) to geographic coordinates with an isotropic affine transform (~22.77 px per degree).
3. **Topology Locking (`src/lib/maps/shared-vertex-builder.ts`)**: Merges shared boundary vertices between adjacent nations into a unified vertex lookup topology, preventing tearing or slivers.
4. **GeoJSON Optimization (`geojson-compress.ts`)**: Radial-distance plus Douglas-Peucker geometry simplification (`@turf/simplify`, which comes in through `@turf/turf`), coordinate precision truncation (4 decimal places, $\sim 11\text{m}$, for political borders; 3 for decorative layers), and consecutive duplicate-point removal. Sutherland-Hodgman antimeridian clipping lives in `src/lib/maps/map-utils.ts`.

---

## Procedural Realm Engine (UPG v2)

The **Ultra-Fidelity Unified Physical Geography (UPG v2)** vector engine (`src/lib/worldgen/v2/`) generates high-resolution, scientifically accurate fictional world maps:

1. **~69,000-Cell Spatial Mesh**: Voronoi mesh (`WorldGraph`) with 5 Lloyd relaxation iterations. Seeds are thinned by `cos(latitude)` density (`mesh.ts`), so every seed measured gave about 69,000 cells, not 100,000.
2. **Tectonic Plate Simulation**: Continental/oceanic crust assignment, 2-D linear plate velocity vectors (`tectonics.ts`; no Euler poles), and convergent/divergent/transform boundary classification.
3. **Coastal Hypsometric Damping**: Exponentially dampens coastal land elevation within 8 cells of water (`coastDist <= 8`, `coastlines.ts`), preventing glacial peaks on shorelines:
   $$H_{\text{final}} = H_{\text{raw}} \cdot (1.0 - 0.85 \cdot e^{-0.35 \cdot \text{coastDist}})$$
4. **Unified Hydrology & Biomes**: Coriolis wind simulation, rain shadow calculation, priority-queue depression filling, steepest-descent river tracing, and 12 Trewartha climate biomes.
5. **Vector Synthesis & Export (`export.ts`)**: Merges cell polygons into rings, then Douglas-Peucker decimation → Catmull-Rom spline subdivision ($\tau = 0.5$; 2 passes for polygons, 3 for river lines) → harmonic noise perturbation, across all 7 vector layers with shared topology inside the generator. After import the layers are independent rows and `SharedVertex` is not read back.
6. **Status:** Labs only (`/labs/map-pipeline`). Nothing is persisted; the procedural import does not yet produce `Country`, `City` or `Subdivision` rows, and generation runs synchronously on the main Node process (3-28 s). Capital count is fixed at 80 (`politics.ts`); the `countryCountRange`, `useIxWorldTemplate`, `templateStrength`, `climateFidelity` and `languageFamilies` params are accepted and ignored. Worldgen biomes never reach the database, so the 12 Trewartha biomes drive agriculture only in the bbox-estimated profile.

---

## Runtime Requirements

- **PostGIS geometry triggers.** The spatial SQL reads `geom_postgis`, which triggers fill from the GeoJSON columns of
  `map_layers`, `subdivisions`, `cities` and `points_of_interest`. `db push` cannot create triggers, so they live in
  `prisma/migrations/20261007_map_geometry_sync_triggers.sql` (idempotent, with a backfill). `db:bootstrap` applies
  it; on an existing database run it by hand after `db push` (see the deploy runbook).
- **Realm-scoped spatial SQL.** Realms share one coordinate space. Every raw join on `map_layers` matches the realm of
  what it measures (`ml."worldId" = <country>."realmId"`); `getTerrainAtPoint` / `getTerrainForArea` take a required
  realm, and a country's border by id comes from `COUNTRY_BORDER_SQL` (`src/lib/maps/geo-validation.ts`).
- **Upload limits.** Map images decode through a 64-megapixel limit (`MAX_PNG_PIXELS`, `png-realm-map.ts`), checked
  from the header before any pixels are decoded; province imports cap their content at the pipeline's 25 MB, the map
  import's upload route (`/api/admin/map-import/upload`) at 40 MB, and the upload routes refuse an oversize body by its
  Content-Length before parsing it.
- **Planet figures.** The radius and degree → km factors (6371 km, 111.32 / 110.574 km per degree) live in
  `src/lib/maps/planet.ts`; its helpers take an optional radius, and a realm's own radius (`Realm.settings.map.radiusKm`)
  scales its areas and distances (see [Realm maps](#realm-maps)).
- **IxWorld only.** The 56.1842° prime meridian, the home view and the R shortcut follow `mapHomeCenter(ixWorld)`;
  other realms' maps centre on the origin with no meridian line. The style editor's preview sources
  (`/api/maps/editor-source/[layer]`) are admin-only and serve one realm (`?realm=`, IxWorld by default).

- **MapLibre web worker.** MapLibre 6 finds its worker next to its own module, which is a bundled chunk under Turbopack, so `src/lib/maps/load-maplibre.ts` points it at `/maplibre/maplibre-gl-worker.mjs`. `scripts/setup/copy-maplibre-worker.mjs` copies that file and `maplibre-gl-shared.mjs` into the gitignored `public/maplibre/`; it runs from `postinstall`, `build`, `build:fast` and `start-development.sh`. If the files are missing, every map stalls with "Worker failed to load".
- **Direct dependencies.** Map code imports individual `@turf/*` packages (`@turf/intersect`, `@turf/union`, …). They are declared in `package.json` next to `@turf/turf`; an import of a package that is only a transitive dependency resolves under a hoisted `node_modules` but fails ("Module not found") under isolated installs.

## Realm Maps

Every realm has its own map (`MapLayer.realmId`). What follows is what a realm's own staff can do with it and how the
viewer shows it.

### Who edits a realm's map

- **The Map power.** A realm officer can hold `map` ("Edit the realm's map, borders and labels, and import maps").
  `canEditRealmMap` / `canImportRealmMap` (`src/server/modules/realms/realms.access.ts`) allow site admins, the
  founder and map officers; IxWorld stays with site admins, and an archived realm is read-only (`realmMapAccess`).
- **World editor procedures are realm-scoped.** Border edit, split and merge (`geo/editor/borders.ts`), region links
  (`linkage/assignment.ts`), linkage validation and Auto-Match (`linkage/validation.ts`) and realm labels
  (`geo/features/realm-labels.ts`) call `editableMapRealmId` (`src/server/api/trpc/realm-scope.ts`): the edited
  realm (`?realm=`, else the caller's) once the caller may edit it, else `FORBIDDEN`. A map officer renames a region
  but not the nation linked to it; creating a nation from a shape and rebuilding adjacency stay admin-only. A draft
  session is saved only by its own editor. Border edits filed for review record their realm
  (`MapEditRequest.realmId`).
- **Entry points.** Founders and map officers get **World editor** on `/maps?realm=<slug>`; site admins also have
  `/admin/maps/editor?realm=<slug>`. The map import wizard is in `/admin/maps` → Import pipeline → Full pipeline for
  site admins, and in the realm's Manage tab (**Map import**) for the founder and map officers.

### Map settings (`Realm.settings.map`)

`src/lib/maps/realm-map-settings.ts` is the zod schema; every key is optional and read on its own (a malformed value
is dropped, not the rest). Edited in the realm's Manage tab (**Map**, holders of `map`) through
`realms.map.updateSettings`, and read by the viewer through `realms.map.display`.

| Key | Meaning |
| :-- | :------ |
| `radiusKm` | The planet radius, 500 to 50,000 km (default 6371). Scales areas and distances measured on the realm's map |
| `defaultView` | `{ center: [lng, lat], zoom }` where the map opens, saved from the world editor's realm menu (**Save current view as default**); also the R home view |
| `baseImage` | A base raster image: an `https://` address or an image uploaded through `/api/upload/image` (`isMapBaseImageUrl`) |
| `attribution` | The credit line (at most 300 characters). Empty: the realm's source sync attribution, if any |
| `projection` | `equirectangular` (default) or `mercator`: how an imported image's vertical axis maps to latitude |
| `bounds` | `{ west, south, east, north }`: the lon/lat box a cropped image covers (west < east, south < north) |
| `controlPoints` | At least three `{ x, y, lon, lat }` pairs (pixel from the top-left ↔ lon/lat), fitted instead of bounds |

Other keys under `map` (the wiki map's `source` and `file`, written by `withRealmWikiMap`) are never dropped when the
settings are saved.

### Planet radius

- `src/lib/maps/planet.ts` scales Earth's figures: `scaleAreaToRadius` (`area × (r / 6371)²`), `scaleDistanceToRadius`
  and `haversineKm(a, b, r)`. Stored `MapLayer.areaSqKm` values are areas on the realm's planet.
- Applied to: areas the border editor stores on edit, split and merge; the editor's live area readout
  (`useRealmPlanetRadius`); the geo profile's perimeter, coastline, shared borders and spans (`geo-profile.ts`); the
  measure tool; the viewer's scale bar.
- **Recompute areas** (`realms.map.recomputeAreas`, Manage → Map) measures every active polygon feature of the realm
  again: PostGIS `ST_Area(geom_postgis::geography) × (r / 6371)²`, or the flat helpers at radius r without PostGIS.
  Run it after changing the radius (the map import already measures on the realm's radius). Nations' stated land area
  is untouched unless the founder (or a site admin) ticks **Also set nations' land area from the map**, which sets
  each linked nation's land area to the sum of its regions.
- Not scaled yet: river `lengthKm` properties written by imports, and the economy's own figures.

### Viewer

`MapContainer` reads `realms.map.display` (`useRealmMapDisplay`) for the realm it shows:

- **Default view:** opened once per realm (`useRealmDefaultView`) unless the URL asks for a place (`?lat=&lng=`,
  `?zoom=`, a country).
- **Base image:** a MapLibre `image` source pinned at `[-180, 85]`, `[180, 85]`, `[180, -85]`, `[-180, -85]` and a
  raster layer under the first data layer (`src/components/maps/core/utils/realm-map-layers.ts`), credited in the
  attribution control. **Limits:** a full-globe equirectangular image, 2:1, cropped to 85°N to 85°S (the Web Mercator
  limit). MapLibre stretches it linearly between the corners in the map's projection, so features drift toward the
  mid-latitudes on Mercator; a Web Mercator image registers exactly. The whole image is one GPU texture: keep it at
  most 8192 × 4096 (many GPUs cap textures at 8192 or 16384 px). Uploads are at most 5MB; an `https://` host must
  send CORS headers or WebGL refuses the image.
- **Credit line:** `RealmMapAttribution` at the bottom left (the realm's own, else its source sync's).
- **Political legend** (`RealmMapLegend`, realm maps only): each nation once, by its colour, collapsed until opened.
- **Unclaimed nations** (no owner, `display.unclaimedCountryIds`): a diagonal hatch (`fill-pattern`, layer
  `realm-unclaimed-hatch`) over their fill, under the borders, with a legend entry; same meaning as the source sync's
  **Unclaimed** badge. IxWorld's unowned countries keep their usual fill.
- **Scale bar and coordinates** (`RealmMapScale`): the scale bar measures the middle of the view with `haversineKm` at
  the realm's radius (MapLibre's own assumes Earth), and the cursor's coordinates show beside it. Both are written to
  the DOM once per animation frame, never through React state.

### Realm labels

`MapLabel.countryId` is optional and `MapLabel.realmId` names the realm of a **realm label**: an ocean, sea, region or
continent (`src/lib/maps/realm-labels.ts`) that the realm's map editors place anywhere, with size, weight, colour,
letter spacing and zoom range (`geoFeatures.listRealmLabels` / `createRealmLabel` / `updateRealmLabel` /
`deleteRealmLabel`). The world editor's realm menu (**Realm labels…**) manages them; `geoFeatures.getAllMapLabels`
returns them with the nations' labels (`realmLabel: true`), and the viewer shows them at their own zoom range, globe
view included (nations' labels start at zoom 4). `fontStyle` (`italic` for oceans and seas) is stored, but the
self-hosted glyphs have no oblique face, so labels are drawn upright.

### Auto-Match and nations with several regions

- **Auto-Match** (world editor → Links → the wand) reads the edited realm's unlinked regions and nations in id-ordered
  pages (`findAllById`, never the 1,000-row guard) and matches names after normalising case, accents, hyphens,
  underscores, punctuation, a leading "The" and state forms ("Republic of", "Kingdom of"…), against each nation's
  name, wiki page title, `externalSourceKey` and the roster's nation page titles (`src/lib/maps/nation-name-matching.ts`,
  `linkage/matching.ts`). Confidence: same name 100%, same normalised name 95%, same without the state form 85%,
  similar spelling (edit similarity ≥ 0.8) scaled below 80%. `geoEditor.suggestLinkageMatches` is the review list;
  `repairLinkage` `apply_matches` links the picked pairs and `auto_match` alone links matches of at least 85%.
- **Several regions per nation:** Auto-Match and a claimed nation page (`takeMapRegion`) link every region that names
  the nation (feature id, display name or source key), and `syncCountryGeometryFromMapLayer` reads all the nation's
  active regions in its own realm and stores their union (`@turf/union`), summed area, joint bounding box and
  area-weighted centre.

### Not done yet

- Per-realm overrides of the fixed elevation and climate colour keys (`getZoneByColor`, `resolveClimateFromColor`):
  every realm still reads IxWorld's keys.
- A few country-id lookups of `MapLayer` (`getCountryGeometry`, the edit queue, province imports) do not filter by
  realm; country ids are unique and cross-realm links are refused (`assertCountryInFeatureRealm`).

## Realm Map Import Engine

A realm's political map from a file: a flat-colour **PNG/JPEG/WebP**, an **SVG** with a shape or group per nation, or
a **GeoJSON** FeatureCollection. Code: `src/lib/maps/import/` (engines, georeferencing, colour keys, name checks),
`src/server/modules/maps/map-import.*` (jobs, storage, plan and apply, rollback, upload, wiki), router
`geoEditor.mapImport` (`geo/editor/map-import.ts`), upload route `/api/admin/map-import/upload`, wizard
`src/app/admin/maps/_components/map-import/`.

**Who:** `canImportRealmMap` (site admins, the founder, officers with the Map power; IxWorld admin-only; archived
realms refused) for uploads, analyses, dry runs, applies and rollbacks. Quick Update and the layered SVG pipeline stay
admin-only.

### Flow and jobs

1. **Upload** (multipart, 40 MB, Content-Length checked first): the kind is read from the bytes; the file is stored by
   its SHA-256 in `MAP_IMPORT_DIR` (default `.map-imports/` under the app, not public). Never base64 through tRPC.
2. **Analyse** (`mapImport.start`, or `startMapImport({ realmId, source: { kind, bytes | uploadId, filename },
   options, requestedBy })` from server code): a `MapImportJob` (status queued, running, succeeded, failed, cancelled;
   progress 0 to 100 and a stage text) runs the engine and stores its result in `MAP_IMPORT_DIR/results/<job>.json`
   and a summary (regions, report, georeference extent, suggested mapping) on the job.
3. **Map regions to nations** in the wizard; **dry run** (`mapImport.preview`): new, changed, unchanged and (replace
   mode) retired borders, unmatched regions, names that are not nations of the realm (with suggestions), and each
   nation's area (PostGIS geography × (radiusKm / 6371)², or the flat helpers at the realm's radius).
4. **Apply** (`mapImport.applyImport`): an apply job writes through the realm map writer (validated geometry, batched
   transactions, display names, country links, `geom_postgis`, areas on the realm's planet), retires the rest of the
   political layer in replace mode only, fills a nation's land area from its border **only when it has none** (option,
   on by default; re-checked at write time), rebuilds adjacency, drops the map caches and keeps a `MapImport`
   snapshot. Several regions may name one nation: they are merged into one border.
5. **Roll back** (`mapImport.rollback`): the realm's latest import still in place is restored from its snapshot
   (touched features as they were, created features deleted, linked countries' outline and land area restored). The
   snapshot is gzipped and capped at 64 MB of JSON; over the cap the import is applied without one and says so.

**Who runs jobs:** the `map-import` cron job (every minute, `runQueuedMapImports`) when it is in
`CRON_ENABLED_JOBS`: it runs analyses, with PNG tracing in a Bun worker thread, plus apply jobs left queued for two
minutes. Otherwise the web process runs the queue itself right after queueing, in-process, yielding to the event loop
every 40 ms (a Node worker thread cannot load the TypeScript source there). Apply jobs always start in the web process,
so its in-memory layer cache is dropped at once. A realm runs one job at a time (lease `map-import:<realmId>`); a
job queued behind it is retried every few seconds; a running job silent for 10 minutes is marked failed; Cancel stops
a running job at its next progress report. Both processes must see the same `MAP_IMPORT_DIR`.

### PNG engine (`src/lib/maps/import/png/`)

Decode once (sharp, 64-megapixel limit from the header) → **palette**: the colour key's colours, or the image's
dominant colours from a 15-bit histogram clustered by CIEDE2000 (a third of the tolerance merges; anti-aliasing and
JPEG halos join their colour) → every pixel snapped to the nearest palette colour within the tolerance (default ΔE 12)
through a 24-bit lookup table → detected colours that exist only as thin lines are dropped → a 3×3 majority vote
removes one-pixel lines → **border lines** (dark, nearly grey pixels, or listed line colours) and unmatched pixels are
grown over from their neighbours, so neighbours touch → regions under the minimum (default 0.002% of the image) merge
into their largest neighbour (on row runs) → every boundary is traced once along pixel edges, keeping only vertices
that matter (corners and junctions), so both sides of a border list the same points → rings become polygons with
holes by containment (`ring-assembly.ts`) → TopoJSON (shared arcs) → topological simplification (Visvalingam, 1.5 px²).
Nations made of several colours are merged along their shared arcs (`topojson-client` merge). The report lists each
colour's pixels and pieces, merged specks and unmatched colours. Sea colours are offered as ignored.

**Performance** (synthetic 8000 × 4000 map, about 130 nations with 3 px black borders and anti-aliased edges, Bun):
about 2 s for the PNG and 4.5 s for a JPEG of it (all distinct JPEG colours classified), plus about 0.1 s to build the
nations' borders; the old per-colour potrace path took about 1.1 s per colour (about 2.5 minutes for 130 nations) in
one tRPC call.

### SVG and GeoJSON engines

- **SVG** (`svg-engine.ts`, on the province importer's building blocks): `<path>` (arcs drawn as arcs),
  `<polygon>`, `<polyline>`, `<rect>`, `<circle>`, `<ellipse>`, accumulated `transform`s, `fill-rule`, holes by
  containment. A region is the nearest named `<g>` (`<title>`, Inkscape label, data-name, aria-label or a non-generic
  id), else the shape's own name, else its fill colour; unnamed regions take the `<text>` drawn over them. A layer
  named political, countries, nations, states or borders is read when present; sea and background shapes (named so,
  or covering most of the drawing) are left out. Coordinates are viewBox units, georeferenced like pixels.
- **GeoJSON** (`geojson-engine.ts`): a FeatureCollection whose `crs` names WGS84 (or none); a projected CRS is refused
  unless every coordinate is a valid lon/lat anyway. Non-negative coordinates beyond lon/lat range are read as image
  pixels and georeferenced. The wizard chooses the property holding the nation's name (suggested from `name`,
  `NAME`, `admin`, `sovereignt`…); features with one value are unioned into one region.

### Georeferencing (`georef.ts`)

Precedence: **control points** (three or more, fitted with the SVG calibration helper's Theil-Sen then least-squares
fit, with an RMSE warning over 1°), then **bounds** (a crop), then **whole globe** (warns when the image is not 2:1,
or 1:1 for Mercator). In **Mercator** the vertical axis is linear in Mercator y and the latitude comes from the inverse
Mercator (control points are fitted in Mercator space). The wizard previews the resulting extent
(`mapImport.previewGeoreference`), offers the wiki's capital coordinates as control points, and can save the
georeference as the realm's.

### Colour keys and names

A colour key (CSV: a colour and a name per row in either order, or a name with several colours; JSON:
`{ "#hex": "Nation" }`, `{ "Nation": ["#hex", …] }` or a list of objects) fills the mapping by nearest colour
(`colour-key.ts`). Names are checked against the realm's countries and roster pages with the world editor's matcher
(`nation-name-matching.ts`); unknown names are allowed (a nation claimed later by that name takes the border) and
flagged with close spellings.

### Import this map (from the realm's wiki)

The wiki panel's chosen map (`Realm.settings.map.source`) has **Import this map**: `mapImport.startFromWiki` fetches
the original (`fetchChosenWikiMapOriginal`, refused with CONFLICT when the wiki's file changed since it was chosen),
queues its analysis with the realm's credit line (stored on every imported border) and georeference, and opens the
wizard on it. The wizard shows each nation's locator map from `realms.wiki.infoboxHints` beside its choice.

### Layered SVG pipeline and `importPipelineResult`

The Inkscape SVG pipeline (all layers) stays in Full pipeline (`LayeredSvgPipeline`). `importPipelineResult` is a thin
wrapper over the same writer (`map-import.pipeline.ts`): validated geometry (lines and points accepted on
non-political layers), batched transactions, display names from `properties.name`, a `MapImport` snapshot, and replace
mode retires only the stale features of the layer types it imports. Quick Update (IxWorld's single-layer SVG commits)
is unchanged.

## Viewer Performance

The public viewer (`/maps`, `MapContainer` → `IxWorldMap`, hooks in `src/components/maps/core/hooks/`) keeps pan, zoom and hover free of React renders and redundant worker work. Rules for anyone changing it:

- **No React state per frame.** Hover hit-testing (`useWorldMapInteractions`) is coalesced to one `queryRenderedFeatures` pass per animation frame and never stores the hovered country in state (hover only warms the country-panel query cache). `onZoomChange` fires on `zoomend`, and `MapContainer` keeps the new zoom only when its LOD bucket changes. `IxWorldMap` is memoised and receives only stable callbacks.
- **`setData` only on change.** Zoom-filtered point sources (cities, POIs, story pins, custom map labels) are re-filtered on `zoom` but pushed to the worker only when the filtered feature list differs (`setFilteredSourceData` in `utils/map-core-helpers.ts`). Subdivisions are pushed once per data change. The country-label distance fade (`utils/label-fade.ts`) runs on `moveend` and skips `setData` when no fade changed, which is always the case at globe zoom.
- **Hidden means `visibility: none`.** Base layers that are toggled off (climate, biomes, ice caps, rivers, …) are hidden with layout visibility, not opacity 0, so MapLibre neither tiles nor draws them. The political fill is the exception: it stays at opacity 0 so hover and click still work. Country labels live on one source (`source-country-labels`); there is no generic `source-country_labels`.
- **Level of detail.** `useMapDataBatched` requests the critical bundle without a zoom (the server's mid-zoom LOD, the key `MapPrefetcher` warms) and only asks for the detail bundle at zoom ≥ 7. It no longer refetches a coarser globe bundle after the first zoom. Extra layers (e.g. climate) load one `getWorldMap` query per layer, and once loaded stay loaded, so toggling them is instant.
- **Overlays and style readiness.** Overlay components check `isMapStyleReady()` (`src/lib/maps/geojson-layer-helpers.ts`), not `map.isStyleLoaded()`, which is false whenever any source is re-tiling and made overlays silently skip setup or cleanup mid-pan. `TransportOverlay`'s `styledata` handler is a no-op once its layers exist; it used to call `moveLayer` on every style event, which re-triggered itself and kept the map rendering every frame.
- **Cache invalidation.** `useMapLiveSync` coalesces bursts of `map_data_changed` SSE events into one invalidation (750 ms trailing), and `useMapPrefetch` warms per-country summaries and wiki intros in idle time after the first bundle arrives.

## Map Layers & Stacking Order

MapLibre GL JS renders vector GeoJSON layers. Hydrological layers strictly render **above** political boundaries for correct cartographic presentation:

| Layer | Source File | z-Index | Purpose | Compression Tolerance |
| :--- | :--- | :---: | :--- | :---: |
| `rivers` | `rivers.geojson` | **7** | River linestrings with flow hierarchy | 0.035 |
| `lakes` | `lakes.geojson` | **6** | Freshwater and saline lakes | 0.02 |
| `political` | `political.geojson` | **4** | National borders & sovereign territory fills | 0.008 |
| `climate` | `climate.geojson` | **2** | 12 Trewartha biome zone polygons | 0.05 |
| `altitudes` | `altitudes.geojson` | **1** | 9-zone hypsometric elevation contours | 0.05 |

z-index values are `LAYER_CONFIGS` in `src/lib/maps/map-config.ts`; tolerances are the base `LAYER_COMPRESSION` values in `src/server/api/routers/geo/core/cache.ts` (mid-zoom defaults; `LOD_OVERRIDES` change them for globe and detail zoom).

---

## Map Editor Studio Architecture (`/admin/maps/editor`, `/mycountry/map-editor`, in-place on `/maps`)

The Map Editor (`MapEditorOverlay`, `src/components/maps/editor/`) is a full-screen vector cartography workstation for authoring geography at national, regional, and municipal levels:

### 1. Authoring Toolset & Entity Types
- **Sovereign Boundaries & Territories**: Draw, split, merge, and modify national border polygons with shared-vertex topology locking to prevent border overlap slivers or tears.
- **Sub-National Regions & Provinces**: Partition sovereign territory into administrative subdivisions, states, and cantons with autonomous attribute rollups.
- **Cities & Municipalities**: Place capital cities, industrial hubs, and ports with population weight and review status.
- **Points of Interest (POIs) & Landmarks**: Place historical sites, military fortifications, mountain peaks, canal locks, and natural superlatives.
- **Story Pins & Storylines** (AT-14): the country editor's **Stories** tab (`panels/StorylinesPanel.tsx`) creates, recolours and deletes storylines, adds the country's story pins to one (appended after its last pin), takes them out again, and writes a new event (title, IxTime year, category, text) straight into a storyline at one of the country's cities, POIs, story pins or peaks. It previews the same `StorylineTimeline` the map's story pin modal shows once a storyline has two or more pins. Storyline writes are `geoFeatures.createStoryline` / `updateStoryline` / `deleteStoryline` / `addPinToStoryline` / `removePinFromStoryline` (`geo/features/storylines.ts`; owner of the country or privileged, `assertOwnCountry` plus `findFirst({ id, countryId })`; deleting a storyline keeps its pins). `createStoryPin` / `updateStoryPin` refuse a `storylineId` from another country. These writes bypass the editor's undo history.
- **Transit & Trade Corridors**: Friction-weighted pathfinding generating realistic highway, rail, and maritime shipping routes following terrain contours.

### 2. Precision GIS & Vertex Snapping Model
- **Polygon Snapping**: Snaps vertices to neighboring borders, coastlines and rivers (per-layer snap toggles, `src/lib/maps/editor-prefs.ts`), with shared-edge cascading (`src/lib/maps/topology-engine.ts`) maintaining topological correctness.
- **Copy-on-Write Polygon Updates (`border-editor.ts`)**: `cloneRingsWithTarget` avoids full geometry deep-clones during 60fps drag operations.
- **Two-Phase Hit-Testing (`src/components/maps/editor/utils/hit-test.ts`)**: Exact point selection wins, polygon containment second, grab-assist over empty space only.
- **Nominal Coordinate Typing (`src/types/maps/editor-domain.ts`)**: TypeScript nominal types (`Lng`, `Lat`, `GeoPoint`, `ScreenPoint`) prevent axis-inversion coordinate bugs.
- **Import / export**: Province SVG/PNG import in the editor (`province-importer/`); a realm's whole political map from PNG/JPEG, SVG or GeoJSON through the [realm map import](#realm-map-import-engine), and layered Inkscape SVGs through the admin Import Pipeline (`/admin/maps` → `PipelineWizard`). The editor's Settings menu imports a GeoJSON file (points → cities, or POIs when the feature has a `category`; polygons → regions; lines are skipped) and exports every feature as a GeoJSON FeatureCollection (`src/hooks/map-editor/editor-geo-ops.ts`). An import is one undo step. There is no SVG export.

### 3. Editing Model: Undo, Drafts, Confirmations
- **Every write is undoable.** Creates, deletes, attribute edits, point drags and arrow-key nudges (a burst of nudges is one save), region reshapes with their topology-cascaded neighbours, duplicates, merges/splits, bulk delete/edit, the city placement tools and GeoJSON imports all land on the history stack (`useMapHistory`, 50 steps). Multi-feature operations record one `"batch"` action. `useHistoryReversalExecutor` replays actions as **partial** patches (only the recorded fields are sent) and keeps an id alias map, because re-creating a deleted feature gives it a new id. Undo/redo run one at a time and close any open vertex/path edit first.
- **Region reshaping** (select a region → drag vertices, click a midpoint to add, right-click/Backspace to remove) saves through `geoFeatures.updateSubdivision` with `cascadedNeighbors`, writing only the neighbours whose shared vertices actually moved. "Done" saves only when something changed; "Cancel" restores the neighbours.
- **Tools that were stubs now work:** route and river drawing collect clicks (Enter finishes a route), the split-region tool draws a line and splits into "A"/"B" pieces, scatter cities, regional capitals for regions with no city ("Auto-Create Cities" while gaps are highlighted, `H`), snap city to region border / coastline (the `background` landmass layer, within 3°), bulk edit of region type/level/colour/government type (colour and government type go through `countryGeo.upsertSubdivision`), and the gap / empty-region overlay. Union keeps the merged shape and deletes the others; subtract and intersect reshape the first region and keep the rest.
- **Drafts:** an unsaved placement or drawing (placed point, closed shape, route waypoints, river path) is mirrored to `localStorage` per country and offered back when the editor reopens (`useEditorDraft`). Saved edits need no draft — they are on the server already.
- **Leaving:** the status bar shows Saving… / Unsaved / Saved *n* ago and the last error; the exit button asks before discarding unsaved work, and the browser warns on reload/close while work is unsaved.
- **Confirmations** use a themed AlertDialog (`EditorConfirmDialog`) instead of `window.confirm`; deleting from the Delete key, context menu, inspector, tool bar or header always asks and says the delete can be undone.
- **Keyboard:** one listener in `useMapEditorOverlayState` owns undo/redo, selection (Ctrl+A / Ctrl+D / Ctrl+J duplicate), Delete, Enter, Escape (close menu → cancel drawing → clear selection → leave tool → exit), `G` grid, `H` gaps, `F` panels, `I` import, `?` shortcut sheet, and the border editor's `V P X M T B`; tool letters (`V M C P K T Y R J U`) go through the plugin provider. The shortcut sheet lists exactly what is wired.
- **Wiki tab** (country editor): scans unlinked features against IxWiki search, links the best match in one click and lists map-vs-infobox conflicts (`WikiScannerPanel`, `useWikiScanner`).

### 4. Performance Model
- **Pointer work never re-renders the editor.** Cursor position, hovered feature, terrain-at-cursor and zoom live in `transientMapStore`, which notifies at most once per animation frame; only leaf components (status bar, hover tooltip, elevation HUD) subscribe. Hover hit-testing (`queryRenderedFeatures`), the lasso/marquee outline and cascade previews during a vertex drag are all frame-batched and drawn straight into their GeoJSON sources.
- **Layers upload only on real change.** `useMapLayers` keys feature uploads on the features array and the visibility *values*; opacity is a paint-property effect. The overlay passes memoised layer props, and the plugin context is stable (plugins read `context.state` through a getter), so map listeners are not re-registered on unrelated renders.
- **Rulers** re-render on map move in their own component (`EditorRulers`), so they track the camera without re-rendering the map.
- **Feature queries** are invalidated through one debounced call per burst (features + routes only; the country border and linkage are not refetched after feature edits).
- **Phones** mount the bottom sheet only (and only once there is something to fill in); desktop never mounts the hidden sheet, and phones never mount the docked panels.

---

## Pluggable Overlay Framework (`OVERLAY_REGISTRY`)

The overlay architecture (`src/lib/maps/overlay-registry.ts`) enables declarative, pluggable map overlays powered by `geojson-layer-helpers.ts`:
1. **Fill Overlays** (Mutually Exclusive): Recolor political boundaries — wealth, population, economic tier, vitality, health, trade balance, canon density (`ChoroplethOverlay`) and crises (`RiskHeatmapOverlay`).
2. **Feature Overlays** (Combinable): Cities, POIs, subdivisions, story pins and map labels (visibility toggles rendered by `IxWorldMap`).
3. **Analytics Overlays** (Combinable): Diplomacy (`GeopoliticalOverlay` showing alliances, embassies, conflict hotspots) and transport networks (`TransportOverlay`).

---

## MyCountry Tier-0 Single Source of Truth

Geography serves as the foundational data source across the platform:
- **Spatial Boundaries**: `MapLayer` plus the cached geometry columns on `Country` (`src/lib/country-geo/sync.ts`) and `BorderHistory` are authoritative for geometry, area, centroid and bounding box. `Territory` is used only by the demo seed. Adjacency is computed live with PostGIS `ST_Touches`.
- **Settlements**: `City`, `Subdivision`, `PointOfInterest`, `StoryPin`, `Storyline`, `MapLabel` foreign-key linked to `Country.id` (a realm label has no country and names its realm instead).
- **Admin lock**: `editableByOwner: false` on a subdivision, city, peak, named river or lake stops its country's owner from changing or deleting it (`geoFeatures` update/delete, `countryGeo` upserts of an existing row and `populateFromWiki`, topology cascades; an owner's batch simplify skips it). Admins can always edit (`server/shared/map-feature-lock.ts`). No UI sets the flag yet.
- **Attribute Rollups**: `hybrid` (default), `top-down`, and `bottom-up` rollup modes aggregate population and GDP only. Bottom-up overwrites the national figures, and with no approved subdivisions it falls back to the sum of city populations.

---

## Geo API Routers (`src/server/api/routers/`)

- `geo/core/` (`geoCore`) – World map geometry and bundles, country geometry/neighbors, point lookups, geo profiles, overlays, border history, and area/profile recalculation
- `geo/features/` (`geoFeatures`) – Cities, POIs, subdivisions, story pins and storylines (`getCountryStorylines`, storyline CRUD, add/remove pins), map labels, and named superlatives (`createPeak`, `createNamedRiver`, `createNamedLake`)
- `geo/editor/` (`geoEditor`) – Border editing mutations, split/merge, linkage, the spatial submission review queue, the map pipeline (`runPipeline`, `importPipelineResult`, realm-targeted) and the realm map import (`mapImport.*`)
- `geo/admin/` (`geoAdmin`) – SVG uploads, province and city imports (the province and city imports are country-owner procedures, not admin-only)
- `geo/sovereignty.ts` (`geoSovereignty`), `geo/wiki.ts` (`geoWiki`) – Sovereignty relations; wiki intros/infobox lookups for features
- `countryGeo.ts` – Geo bundles and compliance, `sampleTerrainAt`, settlement upserts (`upsertCity`, `upsertSubdivision`), rollup mode, and wiki population
- `transport/` – Friction-based transit corridor generation, route CRUD, travel-time and national mobility queries
- `realms/` (`realms`) – Realm lookup, nation claims and the claims review queue (see [Realms](../architecture/realms-framework-spec.md)); `realms.map` serves a realm's map display and settings and recomputes its areas ([Realm maps](#realm-maps))

---

## Related Documentation

- [Oceanography Report](../reference/oceanography-report.md)
- [Autosave Architecture](../architecture/autosave.md)
- [Framework Specification (Realms)](../architecture/realms-framework-spec.md)
- [API Reference: Maps & Geography](../reference/api-complete.md#maps--geography)
