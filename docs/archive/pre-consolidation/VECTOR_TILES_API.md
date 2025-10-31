# Vector Tiles API Documentation

## Overview

Three vector tile endpoints have been implemented for user-generated map features using PostGIS ST_AsMVT. These endpoints generate Mapbox Vector Tiles (MVT) for efficient rendering in MapLibre GL JS.

## Endpoints

### 1. Subdivisions Tiles
**Endpoint:** `/api/tiles/subdivisions/{z}/{x}/{y}`

**Features:**
- Displays administrative subdivisions (states, provinces, regions, territories)
- Zoom filtering: Shows at zoom 6+
- Status: Only approved subdivisions
- Caching: 7-day Redis cache with fallback

**Properties:**
- `id` - Unique identifier
- `name` - Subdivision name
- `type` - Subdivision type (state, province, region, territory)
- `level` - Administrative level (1=state, 2=county, 3=district)
- `population` - Population count
- `areaSqKm` - Area in square kilometers
- `capital` - Capital city name

**Example Usage:**
```typescript
map.addSource('subdivisions', {
  type: 'vector',
  tiles: [`${baseUrl}/api/tiles/subdivisions/{z}/{x}/{y}`],
  minzoom: 6,
  maxzoom: 14
});

map.addLayer({
  id: 'subdivisions-fill',
  type: 'fill',
  source: 'subdivisions',
  'source-layer': 'subdivisions',
  paint: {
    'fill-color': '#3B82F6',
    'fill-opacity': 0.3,
    'fill-outline-color': '#1E40AF'
  }
});
```

---

### 2. Cities Tiles
**Endpoint:** `/api/tiles/cities/{z}/{x}/{y}`

**Features:**
- Displays cities, towns, and villages
- Smart zoom filtering:
  - National capitals: zoom 4+
  - Cities: zoom 7+
  - Towns: zoom 9+
  - Villages: zoom 11+
- Status: Only approved cities
- Caching: 7-day Redis cache with fallback

**Properties:**
- `id` - Unique identifier
- `name` - City name
- `type` - City type (capital, city, town, village)
- `population` - Population count
- `isNationalCapital` - Boolean flag
- `isSubdivisionCapital` - Boolean flag
- `elevation` - Elevation in meters

**Example Usage:**
```typescript
map.addSource('cities', {
  type: 'vector',
  tiles: [`${baseUrl}/api/tiles/cities/{z}/{x}/{y}`],
  minzoom: 4,
  maxzoom: 14
});

// National capitals (visible at zoom 4+)
map.addLayer({
  id: 'capitals',
  type: 'symbol',
  source: 'cities',
  'source-layer': 'cities',
  filter: ['==', ['get', 'isNationalCapital'], true],
  layout: {
    'icon-image': 'star-fill',
    'icon-size': 1.5,
    'text-field': ['get', 'name'],
    'text-offset': [0, 1.5],
    'text-size': 14,
    'text-font': ['Open Sans Bold']
  }
});

// Regular cities (visible at zoom 7+)
map.addLayer({
  id: 'cities',
  type: 'circle',
  source: 'cities',
  'source-layer': 'cities',
  filter: ['all',
    ['==', ['get', 'type'], 'city'],
    ['==', ['get', 'isNationalCapital'], false]
  ],
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'],
      7, 4,
      14, 12
    ],
    'circle-color': '#374151',
    'circle-stroke-width': 1,
    'circle-stroke-color': '#FFFFFF'
  }
});
```

---

### 3. Points of Interest (POIs) Tiles
**Endpoint:** `/api/tiles/pois/{z}/{x}/{y}`

**Features:**
- Displays user-submitted points of interest
- Zoom filtering: Shows at zoom 8+
- Optional category filtering via query parameter
- Status: Only approved POIs
- Caching: 7-day Redis cache with fallback

**Properties:**
- `id` - Unique identifier
- `name` - POI name
- `category` - Main category (civilian_cultural, military_defense, natural_features, etc.)
- `subcategory` - Specific subcategory (monument, landmark, museum, etc.)
- `icon` - Icon identifier for rendering
- `description` - POI description

**Category Query Parameter:**
Add `?category=<category_key>` to filter by specific category:
- `civilian_cultural` - Museums, monuments, universities, etc.
- `military_defense` - Military bases, fortresses, etc.
- `natural_features` - Mountains, waterfalls, caves, etc.
- `infrastructure_transport` - Airports, seaports, bridges, etc.
- `commercial_economic` - Mines, factories, farms, etc.
- `government_services` - City halls, embassies, police stations, etc.

**Example Usage:**
```typescript
// All POIs
map.addSource('pois', {
  type: 'vector',
  tiles: [`${baseUrl}/api/tiles/pois/{z}/{x}/{y}`],
  minzoom: 8,
  maxzoom: 14
});

// Filter by category using URL query parameter
map.addSource('military-pois', {
  type: 'vector',
  tiles: [`${baseUrl}/api/tiles/pois/{z}/{x}/{y}?category=military_defense`],
  minzoom: 8,
  maxzoom: 14
});

// Render POIs with custom icons
map.addLayer({
  id: 'pois',
  type: 'symbol',
  source: 'pois',
  'source-layer': 'pois',
  layout: {
    'icon-image': ['get', 'icon'],
    'icon-size': 1,
    'text-field': ['get', 'name'],
    'text-offset': [0, 1.5],
    'text-size': 12,
    'text-optional': true
  }
});
```

---

## Technical Details

### PostGIS Query Pattern

All endpoints use the following PostGIS MVT generation pattern:

```sql
SELECT ST_AsMVT(tile, 'layer_name', 4096, 'geom') as mvt
FROM (
  SELECT
    ST_AsMVTGeom(
      geom_postgis,
      ST_TileEnvelope(z, x, y),
      4096,
      256,
      true
    ) as geom,
    -- properties
  FROM table_name
  WHERE status = 'approved'
    AND geom_postgis IS NOT NULL
    AND geom_postgis && ST_TileEnvelope(z, x, y)
    -- zoom filtering logic
) as tile
WHERE geom IS NOT NULL
```

### Caching Strategy

**Redis Caching (Production):**
- TTL: 7 days (604800 seconds)
- Cache key format: `tile:<layer>:<z>:<x>:<y>`
- Automatic fallback if Redis unavailable

**HTTP Cache Headers:**
```
Content-Type: application/x-protobuf
Cache-Control: public, max-age=604800
X-Cache-Status: HIT | MISS | NO-REDIS
```

### Performance Optimization

1. **Zoom-based filtering** - Reduces tile size at lower zoom levels
2. **Redis caching** - 5-10x performance improvement with caching
3. **PostGIS spatial indexes** - Fast bounding box queries using Gist indexes
4. **Empty tile handling** - Returns empty buffer for graceful MapLibre handling

### Error Handling

All endpoints return empty tiles on error to prevent map rendering failures:

```typescript
// Error response
return new NextResponse(Buffer.from([]), {
  status: 200,
  headers: {
    'Content-Type': 'application/x-protobuf',
    'Cache-Control': 'public, max-age=60',
  },
});
```

---

## Database Schema Requirements

All three tables require PostGIS geometry columns with spatial indexes:

```sql
-- Subdivisions
ALTER TABLE subdivisions ADD COLUMN geom_postgis geometry(Polygon, 4326);
CREATE INDEX idx_subdivision_geom ON subdivisions USING GIST (geom_postgis);

-- Cities
ALTER TABLE cities ADD COLUMN geom_postgis geometry(Point, 4326);
CREATE INDEX idx_city_geom ON cities USING GIST (geom_postgis);

-- Points of Interest
ALTER TABLE points_of_interest ADD COLUMN geom_postgis geometry(Point, 4326);
CREATE INDEX idx_poi_geom ON points_of_interest USING GIST (geom_postgis);
```

---

## Complete MapLibre Integration Example

```typescript
import maplibregl from 'maplibre-gl';

const map = new maplibregl.Map({
  container: 'map',
  style: 'your-base-style.json',
  center: [0, 0],
  zoom: 5
});

map.on('load', () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  // Add subdivisions
  map.addSource('subdivisions', {
    type: 'vector',
    tiles: [`${baseUrl}/api/tiles/subdivisions/{z}/{x}/{y}`],
    minzoom: 6,
    maxzoom: 14
  });

  map.addLayer({
    id: 'subdivisions-fill',
    type: 'fill',
    source: 'subdivisions',
    'source-layer': 'subdivisions',
    paint: {
      'fill-color': '#3B82F6',
      'fill-opacity': 0.3
    }
  });

  // Add cities
  map.addSource('cities', {
    type: 'vector',
    tiles: [`${baseUrl}/api/tiles/cities/{z}/{x}/{y}`],
    minzoom: 4,
    maxzoom: 14
  });

  map.addLayer({
    id: 'cities',
    type: 'circle',
    source: 'cities',
    'source-layer': 'cities',
    paint: {
      'circle-radius': 5,
      'circle-color': '#374151'
    }
  });

  // Add POIs
  map.addSource('pois', {
    type: 'vector',
    tiles: [`${baseUrl}/api/tiles/pois/{z}/{x}/{y}`],
    minzoom: 8,
    maxzoom: 14
  });

  map.addLayer({
    id: 'pois',
    type: 'symbol',
    source: 'pois',
    'source-layer': 'pois',
    layout: {
      'icon-image': ['get', 'icon'],
      'text-field': ['get', 'name']
    }
  });
});
```

---

## Testing

Test endpoints using curl:

```bash
# Test subdivisions tile (should return MVT binary)
curl -I "http://localhost:3000/api/tiles/subdivisions/6/32/21"

# Test cities tile
curl -I "http://localhost:3000/api/tiles/cities/7/64/42"

# Test POIs tile
curl -I "http://localhost:3000/api/tiles/pois/8/128/84"

# Test POIs with category filter
curl -I "http://localhost:3000/api/tiles/pois/8/128/84?category=military_defense"
```

Expected response headers:
```
HTTP/1.1 200 OK
Content-Type: application/x-protobuf
Cache-Control: public, max-age=604800
X-Cache-Status: MISS
```

---

## Related Files

- **API Routes:**
  - `/src/app/api/tiles/subdivisions/[z]/[x]/[y]/route.ts`
  - `/src/app/api/tiles/cities/[z]/[x]/[y]/route.ts`
  - `/src/app/api/tiles/pois/[z]/[x]/[y]/route.ts`

- **Database Schema:** `/prisma/schema.prisma`
- **POI Taxonomy:** `/src/lib/poi-taxonomy.ts`
- **Database Connection:** `/src/server/db.ts`

---

## Notes

- All endpoints use Next.js 15 async params pattern: `context: { params: Promise<{...}> }`
- Redis is optional - endpoints work without Redis but with reduced performance
- Tiles are generated on-demand and cached for 7 days
- Empty tiles are returned for invalid coordinates or zoom levels
- All endpoints filter for `status = 'approved'` records only
