# Realms Platform — Product Requirements Document

**Date:** July 21, 2026
**Status:** Draft — Pending User Review
**Author:** Brainstorming session (user + agent)
**Supersedes:** Partially supersedes [2026-07-20-external-player-onboarding-design-spec.md](file:///home/jxsig/projects/ixstats/docs/superpowers/specs/2026-07-20-external-player-onboarding-design-spec.md) (maps gatekeeping sections)

---

## 1. Vision

Turn IxStates from a single-world platform (IxWorld/Ixnay) into a **multi-tenant worldbuilding and nation simulation platform** where anyone can create their own Realm — a self-contained universe with its own map, countries, simulation engine, and governance.

**IxWorld remains the internal/closed "default" realm** for the Ixnay community. It is *not* the entry point for external users. Realms are the external-facing product. IxWorld is architecturally just `realm="default"` — same code paths, same models, same engine.

### Analogy
> NationStates has regions. We have **Realms** — but with full maps, procedural world generation, and a nation simulation engine that NationStates doesn't have.

---

## 2. Key Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Audience model | **Hybrid** — public realms open with admin approval, private realms invite-only | Balances discoverability with control |
| Simulation scope | **Full sim per realm** — economy, diplomacy, politics, defense run independently per realm | Realms aren't just maps — they're playable worlds |
| Map sources | **Three sources at launch** — Azgaar fork (procedural), image upload (PNG/SVG), blank canvas | Covers all user types: casual, existing-world, scratch |
| Azgaar integration | **Deep fork** — extract generator core, strip UI, render in MapLibre with Facet design system | Quality of Azgaar's generation + full UX control |
| Realm governance | **Full governance model** — founder, delegates, elected positions, voting, constitutions | Goes further than NS regions |
| Cross-realm interaction | **Isolated** — each realm is its own universe, no cross-realm diplomacy/trade | Simplifies architecture, avoids balancing nightmares |
| Realm navigation | **Realm-scoped URL pattern** — `/realms/[slug]/maps`, `/realms/[slug]/mycountry`, etc. | Clean, shareable, direct-linkable |
| Territory claiming | **Click-to-claim on map** — click unclaimed polygon → fill nation details → submit for admin approval | Intuitive, map-first experience |
| Monetization | **Not a concern now** — build first, monetize later | Focus on product-market fit |

---

## 3. Architecture Overview

### 3.1 Five Subsystems

```
┌─────────────────────────────────────────────────────────────┐
│                      REALMS PLATFORM                        │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│  World   │   Map    │  Claim   │  Realm   │   Governance   │
│  Studio  │ Pipeline │  System  │  Engine  │   & Members    │
│          │          │          │          │                │
│ Creation │ 3 sources│ Click to │ Per-realm│ Founder, roles │
│ wizard   │ → unified│ claim,   │ sim:     │ delegates,     │
│ at       │ GeoJSON  │ admin    │ economy, │ voting,        │
│ /realms/ │ → enrich │ approval │ politics,│ constitution   │
│ create   │ → commit │ queue    │ defense  │                │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
```

### 3.2 Routing Architecture

```
/realms                             → Realm discovery / browse
/realms/create                      → World Studio wizard
/realms/[slug]                      → Realm landing page
/realms/[slug]/maps                 → Realm map viewer
/realms/[slug]/mycountry            → Player's country dashboard
/realms/[slug]/mycountry/editor     → Map editor (per-country)
/realms/[slug]/diplomacy            → Diplomacy hub
/realms/[slug]/defense              → Defense dashboard
/realms/[slug]/politics             → Politics dashboard
/realms/[slug]/intelligence         → Intelligence dashboard
/realms/[slug]/admin                → Realm admin panel
/realms/[slug]/settings             → Realm settings & governance
/realms/[slug]/members              → Member directory
/realms/[slug]/join                 → Join / apply page
```

Existing IxWorld routes (`/maps`, `/mycountry`, `/diplomacy`, etc.) continue to work — they resolve to `realm="default"` implicitly via middleware.

### 3.3 Data Isolation

Every tRPC query gets a `realmId` filter. The existing schema already has the scaffolding:

| Model | Existing Field | Notes |
|-------|---------------|-------|
| `Country` | `realmId` (defaults `"default"`) | Already exists, FK to Realm |
| `MapLayer` | `worldId` (defaults `"default"`) | Rename/alias to `realmId` for consistency |
| `TransportRoute` | `worldId` (defaults `"default"`) | Same |
| `TransportHub` | `worldId` (defaults `"default"`) | Same |
| `SharedVertex` | `worldId` (defaults `"default"`) | Same |
| `Realm` | Model exists | slug, name, ownerId, status, visibility, settings |
| `WorldConfig` | `realmId` (nullable) | Links to Realm |

Models that need `realmId` added: `Territory`, `BorderHistory`, `Subdivision`, `City`, `PointOfInterest`, `StoryPin`, `Storyline`, `MapLabel`, `CountryGeoProfile`, `GeographicResource`, `Peak`, `NamedRiver`, `NamedLake`, `MapEditRequest`, `MapEditorSession`.

> **Note:** These don't strictly *need* a direct `realmId` since they all FK to `Country` which has `realmId`. But for query performance (avoiding joins), the high-traffic models (`MapLayer`, `City`, `Subdivision`) should have a denormalized `realmId`.

---

## 4. World Studio — Realm Creation Wizard

**Route:** `/realms/create`

A multi-step creation flow — the first 5 minutes for an external user.

### 4.1 Wizard Steps

```
Step 1: Basics         → Name, slug, description, visibility (public/private/unlisted)
Step 2: Map Source     → Choose: Generate / Upload / Blank
Step 3: Map Config     → Source-specific configuration (see §5)
Step 4: World Settings → Climate system, elevation zones, time system, projection
Step 5: Governance     → Founder role, initial delegate slots, invite settings
Step 6: Review & Launch → Summary, confirm, generate/commit
```

### 4.2 Step 2: Map Source Selection

Three cards with preview thumbnails:

| Source | Label | Description |
|--------|-------|-------------|
| `azgaar` | **Generate a World** | Procedurally create continents, countries, rivers, and climate. Customize terrain style, land coverage, and number of nations. |
| `upload` | **Upload Your Map** | Have an existing world map? Upload a PNG or SVG and we'll convert it into an interactive, playable world. |
| `blank` | **Draw from Scratch** | Start with an empty globe and draw your own continents, borders, and features. |

### 4.3 Step 3: Source-Specific Configuration

**For `azgaar` (procedural generation):**

| Parameter | Control | Default | Range |
|-----------|---------|---------|-------|
| Seed | Text input + randomize button | Random | Any integer |
| Map size | Slider | Medium (10,000 cells) | 5K–50K cells |
| Land coverage | Slider | 35% | 15%–65% |
| Number of countries | Slider | 12 | 3–60 |
| Terrain style | Preset cards | Continents | Continents, Archipelago, Pangaea, Island Chains, Realistic |
| Climate bias | Preset cards | Temperate | Tropical, Temperate, Arctic, Mixed |
| Has rivers | Toggle | Yes | — |
| Has lakes | Toggle | Yes | — |

Live preview: as user adjusts parameters, a low-res preview generates in a Web Worker and renders in a mini MapLibre viewport.

**For `upload` (image conversion):**

| Step | Description |
|------|-------------|
| Upload | Drag-and-drop PNG/SVG (max 50MB). Accepts Inkscape SVGs with layer groups, plain PNGs, or Azgaar FMG exports. |
| Auto-detect | System runs color segmentation (PNG) or layer detection (SVG) to identify countries/regions. Shows detected regions with editable names. |
| Province importer | If auto-detect isn't sufficient, user can use the existing province importer wizard (Upload → Names → Align → Snap → Validate → Commit) to manually refine boundaries. |
| Georeferencing | User positions the map on a globe projection — drag corners to define geographic extent, mapping pixel coords to lat/lng. |

**For `blank` (draw from scratch):**

Opens Forge Mode editor (existing `MapEditorOverlay` + `EditorMap` components) adapted for realm creation — user draws landmasses, then subdivides into countries.

---

## 5. Map Pipeline — Three Sources → One Schema

### 5.1 Pipeline Overview

```
┌─────────────────────┐     ┌──────────────────┐     ┌──────────────────────────┐
│  Source A: Azgaar    │     │                  │     │  OUTPUT (per realm)      │
│  (forked generator)  │────▶│                  │────▶│  MapLayer (7 layer types)│
├─────────────────────┤     │   Normalizer +   │     │  Country records         │
│  Source B: Upload    │────▶│   Enrichment     │────▶│  City records            │
│  (PNG/SVG)           │     │   Pipeline       │     │  Subdivision records     │
├─────────────────────┤     │                  │     │  CountryGeoProfile       │
│  Source C: Blank     │────▶│                  │────▶│  GeographicResource      │
│  (draw from scratch) │     │                  │     │  TransportRoute/Hub      │
└─────────────────────┘     └──────────────────┘     │  SharedVertex            │
                                                      │  NamedRiver/Lake/Peak    │
                                                      └──────────────────────────┘
```

### 5.2 Source A: Azgaar Fork

**Integration approach:**
1. Fork [Azgaar/Fantasy-Map-Generator](https://github.com/Azgaar/Fantasy-Map-Generator) (MIT license)
2. Extract the generator core (`modules/` directory — ~30,000 lines covering Voronoi mesh, heightmap, rivers, climate, cultures, settlements, states)
3. Strip the D3-based UI completely — we render in MapLibre with Facet design system
4. Wrap as a **Web Worker** for non-blocking generation
5. Expose parameters via World Studio controls (§4.3)

**Normalization mapping (Azgaar → IxStates):**

| Azgaar Concept | IxStates Model | Notes |
|----------------|---------------|-------|
| State | `Country` | With `realmId`, skeleton data (name, color, area) |
| Province | `Subdivision` | Level 1 subdivisions |
| Burg (town/city) | `City` | With coordinates, population, capital flag |
| Biome | `MapLayer(layerType="climate")` | Mapped to Trewartha zones |
| Heightmap cells | `MapLayer(layerType="altitudes")` | Classified into 9 elevation zones |
| River | `MapLayer(layerType="rivers")` + `NamedRiver` | Geometry + named record |
| Lake | `MapLayer(layerType="lakes")` + `NamedLake` | Geometry + named record |
| Coastline | `MapLayer(layerType="background")` | Ocean/land boundary |
| Culture | `Country.settings` or `Realm.settings` | Culture metadata for NPC/naming |

**Relationship to existing worldgen engine:**

The existing [src/lib/worldgen/](file:///home/jxsig/projects/ixstats/src/lib/worldgen) (13 files, ~106KB) is already Azgaar-inspired (same pipeline: Voronoi → heightmap → features → rivers → climate → cultures → settlements → states → validate → export). The Azgaar fork **replaces** this with the real thing — higher fidelity, battle-tested algorithms. The existing engine becomes deprecated once the fork is production-ready.

### 5.3 Source B: Image Upload

Combines two existing systems:

**Path 1 — Auto-detection:**
1. Upload PNG/SVG (existing dropzone in province importer)
2. **PNG path:** [png-to-svg.ts](file:///home/jxsig/projects/ixstats/src/lib/png-to-svg.ts) runs color segmentation → detects regions by color → traces boundaries
3. **SVG path:** [svg-layer-detector.ts](file:///home/jxsig/projects/ixstats/src/lib/province-importer/svg-layer-detector.ts) (26KB) detects Inkscape layer groups, [svg-preprocessor.ts](file:///home/jxsig/projects/ixstats/src/lib/province-importer/svg-preprocessor.ts) (18KB) normalizes transforms
4. [svg-parser.ts](file:///home/jxsig/projects/ixstats/src/lib/svg-parser.ts) (1,328 lines) converts to GeoJSON with bezier flattening + affine coordinate mapping
5. Auto-match detected regions to create Country records (name matching, user confirmation)

**Path 2 — Province importer (manual refinement):**

The existing 6-step province import wizard ([ProvinceImportWizard](file:///home/jxsig/projects/ixstats/src/components/maps/editor/province-importer/ProvinceImportWizard.tsx)):

| Step | Component | What it does |
|------|-----------|-------------|
| Upload | [UploadStep](file:///home/jxsig/projects/ixstats/src/components/maps/editor/province-importer/UploadStep.tsx) | SVG/PNG dropzone, scope picker (provinces, cities, or both) |
| Names | [NameDetectionStep](file:///home/jxsig/projects/ixstats/src/components/maps/editor/province-importer/NameDetectionStep.tsx) | Auto-detected names from SVG text labels, editable |
| Align | [AlignmentStep](file:///home/jxsig/projects/ixstats/src/components/maps/editor/province-importer/AlignmentStep.tsx) | ICP auto-align + reference points + manual transform |
| Snap | [SnapPreviewStep](file:///home/jxsig/projects/ixstats/src/components/maps/editor/province-importer/SnapPreviewStep.tsx) | Snap imported boundaries to existing borders |
| Validate | [ValidationStep](file:///home/jxsig/projects/ixstats/src/components/maps/editor/province-importer/ValidationStep.tsx) | Topology validation — gaps, overlaps, coverage |
| Commit | [CommitStep](file:///home/jxsig/projects/ixstats/src/components/maps/editor/province-importer/CommitStep.tsx) | Write to database |

**Extension needed:** The importer currently targets `Subdivision` records within an existing country. For realm creation, extend it to also target `Country` + `MapLayer` records within a new realm — same pipeline, different commit target.

### 5.4 Source C: Blank Canvas

Opens the existing Forge Mode editor ([MapEditorOverlay](file:///home/jxsig/projects/ixstats/src/components/maps/editor/MapEditorOverlay.tsx) + [EditorMap](file:///home/jxsig/projects/ixstats/src/components/maps/editor/EditorMap.tsx)) in realm-creation mode:
- 7 editor tools: Select, City, Region, POI, Route, Import, Paint
- Border editor: vertex editing, split/merge, snapping
- Grid overlay, coordinate display, undo/redo

### 5.5 Enrichment Pipeline (Shared for ALL Sources)

After any source produces raw geography, this pipeline runs to make the realm *playable*:

```
Raw geography (polygons, coastlines)
  │
  ├── 1. CLIMATE SIMULATION (if not provided by source)
  │   Latitude + elevation + ocean proximity → Trewartha (12 types)
  │   Output: MapLayer(layerType="climate")
  │
  ├── 2. ELEVATION CLASSIFICATION (if not provided)
  │   Heightmap → 9 elevation zones
  │   Output: MapLayer(layerType="altitudes"), Peak records
  │
  ├── 3. HYDROLOGY (if not provided)
  │   River generation, lake placement, coastlines
  │   Output: MapLayer(layerType="rivers/lakes"), NamedRiver, NamedLake
  │
  ├── 4. COUNTRY GEO PROFILES
  │   PostGIS: country geometry × climate/altitude layers
  │   → Climate distribution, elevation profile, arable %, coastline,
  │     landlocked?, GDP/trade/infra modifiers
  │   Output: CountryGeoProfile records (1:1 per Country)
  │
  ├── 5. RESOURCE PLACEMENT
  │   Terrain + climate → minerals, fisheries, forests, oil, agriculture
  │   Output: GeographicResource records per country
  │
  ├── 6. TRANSPORT SEED
  │   Capital-to-capital routes, port connections, road/rail
  │   Output: TransportRoute + TransportHub records
  │
  ├── 7. SHARED VERTICES
  │   Border-sharing graph for synchronized editing
  │   Output: SharedVertex records
  │
  └── 8. ATOMIC COMMIT
      All layers + entities in a single transaction
      All scoped with realmId/worldId
```

### 5.6 Manual IxWorld Steps → Automated Realm Pipeline

| # | IxWorld (Manual) | Realm (Automated) |
|---|-----------------|-------------------|
| 1 | Hand-draw 7 SVG layers in Inkscape | Azgaar generates all 7 layers OR upload pipeline extracts them |
| 2 | Admin uploads each SVG via `/admin/maps` | Pipeline processes all sources in one flow |
| 3 | Admin triggers processing, fixes coordinate mapping | Auto-calibration or Azgaar's native coordinates |
| 4 | Admin manually maps featureIds → Country records | Countries auto-created from Azgaar states OR auto-detected from upload |
| 5 | Admin commits each layer separately | All layers committed atomically |
| 6 | Player imports provinces via 6-step wizard | Same wizard, reused for realm-level country imports too |
| 7 | Admin runs PostGIS geo profile computation | Auto-computed in enrichment pipeline |
| 8 | Resources manually assigned | Auto-generated from geo profiles |
| 9 | Countries created one-by-one via admin panel | Skeleton countries from source; players flesh out via claim |
| 10 | Shared vertices built on map import | Auto-built in pipeline |

---

## 6. Claim System — Click-to-Claim

### 6.1 Player Flow

```
Player opens /realms/[slug]/maps
  → Sees world map with unclaimed territories highlighted (dashed borders, muted fill)
  → Clicks an unclaimed territory polygon
  → Slide-out panel appears:
     ┌────────────────────────────────┐
     │  Claim This Territory          │
     │                                │
     │ Territory: [auto-detected name]│
     │ Area: 245,000 km²              │
     │ Climate: Subtropical Humid     │
     │ Terrain: Coastal Lowlands      │
     │                                │
     │ ── Your Nation ──              │
     │ Name: [________________]       │
     │ Government: [dropdown]         │
     │ Capital: [auto-suggested]      │
     │ Flag: [upload / generate]      │
     │                                │
     │ [Submit Claim for Review]      │
     └────────────────────────────────┘
  → Claim submitted → realm admin reviews
  → Approved: Country created, player linked, MyCountry unlocked
  → Rejected: Player notified with reason, can re-claim
```

### 6.2 Claim Status Flow

```
unclaimed → pending_claim → approved → active
                         → rejected → unclaimed (territory released)
```

### 6.3 Data Model Extension

```prisma
model TerritoryClaim {
  id                String   @id @default(cuid())
  realmId           String
  mapLayerFeatureId String   // The unclaimed MapLayer political feature
  userId            String   // Clerk userId of claimant
  nationName        String
  governmentType    String?
  capitalName       String?
  flagUrl           String?
  details           Json?    // Additional nation details
  status            String   @default("pending") // pending, approved, rejected
  reviewedBy        String?
  reviewedAt        DateTime?
  rejectionReason   String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  realm             Realm    @relation(fields: [realmId], references: [id])

  @@unique([realmId, mapLayerFeatureId, status])
  @@index([realmId, status])
  @@index([userId])
  @@map("territory_claims")
}
```

On approval: system creates `Country` record from `MapLayer` geometry + claim details, links user, bootstraps initial economic data.

---

## 7. Realm Governance

### 7.1 Role Hierarchy

| Role | Permissions | Assignment |
|------|------------|------------|
| **Founder** | All permissions. Cannot be removed. Transfer only. | Auto-assigned to realm creator |
| **Delegate** | Manage members, approve claims, edit world config, moderate | Appointed by founder or elected |
| **Officer** | Approve claims, moderate disputes, manage events | Appointed by founder/delegate |
| **Member** | Claim territory, play simulation, vote in elections | Joins realm |
| **Visitor** | View map, browse realm info | Anyone (public realms) |

### 7.2 Governance Features (Future Phases)

- **Realm elections** — delegate positions can be elected by members
- **Voting** — realm-wide polls and referendums
- **Constitution** — markdown document defining realm rules
- **Moderation** — dispute resolution, territory arbitration

### 7.3 Realm Membership

**Public realms:** User browses `/realms` → clicks "Join" → auto-joined as Member (or pending approval) → opens map → clicks unclaimed territory → submits claim → admin approves

**Private realms:** Founder generates invite link → invited user clicks → joins as Member → same claim flow

---

## 8. Realm Engine — Per-Realm Simulation

Each realm runs an independent instance of the IxStats simulation engine. Since `Country.realmId` already exists, the main work is ensuring every query filters by `realmId`.

### 8.1 What Each Realm Gets

| System | Description |
|--------|-------------|
| Economy | GDP, population, growth, inflation, trade, tax, sectors |
| Government | Government type, departments, budget, spending |
| Diplomacy | Bilateral relations, treaties, embassies, alliances |
| Defense | Military, border security, threat assessment |
| Intelligence | Geopolitical analytics, espionage |
| Politics | Elections, parties, approval ratings |
| Events | National issues, crises, world events |
| Cards & Vault | Realm-specific achievements, card ecosystem |
| Time | IxTime (2x speed) or custom per-realm |

### 8.2 Simulation Bootstrap

When a country is created (claim approved):
1. **Economic baseline** from `getDefaultEconomicConfig()` + geo profile modifiers
2. **Population** from geo profile (arable land, climate suitability)
3. **Government** from claim form selection
4. **Military** baseline (scaled to population/GDP)
5. **Diplomacy** — neutral relations with all other realm countries

---

## 9. World Config (Per Realm)

The existing [WorldConfig](file:///home/jxsig/projects/ixstats/prisma/schema/maps.prisma#L532-L560) model handles per-realm configuration:

| Setting | Default (IxWorld) | Customizable |
|---------|-------------------|-------------|
| Climate system | Trewartha (12 types) | Yes — Trewartha, Köppen, or custom |
| Elevation zones | 9 zones (0–7000m+) | Yes — custom ranges/names/colors |
| Map projection | Globe | Yes — globe, Mercator, flat |
| Sovereignty types | 34 types | Yes — subset or custom |
| Time system | IxTime (2x speed) | Yes — custom or real-time |
| Wiki integration | ixwiki.com | Yes — any MediaWiki URL or none |
| Country colors | IxWorld palette | Yes — custom palette |
| Water body labels | 22 IxWorld labels | Yes — auto-generated from geography |

---

## 10. Existing Infrastructure Inventory

### 10.1 Models Already in Place

| Model | Location | Status |
|-------|----------|--------|
| `Realm` | [maps.prisma:503](file:///home/jxsig/projects/ixstats/prisma/schema/maps.prisma#L503-L525) | Exists |
| `WorldConfig` | [maps.prisma:532](file:///home/jxsig/projects/ixstats/prisma/schema/maps.prisma#L532-L560) | Exists |
| `Country.realmId` | [core.prisma:183](file:///home/jxsig/projects/ixstats/prisma/schema/core.prisma#L182-L183) | Exists (defaults "default") |
| `MapLayer.worldId` | [maps.prisma:267](file:///home/jxsig/projects/ixstats/prisma/schema/maps.prisma#L267) | Exists (defaults "default") |
| `ProceduralWorld` | [maps.prisma:347](file:///home/jxsig/projects/ixstats/prisma/schema/maps.prisma#L347-L362) | Exists |
| `WorldTemplate` | [maps.prisma:325](file:///home/jxsig/projects/ixstats/prisma/schema/maps.prisma#L325-L344) | Exists |

### 10.2 Code Already in Place

| Component | Location | Reuse Strategy |
|-----------|----------|---------------|
| Worldgen engine | [src/lib/worldgen/](file:///home/jxsig/projects/ixstats/src/lib/worldgen) (13 files, ~106KB) | Replace with Azgaar fork |
| Map pipeline | [map-pipeline.ts](file:///home/jxsig/projects/ixstats/src/lib/map-pipeline.ts) (266 lines) | Extend with realm-scoped output |
| SVG parser | [svg-parser.ts](file:///home/jxsig/projects/ixstats/src/lib/svg-parser.ts) (1,328 lines) | Reuse directly |
| PNG converter | [png-to-svg.ts](file:///home/jxsig/projects/ixstats/src/lib/png-to-svg.ts) | Reuse directly |
| Province importer lib | [province-importer/](file:///home/jxsig/projects/ixstats/src/lib/province-importer) (~200KB, 13 files) | Extend for realm-level imports |
| Province importer UI | [province-importer/](file:///home/jxsig/projects/ixstats/src/components/maps/editor/province-importer) (10 files) | Reuse, add realm scope |
| Map editor | [maps/editor/](file:///home/jxsig/projects/ixstats/src/components/maps/editor) (~4,500 lines) | Reuse for blank canvas |
| Core map viewer | [maps/core/](file:///home/jxsig/projects/ixstats/src/components/maps/core) (~4,700 lines) | Reuse, add realm context |
| Geo router | [routers/geo/](file:///home/jxsig/projects/ixstats/src/server/api/routers/geo) (70 endpoints) | Add realmId filters |
| SVG upload admin | [geo/admin/uploads.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/geo/admin/uploads.ts) | Extend for realm-scoped uploads |
| SVG commit admin | [geo/admin/commits.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/geo/admin/commits.ts) (504 lines) | Extend for realm-scoped commits |
| Elevation config | [elevation-config.ts](file:///home/jxsig/projects/ixstats/src/lib/elevation-config.ts) | Make configurable per WorldConfig |
| Map config | [map-config.ts](file:///home/jxsig/projects/ixstats/src/lib/map-config.ts) | Make configurable per WorldConfig |
| Shared vertex builder | [shared-vertex-builder.ts](file:///home/jxsig/projects/ixstats/src/lib/shared-vertex-builder.ts) | Reuse with realm scope |
| Country linking | [country-linking.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/users/country-linking.ts) (608 lines) | Extend with claim approval |
| Border editor | [border-editor.ts](file:///home/jxsig/projects/ixstats/src/lib/border-editor.ts) | Reuse with realm scope |

---

## 11. Phased Delivery Plan

### Phase 1: Foundation (Realm CRUD + Data Isolation)
- Realm creation/management tRPC router (CRUD)
- `realmId` filter on all geo queries (MapLayer, Country, features)
- Realm context provider (React context for active realm)
- Realm-scoped URL routing (`/realms/[slug]/...`)
- Realm landing page + discovery page (`/realms`)
- Migrate IxWorld to `realm="default"` explicitly

### Phase 2: World Studio + Azgaar Fork
- Fork Azgaar FMG, extract generator core
- Web Worker wrapper for non-blocking generation
- World Studio wizard UI (6 steps)
- Azgaar → IxStates normalizer
- Enrichment pipeline (climate, elevation, hydrology, geo profiles, resources)
- Atomic commit of generated world to realm

### Phase 3: Upload Pipeline + Province Importer Extension
- Extend province importer for realm-level imports
- Auto-detection path (color segmentation, SVG layer detection)
- Georeferencing UI (position uploaded map on globe)
- Enrichment pipeline for uploaded maps
- Blank canvas mode (Forge Mode for realm creation)

### Phase 4: Claim System + Player Onboarding
- `TerritoryClaim` model + tRPC router
- Click-to-claim UI (map interaction → slide-out panel)
- Realm admin approval queue
- Country bootstrap on approval
- Realm join flow (public + invite-only)
- Member directory

### Phase 5: Realm Simulation Engine
- Verify all sim code works realm-scoped
- Per-realm IxTime instance or shared clock
- Per-realm cron jobs or batched processing
- Per-realm event/crisis generation
- Per-realm leaderboards

### Phase 6: Governance + Polish
- Founder/delegate/officer role system
- Realm settings panel
- Realm elections and voting
- Constitution editor
- Moderation tools

---

## 12. Open Questions

1. **Realm limits** — max realms per user? Max countries per realm?
2. **Azgaar fork maintenance** — pin a version or track upstream updates?
3. **Realm deletion** — cascade delete? Soft delete + archive?
4. **Realm transfer** — can founders transfer ownership?
5. **Custom time systems** — how configurable? Real-time only, or custom calendars?
6. **Realm-specific cards** — own card ecosystem or shared global?
7. **Performance** — with N realms × M countries, PostGIS query partitioning strategy?

---

## 13. Success Criteria

| Metric | Target |
|--------|--------|
| Realm creation time | < 5 minutes (procedural), < 15 minutes (upload) |
| First player claim | < 2 minutes after joining a realm |
| Map rendering | < 3 seconds for any realm map |
| Enrichment pipeline | < 60 seconds for a 12-country world |
| Claim approval | Admin notified immediately, approve in < 30 seconds |

---

## 14. Non-Goals (Explicit)

- **Opening IxWorld to external players** — IxWorld stays closed/internal
- **Cross-realm interaction** — realms are isolated universes
- **Mobile app** — web-only for now
- **Real money transactions** — no paid realm tiers in v1
- **AI-generated maps** (terrain-diffusion) — Azgaar's algorithmic approach first; ML-based is future exploration
