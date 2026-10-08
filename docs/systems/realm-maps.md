# Realm maps: bring any realm's map into IxWorld

**Last updated:** 2026-10-07 · Spec: `docs/specs/2026-10-07-eurth-map-port.md` (Phase 5) · Worked example: Eurth
([realms-eurth-onboarding.md](realms-eurth-onboarding.md) §4.7–4.9)

A realm's map in IxWorld is built from its **map pipeline**: one config per realm, kept with the realm
(`Realm.settings.map.pipeline`), filled from a **source preset** or typed in the realm's admin panel, and run as a
**background job**. Nothing realm-specific lives in code: a new community map is a new preset (or settings typed in
the panel), never a new script.

| Piece | Where |
| :-- | :-- |
| Config schema (client-safe zod) | `src/lib/maps/realm-map-pipeline.ts` (art: `realm-map-art.ts`, physical layers: `import/realm-layer-config.ts`) |
| Presets | `src/lib/realms/sources/presets/*.json`, key `mapPipeline` (schema: `presets/index.ts`) |
| Steps | `src/server/modules/maps/realm-map-pipeline.{repair,physical,rasters,steps}.ts` |
| Job | `src/server/modules/maps/realm-map-pipeline.job.ts`, in the map import queue (`map-import.jobs.ts`) |
| Panel API | `realms.mapPipeline.*` (`src/server/api/routers/realms/map-pipeline.ts`, logic `realm-map-pipeline.config.ts`) |
| CLI | `scripts/realms/build-realm-map.ts` (and the per-step wrappers, `scripts/realms/realm-map-cli.ts`) |

## 1. The config

```jsonc
{
  "art": {                                   // named source files; every other field names art by key
    "blank":     { "repoPath": "Blank Map.png" },          // a file of the realm's source-sync repository at its ref
    "geography": { "repoPath": "Overlays/Geography.png" },
    "labels":    { "uploadId": "<sha256>" }                // or a file uploaded through /api/admin/map-import/upload
  },
  "rasters": [                               // raster tile layers (the `rasters` step)
    { "id": "geography", "label": "Geography", "kind": "base", "art": "geography", "legendArt": "legend" },
    { "id": "geography-grey", "label": "Grey", "kind": "base", "art": "geography", "grey": true },
    { "id": "climate", "label": "Climate", "kind": "overlay", "order": 1, "art": "climate-overlay" }
  ],
  "physical": {                              // the PNG layer engine (the `physical` step)
    "land": "blank",
    "climate": { "art": "climate-map", "key": { "art": "climate-key", "system": "Köppen", "zonesBinding": "ZONES" } },
    "ice": { "art": "geography" },
    "elevation": { "art": "geography", "bands": [{ "color": "#a5bb8c", "min": 0, "max": 50 }, …] },
    "rivers": { "art": "geography", "colours": ["#5184c8"] },
    "engine": { "landMaxSum": 720 }          // only the engine settings that differ from the defaults
  },
  "labels": { "art": "labels" },             // or { "source": "…", "labels": [{ "text", "kind", "coordinates", … }] }
  "flags": { "localize": true },
  "defaultView": "auto",
  "coverage": { "tolerance": 0.045, "smooth": 2 }
}
```

- **`art`** (`artSourceSchema`): `{ repoPath }` is read from raw.githubusercontent.com for the realm's source-sync
  repository at its ref (no redirects, 120 s timeout, at most 25 MB: an 8000 × 4000 PNG fits), then kept in
  `MAP_IMPORT_DIR/uploads/<sha256>` like an upload. `{ uploadId }` is a file uploaded through the map import upload
  route (PNG, JPEG, WebP, SVG or GeoJSON; data files such as a label list or `climates.js` go in a repository). Keys
  are lower case letters, digits and hyphens. Every key a step names must exist (the schema refuses the config
  otherwise, at the field that names it); a saved upload must still be in the store.
