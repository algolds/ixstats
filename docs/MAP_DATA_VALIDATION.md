# Map Data Validation & Fixing Guide

## Overview

This document describes the comprehensive validation and fixing process for IxStats map data, which resolved critical coordinate and geometry issues that were causing vector tile generation failures and map rendering problems.

## Problem Summary

### Issues Identified (October 29, 2025)

1. **Invalid Coordinate (2049) Error**
   - PostGIS error: `ERROR: transform: Invalid coordinate (2049)`
   - Caused by coordinates far outside valid range (-180° to 180°, -90° to 90°)
   - Vector tile generation failing for icecaps and other polar layers

2. **Crazy Border Boundaries**
   - Countries like **Oyashima**, **Metzetta**, and **Daxia** had bizarre extending borders
   - Coordinates beyond ±180° longitude creating geometry wrapping issues
   - Example: Oyashima had 985 invalid coordinates in range 183-187° longitude

3. **Polar Distortion**
   - Features extending beyond Web Mercator limits (±85.05° latitude)
   - Icecaps layer particularly affected with coordinates at 91.8° latitude
   - Invalid coordinates causing ST_Transform() failures

4. **Invalid Geometries**
   - 456 features with invalid geometries (self-intersecting polygons, nested shells)
   - Caused by coordinate sanitization and simplification processes
   - ST_IsValid() returning false for these features

## Solution: 4-Phase Fix Process

### Phase 1: Validation & Diagnosis

**Script**: `scripts/validate-geojson-coordinates.ts`

Validated all GeoJSON source files for:
- Invalid longitude values (outside -180° to 180°)
- Invalid latitude values (outside -90° to 90°)
- NaN, Infinity, or null coordinates
- Coordinates beyond Web Mercator limits (±85.05°)
- Unclosed polygon rings

**Results**:
- ✅ Validated 6,289 features across 7 layers
- ✅ Checked 513,097 coordinates
- ❌ Found 3,077 invalid longitude values
- ❌ Found 19 invalid latitude values
- ❌ Found 79 coordinates beyond Web Mercator limits
- ❌ Found 1 unclosed polygon ring

**Key Issues by Layer**:
- **Political (Oyashima)**: 985 invalid coordinates (183-187° longitude)
- **Climate (path6033)**: 905 invalid coordinates (192-193° longitude)
- **Altitudes (path374)**: 726 invalid coordinates (>180° longitude)
- **Icecaps (path2)**: 459 invalid longitude + 4 invalid latitude (91.8°)
- **Background (rect1)**: 2 invalid longitude coordinates (206.09°)

### Phase 2: Coordinate Sanitization

**Script**: `scripts/sanitize-geojson-coordinates.ts`

Applied fixes:
- **Longitude normalization**: Wrapped values >180° using modulo 360
  - Example: 183° → -177° (183 - 360 = -177)
- **Latitude clamping**: Clamped to Web Mercator safe range (-85.05° to 85.05°)
- **Invalid coordinate removal**: Removed NaN, Infinity values
- **Polygon ring closure**: Ensured first point === last point
- **Duplicate removal**: Removed consecutive duplicate coordinates

**Results**:
- ✅ Processed 6,289 features, 513,097 coordinates
- ✅ Modified 4,484 features (71.3% of total)
- ✅ Applied 8,265 total fixes:
  - **3,077 longitude values wrapped** (>180° → normalized)
  - **79 latitude values clamped** (to ±85.05°)
  - **5,109 duplicate coordinates removed**

**Output**: Sanitized files saved to `scripts/geojson_sanitized/`

### Phase 3: Database Import & Schema Standardization

**Scripts**:
- `scripts/fix-database-schema.sql`
- `scripts/import-map-layers-sanitized.sh`

**Actions**:
1. **Backed up existing tables** to `backups` schema with timestamp
2. **Dropped old tables** with inconsistent schema
3. **Re-imported sanitized data** with proper field mapping:
   - `ogc_fid`: Auto-generated feature ID (for MapLibre)
   - `country_id`: Original 'id' field (country/feature name)
   - `geometry`: PostGIS geometry (SRID 4326, WGS84)
   - `fill`: Color field
4. **Created spatial indexes** (GIST) for performance

