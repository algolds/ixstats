# Atlas and World Studio: admin overhaul

Status: approved by the owner on 2026-10-12 ("execute" after the grilling summary). Replaces the admin page at
`/admin/maps` ("Atlas world map", `WorldStudioPanel`) and the editor's World tab sandbox
(`/admin/maps/editor?sandbox=1`) with two surfaces: **Atlas**, the admin home for every realm's map, and **World
Studio**, a full-screen tool for designing worlds.

## Owner decisions

| Topic | Decision |
|---|---|
| Shape | Two surfaces, one spec, built together. Studio is a mode inside Atlas (`/admin/maps/studio`), no sidebar entry |
| Studio jobs | Explore and calibrate; save presets; apply to realms; export |
| Studio shell | Its own full-screen page: parameter rail (left), map (centre), inspector tabs (right): Layers, Calibration, Presets, Ship |
| Studio tools | Every generator parameter, grouped by stage; diagnostic layers. No side-by-side compare, no seed sweep |
| Regeneration | Automatic on release, re-running only from the changed stage onward |
| Calibration | Measured live from any realm's stored map (Ixnay and Eurth by default) |
| Presets | Recipes only (no seed). Every preset editable, the three built-ins included (they move into the database). Draft, publish, restorable versions |
| Apply | Any non-Ixnay realm under founder rules; Ixnay with ticked physical layers (never land, borders or nations); a new realm from a world (unlisted draft owned by the admin, handed over later) |
| Exports | GeoJSON layers (zip) and a PNG render |
| Atlas | Opens on the realm overview under a health strip; tabs Realms, Jobs, Edit queue, Map style; a realm page with its map settings and actions |
| Realm actions | Open in editor or Studio; rebuild relief and run steps; roll back the last import; refresh caches |
| Kept | Realm map import wizard; edit queue |
| Removed | Layered SVG pipeline; SVG uploader; the old Settings tab (its statistics become per-realm figures); the editor sandbox |
| Old models | `ProceduralWorld`, `WorldTemplate` and `Realm.templateId` dropped outright |

## Global constraints

- Site admins only, behind the existing guards: `src/app/admin/layout.tsx` (client), `src/proxy.ts` (edge) and
  `adminProcedure` (server). Founder-facing reads of published presets use the founder's existing realm-map access.
- bun only; no new dependencies (zip and PNG are written with platform APIs and a small pure zip writer).
- Never `tsc --noEmit`, `bun run check` or a build. Gates are `typecheck:*`, Jest and oxlint.
- Never touch production. Schema ships as `prisma/schema/*.prisma` edits plus one idempotent SQL file, also wired into
  `scripts/deploy-production.sh` and `scripts/setup/bootstrap-dev-db.ts`.
- Facet: primitives from `src/components/ui/` only, `iconoir-react`, semantic tokens, Maps tint; sentence case; no
  em dashes, uppercase labels, emoji, eyebrows, glows or `hover:scale`.
- No `any`/`unknown`; complexity under 22; no new file over 700 lines (components about 500); zero dead code.
- Do not change versions, `buildVersion`, the changelog or revision docs.

## World Studio

### Route and shell

`/admin/maps/studio`, a real Next route rendered full screen like `/admin/maps/editor`: added to the pathname check
in `src/app/admin/layout.tsx` and to `CHROMELESS_PREFIXES` in `src/lib/navigation/app-sections.ts`. A top bar holds
"Back to Atlas", the preset picker, seed with reroll, and the draft status. Below a phone width the page shows a
short notice ("World Studio needs a wider screen") instead of the tool.

```
┌ ← Atlas   World Studio   [Preset ▾]  seed 7 ⟳   Draft · 0.4 s ┐
├ Parameters ─┬──────────── map ────────────┬ Layers │ Calibration │
│ Mesh      ▾ │                             │ Presets │ Ship       │
│ Land      ▾ │   preview + relief +        │                    │
│ Climate   ▸ │   diagnostic overlays       │                    │
│ Nations   ▸ │                             │                    │
│ Output    ▸ │                             │                    │
└─────────────┴─────────────────────────────┴────────────────────┘
```

### Source

Preset (any published or draft preset) or **Fit to a realm's map** (pick any realm with a political layer). The fit
source loads that realm's background, political and altitudes layers and generates around them (`keepBorders`), as
the founder's "This realm's map" does. Ixnay is selectable here, because applying to Ixnay requires it.

### Parameter rail

Every `WorldGenParams` field, grouped by the stage that reads it. Each control shows its range, the preset's value,
and a reset; each group has "Reset group". Ranges come from the bounded zod schema in
`src/lib/maps/import/world-bundle.ts`.