- **`rasters`**: each a full-globe equirectangular image (2:1). `kind: "base"` layers are alternatives (one shown at
  a time), `overlay` layers are switches drawn in `order`; `legendArt` is the key image shown while the layer is on;
  `grey` builds the grey copy (each pixel its brightest channel). Ids match `^[a-z0-9][a-z0-9-]{0,31}$`.
- **`physical`**: `land` (the blank map, land darker than a white sea) is required; climate (the zone colours, and
  the key typed in as `{ system, zones }` or read as literals from a JS data file of the art, never run), ice, the
  geography map's elevation bands (sampled tints and metres, stored as IxWorld's altitude bands) and river colours
  are each traced when given. `engine` overrides `layerEngineOptionsSchema`
  (`src/lib/maps/import/png/layer-engine-options.ts`).
- **`labels`**: the realm's ocean, sea, region and continent labels, matched by key (`key`, else the text). Without
  it the labels are edited in the map editor only.
- **`flags.localize`**: copy the nations' wiki flags and coats of arms to local files (`public/flags/`).
- **`defaultView: "auto"`**: centre the map on the continent with the most nations (area-weighted centre of their
  borders, longitudes taken round the largest one), at IxWorld's home zoom (1.8). Absent: the view saved in the
  editor stays.
- **`coverage`**: smooth the realm's borders as one coverage (`ST_CoverageSimplify` at `tolerance` degrees, about one
  source pixel: 0.045° on an 8000 px wide globe, then `smooth` rounds of corner cutting), shared edges kept shared.

## 2. Presets

A source preset (`src/lib/realms/sources/presets/<id>.json`, registered in `presets/index.ts`) may carry
`mapPipeline`: the whole config above, art as `repoPath` in the preset's repository. **Load preset** fills the realm's
pipeline the way the source sync's Load preset fills its config: a realm without a pipeline takes all of it; a realm
with one keeps every field it has, takes only the empty ones, and gains the preset's art keys it does not name (its
own art is never replaced); **force** takes every field of the preset. From then on the realm's config is the only
source of truth: editing a preset never changes a realm that loaded it.

For a new community map: copy `eurth-map.json`'s `mapPipeline`, point the art at the new repository's files, sample
the legend's band tints and river colour from the map itself, set `coverage.tolerance` to one source pixel
(360 / image width), and load it. A realm with no repository uploads its art and types the config in the panel.

## 3. Steps

A run takes any of the steps, always in this order. A dry run writes nothing and reports what an apply would change
(`would-change`); a step whose output is already in place reports `unchanged`, and an apply then writes nothing.

| Step | What it does | Writes (apply) |
| :-- | :-- | :-- |
| `repair` | Political borders made valid, overlaps given to one side, smoothed with `coverage` (see §4) | `map_layers` (with a rollback snapshot, `MapImport`), areas, adjacency |
| `physical` | Traces altitudes, lakes, climate, ice and rivers from the art; compares them with the stored features (as the writer would store them, coordinates equal within 1e-9°) | Replaces those layer types as one map import (rollback snapshot), `settings.map.climateKey`, areas |
| `rasters` | Builds each raster layer's tiles (`MAP_RASTER_DIR/<realm>/<layer>/<version>/`); the version is a hash of the art and options | Tiles, `settings.map.rasterLayers`; versions other than the new and the previous one removed. Layers the pipeline does not list are kept |
| `labels` | The label list against the realm's labels | `MapLabel` rows (created or updated; others kept) |
| `flags` | Resolves every non-local flag and arms file on its wiki | `public/flags/<realm>--<country>[--arms].<ext>`, `metadata.json`, `Country.flag/coatOfArms`; a file the wiki confirms missing is cleared |
| `defaultView` | `"auto"` centre (above) against the saved view | `settings.map.defaultView` |
| `areas` | Every active polygon measured on the realm's planet against the stored area | `MapLayer.areaSqKm` |

A step the config does not set up reports `skipped`. A step that fails is recorded with its reason and the run goes
on with the next one; the run is then `failed`, every step's report kept.

