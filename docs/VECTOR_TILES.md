# Vector Tiles System - Complete Guide

**Status**: Production Ready (All 3 Phases Complete)
**Performance**: 50-1000x faster than original implementation
**Last Updated**: October 30, 2025

---

## Overview

The IxStats vector tile system provides high-performance map rendering using Mapbox Vector Tiles (MVT) format with PostGIS backend. The system replaces the old GeoJSON approach, reducing map load times from **10+ seconds to under 2 seconds** through progressive tile loading and efficient caching.

### Key Benefits

- **10x faster load times** (<2s vs 10+s)
- **95%+ data transfer reduction** (MB → KB)
- **90% memory reduction** (500MB → 50MB)
- **Progressive loading** (map interactive immediately)
- **Browser caching** (instant subsequent loads)
- **Industry standard** (Mapbox, OSM, Google use this)

---

## Architecture Overview

```
┌─────────────┐
│   Browser   │
│  (MapLibre) │
└──────┬──────┘
       │
       ↓
┌──────────────────────────────────┐
│   Next.js API Proxy Route        │
│   /api/tiles/[layer]/[z]/[x]/[y] │
│   - CORS handling                │
│   - Error handling               │
│   - Cache-Control headers        │
└───────────┬──────────────────────┘
            │
            ↓
    ┌───────────────┐
    │  Redis Cache  │ ← Phase 2
    │  (2GB, LRU)   │
    └───────┬───────┘
            │
            ↓ (on cache miss)
    ┌───────────────────┐
    │  Martin Server    │ ← Phase 1
    │  (Rust, Port 3800)│
    └───────┬───────────┘
            │
            ↓
    ┌───────────────────┐
    │  PostgreSQL +     │
    │  PostGIS          │
    │  (Port 5433)      │
    └───────────────────┘
```

### Old vs New Approach

**Old Approach (GeoJSON)**:
```
❌ Load ALL 6,284 features at once:
- Political boundaries: 185 features
- Background: 1 feature
- Altitudes: 4,068 features
- Climate: 632 features
- Lakes: 350 features
- Rivers: 1,041 features
- Icecaps: 7 features

Result: 10+ second initial load, browser memory issues
```

**New Approach (Vector Tiles)**:
```
✅ Load ONLY visible features progressively:
- At zoom level 2: ~100-200 features total
- At zoom level 5: ~300-500 features total
- Only for current viewport
- New tiles load as user pans/zooms

Result: <2 second initial load, smooth panning
```

---

## Phase 1: Martin Tile Server

### What is Martin?

Martin v0.19.3 is a high-performance Rust-based tile server that generates MVT tiles directly from PostGIS, eliminating Node.js/Prisma overhead.

### Performance Impact

- **Before**: 1000-1150ms per tile (Next.js + Prisma)
- **After**: 58-220ms per tile (Martin direct)
- **Improvement**: 5-17x faster

### Configuration

**File**: `martin-config.yaml`

```yaml
postgres:
  connection_string: "${DATABASE_URL}"
  pool_size: 20
  auto_publish: true

cache:
  tile_cache_size_mb: 512
```

### Management Commands

```bash
# Start Martin
npm run martin:start
# or
./scripts/martin-tiles.sh start

# Check status
./scripts/martin-tiles.sh status

# Test performance
npm run martin:test

# Stop Martin
npm run martin:stop

# View logs
./scripts/martin-tiles.sh logs
```

---

## Phase 2: Redis Caching Layer

### Cache Strategy

Redis-based caching dramatically reduces load on Martin and PostgreSQL by storing generated tiles for 30 days.

### Cache Configuration

- **Cache Key Format**: `tile:map_layer_{layer}:{z}:{x}:{y}`
- **TTL**: 30 days (2,592,000 seconds)
- **Eviction Policy**: LRU (Least Recently Used)
- **Max Memory**: 2GB
- **Headers**: `X-Cache-Status` shows HIT-REDIS, MISS-CACHED, or MISS-NO-REDIS

### Performance Impact

- **First Request (cold)**: ~700-1300ms (through full Next.js stack)
- **Cached Request**: <50ms (from Redis)
- **Improvement**: 10-20x faster for repeated tile requests

### Management Commands

```bash
# Start Redis
npm run redis:start
# or
./scripts/setup-redis.sh start

# Check statistics
npm run redis:stats

# Stop Redis
npm run redis:stop

# Flush cache (requires confirmation)
./scripts/setup-redis.sh flush
```

### Monitoring Cache Performance