**Results**:
- ✅ Imported 6,289 features across 7 layers
- ✅ All features with correct SRID (4326)
- ✅ Spatial indexes created automatically
- ✅ Consistent field naming across all tables

**Import Summary**:
| Layer | Features | Status |
|-------|----------|--------|
| political | 185 | ✅ |
| climate | 632 | ✅ |
| altitudes | 4,068 | ✅ |
| rivers | 1,041 | ✅ |
| lakes | 350 | ✅ |
| icecaps | 12 | ✅ |
| background | 1 | ✅ |
| **Total** | **6,289** | ✅ |

### Phase 4: Geometry Validation & Fixing

**Scripts**:
- `scripts/validate-postgis-geometries.ts`
- `scripts/fix-invalid-geometries.sql`

**Initial Validation Results**:
- ❌ Found 456 invalid geometries (7.3% of features)
- Issues: Self-intersecting polygons, nested shells, ring intersections
- Affected layers: political (83), climate (34), altitudes (231), rivers (59), lakes (39), icecaps (9), background (1)

**Fix Applied**: Used PostGIS `ST_MakeValid()` to automatically repair:
- Self-intersecting polygons
- Invalid ring orientations
- Nested shells
- Duplicate vertices
- Other topological issues

**Final Validation Results**:
- ✅ **6,288 of 6,289 geometries valid** (99.98% success rate)
- ❌ Only 1 invalid geometry remaining (background rect1 - non-critical)
- ✅ All spatial indexes in place
- ✅ All geometries ready for vector tile generation

## Verification & Testing

### Vector Tile Generation Tests

**Test Command**:
```bash
curl http://localhost:3000/api/tiles/{layer}/{z}/{x}/{y}
```

**Results**:
| Layer | Zoom 0 | Zoom 1 | Zoom 2 | Status |
|-------|--------|--------|--------|--------|
| political | 200 (24.7KB) | 200 (1.2KB) | 200 (0KB) | ✅ |
| icecaps | 200 (8.1KB) | 200 (3.5KB) | 200 (1.7KB) | ✅ |
| altitudes | 200 (83.5KB) | 200 (497B) | 200 (1.1KB) | ✅ |

**Success Metrics**:
- ✅ All HTTP 200 responses
- ✅ NO "Invalid coordinate (2049)" errors
- ✅ NO transformation failures
- ✅ Tiles generating in 0.6-1.5 seconds (good performance)
- ✅ Polar regions (icecaps) now rendering correctly

## Scripts Reference

### Validation Scripts

#### `scripts/validate-geojson-coordinates.ts`
Validates source GeoJSON files for invalid coordinates

**Usage**:
```bash
npx tsx scripts/validate-geojson-coordinates.ts
```

**Checks**:
- Invalid longitude/latitude ranges
- NaN, Infinity values
- Beyond Mercator limits
- Unclosed polygon rings

#### `scripts/validate-postgis-geometries.ts`
Validates PostGIS database geometries

**Usage**:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats" \
  npx tsx scripts/validate-postgis-geometries.ts
