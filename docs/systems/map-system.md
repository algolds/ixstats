# Vector Tile Map System

**Last updated:** November 2025

Comprehensive guide to IxStats' high-performance vector tile system with 100-1000x performance improvements through Martin tile server, Redis caching, and pre-generation.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Performance Metrics](#performance-metrics)
3. [Martin Tile Server](#martin-tile-server)
4. [Redis Caching Layer](#redis-caching-layer)
5. [Tile Pre-Generation](#tile-pre-generation)
6. [Map Editor](#map-editor)
7. [GIS Integration](#gis-integration)
8. [Usage & Operations](#usage--operations)

---

## Architecture Overview

### 3-Layer Performance System

```
┌─────────────────────────────────────────────┐
│         MapLibre Client (Browser)           │
└───────────────┬─────────────────────────────┘
                │ Request tile
                ↓
┌─────────────────────────────────────────────┐
│   Next.js API Proxy (/api/tiles/...)       │
│   - Route to Redis                          │
│   - Fallback to Martin                      │
│   - Cache management                        │
└───────────────┬─────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
        ↓                ↓ (cache miss)
┌───────────────┐  ┌────────────────────────┐
│  Redis Cache  │  │  Martin Tile Server     │
│  - 30-day TTL │  │  - PostGIS direct       │
│  - 2GB limit  │  │  - Rust performance     │
│  - LRU policy │  │  - MVT generation       │
└───────────────┘  └───────────┬────────────┘
                                │
                                ↓
                      ┌──────────────────┐
                      │ PostGIS Database │
                      │ - Spatial queries│
                      │ - Gist indexes   │
                      └──────────────────┘
```

### Key Components

1. **Martin v0.19.3** - Rust-based tile server with PostGIS integration
2. **Redis 7.x** - In-memory caching with 30-day TTL
3. **PostGIS** - Spatial database with geometry storage
4. **Next.js API** - Proxy layer for tile routing
5. **MapLibre GL JS** - Client-side map rendering

---

## Performance Metrics

### Before & After Comparison

| Phase | Description | Performance | Improvement |
|-------|-------------|-------------|-------------|
| **Before** | Next.js + Prisma | 1000-1150ms | Baseline |
| **Phase 1** | Martin Server | 58-220ms | 5-17x faster |
| **Phase 2** | + Redis Cache | <50ms | 20-50x faster |
| **Phase 3** | + Pre-generation | <10ms | 100-1000x faster |

### Cache Hit Rates

- **Cold start:** 0% (first requests)
- **After warm-up:** 85-95%
- **Fully pre-generated:** 99%

### User Experience Impact

**Before:** Visible tile loading, map glitching, poor zoom performance
**After:** Instant loading, smooth interactions, zero perceived latency

---

## Martin Tile Server

### Installation & Setup

**Docker Deployment:**
```bash
# Pull Martin image
docker pull ghcr.io/maplibre/martin:v0.19.3

# Run Martin container
docker run -d \
  --name martin \
  -p 3800:3800 \
  -e DATABASE_URL="postgresql://user:pass@host:5433/ixstats" \
  ghcr.io/maplibre/martin:v0.19.3
```

**Configuration:** `martin-config.yaml`
```yaml
listen_addresses: "0.0.0.0:3800"

postgres:
  connection_string: ${DATABASE_URL}
  pool_size: 20
  tables:
    map_layer_political:
      schema: public
      table: map_layer_political
      srid: 4326
      geometry_column: geom_postgis
      id_column: ogc_fid
    map_layer_climate:
      schema: public
      table: map_layer_climate
      srid: 4326
      geometry_column: geom_postgis
```

### Management Scripts

**Start/Stop/Status:**
```bash
npm run martin:start   # Start Martin server
npm run martin:stop    # Stop Martin server
npm run martin:status  # Check Martin status
npm run martin:test    # Test tile generation
```

**Script:** `scripts/martin-tiles.sh`
```bash
#!/bin/bash
case "$1" in
  start)
    docker start martin || docker run -d --name martin ...
    ;;
  stop)
    docker stop martin
    ;;
  test)
    curl -s http://localhost:3800/map_layer_political/0/0/0
    ;;
esac
```

### Direct PostGIS Integration

Martin bypasses Prisma ORM for optimal performance:

```sql
-- Martin executes queries like:
SELECT ST_AsMVT(tile, 'political', 4096, 'geom')
FROM (
  SELECT ogc_fid, name, country_id,
         ST_AsMVTGeom(
           geom_postgis,
           ST_TileEnvelope($1, $2, $3),
           4096, 256, true
         ) AS geom
  FROM map_layer_political
  WHERE geom_postgis && ST_TileEnvelope($1, $2, $3)
) AS tile;
```

**Performance Advantages:**
- No ORM overhead
- Streaming vector tile (MVT) format
- Optimized spatial queries
- Native PostGIS functions

---

## Redis Caching Layer

### Configuration

**Docker Setup:**
```bash
docker run -d \
  --name redis-tiles \
  -p 6379:6379 \
  -v redis-tile-cache:/data \
  redis:7-alpine \
  redis-server \
  --maxmemory 2gb \
  --maxmemory-policy allkeys-lru \
  --save 60 1000
```

**Cache Strategy:**
- **TTL:** 30 days (tiles rarely change)
- **Capacity:** 2GB
- **Eviction:** LRU (Least Recently Used)
- **Persistence:** Snapshot every 60s if 1000+ keys changed

### Key Format

```
tile:{layer}:{z}:{x}:{y}
```

**Examples:**
```
tile:political:5:16:10
tile:climate:3:4:2
tile:altitudes:8:128:94
```

### Next.js API Proxy

**Endpoint:** `/api/tiles/[layer]/[z]/[x]/[y]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3
});

export async function GET(
  request: NextRequest,
  { params }: { params: { layer: string; z: string; x: string; y: string } }
) {
  const { layer, z, x, y } = params;
  const cacheKey = `tile:${layer}:${z}:${x}:${y}`;

  // Try Redis cache first
  const cached = await redis.getBuffer(cacheKey);
  if (cached) {
    return new NextResponse(cached, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.mapbox-vector-tile',
        'Cache-Control': 'public, max-age=2592000', // 30 days
        'X-Cache': 'HIT'
      }
    });
  }

  // Cache miss - fetch from Martin
  const martinUrl = `http://localhost:3800/${layer}/${z}/${x}/${y}`;
  const response = await fetch(martinUrl);

  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }

  const tile = Buffer.from(await response.arrayBuffer());

  // Store in Redis
  await redis.setex(cacheKey, 2592000, tile); // 30 days

  return new NextResponse(tile, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.mapbox-vector-tile',
      'Cache-Control': 'public, max-age=2592000',
      'X-Cache': 'MISS'
    }
  });
}
```

### Cache Management

**Monitor cache statistics:**
```bash
npm run redis:stats

# Output:
# Keys: 45,231
# Memory Used: 1.2 GB / 2.0 GB
# Hit Rate: 94.3%
# Evictions: 1,245
```

**Manual cache operations:**
```bash
# Clear specific layer
redis-cli --scan --pattern "tile:political:*" | xargs redis-cli del

# Clear all tiles
redis-cli FLUSHDB

# Check specific tile
redis-cli GET "tile:political:5:16:10"
```

---

## Tile Pre-Generation

### Pre-Generation Strategy

**Rationale:** Pre-generate commonly viewed zoom levels (0-8) to eliminate cold start delays.

**Scope:**
- Zoom levels: 0-8
- Tiles per zoom level (z):
  - z0: 1 tile (4^0)
  - z1: 4 tiles (4^1)
  - z2: 16 tiles (4^2)
  - ...
  - z8: 65,536 tiles (4^8)
- **Total:** 87,381 tiles per layer

**Layers to pre-generate:**
1. Political (borders, countries)
2. Climate (climate zones)
3. Altitudes (elevation)
4. Icecaps (polar regions)
5. Rivers (waterways) [NEW]

### Pre-Generation Script

**Script:** `scripts/pregenerate-tiles.ts`

```typescript
async function pregenerateTiles(
  layer: string,
  maxZoom: number = 8
): Promise<void> {
  console.log(`Pre-generating ${layer} tiles (zoom 0-${maxZoom})...`);

  let totalTiles = 0;
  let generated = 0;
  let cached = 0;

  // Calculate total tiles
  for (let z = 0; z <= maxZoom; z++) {
    totalTiles += Math.pow(4, z);
  }

  for (let z = 0; z <= maxZoom; z++) {
    const tilesAtZoom = Math.pow(2, z);

    for (let x = 0; x < tilesAtZoom; x++) {
      for (let y = 0; y < tilesAtZoom; y++) {
        const url = `http://localhost:3000/api/tiles/${layer}/${z}/${x}/${y}`;

        try {
          const response = await fetch(url);
          if (response.ok) {
            const cacheStatus = response.headers.get('X-Cache');
            if (cacheStatus === 'HIT') {
              cached++;
            } else {
              generated++;
            }
          }
        } catch (error) {
          console.error(`Failed to generate ${z}/${x}/${y}:`, error);
        }

        // Progress update
        if ((generated + cached) % 1000 === 0) {
          const progress = ((generated + cached) / totalTiles * 100).toFixed(1);
          console.log(`Progress: ${progress}% (${generated} generated, ${cached} cached)`);
        }
      }
    }
  }

  console.log(`✅ Complete: ${generated} generated, ${cached} already cached`);
}
```

### Usage

**Pre-generate common tiles (zoom 0-5):**
```bash
npm run tiles:pregenerate

# Estimated time: 5-10 minutes
# Tiles generated: ~1,365 per layer
```

**Pre-generate all tiles (zoom 0-8):**
```bash
npm run tiles:pregenerate-full

# Estimated time: 60-90 minutes
# Tiles generated: 87,381 per layer
# Total data: ~400-800 MB per layer
```

**Schedule automatic pre-generation:**
```bash
# Add to cron (regenerate weekly)
0 2 * * 0 cd /ixwiki/public/projects/ixstats && npm run tiles:pregenerate-full
```

---

## Map Editor

### Features

**CRUD Operations:**
1. **Subdivisions** (provinces, states, regions)
   - Create, edit, delete geographic subdivisions
   - Assign to countries
   - Define boundaries (GeoJSON polygons)

2. **Cities** (population centers)
   - Add cities with coordinates
   - Set population, importance level
   - Mark capital cities

3. **Points of Interest** (POIs)
   - Landmarks, military bases, monuments
   - Categorize by type
   - Custom icons and descriptions

4. **Border Editing**
   - Modify country boundaries
   - Territory management
   - Historical border tracking

### Admin Interface

**Location:** `/admin/map-editor`

**UI Components:**
- Interactive map with drawing tools
- Sidebar with entity list
- Form editors for properties
- Validation and error display
- Batch import/export

**Drawing Tools:**
- Polygon tool for boundaries
- Point tool for cities/POIs
- Line tool for borders
- Edit mode for existing geometries

### API Endpoints

**Subdivisions:**
```typescript
api.mapEditor.createSubdivision.useMutation()
api.mapEditor.updateSubdivision.useMutation()
api.mapEditor.deleteSubdivision.useMutation()
api.mapEditor.getSubdivisions.useQuery({ countryId })
```

**Cities:**
```typescript
api.mapEditor.createCity.useMutation()
api.mapEditor.updateCity.useMutation()
api.mapEditor.listCities.useQuery({ countryId })
```

**POIs:**
```typescript
api.mapEditor.createPOI.useMutation()
api.mapEditor.bulkImportPOIs.useMutation()
```

---

## GIS Integration

### PostGIS Geometry Storage

**Schema:**
```sql
-- Geometry column (native PostGIS type)
geom_postgis geometry(Geometry, 4326)

-- GIS index for spatial queries
CREATE INDEX idx_country_geom ON countries USING GIST (geom_postgis);
CREATE INDEX idx_subdivision_geom ON subdivisions USING GIST (geom_postgis);
CREATE INDEX idx_city_point ON cities USING GIST (geom_postgis);
```

**SRID 4326:** WGS 84 coordinate system (standard latitude/longitude)

### Spatial Queries

**Find countries intersecting a bounding box:**
```sql
SELECT id, name
FROM countries
WHERE ST_Intersects(
  geom_postgis,
  ST_MakeEnvelope(minLon, minLat, maxLon, maxLat, 4326)
);
```

**Calculate area:**
```sql
SELECT
  name,
  ST_Area(geom_postgis::geography) / 1000000 AS area_sq_km
FROM countries;
```

**Find nearest city:**
```sql
SELECT name, ST_Distance(
  geom_postgis::geography,
  ST_Point(longitude, latitude)::geography
) AS distance_meters
FROM cities
ORDER BY distance_meters
LIMIT 1;
```

### Geometry Validation

**Prisma integration:**
```typescript
// Validate before insert
const isValid = await prisma.$queryRaw`
  SELECT ST_IsValid(ST_GeomFromGeoJSON(${geoJSON}))
`;

if (!isValid) {
  throw new Error('Invalid geometry');
}

// Fix invalid geometries
const fixed = await prisma.$queryRaw`
  SELECT ST_AsGeoJSON(ST_MakeValid(ST_GeomFromGeoJSON(${geoJSON})))
`;
```

---

## Usage & Operations

### Client-Side Map Integration

**MapLibre setup:**
```typescript
import maplibregl from 'maplibre-gl';

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      political: {
        type: 'vector',
        tiles: ['http://localhost:3000/api/tiles/political/{z}/{x}/{y}'],
        minzoom: 0,
        maxzoom: 14
      }
    },
    layers: [
      {
        id: 'countries',
        type: 'fill',
        source: 'political',
        'source-layer': 'political',
        paint: {
          'fill-color': '#888888',
          'fill-opacity': 0.4
        }
      },
      {
        id: 'borders',
        type: 'line',
        source: 'political',
        'source-layer': 'political',
        paint: {
          'line-color': '#000000',
          'line-width': 2
        }
      }
    ]
  }
});
```

### Monitoring

**Map Monitoring Dashboard:** `/admin/maps-monitoring`

**Metrics tracked:**
- Tile requests per minute
- Cache hit rates
- Martin server health
- Redis memory usage
- Average response times
- Error rates by layer

**Alerts:**
- Cache hit rate <80%
- Martin server down
- Redis memory >90%
- Error rate >5%

### Troubleshooting

**Issue:** Tiles not loading
**Solution:**
1. Check Martin status: `npm run martin:status`
2. Check Redis: `redis-cli PING`
3. Review logs: `docker logs martin`
4. Test direct Martin: `curl http://localhost:3800/political/0/0/0`

**Issue:** Slow tile loading
**Solution:**
1. Pre-generate tiles: `npm run tiles:pregenerate`
2. Check cache hit rate: `npm run redis:stats`
3. Verify PostGIS indexes exist
4. Consider increasing Redis memory

**Issue:** Invalid geometries
**Solution:**
```sql
-- Find invalid geometries
SELECT id, name FROM countries WHERE NOT ST_IsValid(geom_postgis);

-- Fix invalid geometries
UPDATE countries SET geom_postgis = ST_MakeValid(geom_postgis)
WHERE NOT ST_IsValid(geom_postgis);
```

---

## Reference Documentation

### Related Guides
- [VECTOR_TILES_COMPLETE_GUIDE.md](../VECTOR_TILES_COMPLETE_GUIDE.md) - Full implementation guide
- [MARTIN_TILE_SERVER.md](../MARTIN_TILE_SERVER.md) - Martin configuration
- [Admin CMS Guide](./admin-cms.md) - Map editor interface

### External Resources
- [Martin Documentation](https://maplibre.org/martin/)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/)
- [PostGIS Documentation](https://postgis.net/docs/)
- [MVT Specification](https://github.com/mapbox/vector-tile-spec)