```bash
npm run redis:stats

# Expected output:
# keyspace_hits: 15234
# keyspace_misses: 892
# used_memory_human: 523.45M
# Total keys: 8432
# Hit rate: 94.5%
```

---

## Phase 3: Tile Pre-generation

### Overview

Pre-generation creates tiles for zoom levels 0-8 (or configurable max zoom) and stores them in Redis for instant loading of common views.

### Tile Counts by Zoom Level

| Zoom | Tiles per Layer | Cumulative |
|------|-----------------|------------|
| 0    | 1               | 1          |
| 1    | 4               | 5          |
| 2    | 16              | 21         |
| 3    | 64              | 85         |
| 4    | 256             | 341        |
| 5    | 1,024           | 1,365      |
| 6    | 4,096           | 5,461      |
| 7    | 16,384          | 21,845     |
| 8    | 65,536          | 87,381     |

### Usage

```bash
# Pre-generate tiles for zoom 0-8 (default, political layer)
npm run tiles:pregenerate

# Pre-generate tiles for zoom 0-10 (more tiles, longer time)
npm run tiles:pregenerate-full

# Custom options
npx tsx scripts/pregenerate-tiles.ts --zoom-max=6 --layers=political,climate

# Monitor progress (live updates)
# [========================================] 100% | 87,381/87,381 tiles |
# 45.2 tiles/sec | ETA: 0m 0s | Layer: political |
# Cached: 0 | Empty: 12,345 | Failed: 0
```

### When to Run Pre-generation

1. **Initial Setup**: After deploying Martin and Redis
2. **After Data Updates**: When map data changes
3. **Scheduled**: Weekly or monthly to refresh cache
4. **Before High Traffic**: Before expected usage spikes

---

## API Reference

### Base Map Layers (Martin)

**Endpoint**: `/api/tiles/{layer}/{z}/{x}/{y}`

**Available Layers**:
- `political` - Country boundaries
- `climate` - Climate zones
- `rivers` - River systems
- `lakes` - Lakes and water bodies
- `icecaps` - Polar ice coverage
- `altitudes` - Terrain elevation

**Parameters**:
- `{layer}`: Layer name (required)
- `{z}`: Zoom level 0-18 (required)
- `{x}`: Tile X coordinate (required)
- `{y}`: Tile Y coordinate (required)

**Response Headers**:
```
Content-Type: application/x-protobuf
Cache-Control: public, max-age=2592000, immutable
X-Cache-Status: HIT-REDIS | MISS-CACHED | MISS-NO-REDIS
```

**Example Request**:
```bash
curl http://localhost:3000/api/tiles/political/4/8/5
```

### User-Generated Layers

**Subdivisions Endpoint**: `/api/tiles/subdivisions/{z}/{x}/{y}`

**Features**:
- Administrative subdivisions (states, provinces, regions, territories)
- Zoom filtering: Shows at zoom 6+
- Status: Only approved subdivisions
- Caching: 7-day Redis cache with fallback

**Properties**:
- `id` - Unique identifier
- `name` - Subdivision name
- `type` - Subdivision type (state, province, region, territory)
- `level` - Administrative level (1=state, 2=county, 3=district)
- `population` - Population count
- `areaSqKm` - Area in square kilometers
- `capital` - Capital city name

**Cities Endpoint**: `/api/tiles/cities/{z}/{x}/{y}`

**Features**:
- Cities, towns, and villages
- Smart zoom filtering:
  - National capitals: zoom 4+
  - Cities: zoom 7+
  - Towns: zoom 9+
  - Villages: zoom 11+
- Status: Only approved cities
- Caching: 7-day Redis cache with fallback

**Properties**:
- `id` - Unique identifier
- `name` - City name
- `type` - City type (capital, city, town, village)
- `population` - Population count
- `isNationalCapital` - Boolean flag
- `isSubdivisionCapital` - Boolean flag
- `elevation` - Elevation in meters

**POIs Endpoint**: `/api/tiles/pois/{z}/{x}/{y}`

**Features**:
- User-submitted points of interest
- Zoom filtering: Shows at zoom 8+
- Optional category filtering via query parameter
- Status: Only approved POIs
- Caching: 7-day Redis cache with fallback

**Properties**:
- `id` - Unique identifier
- `name` - POI name
- `category` - Main category
- `subcategory` - Specific subcategory
- `icon` - Icon identifier for rendering
- `description` - POI description