| Group | Fields |
|---|---|
| Mesh | `cellCount`, `lloydIterations` |
| Land | `plateCount`, `oceanPercentage`, `continentCount`, `continentLatitudeRange`, `continentSizeVariance`, `islandShare`, `polarLand`, `terrainRoughness`, `coastlineComplexity`, `hypsometry` (9 zones) |
| Climate | `temperatureOffset`, `precipitationScale`, `riverDensity`, `lakeCoverage`, `hasRivers`, `hasLakes` |
| Nations | `countryCountRange`, `useMarkovNaming`, `developmentLevel` |
| Output | `hasIcecaps` |

Sliders commit on release (and once per key press burst), never on every drag tick.

### Staged generation

The generator becomes an explicit pipeline of stages with a cache of the world graph after each restart point:

| Stage | Runs | Reads |
|---|---|---|
| mesh | `createMesh` (already cached by `MeshCache`) | seed, `cellCount`, `lloydIterations` |
| land | tectonics, terrain, coastlines | seed, Land fields, land mask |
| climate | hydro-climate | Climate fields |
| nations | politics, slots and baseline | seed, Nations fields, keep-borders |
| output | export | `hasIcecaps` |

A changed field restarts the run at the first stage that reads it; earlier stages come from the cache (snapshots of
the graph arrays that later stages mutate, held in the worker, at most the latest snapshot per stage). Every stage
already seeds its own random stream from `seed + offset`, so a restarted run is identical to a full run; a test pins
that equality for every stage. Founders' World tab uses the same worker, so their slider changes get faster too.

Targets on this machine at default size (eurth preset, bun): Climate change ≤ 250 ms, Nations change ≤ 250 ms,
Output change ≤ 150 ms, Land change ≤ 0.6 s, Mesh change and first generation ≤ 1.0 s. The `perf:atlas` bench gates
them.

### Diagnostic layers

Rendered in the worker as equirectangular images, shown as image sources under the political layer, one at a time
plus the overlays below: **Height**, **Temperature**, **Rainfall**, **River flow**, **Cells** (Voronoi edges), each
with a small legend; **Nation seeds** as points (each nation's capital cell). Toggling a diagnostic never regenerates
the world; the worker renders it from the cached graph.

### Calibration

One pure grid sampler (`measureWorld`, 0.5° grid, the method the presets were tuned with) measures a world's layers:
land share, hypsometry (9 zones), climate mix by Trewartha group, nation count, nation size median and p90, and
coastline length. The worker runs it on the generated world; the server runs it on a realm's stored map (reading the
`geometry` JSON, never `geom_postgis`, which is wrong for antimeridian rows), caches it by the realm's map version,
and serves it through an admin procedure. The Calibration tab compares the world against one or two chosen realms
(Ixnay and Eurth by default), shows each figure side by side with the gap, and a single "distance" per realm. Climate
encodings are normalised to Trewartha groups (Ixnay stores Trewartha fills, other realms may store Köppen ids).

### Presets

Two new models replace the code-only presets:

- `WorldPreset`: id, slug (unique), name, description, sortOrder, `builtIn` (true for earthlike, ixnay, eurth),
  `publishedVersionId`, `draftVersionId`, `archivedAt`, timestamps.
- `WorldPresetVersion`: id, presetId, params (`Partial<WorldGenParams>`, never a seed), note, createdBy,
  createdAt, `publishedAt` (null for drafts).

Rules: saving in the Studio writes the draft version; **Publish** makes the draft the published version (founders see
it the next time they open the World tab); **Versions** lists every published version with Restore (which creates a
new draft from it). Built-ins can be edited and published like any preset, and have **Reset to factory** (a new draft
from the code values in `WORLD_PRESETS`, which stay in code as factory defaults and test fixtures). New presets can be
created, renamed, reordered and archived; built-ins cannot be archived. The database is seeded idempotently on first
read from `WORLD_PRESETS` (no deploy step). Founders get the published, unarchived presets in order; the founder
draft recipe stores the preset slug, and an unknown slug falls back to earthlike.

### Ship

- **Export GeoJSON**: one zip, a file per layer (political, background, altitudes, climate, rivers, lakes, icecaps),
  written with a small store-only zip writer (pure, tested). File name `world-<preset>-<seed>.zip`.
- **Export PNG**: an equirectangular render at 2048, 4096 or 8192 px wide (ocean, land by height band, rivers and
  lakes, optional political fills and borders, relief), drawn in the worker with `OffscreenCanvas`, downloaded as
  `world-<preset>-<seed>-<width>.png`.
- **Apply to a realm**: pick a realm. Non-Ixnay realms go through the founder flow unchanged (check, diff, apply,
  claim lock, owned and claimed nations protected, map-version guard). Ixnay is allowed only with the **Fit to a realm's
  map** source on Ixnay and a **layer choice**: checkboxes for elevation, climate, rivers, lakes and ice; ticked layers
  replace Ixnay's; land, borders and nations are never written, and no slots are created. The same layer choice is
  available to admins on any realm with the fit source. Relief is rebuilt from the world's cells when elevation is
  ticked.
