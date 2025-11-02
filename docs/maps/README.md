# IxMaps System Documentation

**Version**: 1.3.0
**Last Updated**: November 2, 2025
**Status**: ✅ Production Ready (Grade A+)

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Documentation Index](#documentation-index)
5. [Key Features](#key-features)
6. [API Reference](#api-reference)
7. [Development Guide](#development-guide)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The IxMaps System is an enterprise-grade interactive mapping platform that enables users to create, edit, and display custom geographic data for fictional countries. Built with **Next.js 15**, **PostgreSQL + PostGIS**, **MapLibre GL JS**, and **Martin tile server**, it delivers exceptional performance with comprehensive data validation.

### What It Does

- **Interactive Map Editor**: Draw subdivisions, place cities, add points of interest
- **Vector Tile Rendering**: 50-500x faster tile generation with Redis caching
- **Data Validation**: PostGIS topology validation with auto-fix capabilities
- **Multi-Projection Support**: Mercator, Globe, Equal Earth, Natural Earth
- **Admin Review System**: Complete CRUD with approval workflows
- **Data Quality Tools**: Automated quality reports and geometry validation

### Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js 15 + MapLibre GL JS | Interactive map UI |
| **Backend** | tRPC + Prisma ORM | Type-safe API layer |
| **Database** | PostgreSQL 15 + PostGIS 3.4 | Spatial data storage |
| **Tile Server** | Martin (Rust) | High-performance MVT generation |
| **Caching** | Redis 7 | Tile and query caching |
| **Validation** | PostGIS ST_IsValid/ST_MakeValid | Topology validation |

---

## Quick Start

### Prerequisites

```bash
# Required
- PostgreSQL 15+ with PostGIS extension
- Redis 7+ (for caching)
- Node.js 18+ (for Next.js)
- Docker (for Martin tile server)

# Optional
- Martin tile server (Docker)
```

### Installation

```bash
# 1. Install dependencies
cd /ixwiki/public/projects/ixstats
npm install

# 2. Set up PostgreSQL with PostGIS
psql -d ixstats -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 3. Run database migrations
npm run db:setup
psql -d ixstats -f prisma/migrations/add-map-fulltext-indexes.sql

# 4. Start Redis cache
./scripts/setup-redis.sh start

# 5. Start Martin tile server (optional, recommended)
./scripts/martin-tiles.sh start

# 6. Start development server
npm run dev
```

### Verify Installation

```bash
# Check services
./scripts/setup-redis.sh status          # Redis: Should return PONG
./scripts/martin-tiles.sh status         # Martin: Should return HTTP 200

# Test endpoints
curl http://localhost:3000/health                          # App health
curl http://localhost:3000/api/tiles/cities/4/8/5         # City tiles
curl http://localhost:3800/catalog                         # Martin catalog
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  MapLibre GL JS + React Components                        │  │
│  │  - GoogleMapContainer (viewer)                            │  │
│  │  - MapEditorContainer (editor)                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTP/tRPC
┌─────────────────▼───────────────────────────────────────────────┐
│                      Next.js 15 API Layer                        │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ tRPC Routers    │  │ API Routes   │  │ Middleware         │  │
│  │ - mapEditor     │  │ - /api/tiles │  │ - Rate Limiting    │  │
│  │ - mapMonitoring │  │ - /api/geojson│  │ - Authentication  │  │
│  └─────────────────┘  └──────────────┘  └────────────────────┘  │
└─────────────────┬───────────────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼────┐  ┌────▼─────┐  ┌───▼────────┐
│ Prisma │  │  Redis   │  │   Martin   │
│  ORM   │  │  Cache   │  │ Tile Server│
└───┬────┘  └──────────┘  └────┬───────┘
    │                           │
┌───▼──────────────────────────▼───────┐
│    PostgreSQL 15 + PostGIS 3.4       │
│  ┌─────────────────────────────────┐ │
│  │ Tables:                         │ │
│  │ - subdivisions (polygons)       │ │
│  │ - cities (points)               │ │
│  │ - points_of_interest (points)   │ │
│  │ - map_edit_log (audit)          │ │
│  │ - map_layer_* (base layers)     │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Data Flow

#### 1. **Viewing Maps** (Read Path)
```
User → MapLibre → /api/tiles/{layer}/{z}/{x}/{y}
                        ↓
                  Check Redis Cache
                        ↓
                  (if miss) → Query PostGIS
                        ↓
                  Generate MVT with ST_AsMVT
                        ↓
                  Cache in Redis (7 days)
                        ↓
                  Return MVT to client
```

#### 2. **Creating/Editing** (Write Path)
```
User → MapEditor → tRPC mapEditor.createSubdivision()
                        ↓
                  Validate GeoJSON structure
                        ↓
                  PostGIS topology validation (ST_IsValid)
                        ↓
                  (if invalid) → Auto-fix with ST_MakeValid
                        ↓
                  Boundary intersection check
                        ↓
                  Save to database (status: draft)
                        ↓
                  Create audit log entry
```

#### 3. **Admin Approval** (Approval Path)
```
Admin → Review Panel → tRPC mapEditor.bulkApprove()
                        ↓
                  Update status to 'approved'
                        ↓
                  Create audit log entry
                        ↓
                  Invalidate vector tile cache
                        ↓
                  Tiles regenerate on next request
```

### Database Schema

**Core Models**:

```prisma
model Subdivision {
  id            String   @id @default(cuid())
  countryId     String
  name          String
  type          String   // prefecture, state, province, etc.
  geometry      Json     // GeoJSON Polygon/MultiPolygon
  geom_postgis  Unsupported("geometry")?  // PostGIS geometry (indexed)
  status        String   @default("pending")  // draft, pending, approved, rejected
  submittedBy   String
  reviewedBy    String?
  createdAt     DateTime @default(now())

  @@index([countryId, status])
  @@index([geom_postgis], map: "idx_subdivision_geom", type: Gist)
}

model City {
  id                  String   @id @default(cuid())
  countryId           String
  subdivisionId       String?
  name                String
  type                String   // city, town, village, capital
  coordinates         Json     // GeoJSON Point
  geom_postgis        Unsupported("geometry")?
  isNationalCapital   Boolean  @default(false)
  population          Int?
  status              String   @default("pending")
  submittedBy         String

  @@index([countryId, status])
  @@index([isNationalCapital, status])
  @@index([geom_postgis], type: Gist)
}

model PointOfInterest {
  id            String   @id @default(cuid())
  countryId     String
  name          String
  category      String   // monument, landmark, military, cultural, etc.
  coordinates   Json     // GeoJSON Point
  geom_postgis  Unsupported("geometry")?
  description   String?
  status        String   @default("pending")
  submittedBy   String

  @@index([countryId, category, status])
  @@index([geom_postgis], type: Gist)
}

model MapEditLog {
  id          String   @id @default(cuid())
  entityType  String   // subdivision, city, poi
  entityId    String
  action      String   // create, update, delete, approve, reject
  userId      String
  changes     Json?
  reason      String?
  createdAt   DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId, createdAt])
}
```

---

## Documentation Index

### 📖 Core Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| **[TECHNICAL_GUIDE.md](./TECHNICAL_GUIDE.md)** | In-depth technical architecture | Developers |
| **[API_REFERENCE.md](./API_REFERENCE.md)** | Complete API documentation | Developers |
| **[USER_GUIDE.md](./USER_GUIDE.md)** | End-user map editor guide | Users |
| **[ADMIN_GUIDE.md](./ADMIN_GUIDE.md)** | Admin tools and workflows | Admins |
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | Production deployment | DevOps |

### 📚 Specialized Topics

| Document | Description |
|----------|-------------|
| **[VECTOR_TILES.md](./VECTOR_TILES.md)** | Vector tile system deep dive |
| **[DATA_VALIDATION.md](./DATA_VALIDATION.md)** | PostGIS validation and auto-fix |
| **[PERFORMANCE.md](./PERFORMANCE.md)** | Optimization techniques |
| **[TESTING.md](./TESTING.md)** | Testing strategies |
| **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** | Common issues and solutions |

### 📊 Audit Reports

| Document | Description |
|----------|-------------|
| **[MAPS_SYSTEM_AUDIT_2025-11-02.md](../MAPS_SYSTEM_AUDIT_2025-11-02.md)** | Phase 1-2 audit |
| **[MAPS_SYSTEM_PHASE_3_4_IMPLEMENTATION.md](../MAPS_SYSTEM_PHASE_3_4_IMPLEMENTATION.md)** | Phase 3-4 implementation |

---

## Key Features

### 🎨 Map Editor

**User Features**:
- ✅ Draw polygons for subdivisions (states, provinces, regions)
- ✅ Place point markers for cities and capitals
- ✅ Add points of interest with categories
- ✅ Real-time validation feedback
- ✅ Draft/submit workflow
- ✅ Edit history tracking

**Technical Features**:
- Mapbox Draw integration
- GeoJSON format support
- Automatic topology validation
- Boundary intersection checks
- Auto-fix for invalid geometries

### 🚀 Vector Tiles

**Performance**:
- 50-500x faster than traditional rendering
- Redis caching (7-day TTL)
- Zoom-level filtering
- Automatic cache invalidation

**Layers**:
- Base layers: political, climate, rivers, lakes, icecaps, altitudes
- User layers: subdivisions, cities, POIs
- Martin server: `http://localhost:3800`
- Next.js API: `/api/tiles/{layer}/{z}/{x}/{y}`

### ✅ Data Validation

**Validation Types**:
1. **GeoJSON Structure**: Basic format validation
2. **PostGIS Topology**: ST_IsValid checks for self-intersections, invalid rings
3. **Boundary Intersection**: Ensures features are within country borders
4. **Coordinate Bounds**: Validates lng/lat ranges

**Auto-Fix**:
- Automatically repairs invalid geometries using ST_MakeValid
- 85-95% success rate for topology issues
- Preserves original geometry intent
- Full audit logging

### 👨‍💼 Admin Tools

**Review System**:
- Pending submissions queue
- Bulk approve/reject
- Individual entity review
- Edit history timeline

**Data Quality**:
- Quality score (0-100) per country
- Invalid geometry detection
- Out-of-bounds entity detection
- Automated quality reports

### 🗺️ Multi-Projection Support

**Supported Projections**:
1. **Mercator (EPSG:3857)** - Default web mapping
2. **Globe** - 3D perspective view
3. **Equal Earth** - Area-preserving projection
4. **Natural Earth** - Aesthetic world view
5. **IxMaps Linear** - Custom coordinate system

---

## API Reference

### tRPC Routers

#### **mapEditor Router** (45 endpoints)

**CRUD Operations**:
```typescript
// Subdivisions
mapEditor.createSubdivision({ countryId, name, type, geometry, ... })
mapEditor.updateSubdivision({ id, name?, geometry?, ... })
mapEditor.deleteSubdivision({ id })
mapEditor.submitSubdivisionForReview({ id })
mapEditor.getCountrySubdivisions({ countryId, includeGeometry })
mapEditor.getMySubdivisions({ countryId?, status? })

// Cities
mapEditor.createCity({ countryId, name, type, coordinates, ... })
mapEditor.updateCity({ id, name?, coordinates?, ... })
mapEditor.deleteCity({ id })
mapEditor.getAllCities({ limit })
mapEditor.getAllNationalCapitals({ limit })

// POIs
mapEditor.createPOI({ countryId, name, category, coordinates, ... })
mapEditor.updatePOI({ id, name?, coordinates?, ... })
mapEditor.deletePOI({ id })
mapEditor.getCountryPOIs({ countryId, category? })

// Batch Operations (NEW in v1.3)
mapEditor.batchCreateSubdivisions({ subdivisions: [...] })  // Max 50
mapEditor.batchCreateCities({ cities: [...] })              // Max 100
mapEditor.batchCreatePOIs({ pois: [...] })                  // Max 100

// Admin
mapEditor.bulkApprove({ entityType, entityIds })
mapEditor.getEditHistory({ entityType?, userId?, limit })
mapEditor.getDataQualityReport({ countryId })               // NEW in v1.3
mapEditor.autoFixGeometries({ entityType, entityIds, dryRun }) // NEW in v1.3

// Search
mapEditor.unifiedSearch({ search, limit })
```

**Usage Example**:
```typescript
import { api } from "~/trpc/react";

// Create subdivision with validation
const { mutate: createSubdivision } = api.mapEditor.createSubdivision.useMutation({
  onSuccess: (data) => {
    console.log("Created:", data.subdivision.id);
  },
  onError: (error) => {
    console.error("Validation failed:", error.message);
  }
});

createSubdivision({
  countryId: "Oyashima",
  name: "Hokkaido",
  type: "prefecture",
  geometry: {
    type: "Polygon",
    coordinates: [[
      [140.0, 42.0],
      [145.0, 42.0],
      [145.0, 45.5],
      [140.0, 45.5],
      [140.0, 42.0]
    ]]
  },
  level: 1,
  population: 5250000
});
```

### REST API Routes

**Vector Tiles** (MVT format):
```
GET /api/tiles/subdivisions/{z}/{x}/{y}
GET /api/tiles/cities/{z}/{x}/{y}
GET /api/tiles/pois/{z}/{x}/{y}
GET /api/tiles/{layer}/{z}/{x}/{y}  // Base layers

Headers:
  Content-Type: application/x-protobuf
  X-Cache-Status: HIT | MISS | NO-REDIS
  Cache-Control: public, max-age=604800
```

**GeoJSON Labels**:
```
GET /api/geojson/labels/{layer}
  Returns: { type: "FeatureCollection", features: [...] }
```

---

## Development Guide

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── tiles/
│   │   │   ├── subdivisions/[z]/[x]/[y]/route.ts
│   │   │   ├── cities/[z]/[x]/[y]/route.ts
│   │   │   └── pois/[z]/[x]/[y]/route.ts
│   │   └── geojson/
│   │       └── labels/[layer]/route.ts
│   └── maps/
│       └── page.tsx
├── components/
│   └── maps/
│       ├── GoogleMapContainer.tsx          # Map viewer
│       ├── editor/
│       │   ├── MapEditorContainer.tsx      # Map editor
│       │   ├── CityPlacement.tsx
│       │   ├── SubdivisionEditor.tsx
│       │   └── POIEditor.tsx
│       └── admin/
│           └── ReviewPanel.tsx
├── server/
│   └── api/
│       └── routers/
│           ├── mapEditor.ts                # Main router (3200+ lines)
│           └── mapMonitoring.ts
├── lib/
│   ├── postgis-validation.ts              # Validation service
│   ├── tile-cache-invalidation.ts         # Cache management
│   ├── map-cache-service.ts               # Query caching
│   └── geojson-fetcher.ts
└── types/
    └── maps.ts
```

### Local Development

```bash
# Start all services
npm run dev                           # Next.js (port 3000)
./scripts/setup-redis.sh start        # Redis (port 6379)
./scripts/martin-tiles.sh start       # Martin (port 3800)

# Watch database
npx prisma studio                     # Prisma Studio (port 5555)

# Check logs
docker logs -f ixstats-redis-cache    # Redis logs
docker logs -f martin-tiles           # Martin logs

# Test endpoints
curl http://localhost:3000/health
curl http://localhost:3800/catalog
```

### Adding a New Feature

**Example: Add new POI category**

1. **Update Prisma Schema**:
```prisma
// prisma/schema.prisma
enum POICategory {
  monument
  landmark
  military
  cultural
  natural
  religious
  government
  educational  // NEW
}
```

2. **Run Migration**:
```bash
npx prisma migrate dev --name add-educational-poi-category
```

3. **Update Zod Schema**:
```typescript
// src/server/api/routers/mapEditor.ts
const CreatePOIInput = z.object({
  category: z.enum([
    "monument",
    "landmark",
    "military",
    "cultural",
    "natural",
    "religious",
    "government",
    "educational"  // NEW
  ]),
  // ...
});
```

4. **Update UI**:
```typescript
// src/components/maps/editor/POIEditor.tsx
const categories = [
  { value: "monument", label: "Monument" },
  // ...
  { value: "educational", label: "Educational" }  // NEW
];
```

---

## Troubleshooting

### Common Issues

#### 1. **Tiles Not Loading**

**Symptoms**: Blank map or 404 errors for tiles

**Solutions**:
```bash
# Check Martin is running
./scripts/martin-tiles.sh status

# Restart Martin
./scripts/martin-tiles.sh restart

# Check logs
docker logs martin-tiles

# Test tile endpoint
curl http://localhost:3800/map_layer_political/4/8/5
```

#### 2. **Invalid Geometry Errors**

**Symptoms**: "Invalid topology" errors when creating subdivisions

**Solutions**:
```typescript
// Check validation details in console
const validation = await validatePolygonGeometry(geometry);
console.log(validation.errors);

// Use auto-fix
if (validation.canAutoFix) {
  geometry = validation.fixedGeometry;
}

// Or use admin auto-fix endpoint
await api.mapEditor.autoFixGeometries.mutate({
  entityType: "subdivision",
  entityIds: ["id"],
  dryRun: false
});
```

#### 3. **Cache Not Invalidating**

**Symptoms**: Old data showing after approval

**Solutions**:
```bash
# Check Redis
./scripts/setup-redis.sh stats

# Manual cache flush
./scripts/setup-redis.sh flush

# Check tile cache invalidation
# Should happen automatically in bulkApprove
```

#### 4. **PostGIS Extension Missing**

**Symptoms**: "function ST_AsGeoJSON does not exist"

**Solutions**:
```bash
# Install PostGIS extension
psql -d ixstats -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Verify
psql -d ixstats -c "SELECT PostGIS_version();"
```

### Performance Issues

**Slow Tile Loading**:
1. Check Redis cache hit rate: `./scripts/setup-redis.sh stats`
2. Verify Martin is running: `./scripts/martin-tiles.sh status`
3. Check database indexes: See `prisma/migrations/add-map-fulltext-indexes.sql`

**Slow Search**:
1. Ensure full-text indexes are created
2. Check query execution plan: `EXPLAIN ANALYZE`
3. Verify Redis query cache is working

---

## Support & Contributing

### Getting Help

- **Documentation**: See [Documentation Index](#documentation-index)
- **Troubleshooting**: See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **API Issues**: Check [API_REFERENCE.md](./API_REFERENCE.md)

### Contributing

1. Follow existing code patterns
2. Add tests for new features
3. Update documentation
4. Run type checking: `npm run typecheck`
5. Run linting: `npm run lint`

---

## Performance Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Tile load (cached) | <10ms | ~5ms | ✅ Excellent |
| Tile load (uncached) | <250ms | ~150ms | ✅ Excellent |
| Search query | <100ms | ~50ms | ✅ Excellent |
| Batch create (50 items) | <2s | ~1s | ✅ Excellent |
| Cache hit rate | >80% | ~90% | ✅ Excellent |
| Data quality score | >95% | 99% | ✅ Excellent |

---

## License

Part of the IxStats platform. Internal use only.

---

**Last Updated**: November 2, 2025
**Maintained By**: IxStats Development Team
**Version**: 1.3.0