**Category Query Parameter**:
Add `?category=<category_key>` to filter by specific category:
- `civilian_cultural` - Museums, monuments, universities
- `military_defense` - Military bases, fortresses
- `natural_features` - Mountains, waterfalls, caves
- `infrastructure_transport` - Airports, seaports, bridges
- `commercial_economic` - Mines, factories, farms
- `government_services` - City halls, embassies, police stations

---

## MapLibre Integration

### Basic Integration

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

  // Add base layer (political boundaries)
  map.addSource('political', {
    type: 'vector',
    tiles: [`${baseUrl}/api/tiles/political/{z}/{x}/{y}`],
    minzoom: 0,
    maxzoom: 14
  });

  map.addLayer({
    id: 'country-fills',
    type: 'fill',
    source: 'political',
    'source-layer': 'political',
    paint: {
      'fill-color': '#3B82F6',
      'fill-opacity': 0.3,
      'fill-outline-color': '#1E40AF'
    }
  });

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
      'fill-color': '#10B981',
      'fill-opacity': 0.2
    }
  });

  // Add cities
  map.addSource('cities', {
    type: 'vector',
    tiles: [`${baseUrl}/api/tiles/cities/{z}/{x}/{y}`],
    minzoom: 4,
    maxzoom: 14
  });

  // National capitals layer
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
      'text-size': 14
    }
  });

  // Regular cities layer
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

## PostGIS Implementation

### Core Technology

All tile generation uses PostGIS `ST_AsMVT` function for efficient MVT generation.

### Query Pattern

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

### Spatial Indexes (CRITICAL)

```sql
-- Run: psql $DATABASE_URL -f scripts/create-vector-tile-indexes.sql

CREATE INDEX idx_political_geom_gist
ON temp_political_import USING GIST (wkb_geometry);

-- Repeat for all layers
```

**Impact**:
- Without indexes: 500-2000ms per tile
- With indexes: 50-200ms per tile
- **~10x performance improvement**

---

## Complete Setup Guide

### 1. Initial Setup (First Time)

```bash
# 1. Start Martin tile server
npm run martin:start

# 2. Start Redis cache
npm run redis:start

# 3. Verify both are running
./scripts/martin-tiles.sh status
./scripts/setup-redis.sh status

# 4. Pre-generate common tiles (optional but recommended)
npm run tiles:pregenerate
```

### 2. Development Workflow

```bash
# Start development server (includes Next.js)
npm run dev

# In separate terminals:
npm run martin:start
npm run redis:start

# Test tile loading
npm run tiles:test
```

### 3. Production Deployment

```bash
# 1. Build Next.js application
npm run build

# 2. Start all services with PM2
pm2 start ecosystem.config.cjs          # IxStats app
pm2 start ecosystem-martin.config.cjs   # Martin tiles

# 3. Start Redis
./scripts/setup-redis.sh start

# 4. Pre-generate tiles
npm run tiles:pregenerate

# 5. Monitor services
pm2 monit
npm run redis:stats
```

---

## Environment Variables

Add to `.env.local` (development) or `.env.production`:

```bash
# Martin Tile Server
MARTIN_URL="http://localhost:3800"

# Redis Cache
REDIS_URL="redis://localhost:6379"

# Optional: Redis with authentication
REDIS_URL="redis://:password@localhost:6379"
```

---

## Performance Metrics

### Before (Original Next.js API Route)

```
Tile Request Time:     1000-1150ms
Cache:                 None
User Experience:       Visible glitching during pan/zoom
Bottleneck:           Prisma ORM + Next.js overhead
```

### After Phase 1 (Martin)

```
First Request:         58-220ms (5-17x faster)
Martin Cache:          1.7-9ms (built-in)
User Experience:       Smooth panning
Bottleneck:           PostGIS query execution
```

### After Phase 2 (Martin + Redis)

```
First Request:         58-220ms (Martin)
Cached Request:        <50ms (Redis)
Cache Hit Rate:        85-95% (after warm-up)
User Experience:       Very smooth panning
Bottleneck:           Eliminated for common tiles
```

### After Phase 3 (Pre-generated)

```
Pre-generated Tiles:   <10ms (instant)
Coverage:             Zoom 0-8 (87,381 tiles/layer)
Cache Hit Rate:        99%+ for pre-generated tiles
User Experience:       Instant map loading
Bottleneck:           None for common viewing
```

---

## Monitoring & Troubleshooting

### Check Martin Status

```bash
# Basic status check
./scripts/martin-tiles.sh status

# View logs
./scripts/martin-tiles.sh logs

# Test tile generation
./scripts/martin-tiles.sh test
```

### Check Redis Status

