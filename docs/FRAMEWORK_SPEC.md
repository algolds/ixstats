# IxWorld Framework Specification

## Overview

IxWorld is a worldbuilding framework that provides interactive mapping, economic simulation, and wiki integration for fictional worlds. This document specifies the standardized data model and configuration points that allow any community to deploy their own instance.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  WorldConfig (database)                          │
│  Defines: wiki URL, map layers, climate system   │
├──────────────┬──────────────┬────────────────────┤
│  Map Layers  │  Features    │  Analytics Engine   │
│  (GeoJSON)   │  (Cities,    │  (Climate, Elev,    │
│              │   POIs,      │   Economy, Risk)    │
│              │   Regions)   │                     │
├──────────────┴──────────────┴────────────────────┤
│  MapLibre GL JS Renderer                         │
│  Globe/Mercator projection, overlays, editor     │
└─────────────────────────────────────────────────┘
```

## Data Model

### Required Layers (GeoJSON)

| Layer | Type | Purpose |
|-------|------|---------|
| `background` | Fill | Land/ocean boundary (single polygon or multipolygon) |
| `political` | Fill | Country polygons with `_fillColor`, `_displayName`, `_countryId` properties |

### Optional Layers

| Layer | Type | Purpose |
|-------|------|---------|
| `climate` | Fill | Climate zone polygons (colored by fill property, mapped to system) |
| `altitudes` | Fill | Elevation zone polygons (colored by fill property) |
| `rivers` | Line | River linestrings |
| `lakes` | Fill | Lake polygons |
| `icecaps` | Fill | Permanent ice coverage |

### Feature Models

**City** (point feature, database record):
- `name` (required), `coordinates` [lng, lat], `countryId`
- `type`: city, town, village, etc.
- `population`, `isNationalCapital`, `isSubdivisionCapital`
- `wikiPageTitle` (optional link to wiki article)

**Point of Interest** (point feature):
- `name`, `coordinates`, `countryId`, `category`
- `description`, `icon`, `wikiPageTitle`

**Subdivision** (polygon feature):
- `name`, `geometry` (GeoJSON Polygon/MultiPolygon), `countryId`
- `type`: province, state, territory, etc.
- `level` (1-5), `population`, `areaSqKm`

### Country Model

- `name`, `slug`, `geometry` (JSONB GeoJSON)
- `centroid`, `boundingBox` (computed)
- Economic fields: `currentGdpPerCapita`, `currentPopulation`, `economicTier`, etc.
- Geographic fields: `continent`, `region`, `coastlineKm`, `landArea`
- Links to wiki via `wikiPageTitle` on child features

## WorldConfig Schema

```prisma
model WorldConfig {
  worldId          String   @unique  // "default", "myworld", etc.
  name             String            // Display name
  wikiBaseUrl      String?           // MediaWiki instance URL
  wikiApiPath      String            // "/api.php"
  mapProjection    String            // "globe", "mercator", "dynamic"
  defaultCenter    Json?             // [lng, lat]
  defaultZoom      Float             // Initial zoom level
  layerTypes       Json?             // Available layer types
  climateSystem    String            // "trewartha", "koppen", "custom"
  elevationZones   Json?             // Custom zone definitions
  waterBodyLabels  Json?             // Ocean/sea label positions
  sovereigntyTypes Json?             // Custom sovereignty types
}
```

## SVG Import Pipeline

To create a new world:

1. **Prepare SVG map** with distinct polygons for countries
2. **Upload via admin panel** → parsed by `svg-parser.ts` → stored in `map_layers` table
3. **Link countries** → admin maps page connects political features to `Country` records
4. **Upload additional layers** → climate, altitude, rivers, lakes as separate SVG files
5. **Configure WorldConfig** → set wiki URL, projection, climate system

## Wiki Integration

The framework connects to any MediaWiki instance via standard API:

- **Search**: `action=opensearch` for type-ahead
- **Intro**: `action=query&prop=extracts` for article summaries
- **Infobox**: `action=parse&prop=wikitext` for structured data extraction
- **Auto-linking**: Scans article text for known place names

The `wikiBaseUrl` in WorldConfig determines which wiki to query. Falls back to secondary wiki if configured.

## Analytics Engine

Geographic analytics are computed from map data:

- **Climate zones** → resolved from SVG fill colors via `resolveClimateFromColor()`
- **Elevation profile** → resolved from altitude layer fill colors
- **Neighbor detection** → PostGIS `ST_Intersects` on country geometries
- **Coastline computation** → `ST_Perimeter` minus shared borders
- **Economic modifiers** → derived from climate, elevation, coastline, neighbors
- **Crisis risk** → derived from climate, terrain, coastline
- **NPC personality drift** → geography influences NPC behavior

All computation is done server-side via tRPC endpoints and cached.

## Extension Points

| Extension | How to Customize |
|-----------|------------------|
| Climate system | Set `climateSystem` to "custom", provide `elevationZones` JSON |
| Sovereignty types | Provide `sovereigntyTypes` JSON array in WorldConfig |
| Map colors | Provide `countryColors` JSON array in WorldConfig |
| Water labels | Provide `waterBodyLabels` JSON array |
| Wiki source | Set `wikiBaseUrl` to any MediaWiki instance |
| Projection | Set `mapProjection` to "globe", "mercator", or "dynamic" |

## API Surface

Key tRPC endpoints that power the framework:

- `geo.getWorldMap` — fetch GeoJSON layers
- `geo.getMapBundle` — batched initial load (layers + features + capitals)
- `geo.getCountryGeoProfile` — climate, elevation, neighbors, coastline, economic modifiers
- `geo.parseWikiInfobox` — extract structured data from wiki articles
- `geo.searchWikiPages` — type-ahead wiki search
- `geo.scanWikiForPlaces` — auto-link place names in articles
- `geo.getCountryConflicts` — detect data quality issues
- `geo.getRegionalChoropleth` — per-country metric data for map visualization
- `geo.getCrisisRiskMap` — risk scores for heatmap overlay
- `geo.getGeopoliticalOverlay` — alliance/diplomacy/conflict data

## Deployment

Each world instance requires:
- PostgreSQL with PostGIS extension
- Node.js runtime (Next.js 16+)
- Map layers imported via SVG pipeline
- WorldConfig record in database
- Optional: MediaWiki instance for wiki integration
