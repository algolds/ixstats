# IxMaps 3.0 - Product Requirements Document

**Version:** 3.0.0
**Date:** November 11, 2025
**Status:** Planning Phase
**Author:** IxStats Development Team

---

## Executive Summary

IxMaps 3.0 is a complete architectural redesign of the IxStats mapping system, moving from MapLibre GL JS to Leaflet 2.0 with a custom coordinate reference system (CRS). This document outlines the technical architecture, data processing pipeline, and implementation strategy based on lessons learned from previous implementations.

### Key Decisions

- **Primary Renderer:** Leaflet 2.0 (alpha) with custom CRS
- **Base Layers:** SVG or pre-rendered raster tiles
- **Dynamic Layers:** PostGIS + GeoJSON via tRPC
- **Coordinate System:** Custom linear projection with shifted prime meridian (26.09°E)
- **No Vector Tiles:** Eliminated Martin tile server complexity for base layers

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Goals & Objectives](#goals--objectives)
3. [Technical Architecture](#technical-architecture)
4. [IxEarth Coordinate System](#ixearth-coordinate-system)
5. [Data Processing Pipeline](#data-processing-pipeline)
6. [Implementation Phases](#implementation-phases)
7. [Learned Lessons](#learned-lessons)
8. [Success Criteria](#success-criteria)
9. [Technical Specifications](#technical-specifications)
10. [Risk Mitigation](#risk-mitigation)

---

## Problem Statement

### Current Issues (IxMaps 2.0 - MapLibre Implementation)

#### 1. **Horizontal Banding Artifacts**
- **Symptom:** Horizontal streaks across the map at specific latitudes
- **Root Cause:** Countries crossing the international dateline (±180°) have geometries spanning 350-360° longitude
- **MapLibre Behavior:** Connects vertices at -179° and +179° by drawing across the entire map width
- **Countries Affected:** Oyashima, Daxia, Metzetta, Huoxia, path190-4

#### 2. **Coordinate System Incompatibility**
- **IxEarth:** Custom prime meridian at 26.09°E, linear projection, 1.4777x scale factor
- **MapLibre:** Designed for Web Mercator (EPSG:3857), expects standard ±180° longitude range
- **Conflict:** Forcing custom coordinates into MapLibre's assumptions creates rendering artifacts

#### 3. **Excessive Complexity**
- **Current Stack:** Next.js → Martin tile server → PostGIS → Redis caching → MapLibre
- **Issues:**
  - Martin tile server adds deployment overhead
  - Vector tile generation for static base layers is overkill
  - Complex cache invalidation logic
  - Difficult debugging across multiple services

#### 4. **Data Processing Problems**
- **Dateline Splitting Failures:** PostGIS functions (ST_WrapX, ST_Split, ST_Intersection) fail on complex MultiPolygons
- **Topology Errors:** `TopologyException: side location conflict` during geometry operations
- **Invalid Coordinates:** Attempts to "fix" dateline crossing created coordinates >180° (up to 187°)

### Previous Implementation (IxMaps 1.0 - Original Leaflet)

✅ **What Worked:**
- Leaflet 1.x with custom CRS handled IxEarth coordinates perfectly
- SVG-based layers rendered without artifacts
- Simple coordinate transformation functions in `coordinates-system.ts`
- No dateline crossing issues with custom projection

❌ **Why It Was Abandoned:**
- Perceived as "outdated" compared to WebGL solutions
- Desire for 3D terrain visualization
- Vector tiles seen as "modern" approach

---

## Goals & Objectives

### Primary Goals

1. **Eliminate Rendering Artifacts**
   - Zero horizontal banding regardless of geometry complexity
   - Proper rendering of dateline-crossing countries
   - Stable across all zoom levels

2. **Simplify Architecture**
   - Reduce number of services and dependencies
   - Easier deployment and maintenance
   - Faster development iteration

3. **Preserve IxEarth Coordinate System**
   - Maintain 26.09°E prime meridian
   - Keep linear projection (not Web Mercator)
   - Support 1.4777x scale factor for planetary metrics

4. **Enable Dynamic User Content**
   - User-editable subdivisions via PostGIS
   - Admin-managed cities and points of interest
   - Real-time updates without full map regeneration

### Secondary Goals

1. **Performance Optimization**
   - <100ms initial map load
   - Smooth panning and zooming (60 FPS)
   - Efficient memory usage (<200MB)

2. **Maintainability**
   - Clear separation of static and dynamic layers
   - Documented coordinate transformation logic
   - Testable components

3. **Future-Proof**
   - Option to add MapLibre as overlay for 3D effects
   - Support for additional map projections
   - Scalable data architecture

---

## Technical Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     IxStats Platform (Next.js 15)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │          Frontend Map Component (React)                  │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │     Leaflet 2.0 Map Instance                    │    │   │
│  │  │     - Custom IxEarth CRS                        │    │   │
│  │  │     - Custom projection transformations         │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ├──────────────┬──────────────────┐   │
│                           │              │                  │   │
│            ┌──────────────▼────┐  ┌─────▼──────┐  ┌────────▼─┐ │
│            │  Static Layers    │  │  Dynamic   │  │ Optional │ │
│            │  (SVG/Raster)     │  │  GeoJSON   │  │ MapLibre │ │
│            │  - Political      │  │  - Cities  │  │ Overlay  │ │
│            │  - Terrain        │  │  - Subds   │  │ (Future) │ │
│            │  - Climate        │  │  - POIs    │  │          │ │
│            └───────────────────┘  └────────────┘  └──────────┘ │
│                                         │                       │
│                                         │ tRPC API              │
│                                         ▼                       │
│                          ┌──────────────────────────┐           │
│                          │   PostgreSQL + PostGIS   │           │
│                          │   - User subdivisions    │           │
│                          │   - Cities (approved)    │           │
│                          │   - Points of interest   │           │
│                          └──────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Architecture

#### 1. **Static Base Layers** (No Database)

**Purpose:** Non-editable world geography that rarely/never changes

**Implementation Options:**

**Option A: SVG Layers (Recommended for Phase 1)**
```typescript
// Load pre-processed SVG layers directly
const politicalLayer = L.svg({
  url: '/maps/layers/political.svg',
  bounds: [[minLat, minLng], [maxLat, maxLng]]
});

// Original ixmaps-new approach
// Pros: Simple, proven, works with custom CRS
// Cons: Larger file sizes, slower for complex geometries
```

**Option B: Pre-rendered Raster Tiles**
```typescript
// Generate once from GeoJSON, serve forever
L.tileLayer('/tiles/political/{z}/{x}/{y}.png', {
  tms: true,
  bounds: ixEarthBounds
});

// Pros: Fast rendering, cached by browser
// Cons: Requires tile generation pipeline
```

**Layers:**
- `political` - Country borders and boundaries
- `climate` - Climate zones (Köppen classification)
- `altitudes` - Elevation/terrain data
- `rivers` - Major river systems
- `lakes` - Water bodies
- `icecaps` - Polar regions
- `background` - Ocean/base layer

#### 2. **Dynamic GeoJSON Layers** (PostGIS → tRPC → GeoJSON)

**Purpose:** User-created and admin-managed content

**Implementation:**
```typescript
// Fetch from tRPC endpoint
const subdivisions = await api.mapEditor.getCountrySubdivisions.query({
  countryId: 'Oyashima',
  status: 'approved'
});

// Render as Leaflet GeoJSON layer
const subdivisionLayer = L.geoJSON(subdivisions, {
  style: (feature) => ({
    color: feature.properties.stroke || '#3388ff',
    fillColor: feature.properties.fill || '#3388ff',
    fillOpacity: 0.2,
    weight: 2
  }),
  onEachFeature: (feature, layer) => {
    layer.bindPopup(`
      <strong>${feature.properties.name}</strong><br>
      Type: ${feature.properties.type}<br>
      Population: ${feature.properties.population?.toLocaleString() || 'N/A'}
    `);
  }
});
```

**Layers:**
- `user-subdivisions` - Player-created administrative regions
- `cities` - Admin-approved city markers
- `pois` - Points of interest

#### 3. **Optional MapLibre Overlay** (Future Enhancement)

**Purpose:** 3D terrain visualization, WebGL effects

**Implementation:**
```typescript
import { MaplibreGlLayer } from 'maplibre-gl-leaflet';

// Add ONLY as an overlay, not for base layers
const terrainOverlay = new MaplibreGlLayer({
  style: {
    version: 8,
    sources: {
      terrain: {
        type: 'raster-dem',
        url: 'terrain-tiles-url'
      }
    },
    layers: [
      {
        id: '3d-terrain',
        type: 'hillshade',
        source: 'terrain'
      }
    ]
  }
});

// Only add if user enables 3D mode
if (enable3DMode) {
  map.addLayer(terrainOverlay);
}
```

---

## IxEarth Coordinate System

### Planetary Specifications

**From:** `docs/IXEARTH_METRICS.md` and `src/lib/ixearth-constants.ts`

```typescript
// IxEarth planetary constants
export const IXEARTH_PLANETARY_METRICS = {
  // Surface areas (square miles)
  totalLandAreaSqMi: 127_724_236,    // 2.22x Earth
  totalWaterAreaSqMi: 227_128_507,   // 1.63x Earth
  totalSurfaceAreaSqMi: 354_852_742, // 1.80x Earth

  // Land composition
  claimedLandSqMi: 44_440_107,       // 82 countries (34.8%)
  unclaimedLandSqMi: 83_284_129,     // Wilderness (65.2%)
  landPercentage: 36.0,              // vs Earth's 29.2%
};

// Scale system
export const IXEARTH_SCALE_SYSTEM = {
  // Scale factor: reconciles IxMaps CRS with Earth WGS84
  scaleFactor: 1.4777,

  // IxMaps coordinate system
  pixelsPerSquareMile: 1 / 10,  // 1px = 10 sq mi
  primeMeridianLongitude: 26.09, // Shifted from Greenwich

  // Conversion functions
  earthScaleToCanonical: (earthArea: number) => earthArea * 1.4777,
  canonicalToEarthScale: (ixearthArea: number) => ixearthArea / 1.4777,
};
```

### Custom CRS Implementation

**Based on:** `/public/maps/ixmaps-new/src/lib/coordinates-system.ts`

```typescript
import L from 'leaflet';

// Define custom CRS for IxEarth
export const IxEarthCRS = L.extend({}, L.CRS.Simple, {
  projection: {
    // Project lat/lng to pixel coordinates
    project: function(latlng: L.LatLng): L.Point {
      // Apply prime meridian shift (26.09°)
      const adjustedLng = latlng.lng + 26.09;

      // Apply custom scaling
      const x = adjustedLng * PIXELS_PER_LONGITUDE;
      const y = latlng.lat * PIXELS_PER_LATITUDE;

      return new L.Point(x, y);
    },

    // Unproject pixel coordinates to lat/lng
    unproject: function(point: L.Point): L.LatLng {
      const lng = (point.x / PIXELS_PER_LONGITUDE) - 26.09;
      const lat = point.y / PIXELS_PER_LATITUDE;

      return new L.LatLng(lat, lng);
    }
  },

  // Transformation matrix (handles coordinate system orientation)
  transformation: new L.Transformation(
    1, 0,  // Scale and offset X
    -1, 0  // Scale and offset Y (inverted for SVG coordinates)
  ),

  // Wrap longitude at custom boundaries
  wrapLng: [-180 + 26.09, 180 + 26.09],

  // No latitude wrapping
  wrapLat: undefined
});

// Map initialization with custom CRS
export function initializeIxEarthMap(containerId: string) {
  return L.map(containerId, {
    crs: IxEarthCRS,
    center: [0, 0],  // IxEarth equator/prime meridian
    zoom: 2,
    minZoom: 0,
    maxZoom: 6,
    maxBounds: [[-100, -200], [100, 200]],  // IxEarth boundaries
    maxBoundsViscosity: 1.0
  });
}
```

### Coordinate Transformation Functions

**Ported from original ixmaps-new:**

```typescript
export interface MapConfig {
  equatorY: number;              // Y coordinate of equator in SVG
  pixelsPerLatitude: number;     // Pixels per degree latitude
  primeMeridianX: number;        // X coordinate of prime meridian
  pixelsPerLongitude: number;    // Pixels per degree longitude
  primeMeridianReferenceLng: number; // Longitude value at prime meridian (26.09)
}

/**
 * Convert geographic coordinates to SVG pixel coordinates
 * Handles custom prime meridian (26.09°E instead of 0°)
 */
export function latLngToSvg(
  lat: number,
  lng: number,
  config: MapConfig
): { x: number; y: number } {
  const { equatorY, pixelsPerLatitude, primeMeridianX,
          pixelsPerLongitude, primeMeridianReferenceLng } = config;

  // Y: Higher latitude = lower Y value (moving "up" from equator)
  const y = equatorY - (lat * pixelsPerLatitude);

  // X: Offset from prime meridian based on longitude difference
  const x = primeMeridianX + ((lng - primeMeridianReferenceLng) * pixelsPerLongitude);

  return { x, y };
}

/**
 * Convert SVG pixel coordinates to geographic coordinates
 * Inverse operation of latLngToSvg
 */
export function svgToLatLng(
  svgX: number,
  svgY: number,
  config: MapConfig
): { lat: number; lng: number } {
  const { equatorY, pixelsPerLatitude, primeMeridianX,
          pixelsPerLongitude, primeMeridianReferenceLng } = config;

  const lat = (equatorY - svgY) / pixelsPerLatitude;
  const lng = ((svgX - primeMeridianX) / pixelsPerLongitude) + primeMeridianReferenceLng;

  return { lat, lng };
}
```

---

## Data Processing Pipeline

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│               Data Processing Workflow                      │
└─────────────────────────────────────────────────────────────┘

Step 1: Source Data Acquisition
├── Raw IxMaps SVG files (Inkscape/Illustrator)
├── Located in: /ixwiki/public/maps/ixmaps-new/public/maps/
└── Format: SVG with custom coordinate system

Step 2: SVG to GeoJSON Conversion
├── Tool: ogr2ogr or custom SVG parser
├── Process: Extract paths, convert to GeoJSON features
├── Output: GeoJSON FeatureCollections per layer
└── Located in: scripts/geojson_sanitized/

Step 3: Coordinate System Validation
├── Verify longitude range: Check for values outside ±180°
├── Validate geometries: Ensure closed rings, no self-intersections
├── Check topology: No invalid polygons
└── Handle dateline crossing: Document which countries span dateline

Step 4: Data Import Strategies
├── Option A: Direct SVG serving (simplest)
├── Option B: GeoJSON → Leaflet layers (dynamic)
├── Option C: Pre-rendered raster tiles (performance)
└── Option D: PostGIS storage (user-editable content only)

Step 5: PostGIS Import (Dynamic Layers Only)
├── Import user-editable features to database
├── Apply spatial indexes
├── Serve via tRPC as GeoJSON
└── No vector tile generation needed
```

### Detailed Processing Steps

#### Step 1: Export from Design Tools

**Current Source:** IxMaps SVG files

**Requirements:**
- SVG coordinate system must match IxEarth projection
- Layers properly organized by ID/class
- Paths use absolute coordinates (not relative)

**Verification:**
```bash
# Check SVG structure
xmllint --format /path/to/master-map.svg | grep -E '<g id=|<path'

# Verify coordinate ranges
grep -oP 'd="[^"]*"' master-map.svg | \
  python3 -c "import sys, re; coords=[float(x) for line in sys.stdin for x in re.findall(r'-?\d+\.?\d*', line)]; print(f'X: [{min(coords)}, {max(coords)}]')"
```

#### Step 2: SVG to GeoJSON Conversion

**Option A: Use ogr2ogr (Simple Layers)**

```bash
#!/bin/bash
# Convert SVG to GeoJSON using GDAL

# For each layer
for layer in political climate altitudes rivers lakes icecaps; do
  ogr2ogr -f "GeoJSON" \
    "output/${layer}.geojson" \
    "master-map.svg" \
    -sql "SELECT * FROM ${layer}" \
    -t_srs EPSG:4326
done
```

**Option B: Custom Parser (Complex SVG)**

```typescript
// scripts/svg-to-geojson.ts
import { DOMParser } from 'xmldom';
import * as fs from 'fs';

interface MapConfig {
  equatorY: number;
  pixelsPerLatitude: number;
  primeMeridianX: number;
  pixelsPerLongitude: number;
  primeMeridianReferenceLng: number;
}

export function parseSVGLayer(
  svgContent: string,
  layerId: string,
  config: MapConfig
): GeoJSON.FeatureCollection {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');

  // Find layer group
  const layerGroup = doc.getElementById(layerId);
  if (!layerGroup) throw new Error(`Layer ${layerId} not found`);

  // Extract all paths
  const paths = Array.from(layerGroup.getElementsByTagName('path'));

  const features: GeoJSON.Feature[] = paths.map(path => {
    const d = path.getAttribute('d');
    const id = path.getAttribute('id');
    const fill = path.getAttribute('fill') || path.style.fill;

    // Parse SVG path to coordinates
    const svgCoords = parseSVGPath(d);

    // Convert to lat/lng using config
    const geoCoords = svgCoords.map(ring =>
      ring.map(([x, y]) => {
        const { lat, lng } = svgToLatLng(x, y, config);
        return [lng, lat]; // GeoJSON is [lng, lat]
      })
    );

    return {
      type: 'Feature',
      id,
      geometry: {
        type: 'Polygon',
        coordinates: geoCoords
      },
      properties: {
        id,
        fill,
        layer: layerId
      }
    };
  });

  return {
    type: 'FeatureCollection',
    features
  };
}
```

#### Step 3: Validate Geometries

**Critical Checks:**

```bash
#!/bin/bash
# scripts/validate-geojson.sh

# Check for invalid geometries
for file in scripts/geojson_sanitized/*.geojson; do
  echo "Validating $file..."

  # Check JSON syntax
  jq empty "$file" 2>/dev/null || echo "❌ Invalid JSON"

  # Check coordinate ranges
  python3 << EOF
import json
with open('$file') as f:
    data = json.load(f)
    coords = []
    for feature in data['features']:
        geom = feature['geometry']
        if geom['type'] == 'Polygon':
            for ring in geom['coordinates']:
                coords.extend(ring)
        elif geom['type'] == 'MultiPolygon':
            for polygon in geom['coordinates']:
                for ring in polygon:
                    coords.extend(ring)

    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]

    print(f"Longitude range: [{min(lons):.2f}, {max(lons):.2f}]")
    print(f"Latitude range: [{min(lats):.2f}, {max(lats):.2f}]")

    # Flag potential issues
    if max(lons) - min(lons) > 350:
        print("⚠️  Warning: Polygon spans >350° (possible dateline crossing)")
    if any(lon < -180 or lon > 180 for lon in lons):
        print("❌ Error: Longitude outside valid range")
    if any(lat < -90 or lat > 90 for lat in lats):
        print("❌ Error: Latitude outside valid range")
EOF
done
```

#### Step 4: Import to PostGIS (Dynamic Layers Only)

**Only for user-editable content:**

```bash
#!/bin/bash
# scripts/import-dynamic-layers.sh

# Database connection
DB="postgresql://postgres:postgres@localhost:5433/ixstats"

# Import subdivisions (user-created)
# These go to PostGIS because they're editable
ogr2ogr -f "PostgreSQL" \
  "PG:$DB" \
  "geojson_sanitized/subdivisions.geojson" \
  -nln user_subdivisions \
  -lco GEOMETRY_NAME=geometry \
  -lco FID=ogc_fid \
  -t_srs EPSG:4326 \
  -overwrite

# Import cities (admin-managed)
ogr2ogr -f "PostgreSQL" \
  "PG:$DB" \
  "geojson_sanitized/cities.geojson" \
  -nln cities \
  -lco GEOMETRY_NAME=geometry \
  -lco FID=ogc_fid \
  -t_srs EPSG:4326 \
  -overwrite

# Note: Base layers (political, climate, etc.) are NOT imported
# They're served directly as SVG or pre-rendered tiles
```

**Create spatial indexes:**

```sql
-- After import, add spatial indexes
CREATE INDEX idx_user_subdivisions_geom
  ON user_subdivisions USING GIST(geometry);

CREATE INDEX idx_cities_geom
  ON cities USING GIST(geometry);

-- Analyze for query optimization
ANALYZE user_subdivisions;
ANALYZE cities;
```

#### Step 5: Serve Static Layers (No Database)

**Option A: Direct SVG (Simplest)**

```typescript
// No processing needed - serve original SVG files
app.get('/maps/layers/:layer.svg', (req, res) => {
  const layer = req.params.layer;
  const svgPath = path.join(__dirname, 'public/maps', `${layer}.svg`);
  res.sendFile(svgPath);
});

// In Leaflet component
const politicalLayer = L.svg({
  url: '/maps/layers/political.svg'
});
```

**Option B: Pre-rendered Raster Tiles (Best Performance)**

```bash
#!/bin/bash
# scripts/generate-raster-tiles.sh

# Convert GeoJSON to Mapnik XML
python3 << 'EOF'
import mapnik
import json

# Load GeoJSON
with open('geojson_sanitized/political.geojson') as f:
    data = json.load(f)

# Create Mapnik map
m = mapnik.Map(256, 256)
m.background = mapnik.Color('steelblue')

# Add layer
layer = mapnik.Layer('political')
layer.datasource = mapnik.GeoJSON(file='geojson_sanitized/political.geojson')
layer.styles.append('political_style')

# Add style
style = mapnik.Style()
rule = mapnik.Rule()
rule.symbols.append(mapnik.PolygonSymbolizer(mapnik.Color('white')))
rule.symbols.append(mapnik.LineSymbolizer(mapnik.Color('black'), 1))
style.rules.append(rule)
m.append_style('political_style', style)
m.layers.append(layer)

# Render tiles
for z in range(0, 7):  # Zoom levels 0-6
    for x in range(2**z):
        for y in range(2**z):
            m.zoom_to_box(tile_bbox(x, y, z))
            mapnik.render_to_file(m, f'tiles/political/{z}/{x}/{y}.png')
            print(f'Rendered tile {z}/{x}/{y}')
EOF
```

---

## Implementation Phases

### Phase 1: Core Map Engine (Week 1)

**Goal:** Get Leaflet 2.0 rendering the political map without artifacts

**Tasks:**

1. **Set up Leaflet 2.0**
   ```bash
   npm install leaflet@2.0.0-alpha.1
   npm install @types/leaflet@latest
   npm install leaflet-draw  # For future editing
   ```

2. **Port coordinate system from ixmaps-new**
   - Copy `/public/maps/ixmaps-new/src/lib/coordinates-system.ts`
   - Adapt for IxStats directory structure
   - Add TypeScript types

3. **Create custom CRS**
   ```typescript
   // src/lib/maps/ixearth-crs.ts
   export const IxEarthCRS = L.extend({}, L.CRS.Simple, {
     // Implementation from architecture section above
   });
   ```

4. **Build map component**
   ```typescript
   // src/components/maps/IxEarthMap.tsx
   'use client';
   import { useEffect, useRef } from 'react';
   import L from 'leaflet';
   import { IxEarthCRS } from '~/lib/maps/ixearth-crs';

   export function IxEarthMap() {
     const mapRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
       if (!mapRef.current) return;

       const map = L.map(mapRef.current, {
         crs: IxEarthCRS,
         center: [0, 0],
         zoom: 2
       });

       // Add political layer (SVG or tiles)
       L.tileLayer('/maps/tiles/political/{z}/{x}/{y}.png').addTo(map);

       return () => map.remove();
     }, []);

     return <div ref={mapRef} className="w-full h-screen" />;
   }
   ```

5. **Test with political layer**
   - Verify no banding artifacts
   - Check dateline-crossing countries render correctly
   - Validate zoom/pan behavior

**Success Criteria:**
- ✅ Political map displays without horizontal banding
- ✅ All countries visible, including Oyashima, Daxia, Metzetta
- ✅ Smooth pan/zoom (60 FPS)
- ✅ Correct coordinate display in UI

### Phase 2: Additional Base Layers (Week 2)

**Goal:** Add all static map layers (climate, terrain, rivers, etc.)

**Tasks:**

1. **Process all GeoJSON files**
   ```bash
   for layer in climate altitudes rivers lakes icecaps; do
     # Convert to tiles or prepare for SVG serving
     ./scripts/generate-raster-tiles.sh $layer
   done
   ```

2. **Create layer switcher UI**
   ```typescript
   const layers = {
     political: L.tileLayer('/maps/tiles/political/{z}/{x}/{y}.png'),
     climate: L.tileLayer('/maps/tiles/climate/{z}/{x}/{y}.png'),
     terrain: L.tileLayer('/maps/tiles/terrain/{z}/{x}/{y}.png'),
   };

   L.control.layers(layers).addTo(map);
   ```

3. **Add grid overlay**
   - Port from original ixmaps-new
   - Display lat/lng grid lines
   - Show prime meridian (26.09°E)

4. **Add coordinate display**
   ```typescript
   map.on('mousemove', (e) => {
     const { lat, lng } = e.latlng;
     setCoordinateDisplay({ lat, lng });
   });
   ```

**Success Criteria:**
- ✅ All 7 base layers render correctly
- ✅ Layer switcher functional
- ✅ Grid overlay accurate
- ✅ Coordinate display shows correct values

### Phase 3: PostGIS Integration (Week 3)

**Goal:** Add dynamic user-created content from database

**Tasks:**

1. **Import existing user subdivisions to PostGIS**
   ```sql
   -- Already done in current system
   -- Verify data integrity
   SELECT COUNT(*), status FROM subdivisions GROUP BY status;
   ```

2. **Create tRPC endpoints**
   ```typescript
   // src/server/api/routers/mapData.ts
   export const mapDataRouter = createTRPCRouter({
     getSubdivisions: publicProcedure
       .input(z.object({
         countryId: z.string().optional(),
         status: z.enum(['approved', 'pending', 'draft']).default('approved')
       }))
       .query(async ({ ctx, input }) => {
         const subdivisions = await ctx.db.subdivision.findMany({
           where: {
             countryId: input.countryId,
             status: input.status
           }
         });

         // Convert PostGIS geometry to GeoJSON
         const features = await Promise.all(
           subdivisions.map(async (sub) => {
             const geojson = await ctx.db.$queryRaw`
               SELECT ST_AsGeoJSON(geom_postgis)::json as geometry
               FROM subdivisions WHERE id = ${sub.id}
             `;
             return {
               type: 'Feature',
               id: sub.id,
               geometry: geojson[0].geometry,
               properties: {
                 name: sub.name,
                 type: sub.type,
                 population: sub.population
               }
             };
           })
         );

         return {
           type: 'FeatureCollection',
           features
         };
       }),
   });
   ```

3. **Render dynamic GeoJSON layers**
   ```typescript
   const { data: subdivisions } = api.mapData.getSubdivisions.useQuery({
     countryId: selectedCountry,
     status: 'approved'
   });

   useEffect(() => {
     if (!map || !subdivisions) return;

     const layer = L.geoJSON(subdivisions, {
       style: { color: '#ff7800', weight: 2 }
     });

     layer.addTo(map);

     return () => layer.remove();
   }, [map, subdivisions]);
   ```

4. **Add city markers**
   ```typescript
   const cityIcon = L.icon({
     iconUrl: '/icons/city.png',
     iconSize: [16, 16]
   });

   cities.features.forEach(city => {
     const [lng, lat] = city.geometry.coordinates;
     L.marker([lat, lng], { icon: cityIcon })
       .bindPopup(`<strong>${city.properties.name}</strong>`)
       .addTo(map);
   });
   ```

**Success Criteria:**
- ✅ User subdivisions display on map
- ✅ Cities appear as markers
- ✅ Popups show correct information
- ✅ Real-time updates when data changes

### Phase 4: Map Editor (Weeks 4-5)

**Goal:** Enable in-browser editing of subdivisions

**Tasks:**

1. **Add Leaflet Draw plugin**
   ```typescript
   import 'leaflet-draw';

   const drawControl = new L.Control.Draw({
     draw: {
       polygon: true,
       rectangle: true,
       circle: false,
       circlemarker: false,
       marker: false,
       polyline: false
     },
     edit: {
       featureGroup: subdivisionLayer
     }
   });

   map.addControl(drawControl);
   ```

2. **Handle draw events**
   ```typescript
   map.on('draw:created', async (e) => {
     const { layer } = e;
     const geojson = layer.toGeoJSON();

     // Save to database via tRPC
     await api.mapEditor.createSubdivision.mutate({
       countryId: selectedCountry,
       name: subdivisionName,
       geometry: geojson.geometry
     });
   });
   ```

3. **Add validation**
   - Check for overlaps with existing subdivisions
   - Validate within country boundaries
   - Ensure geometry is valid (no self-intersections)

4. **Admin approval workflow**
   - Draft → Pending → Approved status
   - Admin review panel
   - Bulk approve/reject

**Success Criteria:**
- ✅ Users can draw subdivisions on map
- ✅ Geometries saved to PostGIS
- ✅ Validation prevents invalid submissions
- ✅ Admin approval workflow functional

### Phase 5: Performance Optimization (Week 6)

**Goal:** Ensure smooth performance at scale

**Tasks:**

1. **Implement LOD (Level of Detail)**
   ```typescript
   // From original ixmaps-new LODManager
   const lodLevels = {
     low: { zoom: [0, 2], url: '/maps/tiles/political-low/{z}/{x}/{y}.png' },
     medium: { zoom: [3, 4], url: '/maps/tiles/political-med/{z}/{x}/{y}.png' },
     high: { zoom: [5, 6], url: '/maps/tiles/political-high/{z}/{x}/{y}.png' }
   };

   map.on('zoomend', () => {
     const zoom = map.getZoom();
     switchToAppropriateLOD(zoom);
   });
   ```

2. **Add clustering for cities**
   ```typescript
   import 'leaflet.markercluster';

   const markers = L.markerClusterGroup();
   cities.forEach(city => {
     const marker = L.marker(city.coordinates);
     markers.addLayer(marker);
   });
   map.addLayer(markers);
   ```

3. **Optimize GeoJSON rendering**
   ```typescript
   // Simplify geometries at lower zoom levels
   const simplifiedGeojson = turf.simplify(geojson, {
     tolerance: map.getZoom() < 3 ? 0.01 : 0.001,
     highQuality: false
   });
   ```

4. **Browser caching**
   ```typescript
   // Cache tile requests
   const tileLayer = L.tileLayer(url, {
     maxAge: 86400000, // 24 hours
     detectRetina: true
   });
   ```

**Success Criteria:**
- ✅ <100ms initial load time
- ✅ 60 FPS during pan/zoom
- ✅ <200MB memory usage
- ✅ Graceful degradation with thousands of features

### Phase 6: Optional 3D Terrain (Week 7+)

**Goal:** Add MapLibre overlay for 3D effects (optional enhancement)

**Tasks:**

1. **Install MapLibre-Leaflet plugin**
   ```bash
   npm install maplibre-gl maplibre-gl-leaflet
   ```

2. **Add 3D terrain overlay**
   ```typescript
   import { MaplibreGlLayer } from 'maplibre-gl-leaflet';

   const terrainLayer = new MaplibreGlLayer({
     style: {
       version: 8,
       sources: {
         terrain: {
           type: 'raster-dem',
           url: '/api/terrain-tiles'
         }
       },
       layers: [
         {
           id: 'hillshading',
           type: 'hillshade',
           source: 'terrain'
         }
       ]
     }
   });

   // Only add if user enables 3D mode
   if (enable3DMode) {
     map.addLayer(terrainLayer);
   }
   ```

3. **Toggle between 2D/3D**
   ```typescript
   const [is3DEnabled, setIs3DEnabled] = useState(false);

   const toggle3D = () => {
     if (is3DEnabled) {
       map.removeLayer(terrainLayer);
     } else {
       map.addLayer(terrainLayer);
     }
     setIs3DEnabled(!is3DEnabled);
   };
   ```

**Success Criteria:**
- ✅ Optional 3D terrain overlay works
- ✅ No interference with base 2D layers
- ✅ Smooth toggle between 2D/3D
- ✅ No dateline artifacts in 3D mode

---

## Learned Lessons

### From IxMaps 2.0 (MapLibre Implementation)

#### 1. **Don't Force Standard Projections on Custom Worlds**

**Problem:** MapLibre GL JS is built for Earth's Web Mercator projection. Forcing IxEarth's custom coordinate system into this framework caused constant issues.

**Lesson:** When you have a custom coordinate system, choose a library designed for flexibility (Leaflet) rather than performance (MapLibre). WebGL performance doesn't matter if rendering is incorrect.

**Action:** IxMaps 3.0 uses Leaflet with custom CRS designed specifically for IxEarth.

#### 2. **Dateline Crossing is a Projection Problem, Not a Data Problem**

**Problem:** Spent days trying to "fix" GeoJSON data by splitting polygons at the dateline, creating invalid geometries (coordinates >180°), and fighting PostGIS topology errors.

**Lesson:** Countries that cross the dateline are valid. The issue is the projection system doesn't handle them correctly. With a custom projection, dateline crossing is a non-issue.

**Action:** Keep original GeoJSON as-is. Custom CRS handles coordinate wrapping naturally.

#### 3. **Vector Tiles Are Overkill for Static Base Layers**

**Problem:** Set up Martin tile server, Redis caching, complex cache invalidation—all for base layers (political, terrain, climate) that never change.

**Lesson:** Vector tiles are valuable for dynamic, real-time data. For static world geography, they add complexity without benefit.

**Action:**
- Static layers: Use SVG or pre-rendered raster tiles (generate once, serve forever)
- Dynamic layers: Serve GeoJSON from PostGIS via tRPC (no tiles needed)

#### 4. **Keep PostGIS for What It's Good At**

**Problem:** Used PostGIS for everything, including static base layers. This required complex spatial queries, tile generation, and caching.

**Lesson:** PostGIS excels at:
- Spatial queries (find subdivisions within country)
- Geometric operations (calculate area, distance, intersections)
- User-editable content (subdivisions, cities, POIs)

PostGIS is NOT needed for:
- Serving static base layers
- Tile generation for non-editable geography

**Action:** PostGIS only stores user-created and admin-managed content. Base layers are files on disk.

#### 5. **Simpler Architecture = Faster Development**

**Problem:** Current architecture requires understanding:
- MapLibre GL JS internals
- Vector tile specification (MVT)
- Martin tile server configuration
- PostGIS spatial functions
- Redis caching strategies
- Coordinate projection mathematics

**Lesson:** Each additional service/technology increases debugging time exponentially. When something breaks, you have to check 5+ different systems.

**Action:** IxMaps 3.0 architecture:
- Leaflet (well-documented, mature)
- Static files (SVG or raster tiles)
- PostGIS (only for dynamic content)
- tRPC (type-safe API)

Total: 4 technologies instead of 8.

#### 6. **The Original ixmaps-new Had It Right**

**Problem:** Abandoned a working Leaflet implementation because it seemed "old" compared to WebGL solutions.

**Lesson:**
- Leaflet 1.x handled IxEarth coordinates perfectly
- SVG layers rendered without artifacts
- Simple coordinate transformation functions worked reliably
- No dateline issues

**Action:** IxMaps 3.0 is essentially ixmaps-new upgraded to Leaflet 2.0 and integrated into IxStats. Sometimes the "boring" solution is the right one.

#### 7. **Premature Optimization Wastes Time**

**Problem:** Spent time optimizing vector tile caching, Redis configuration, pre-generation scripts—before base functionality worked correctly.

**Lesson:** Get it working first, optimize later. Banding artifacts are worse than slow tiles.

**Action:** Phase 1 focuses solely on correct rendering. Performance optimization comes in Phase 5 after core functionality is solid.

### From Freelancer's IxMaps Conversion

#### 8. **Conversion Tools Are Valuable, The Architecture May Not Be**

**Problem:** Freelancer delivered a great SVG → GeoJSON conversion workflow but built a static visualization tool instead of an integrated platform.

**Lesson:** Distinguish between:
- **Good:** GeoJSON conversion scripts, coordinate transformation logic
- **Bad:** PMTiles-only architecture that can't support dynamic editing

**Action:** Keep the conversion scripts, discard the PMTiles-only approach.

#### 9. **Understand the Full Requirements Before Choosing Architecture**

**Problem:** Freelancer optimized for static map serving (PMTiles) when the PRD required dynamic, user-editable borders with economic integration.

**Lesson:** Architecture decisions have long-term consequences. A "convert once and serve" approach doesn't work when users need to edit borders in real-time.

**Action:** IxMaps 3.0 PRD explicitly separates:
- Static layers (base geography)
- Dynamic layers (user content)

### From IxEarth Coordinate System Design

#### 10. **Document Coordinate System Assumptions Thoroughly**

**Problem:** The 26.09° prime meridian shift and 1.4777x scale factor were discovered through archaeology of old code and documentation.

**Lesson:** Custom coordinate systems need comprehensive documentation:
- Why the shift exists (IxMaps convention)
- How to convert between systems
- What the scale factor represents
- Edge cases and limitations

**Action:** IxEarth constants are now centralized in `ixearth-constants.ts` with extensive comments and examples.

#### 11. **Custom Projections Need Custom Tools**

**Problem:** Tried to use standard GIS tools (QGIS, PostGIS functions) designed for Earth projections on IxEarth data.

**Lesson:** Standard tools make assumptions about coordinate systems (±180° longitude, Web Mercator, etc.). Custom worlds need custom tooling.

**Action:** Built custom coordinate transformation functions specific to IxEarth rather than fighting standard tools.

---

## Success Criteria

### Technical Requirements

#### Rendering Quality
- ✅ Zero horizontal banding artifacts
- ✅ All countries visible and correctly positioned
- ✅ Dateline-crossing countries (Oyashima, Daxia, Metzetta) render without distortion
- ✅ Smooth transitions between zoom levels
- ✅ Accurate coordinate display (matches IxEarth system)

#### Performance
- ✅ Initial map load: <100ms
- ✅ Pan/zoom performance: 60 FPS
- ✅ Memory usage: <200MB
- ✅ Handles 10,000+ features without degradation
- ✅ Mobile-responsive (works on tablets/phones)

#### Functionality
- ✅ All 7 base layers render correctly (political, climate, terrain, rivers, lakes, icecaps, background)
- ✅ Layer switcher functional
- ✅ Grid overlay displays latitude/longitude lines
- ✅ Prime meridian (26.09°E) clearly marked
- ✅ Coordinate display shows mouse position
- ✅ User subdivisions display from PostGIS
- ✅ Cities appear as markers with popups
- ✅ Points of interest display correctly

#### Data Integrity
- ✅ All GeoJSON files validated (no invalid geometries)
- ✅ Coordinate ranges within expected bounds
- ✅ PostGIS spatial indexes applied
- ✅ No data loss during import process
- ✅ Topology validated (no self-intersections)

#### Developer Experience
- ✅ Clear code organization
- ✅ TypeScript types for all components
- ✅ Documented coordinate transformation functions
- ✅ Easy to add new layers
- ✅ Simple deployment process (no multiple services)

### User Experience Requirements

#### Map Viewing
- ✅ Intuitive navigation (pan, zoom, scroll)
- ✅ Responsive on desktop and mobile
- ✅ Clear visual hierarchy (base layers vs dynamic content)
- ✅ Tooltips show country/region names on hover
- ✅ Search functionality (find country, city, POI)

#### Map Editing (Admin)
- ✅ Draw tool for creating subdivisions
- ✅ Edit existing geometries
- ✅ Validation prevents invalid submissions
- ✅ Preview changes before saving
- ✅ Approval workflow (draft → pending → approved)

#### Integration with IxStats
- ✅ Country pages link to map view
- ✅ Clicking map region navigates to country page
- ✅ Economic data overlay (GDP, population density, etc.)
- ✅ Consistent UI design (glass physics)
- ✅ Accessible from main navigation

---

## Technical Specifications

### Technology Stack

#### Core Dependencies
```json
{
  "dependencies": {
    "leaflet": "^2.0.0-alpha.1",
    "@types/leaflet": "^1.9.8",
    "leaflet-draw": "^1.0.4",
    "leaflet.markercluster": "^1.5.3",
    "react": "^18.2.0",
    "next": "^15.5.4",
    "typescript": "^5.3.3"
  },
  "optionalDependencies": {
    "maplibre-gl": "^4.0.0",
    "maplibre-gl-leaflet": "^0.0.20"
  }
}
```

#### Backend Stack (Unchanged)
- **Framework:** Next.js 15 with App Router
- **Database:** PostgreSQL 15 + PostGIS 3.4
- **ORM:** Prisma 5.x
- **API:** tRPC 10.x
- **Authentication:** Clerk

### File Structure

```
/ixwiki/public/projects/ixstats/
├── docs/
│   └── IXMAPS_3_PRD.md                    # This document
├── public/
│   └── maps/
│       ├── layers/                        # Static SVG layers
│       │   ├── political.svg
│       │   ├── climate.svg
│       │   ├── terrain.svg
│       │   └── ...
│       └── tiles/                         # Pre-rendered raster tiles
│           ├── political/
│           │   └── {z}/{x}/{y}.png
│           └── ...
├── scripts/
│   ├── geojson_sanitized/                 # Source GeoJSON files
│   │   ├── political.geojson
│   │   ├── climate.geojson
│   │   └── ...
│   ├── svg-to-geojson.ts                  # Conversion script
│   ├── validate-geojson.sh                # Validation script
│   ├── generate-raster-tiles.sh           # Tile generation
│   └── import-dynamic-layers.sh           # PostGIS import
├── src/
│   ├── components/
│   │   └── maps/
│   │       ├── IxEarthMap.tsx             # Main map component
│   │       ├── LayerSwitcher.tsx          # UI for layer control
│   │       ├── CoordinateDisplay.tsx      # Show lat/lng
│   │       ├── GridOverlay.tsx            # Lat/lng grid
│   │       ├── MapEditor.tsx              # Drawing tools
│   │       └── MapSearch.tsx              # Search functionality
│   ├── lib/
│   │   └── maps/
│   │       ├── ixearth-crs.ts             # Custom CRS definition
│   │       ├── coordinates-system.ts      # Transformation functions
│   │       ├── ixearth-constants.ts       # Planetary metrics
│   │       └── map-utils.ts               # Helper functions
│   └── server/
│       └── api/
│           └── routers/
│               ├── mapData.ts             # GeoJSON serving
│               └── mapEditor.ts           # CRUD operations
└── prisma/
    └── schema.prisma                      # Database schema (unchanged)
```

### API Endpoints

#### tRPC Routers

**mapData router** (Read-only)
```typescript
export const mapDataRouter = createTRPCRouter({
  // Get subdivisions as GeoJSON
  getSubdivisions: publicProcedure
    .input(z.object({
      countryId: z.string().optional(),
      status: z.enum(['approved', 'pending', 'draft']).default('approved')
    }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  // Get cities as GeoJSON
  getCities: publicProcedure
    .input(z.object({
      countryId: z.string().optional(),
      type: z.enum(['city', 'town', 'village', 'capital']).optional()
    }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  // Get points of interest
  getPOIs: publicProcedure
    .input(z.object({
      countryId: z.string().optional(),
      category: z.string().optional()
    }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  // Search by name
  searchMap: publicProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ ctx, input }) => { /* ... */ }),
});
```

**mapEditor router** (Mutations)
```typescript
export const mapEditorRouter = createTRPCRouter({
  // Create subdivision
  createSubdivision: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      name: z.string(),
      type: z.string(),
      geometry: z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.array(z.number())))
      })
    }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  // Update subdivision
  updateSubdivision: protectedProcedure
    .input(z.object({
      id: z.string(),
      geometry: z.object({ /* ... */ }).optional(),
      name: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  // Submit for approval
  submitForApproval: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  // Admin: Approve/reject
  reviewSubmission: protectedProcedure
    .input(z.object({
      id: z.string(),
      action: z.enum(['approve', 'reject']),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),
});
```

### Database Schema (Additions)

**Existing tables remain unchanged. New fields:**

```prisma
model Country {
  // ... existing 131+ fields ...

  // Geographic data (new)
  geom_postgis    Unsupported("geometry(MultiPolygon, 4326)")?
  centroid_lat    Float?
  centroid_lng    Float?

  // Relationships
  subdivisions    Subdivision[]
  cities          City[]
  pois            PointOfInterest[]
}

model Subdivision {
  id              String   @id @default(cuid())
  countryId       String
  name            String
  type            String   // prefecture, state, province, etc.
  geometry        Json     // GeoJSON representation
  geom_postgis    Unsupported("geometry(Polygon, 4326)")?
  status          String   @default("draft") // draft, pending, approved, rejected
  submittedBy     String
  submittedAt     DateTime @default(now())
  reviewedBy      String?
  reviewedAt      DateTime?

  country         Country  @relation(fields: [countryId], references: [id])

  @@index([countryId, status])
  @@index([status, submittedAt])
}

model City {
  id                  String   @id @default(cuid())
  countryId           String
  name                String
  type                String   // city, town, village, capital
  coordinates         Json     // GeoJSON Point
  geom_postgis        Unsupported("geometry(Point, 4326)")?
  population          Int?
  isNationalCapital   Boolean  @default(false)
  status              String   @default("approved")

  country             Country  @relation(fields: [countryId], references: [id])

  @@index([countryId])
  @@index([isNationalCapital])
}

model PointOfInterest {
  id            String   @id @default(cuid())
  countryId     String
  name          String
  category      String   // monument, landmark, military, etc.
  coordinates   Json     // GeoJSON Point
  geom_postgis  Unsupported("geometry(Point, 4326)")?
  description   String?
  status        String   @default("approved")

  country       Country  @relation(fields: [countryId], references: [id])

  @@index([countryId, category])
}
```

---

## Risk Mitigation

### Technical Risks

#### Risk 1: Leaflet 2.0 Alpha Stability

**Risk:** Leaflet 2.0 is still in alpha, may have bugs or breaking changes

**Mitigation:**
- Leaflet 2.0 maintains backward compatibility with 1.x API
- Can fallback to Leaflet 1.9 if needed (stable, well-tested)
- Most features we need exist in 1.x, 2.0 adds enhancements
- Active community and rapid bugfix cycle

**Contingency:** Use Leaflet 1.9.4 (stable) if 2.0 alpha causes issues

#### Risk 2: Performance with Large Datasets

**Risk:** Rendering thousands of subdivisions/cities may cause slowdown

**Mitigation:**
- Implement LOD (Level of Detail) from original ixmaps-new
- Use marker clustering for cities (leaflet.markercluster)
- Simplify geometries at lower zoom levels (turf.js simplify)
- Lazy-load features (only fetch visible regions)

**Metrics:**
- Target: <200ms to render 10,000 features
- Monitor: Frame rate during pan/zoom
- Alert: If memory usage exceeds 500MB

#### Risk 3: Browser Compatibility

**Risk:** Custom CRS or advanced Leaflet features may not work in all browsers

**Mitigation:**
- Test on Chrome, Firefox, Safari, Edge
- Provide fallback for older browsers
- Use feature detection (Modernizr)
- Graceful degradation (disable advanced features if unsupported)

**Minimum browser support:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

#### Risk 4: Coordinate System Edge Cases

**Risk:** Unexpected behavior at map boundaries or extreme coordinates

**Mitigation:**
- Comprehensive testing of dateline-crossing countries
- Validate all coordinate transformations
- Add bounds checking to prevent invalid coordinates
- Document known limitations

**Test cases:**
- Countries crossing dateline (Oyashima, Daxia, Metzetta)
- Polar regions (icecaps layer)
- Map wrap-around behavior
- Zoom level edge cases

### Project Risks

#### Risk 5: Timeline Delays

**Risk:** Implementation takes longer than estimated 6 weeks

**Mitigation:**
- Phases 1-3 are critical, 4-6 are enhancements
- Minimum viable product: Phase 1-2 (correct rendering + base layers)
- Buffer time built into each phase
- Weekly progress checkpoints

**Escalation:**
- If Phase 1 takes >2 weeks, reassess approach
- If dateline issues persist, consider alternative projections
- Document blockers immediately

#### Risk 6: Data Migration Issues

**Risk:** Existing PostGIS data doesn't work with new system

**Mitigation:**
- Existing subdivisions/cities table schema stays the same
- GeoJSON → PostGIS import already tested and working
- No changes to database structure
- Only frontend rendering changes

**Verification:**
- Test data export from PostGIS
- Verify GeoJSON format compatibility
- Check spatial indexes still apply

#### Risk 7: User Adoption

**Risk:** Users prefer old map system or find new one confusing

**Mitigation:**
- Keep UI/UX consistent with IxStats design system
- Provide migration guide for existing features
- Beta test with select users before full rollout
- Gather feedback early and iterate

**Success metrics:**
- User engagement (map views, time spent)
- Feature usage (layer switching, search)
- Error rates (clicks that don't work)
- User feedback scores

---

## Appendix

### A. Glossary

- **CRS:** Coordinate Reference System - defines how coordinates map to geographic locations
- **GeoJSON:** JSON format for encoding geographic data structures
- **PostGIS:** Spatial database extension for PostgreSQL
- **Vector Tiles:** Map tiles that contain vector geometry (not raster images)
- **MVT:** Mapbox Vector Tiles - binary format for vector tiles
- **LOD:** Level of Detail - rendering different detail levels at different zoom levels
- **Dateline:** International Date Line (180°/-180° longitude)
- **WGS84:** World Geodetic System 1984 - standard coordinate system for Earth
- **EPSG:4326:** Spatial reference system identifier for WGS84
- **EPSG:3857:** Web Mercator projection used by most web maps

### B. Reference Documents

**Internal:**
- `docs/IXEARTH_METRICS.md` - Planetary specifications
- `docs/systems/map-system.md` - Current map system documentation
- `docs/archive/ixmaps-notes.md` - Freelancer integration notes
- `docs/MARTIN_TILE_SERVER.md` - Vector tile system (deprecated in 3.0)
- `src/lib/ixearth-constants.ts` - Coordinate system constants

**External:**
- [Leaflet 2.0 Documentation](https://leafletjs.com/reference-2.0.0.html)
- [Leaflet Custom CRS Tutorial](https://leafletjs.com/examples/crs-simple/crs-simple.html)
- [PostGIS ST_AsGeoJSON](https://postgis.net/docs/ST_AsGeoJSON.html)
- [GeoJSON Specification](https://geojson.org/)
- [MapLibre GL Leaflet Plugin](https://github.com/maplibre/maplibre-gl-leaflet)

### C. Coordinate System Examples

**Converting IxMaps SVG to IxEarth Geographic:**

```typescript
// Example: Convert SVG coordinates to lat/lng
const mapConfig: MapConfig = {
  equatorY: 245,              // Y coordinate of equator in SVG
  pixelsPerLatitude: 5.0,     // Scaling factor
  primeMeridianX: 410,        // X coordinate of prime meridian
  pixelsPerLongitude: 8.2,    // Scaling factor
  primeMeridianReferenceLng: 26.09  // Shifted prime meridian
};

// SVG point (500, 200) converts to:
const { lat, lng } = svgToLatLng(500, 200, mapConfig);
// Result: lat = 9.0, lng = 37.06

// Reverse conversion:
const { x, y } = latLngToSvg(9.0, 37.06, mapConfig);
// Result: x = 500, y = 200
```

**IxEarth to WGS84 (for external systems):**

```typescript
// IxEarth uses a shifted prime meridian (26.09°E)
// To convert to standard WGS84 (0° prime meridian):

function ixearthToWGS84(ixLng: number): number {
  // Shift back to Greenwich prime meridian
  return ixLng - 26.09;
}

function wgs84ToIxearth(wgsLng: number): number {
  // Apply IxEarth prime meridian shift
  return wgsLng + 26.09;
}

// Example:
const ixLng = 50.0;  // 50° in IxEarth coordinates
const wgsLng = ixearthToWGS84(ixLng);  // 23.91° in WGS84
```

### D. Migration Checklist

**Before starting implementation:**

- [ ] Backup current map system code (create branch `ixmaps-2-maplibre`)
- [ ] Export all PostGIS data to GeoJSON (backup)
- [ ] Document current system behavior (screenshots, videos)
- [ ] Identify critical features that must be preserved
- [ ] Set up staging environment for testing

**During Phase 1:**

- [ ] Install Leaflet 2.0 alpha
- [ ] Port coordinate system from ixmaps-new
- [ ] Create custom CRS
- [ ] Test political layer rendering
- [ ] Verify no banding artifacts
- [ ] Check all dateline-crossing countries

**During Phase 2:**

- [ ] Add all base layers (climate, terrain, rivers, lakes, icecaps)
- [ ] Implement layer switcher UI
- [ ] Add grid overlay
- [ ] Add coordinate display
- [ ] Test performance at all zoom levels

**During Phase 3:**

- [ ] Verify PostGIS data integrity
- [ ] Create tRPC endpoints
- [ ] Render user subdivisions
- [ ] Add city markers
- [ ] Test real-time updates

**Before production deployment:**

- [ ] Full browser compatibility testing
- [ ] Performance benchmarking
- [ ] Security review of map editor
- [ ] User acceptance testing
- [ ] Documentation complete
- [ ] Rollback plan ready

---

## Conclusion

IxMaps 3.0 represents a return to proven technology (Leaflet) with modern enhancements (2.0 alpha, tRPC integration, PostGIS for dynamic content). By learning from the MapLibre struggles, we're building a system that:

1. **Correctly renders IxEarth** with its custom coordinate system
2. **Simplifies architecture** by eliminating unnecessary services
3. **Enables future growth** with modular, maintainable code
4. **Performs efficiently** through appropriate use of LOD and caching
5. **Integrates seamlessly** with the existing IxStats platform

The key insight: **Custom coordinate systems need custom-friendly libraries**. Leaflet's flexibility and maturity make it the right choice for IxEarth, while MapLibre's WebGL performance is valuable for standard Earth projections but fights against custom worlds.

Implementation begins with Phase 1: proving Leaflet can render the political map without banding artifacts. Once that milestone is achieved, the rest is incremental enhancement.

---

**Document Version:** 1.0.0
**Last Updated:** November 11, 2025
**Next Review:** After Phase 1 completion
**Approved By:** IxStats Development Team

**Questions or concerns?** Contact the development team or open an issue in the project tracker.
