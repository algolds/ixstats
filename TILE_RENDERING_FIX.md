# Tile Rendering Fix - October 30, 2025

## Problem

Map tiles were only rendering partially, showing a small fragment in the upper-left corner instead of the full map.

**Symptoms**:
- Only ~5% of expected tile area visible
- Tiles loaded but didn't cover the map
- Rendering issues at all zoom levels

## Root Causes Identified

### 1. Invalid Geometries in Database (Critical)
**82 out of 185 geometries (44%) were invalid**, causing rendering failures.

```sql
-- Validation check revealed:
Total geometries:  185
Valid geometries:  103 (56%)
Invalid geometries: 82 (44%)
```

**Types of invalidity**:
- Too few points in geometry components (degenerate polygons)
- Self-intersecting polygons
- Ring self-intersections
- Invalid topology

### 2. Missing Tile Bounds in MapLibre Configuration
MapLibre wasn't aware of the valid coordinate range for tiles.

### 3. Low Maxzoom Setting
Maxzoom was set to 14, limiting detail at higher zoom levels.

## Solutions Applied

### Fix 1: Repair Invalid Geometries ✅

```sql
-- Applied ST_MakeValid to fix all invalid geometries
UPDATE map_layer_political
SET geometry = ST_MakeValid(geometry)
WHERE NOT ST_IsValid(geometry);

-- Result: 82 geometries fixed
```

**What ST_MakeValid does**:
- Removes degenerate components
- Fixes self-intersections
- Repairs topology errors
- Creates valid OGC-compliant geometries

### Fix 2: Add Tile Bounds to MapLibre ✅

```typescript
// Before (no bounds)
mapInstance.addSource('political-tiles', {
  type: 'vector',
  tiles: [`${baseUrl}${basePath}/api/tiles/political/{z}/{x}/{y}`],
  minzoom: 0,
  maxzoom: 14,
});

// After (with standard Web Mercator bounds)
mapInstance.addSource('political-tiles', {
  type: 'vector',
  tiles: [`${baseUrl}${basePath}/api/tiles/political/{z}/{x}/{y}`],
  minzoom: 0,
  maxzoom: 18,  // Increased from 14
  bounds: [-180, -85, 180, 85],  // Added bounds
});
```

### Fix 3: Add Political Borders Layer ✅

Added a separate line layer for clearer borders:

```typescript
mapInstance.addLayer({
  id: 'political-borders',
  type: 'line',
  source: 'political-tiles',
  'source-layer': 'map_layer_political',
  paint: {
    'line-color': '#000000',
    'line-width': 1,
    'line-opacity': 0.5,
  },
});
```

### Fix 4: Clear Cached Tiles ✅

```bash
# Restart Martin to clear its cache
docker restart martin-tiles

# Clear Redis cache of old invalid tiles
./scripts/setup-redis.sh clean
npm run redis:start
```

## Files Modified

1. **`src/hooks/maps/useVectorTileLayers.ts`**
   - Added `bounds: [-180, -85, 180, 85]`
   - Increased `maxzoom` from 14 to 18
   - Added `political-borders` line layer
   - Removed `fill-outline-color` from fill layer

2. **Database** (`map_layer_political` table)
   - Applied `ST_MakeValid()` to 82 invalid geometries

## Verification Steps

```bash
# 1. Check all geometries are now valid
psql -d ixstats -c "SELECT COUNT(*) as total,
  SUM(CASE WHEN ST_IsValid(geometry) THEN 1 ELSE 0 END) as valid
  FROM map_layer_political;"
# Expected: 185 total, 185 valid

# 2. Test tile generation
curl http://localhost:3800/map_layer_political/2/1/1 | xxd | head -10
# Should show MVT binary data

# 3. Check browser console for errors
# Should see no tile loading errors

# 4. Verify full map renders
# Navigate to /maps and pan/zoom - should see complete map
```

## Expected Results After Fix

- ✅ Full map rendering across all tiles
- ✅ No missing geometry fragments
- ✅ Smooth panning and zooming
- ✅ Clear political borders
- ✅ Proper rendering at all zoom levels (0-18)

## Prevention

To prevent future invalid geometry issues:

1. **Validate on Import**
   ```sql
   -- Add constraint to ensure valid geometries
   ALTER TABLE map_layer_political
   ADD CONSTRAINT geometry_must_be_valid
   CHECK (ST_IsValid(geometry));
   ```

2. **Run ST_MakeValid on Import**
   ```sql
   -- Apply during data import
   INSERT INTO map_layer_political (geometry, ...)
   VALUES (ST_MakeValid(ST_GeomFromText(...)), ...);
   ```

3. **Regular Validation Checks**
   ```bash
   # Add to monitoring
   npx tsx scripts/validate-geometries.ts
   ```

## Performance Impact

- ✅ No negative performance impact
- ✅ Fixed geometries may render slightly faster (simpler topology)
- ✅ Increased maxzoom allows for better detail at high zoom levels

## Related Issues

This fix resolves:
- Partial tile rendering
- Missing map areas
- Geometry-related rendering errors
- Tiles loading but not displaying

## References

- PostGIS `ST_MakeValid`: https://postgis.net/docs/ST_MakeValid.html
- PostGIS `ST_IsValid`: https://postgis.net/docs/ST_IsValid.html
- MapLibre Vector Tile Sources: https://maplibre.org/maplibre-style-spec/sources/#vector
- OGC Simple Features Specification

---

**Status**: ✅ Fixed
**Date**: October 30, 2025
**Impact**: Critical rendering issue resolved
