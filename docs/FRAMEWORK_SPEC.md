# IxWorld & Realms Framework Specification

## Overview

**IxWorld Framework** is a multi-tenant worldbuilding and nation simulation framework that provides interactive mapping, physical geography generation, economic simulation, and MediaWiki integration for fictional worlds.

This document specifies the standardized data models, configuration points, and procedural generation specifications allowing any community to deploy their own **Realm** instance.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           REALMS PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────┤
│ WorldConfig & Realm Model (Database)                                    │
│ Defines: realmId, wiki URL, map layers, climate system, governance      │
├──────────────────────┬──────────────────────┬───────────────────────────┤
│ Map Conversion       │ Map Layers (GeoJSON) │ Analytics & Sim Engine    │
│ SVG/PNG parsing,     │ 7 UPG v2 vector      │ Elevation, Climate, Sim   │
│ affine WGS84 transform│ topology layers     │ Modifiers, Risk Heatmaps  │
├──────────────────────┴──────────────────────┴───────────────────────────┤
│ MapLibre GL JS Renderer                                                 │
│ Globe/Mercator projection, overlays, editor, embedded widgets           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenant Realms Architecture

- **Realm Isolation**: Every realm is an isolated universe. The default internal realm is `realm="default"` (IxWorld).
- **URL Routing**: `/realms/[slug]/maps`, `/realms/[slug]/mycountry`, `/realms/[slug]/admin`, etc. The top-level routes (`/maps`, `/mycountry`) map to `realm="default"`.
- **Tenant Data Scoping**: All spatial and simulation data models are scoped by `realmId` (or `worldId`), including `Country`, `MapLayer`, `City`, `Subdivision`, `PointOfInterest`, `TransportRoute`, `SharedVertex`, and `WorldConfig`.

---

## Prerequisite Map Ingestion & GeoJSON Conversion

The framework supports ingesting custom vector (SVG) or raster (PNG) map graphics into standardized GeoJSON layers:

### 1. Vector SVG Pipeline (`src/lib/svg-parser.ts`)

- **Layer Extraction**: Inkscape layer groups (`<g inkscape:groupmode="layer" inkscape:label="...">`) map automatically to GeoJSON layer types (`political`, `rivers`, `lakes`, `altitudes`, `climate`).
- **Bezier Flattening**: Converts cubic (`C`, `S`) and quadratic (`Q`, `T`) Bezier path commands into discrete linear line segments.
- **Affine Coordinate Transformation** (`src/lib/svg-coordinate-config.ts`):
  Maps SVG viewBox pixel space $(x, y)$ to geographic WGS84 coordinates $(\text{lng}, \text{lat})$:
  $$\text{lat} = \frac{\text{equatorY} - \text{svgY}}{\text{pixelsPerLat}}$$
  $$\text{lng} = \frac{\text{svgX} - \text{primeMeridianX}}{\text{pixelsPerLng}} + \text{primeMeridianReferenceLng}$$

### 2. Topology Repair & Seam Locking (`src/lib/shared-vertex-builder.ts`)

- Detects coincident border nodes between adjacent country polygons.
- Unifies shared vertex indices across layers, preventing seam tearing or gap artifacts during globe/mercator projection rendering.

### 3. GeoJSON Compression & Transmit Pipeline (`src/lib/geojson-compress.ts`)

- **Visvalingam-Whyatt Simplification**: `@turf/simplify` with layer-specific tolerance parameters (`0.008` political, `0.035` altitudes/climate).
- **Coordinate Precision Truncation**: Truncates floating-point coordinate decimals to 4 DP ($\sim 11\text{m}$ resolution), reducing JSON transfer payload size by 60%–70%.
- **Consecutive Duplicate Removal**: Removes redundant sequential positions post-truncation.
- **Antimeridian Sutherland-Hodgman Splitting**: Splits features across $\pm 180^\circ$ longitude.

---

## Data Model & GeoJSON Layers

### 7 Standard UPG v2 GeoJSON Layers

All GeoJSON layers follow WGS84 coordinates (`[-180, 180] × [-84, 84]`) with topology-locked Catmull-Rom spline curves:

| Layer | Geometry | Purpose | Properties |
|-------|----------|---------|------------|
| `rivers` | LineString / MultiLineString | Hydrological drainage lines | `_flow`, `_strahler`, `_name` |
| `lakes` | Polygon / MultiPolygon | Freshwater/saline inland water bodies | `_fillColor`, `_name` |
| `icecaps` | Polygon / MultiPolygon | Permanent polar ice coverage | `_fillColor` |
| `political` | Polygon / MultiPolygon | Nation boundaries | `_countryId`, `_fillColor`, `_displayName` |
| `altitudes` | Polygon / MultiPolygon | Hypsometric elevation isolines (9 zones) | `_fillColor`, `_zone` (0–8) |
| `climate` | Polygon / MultiPolygon | Trewartha biomes (12 types) | `_fillColor`, `_code` |
| `background` | Polygon / MultiPolygon | Master land/ocean mask | `_fillColor` |