- **New realm from this world**: name and slug, then one flow creates the realm as `status: "draft"`,
  `visibility: "unlisted"`, owned by the admin, and applies the world (preset source only). The admin hands it over
  later through the existing realm admin.

## Atlas

### Route and layout

`/admin/maps` inside the admin shell, title "Atlas". Header actions: **World Studio**, **Import a map**. A health
strip, then tabs **Realms** (default), **Jobs**, **Edit queue**, **Map style**. `?importJob=<id>` still opens the
import wizard on that job.

### Health strip

Running jobs, failed jobs in the last 24 h, storage used by `MAP_TILE_DIR`, `MAP_RASTER_DIR` and `MAP_IMPORT_DIR`
(measured on the server with a time budget, cached 10 minutes), and the last run of the `map-tiles`, `geo-profiles`
and `map-import` cron jobs from `CronRun`. Each item links to the tab that explains it.

### Realms tab

One row per realm: name and status, layers present (of 7), relief (built, missing, failed), linkage (political
features linked to a country / total), nations (total, owned, open, reserved), pending claims, last job (kind, status,
when), and flags for problems (missing layers, relief missing or failed, last job failed, unlinked features, countries
with invalid stored geometry). Sortable, filterable by status and by "has problems". A row opens the realm page.
The old statistics tiles (features, regions, linked countries, linkage rate) become these per-realm figures.

### Realm page

`/admin/maps/realms/[slug]` inside the admin shell: the realm's figures, its recent jobs, and actions:

- **Open in editor** (`/admin/maps/editor?realm=<slug>`) and **Open in Studio** (fit source on this realm).
- **Rebuild relief** and **Run steps** (the realm map-pipeline panel, `MapPipelinePanel`, moved here from
  `/admin/realms`; `/admin/realms` keeps a link per realm).
- **Roll back last import** (existing rollback rules).
- **Refresh caches** (bumps the realm's map version through `invalidateRealmMap`).

### Jobs tab

Every `MapImportJob` across realms (imports, world checks and applies, pipeline runs, relief builds), newest first,
filterable by realm, kind and status. A job opens a detail sheet (stage, progress, result summary, error). Actions:
**Cancel** (where the job can be cancelled), **Retry** (a failed job is started again as a new job with the same
inputs; a failed world apply restarts from its check), **Roll back** (a succeeded import whose rollback is
available).

### Edit queue and Map style

Edit queue is the existing `EditQueuePanel`. Map style hosts the style editor (theme picker plus the Maputnik frame)
at a fixed height inside the tab, with "Open full screen" linking to the existing `/admin/maps/style-editor`.

### Import a map

Opens the existing `RealmMapImportWizard` (admin picks the realm). The quick Ixnay SVG update and the layered SVG
pipeline are removed with their server procedures where nothing else calls them.

## Removals

- `WorldStudioPanel`, `PipelineWizard` (quick update and layered SVG), `LayeredSvgPipeline`, `SvgUploadManager`,
  `SvgProcessingDialog`, `SvgPreviewMap`, `MapSettingsTab`, `MapStatsDashboard`, and server procedures only they call.
- The editor sandbox: `WORLD_SANDBOX_HREF`, `isWorldSandbox`, the `sandbox` prop chain, `WorldCalibration` in the
  World tab, and the sandbox recipe scope.
- `ProceduralWorld`, `WorldTemplate`, `Realm.templateId` (schema, `server/db.ts` model list, migration test).

## Data and migration

One idempotent SQL file `prisma/migrations/20261023120000_atlas_studio/migration.sql`: create `world_presets` and
`world_preset_versions` (with indexes and foreign keys), drop `procedural_worlds` and `world_templates`, drop
`realms."templateId"`. Wired into `deploy-production.sh` and `bootstrap-dev-db.ts` after `atlas_ra`.

## Failure handling

- Worker crash or timeout: the last good world stays, with Retry (as the founder flow).
- A stage restart that fails falls back to a full run once.
- Calibration measurement failure for a realm: that column says "Could not measure this realm" with the reason;
  the others still show.
- Export failure: an inline error; nothing is downloaded.
- Apply and new-realm failures: the server's reason, mapped to readable copy; a new realm whose apply fails stays as a
  draft and is listed in Atlas with the failed job.
- Health measurements that exceed their time budget show "Not measured" rather than blocking the page.

## Testing

Pure modules with unit tests (stage planner, stage equality, measureWorld, zip writer, PNG layout maths, preset
rules); server services with the existing fakes (presets, calibration cache, admin apply with layer choice, new
realm, jobs list and retry, health); components with Testing Library (rail, inspector tabs, presets, ship, Atlas
tabs, realm page). A browser acceptance run on the `ixstats_wv1` clone: tune and publish a preset and see it in a
founder's World tab; fit to Ixnay and apply climate only; create a new realm from a world; export both formats;
Atlas overview, a realm page action, a job retry.