## 4. Smoothing is idempotent

Smoothing a smoothed outline rounds its corners again, and the coverage is smoothed as a whole (shared edges stay
shared), so it must always start from every border's **unsmoothed** outline. The writer stamps each smoothed feature
(`properties.coverage = { tolerance, smooth, hash }`, the hash being `md5(geometry::text)` of the stored outline,
written last, after overlap removal; `realm-geometry-repair.ts` `stampLayerCoverage`). The `repair` step
(`src/lib/maps/realm-layer-repair.ts`):

- **Up to date** (every border stamped with these settings and still holding the stamped outline): nothing to do,
  `unchanged`. This is what a second run reports.
- Otherwise the whole layer is smoothed again from each border's unsmoothed outline: the **source's** border when the
  source (its source-sync repository, or the CLI's `--source` checkout) still has the outline the border was written
  from (`properties.sourceHash`); else the border's own outline when it has no stamp or was edited since (a write or a
  map editor stores unsmoothed outlines).
- **Blocked**: a smoothed border with no unsmoothed outline (no source, or the source changed) is never rounded twice:
  the layer is then not smoothed at all, and the report lists the blocked borders.
- Rows whose rings cross ±180° are left out (PostGIS reads them as planar slivers).

The **source sync** applies the realm's `coverage` itself: after an applied run writes borders (raw, which drops their
stamps), it smooths the layer the same way from the source's borders (`realms.source-apply.ts` `smoothBorders`), so
no repair run is needed after a sync.

## 5. Running it

### Admin panel (Map)

`/admin/realms` → **Map** (site admins, any realm) and `/r/<realm>/manage` → **Map pipeline** (the founder and Map officers;
IxWorld stays with site admins; an archived realm is read-only).

#### In the admin panel

The panel (`src/app/admin/realms/_components/map-pipeline/`, `MapPipelinePanel`; the Manage tab shows it as
**Map pipeline**) edits the whole config as a form and saves it as one validated config:

- **No pipeline yet**: one line, then **Load preset** (the presets that carry a map pipeline) or **Start from scratch**.
  A stored config that no longer parses is shown with its reason; loading a preset or saving replaces it.
- **Preset**: Load preset fills the empty fields; **Replace everything** (force) asks first, as does loading over
  unsaved edits.