### Feature Models

1. **City** (`Point` feature, DB record):
   - `id`, `name`, `coordinates` `[lng, lat]`, `countryId`, `realmId`
   - `type`: `capital`, `metropolis`, `city`, `town`
   - `population`, `gdpContribution`, `isNationalCapital`, `isSubdivisionCapital`
   - `wikiPageTitle` (optional link to wiki article)

2. **Subdivision** (`Polygon` / `MultiPolygon` feature):
   - `id`, `name`, `geometry`, `countryId`, `realmId`
   - `type`: `province`, `state`, `region`, `territory`
   - `population`, `gdpContribution`, `budgetShare`, `governorName`

3. **Point of Interest** (`Point` feature):
   - `id`, `name`, `coordinates`, `countryId`, `realmId`
   - `category`, `description`, `icon`, `wikiPageTitle`

4. **Country** (Main simulation entity):
   - `id`, `name`, `slug`, `realmId`, `geometry` (JSONB GeoJSON), `centroid`, `boundingBox`
   - Economic metrics (`currentGdpPerCapita`, `currentPopulation`, `economicTier`)
   - Physical profile (`continent`, `region`, `coastlineKm`, `landArea`)

---

## WorldConfig Schema

```prisma
model WorldConfig {
  id               String   @id @default(cuid())
  realmId          String   @unique // "default", "realm-slug", etc.
  name             String   // Display name of the world/realm
  wikiBaseUrl      String?  // MediaWiki instance URL
  wikiApiPath      String   @default("/api.php")
  mapProjection    String   @default("globe") // "globe", "mercator", "dynamic"
  defaultCenter    Json?    // [lng, lat]
  defaultZoom      Float    @default(2.5)
  layerTypes       Json?    // Layer definitions
  climateSystem    String   @default("trewartha")
  elevationZones   Json?    // Zone color/height mappings
  waterBodyLabels  Json?    // Ocean/sea label coordinates
  sovereigntyTypes Json?    // Custom sovereignty types
}
```

---

## World Studio Creation Pathways

Realms can be initialized through three pathways in the World Studio (`/realms/create`):

1. **Procedural World Generation (UPG v2 / Azgaar Core)**:
   - 100,000 Voronoi spatial mesh (`WorldGraph`), tectonic simulation, hypsometric slope damping, hydrology pass, and Catmull-Rom vector subdivision.
2. **Raster / Vector Import (PNG / SVG Pipeline)**:
   - Upload vector SVG or raster map → parsed by `svg-parser.ts` (@xmldom + Inkscape layer mapping + affine transform) → converted to GeoJSON layers and stored in `MapLayer`.
3. **Blank Canvas**:
   - Initializes a blank oceanic realm grid for manual border paint mode and vector feature drawing.

---

## MediaWiki & Analytics Engine

### Wiki Integration

Connects to any MediaWiki instance via standardized API endpoints:
- **Search**: `action=opensearch` for live search type-ahead.
- **Extracts**: `action=query&prop=extracts` for nation/city article summaries in drawer panels.
- **Infobox Parsing**: `action=parse&prop=wikitext` for structured data import.
- **Place Name Auto-Linking**: Scans wiki article text against known feature names.

### Geographic Analytics Engine

Spatial analytics are computed server-side from GeoJSON layers and PostGIS queries:
- **Coastal Line Computation**: `ST_Perimeter` minus shared land borders.
- **Neighbor Detection**: PostGIS `ST_Intersects` on political boundaries.
- **Economic Modifiers**: Climate biome, elevation profile, arable land ratio, and maritime coastline access automatically influence national economic growth formulas.
- **Crisis & Risk Scoring**: Terrain ruggedness, coastline exposure, and climate extremes generate risk heatmaps (`RiskHeatmapOverlay`).

---

## API Surface

Key tRPC endpoints powering the framework:

- `geo.getWorldMap` — Fetch compressed GeoJSON map layers for a realm.
- `geo.getMapBundle` — Batched initial load (layers + features + capitals + bounds).
- `geo.getCountryGeoProfile` — Physical metrics (climate breakdown, elevation isolines, neighbors, coastline).
- `geo.searchFeatures` — Cross-feature geographical search.
- `geo.submitBorderEdit` — Submit border modification to admin approval queue.
- `geo.generateProceduralWorld` — Execute UPG v2 engine generator.