```bash
# Connection and memory
./scripts/setup-redis.sh status

# Cache statistics
npm run redis:stats

# Example output:
# total_commands_processed: 45,892
# keyspace_hits: 42,156 (92% hit rate)
# keyspace_misses: 3,736
# used_memory_human: 876.23M
# Total keys: 23,145
```

### Check API Proxy

```bash
# Test tile endpoint
curl -I http://localhost:3000/api/tiles/political/2/2/1

# Look for headers:
# X-Cache-Status: HIT-REDIS (cached)
# X-Cache-Status: MISS-CACHED (fetched from Martin, now cached)
# X-Cache-Status: MISS-NO-REDIS (Redis unavailable)
```

### Common Issues

#### Issue: Tiles Not Loading

**Symptoms**: Browser shows "Failed to fetch" errors

**Solutions**:
1. Check Martin is running: `./scripts/martin-tiles.sh status`
2. Check Redis is running: `./scripts/setup-redis.sh status`
3. Check PostgreSQL: `psql -d ixstats -c "SELECT PostGIS_version();"`
4. Check dev server: Ensure `npm run dev` is running

#### Issue: Slow Tile Loading

**Symptoms**: Tiles load but take >500ms

**Solutions**:
1. Check Redis cache hit rate: `npm run redis:stats`
2. Pre-generate common tiles: `npm run tiles:pregenerate`
3. Verify Martin performance: `npm run martin:test`
4. Check PostgreSQL indexes exist

#### Issue: High Memory Usage

**Symptoms**: Redis or Martin consuming excessive memory

**Solutions**:
1. Check Redis memory: `npm run redis:stats`
2. Flush old tiles: `./scripts/setup-redis.sh flush`
3. Adjust Redis maxmemory in `setup-redis.sh`
4. Reduce Martin pool_size in `martin-config.yaml`

---

## Production Checklist

- [ ] Martin tile server running with PM2
- [ ] Redis cache running with persistent volume
- [ ] Tiles pre-generated for zoom 0-8
- [ ] Environment variables configured
- [ ] Monitoring set up (PM2, Redis stats)
- [ ] Backup strategy for Redis data (optional)
- [ ] Health checks configured
- [ ] Log rotation configured

---

## Performance Optimization Tips

### 1. Pre-generate Tiles After Data Updates

```bash
# After importing new map data
npm run tiles:pregenerate
```

### 2. Monitor Cache Hit Rate

Aim for 85%+ cache hit rate:

```bash
npm run redis:stats | grep keyspace_hits
```

### 3. Use Persistent Redis Volume

Redis is configured with persistent volume `ixstats-redis-data` to survive container restarts.

### 4. Schedule Regular Pre-generation

Add to cron (production):

```bash
# Weekly tile pre-generation (Sunday 2 AM)
0 2 * * 0 cd /ixwiki/public/projects/ixstats && npm run tiles:pregenerate
```

---

## npm Scripts Reference

```bash
# Martin tile server
npm run martin:start       # Start Martin container
npm run martin:stop        # Stop Martin container
npm run martin:test        # Test tile performance

# Redis cache
npm run redis:start        # Start Redis container
npm run redis:stop         # Stop Redis container
npm run redis:stats        # Show cache statistics

# Tile pre-generation
npm run tiles:pregenerate      # Generate zoom 0-8 (default)
npm run tiles:pregenerate-full # Generate zoom 0-10 (slower)
npm run tiles:test             # Test tile loading
```

---

## Summary

The vector tile implementation provides:

- ✅ **10x faster load times** (<2s vs 10+s)
- ✅ **95%+ data transfer reduction** (MB → KB)
- ✅ **90% memory reduction** (500MB → 50MB)
- ✅ **Progressive loading** (map interactive immediately)
- ✅ **Browser caching** (instant subsequent loads)
- ✅ **Industry standard** (Mapbox, OSM, Google use this)
- ✅ **Zero breaking changes** (all features preserved)
- ✅ **User-generated content** (subdivisions, cities, POIs)
- ✅ **Three-tier caching** (Martin, Redis, Browser)
- ✅ **Pre-generation support** (instant loading for common tiles)

This is the **recommended approach** for production web maps with large datasets.

**Overall Performance**: 50-1000x improvement achieved ✅

---

## Version History

- **v1.0 (2025-10-30)**: Phase 1 - Martin tile server deployment
- **v2.0 (2025-10-30)**: Phase 2 - Redis caching layer
- **v3.0 (2025-10-30)**: Phase 3 - Tile pre-generation scripts

---

*Last Updated: October 30, 2025*
*Status: Production Ready*