- **Art files**: name, repository path or upload (through the map import upload route), and which steps read it.
- **Raster layers** (id, label, kind, order, art, legend art, grey; add, remove, reorder), **Physical layers** (land,
  then climate, ice, elevation bands as colour and metres, river colours, each switched on or off; engine settings,
  an empty field keeping the default), **Climate key** (typed zones, or a data file of the art), **Labels** (map editor
  only, a label file, or a typed list; fine edits in the world editor's Realm labels), **Flags**, **Default view**,
  **Border smoothing**.
- Problems show at their field (a malformed art name, art a layer names but the config lacks, a bad colour);
  Save stays off until there are none. Unsaved edits are guarded (closing the tab, switching realm in /admin).
- **Run**: steps as checkboxes (all by default), **Dry run** or **Apply** (confirmed), only from the saved config;
  progress polled every second with Cancel; each step's result as a chip with its summary and expandable details.
  **Run history** lists the last 20 runs (status, dry run or applied, when, who) and opens any one's report.

The panel calls `realms.mapPipeline`:

| Procedure | Input | Returns |
| :-- | :-- | :-- |
| `get` (query) | `{ realm }` (slug) | `pipeline` (or null), `problem` (a stored config that no longer parses), `source` (`{ repo, ref }` repository art is read from, or null), `presets` (those with a map pipeline), `steps` (`{ step, label }` in run order), `built` (`rasterLayers`, `defaultView`, `hasClimateKey`) |
| `save` | `{ realm, pipeline }` (`realmMapPipelineSchema`, or null to remove it) | `{ pipeline }`; refuses art whose upload is gone |
| `loadPreset` | `{ realm, presetId, force? }` | `{ presetId, pipeline, filled, kept }` |
| `start` | `{ realm, steps, dryRun }` | `{ jobId }`; one queued or running run per realm (`CONFLICT` otherwise) |
| `run` (query) | `{ jobId }` | status, progress (0–100), stage (`"<step label>: <stage>"`), error, options, `result` (`{ phase: "pipeline", dryRun, steps: [{ step, status, summary, details[], counts?, ms }], art: { key: sha256 } }`) |
| `runs` (query) | `{ realm, take? }` | last runs, newest first, each step's `{ step, status, summary, ms }` |
| `cancel` | `{ jobId }` | `{ cancelled: true }` |

Uploads go through `/api/admin/map-import/upload` first (its `uploadId` becomes `{ uploadId }` art). Save, preset
loads, run starts and cancels are recorded in `AdminAuditLog` (`REALM_MAP_PIPELINE_*`). Poll `run` while a run is
`queued` or `running`.

### CLI

```bash
bun scripts/realms/build-realm-map.ts --realm <slug>                      # dry run, every step
bun scripts/realms/build-realm-map.ts --realm <slug> --preset <id>        # load a preset first (empty fields; --force: all)
bun scripts/realms/build-realm-map.ts --realm <slug> --steps repair,defaultView,areas --apply
bun scripts/realms/build-realm-map.ts --realm <slug> --source <checkout>  # read repository art from a local checkout
```

It runs the same job in process (under the realm's lease, recorded in the run history as `script:build-realm-map`)
and prints each step's report. The per-step scripts are the same CLI with one step each:
`build-realm-rasters` (rasters), `import-realm-layers` (physical), `repair-realm-geometry` (repair),
`seed-realm-labels` (labels), `localize-realm-flags` (flags).

### The job

A `MapImportJob` of kind `map-pipeline`, options `{ steps, dryRun }`, in the map import queue: one job of a realm at a
time under the lease `map-import:<realmId>` (30 minutes), a running job silent for 10 minutes marked failed (a
restart), cancel honoured at the next progress report. When the `map-import` cron job runs (`CRON_ENABLED_JOBS`), it
takes pipeline runs, applied ones included; the web process then never runs them. Without it the web process runs the
queue in process after a start (fine on a dev box). The physical layer engine runs in a worker thread under Bun (the
cron runner, scripts); tiles are built by sharp, one zoom at a time (about 500 MB for an 8000 px image).

## 6. Bring a new realm's map in

1. Create the realm and its source sync (or not: art can be uploaded).
2. Write its preset's `mapPipeline` (§2) or type the config in the panel; **Load preset**.
3. **Dry run** every step and read the reports (art read, features traced, layers to build).
4. **Apply** physical and rasters (the heavy ones), then labels, flags, defaultView, areas; apply repair after the
   first source sync apply (later syncs smooth on their own).
5. A second dry run must report `unchanged` for every step.

## 7. Production notes

- **`MAP_RASTER_DIR`** (default `data/map-rasters` under the app): the web server serves tiles from it and the cron
  runner (or the CLI) writes it; set the same absolute path for both in the production env file.
- **`MAP_IMPORT_DIR`** (default `.map-imports` under the app): uploads and fetched art, by SHA-256. Web server and cron
  runner must share it (one host: the app directory). Fetched art accumulates there (a few MB per art version).
- **`public/flags`**: the flags step writes `public/flags/` under the process's working directory, but the standalone
  server serves `.next/standalone/public/` (copied at build by `scripts/post-build.sh`) and picks up new files only on
  restart. Run the flags step from the app root (the CLI), then
  `cp public/flags/<realm>--* public/flags/metadata.json .next/standalone/public/flags/` and restart, or run it before
  a deploy. `/public/*` is git-ignored.
- **PostGIS** is needed by `repair` (and by the exact comparisons of `physical`, `defaultView` and `areas`).
- A run applies to the database the process is connected to: on production, run the CLI on the server itself.