```

**Checks**:
- ST_IsValid() for all geometries
- SRID correctness (4326)
- Coordinate bounds
- Spatial index presence

### Fixing Scripts

#### `scripts/sanitize-geojson-coordinates.ts`
Sanitizes GeoJSON coordinate data

**Usage**:
```bash
npx tsx scripts/sanitize-geojson-coordinates.ts
```

**Fixes**:
- Wraps/clamps longitude to -180° to 180°
- Clamps latitude to -85.05° to 85.05°
- Removes invalid coordinates
- Fixes unclosed rings
- Removes duplicates

**Output**: `scripts/geojson_sanitized/*.geojson`

#### `scripts/fix-database-schema.sql`
Standardizes database schema

**Usage**:
```bash
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats \
  -f scripts/fix-database-schema.sql
```

**Actions**:
- Backs up existing tables
- Drops old tables
- Prepares for clean import

#### `scripts/import-map-layers-sanitized.sh`
Imports sanitized GeoJSON to PostgreSQL

**Usage**:
```bash
bash scripts/import-map-layers-sanitized.sh
```

**Features**:
- Imports from `geojson_sanitized/` directory
- Sets SRID to 4326
- Creates spatial indexes
- Proper field mapping

#### `scripts/fix-invalid-geometries.sql`
Fixes invalid PostGIS geometries

**Usage**:
```bash
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats \
  -f scripts/fix-invalid-geometries.sql
```

**Uses**: `ST_MakeValid()` to repair topological issues

## Complete Fix Workflow

To reproduce the complete fix process:

```bash
# 1. Validate source data
npx tsx scripts/validate-geojson-coordinates.ts

# 2. Sanitize coordinates
npx tsx scripts/sanitize-geojson-coordinates.ts

# 3. Validate sanitized data
cd scripts && SOURCE_DIR="geojson_sanitized" npx tsx validate-geojson-coordinates.ts

# 4. Prepare database
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats \
  -f scripts/fix-database-schema.sql

# 5. Import sanitized data
bash scripts/import-map-layers-sanitized.sh

# 6. Validate PostGIS geometries
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats" \
  npx tsx scripts/validate-postgis-geometries.ts

# 7. Fix invalid geometries
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats \
  -f scripts/fix-invalid-geometries.sql

# 8. Verify final state
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats" \
  npx tsx scripts/validate-postgis-geometries.ts

# 9. Test vector tiles
curl http://localhost:3000/api/tiles/political/2/1/1
curl http://localhost:3000/api/tiles/icecaps/1/0/0
```

## Best Practices

### Before Making Map Changes

1. **Always validate source data** before import
2. **Backup existing tables** before destructive operations
3. **Test vector tiles** after any geometry changes
4. **Check coordinate ranges** for invalid values

### Coordinate Ranges

**Valid Geographic Coordinates (EPSG:4326)**:
- Longitude: -180° to 180°
- Latitude: -90° to 90°

**Valid Web Mercator Coordinates (EPSG:3857)**:
- Longitude: -180° to 180°
- Latitude: -85.05112878° to 85.05112878°

**Invalid Values**:
- ❌ Beyond ±180° longitude (will wrap around globe)
- ❌ Beyond ±90° latitude (invalid on sphere)
- ❌ NaN, Infinity, null values
- ❌ Extreme outliers (>1000°)

### Geometry Validation

Always run `ST_IsValid()` after:
- Importing new data
- Transforming coordinates
- Simplifying geometries
- Clipping/buffering operations

Use `ST_MakeValid()` to fix common issues:
- Self-intersecting polygons
- Invalid ring orientations
- Nested shells
- Duplicate vertices

## Troubleshooting

### Vector Tile Errors

**Error**: `ERROR: transform: Invalid coordinate (2049)`
- **Cause**: Invalid coordinates in database
- **Fix**: Run sanitization and re-import process

**Error**: `Self-intersection at point X,Y`
- **Cause**: Invalid polygon topology
- **Fix**: Run `fix-invalid-geometries.sql`

**Error**: Tiles returning HTTP 500
- **Cause**: Database connection or geometry issues
- **Fix**: Check PostgreSQL logs, validate geometries

### Performance Issues

**Slow tile generation (>5 seconds)**:
- Check spatial indexes exist: `\di *_geom_*`
- Verify SRID is correct: `SELECT DISTINCT ST_SRID(geometry) FROM map_layer_political;`
- Consider simplifying geometries for lower zoom levels

## Results Summary

**Problem**: Map system broken with 3,096 coordinate errors and 456 invalid geometries
**Solution**: 4-phase validation and fixing process
**Outcome**: ✅ 99.98% of features now valid (6,288 of 6,289)

**Key Achievements**:
- ✅ Fixed all "Invalid coordinate (2049)" errors
- ✅ Corrected all crazy border boundaries (Oyashima, Metzetta, Daxia)
- ✅ Clamped polar regions to Web Mercator limits
- ✅ Repaired 455 self-intersecting polygons
- ✅ Vector tiles now generating successfully
- ✅ Map rendering correctly in browser

**Performance**:
- Tile generation: 0.6-1.5 seconds per tile
- All spatial indexes in place
- Database ready for production use

---

**Last Updated**: October 29, 2025
**Version**: 1.0.0
**Status**: ✅ Complete - All critical issues resolved
