# Custom Projection Testing Guide

## Server-Side Fix Implementation Complete ✅

All custom projections now use **server-side transformation** via PostGIS + Martin tile server.

---

## Manual Testing Checklist

### 1. Backend Verification (✅ COMPLETE)

**PostGIS Functions:**
```bash
# Verify all 15 functions exist
psql -h localhost -p 5433 -U postgres -d ixstats -c \
  "SELECT routine_name FROM information_schema.routines
   WHERE routine_name LIKE 'mvt_%_equal%'
   OR routine_name LIKE 'mvt_%_natural%'
   OR routine_name LIKE 'mvt_%_ixmaps'
   ORDER BY routine_name;"
```

**Martin Endpoints:**
```bash
# Test sample tiles from each projection × layer combination
curl -s -I http://localhost:3800/mvt_altitudes_equalearth/2/1/1 | head -2
curl -s -I http://localhost:3800/mvt_lakes_naturalearth/2/1/1 | head -2
curl -s -I http://localhost:3800/mvt_rivers_ixmaps/2/1/1 | head -2
curl -s -I http://localhost:3800/mvt_icecaps_equalearth/2/1/1 | head -2
curl -s -I http://localhost:3800/mvt_climate_naturalearth/2/1/1 | head -2
```

**Next.js API Proxy:**
```bash
# Test API routes
curl -s -I http://localhost:3000/api/tiles/projections/equalearth/altitudes/2/1/1
curl -s -I http://localhost:3000/api/tiles/projections/naturalearth/lakes/2/1/1
curl -s -I http://localhost:3000/api/tiles/projections/ixmaps/political/2/1/1
```

---

### 2. Frontend Testing (Manual)

**Test Matrix:** 4 projections × 6 layers × 3 map types = 72 combinations

#### Projection: **Mercator** (Control - No changes expected)
- [ ] Political layer renders
- [ ] Altitudes (terrain) renders
- [ ] Lakes render
- [ ] Rivers render (zoom 3+)
- [ ] Icecaps render
- [ ] Climate layer toggles

#### Projection: **Globe** (Control - No changes expected)
- [ ] Political layer renders
- [ ] Altitudes (terrain) renders
- [ ] Lakes render
- [ ] Rivers render (zoom 3+)
- [ ] Icecaps render
- [ ] Climate layer toggles

#### Projection: **Equal Earth** (Custom - FIXED)
- [ ] Political layer renders in Equal Earth projection
- [ ] Altitudes (terrain) renders in Equal Earth projection
- [ ] Lakes render in Equal Earth projection
- [ ] Rivers render in Equal Earth projection (zoom 3+)
- [ ] Icecaps render in Equal Earth projection
- [ ] Climate layer toggles in Equal Earth projection
- [ ] No tile seams at boundaries
- [ ] Country shapes match Equal Earth projection (compressed poles, wider equator)

#### Projection: **Natural Earth** (Custom - FIXED)
- [ ] Political layer renders in Natural Earth projection
- [ ] Altitudes (terrain) renders in Natural Earth projection
- [ ] Lakes render in Natural Earth projection
- [ ] Rivers render in Natural Earth projection (zoom 3+)
- [ ] Icecaps render in Natural Earth projection
- [ ] Climate layer toggles in Natural Earth projection
- [ ] No tile seams at boundaries
- [ ] Country shapes match Natural Earth projection (compromise between shape/area)

#### Projection: **IxMaps** (Custom - FIXED)
- [ ] Political layer renders in IxMaps projection
- [ ] Altitudes (terrain) renders in IxMaps projection
- [ ] Lakes render in IxMaps projection
- [ ] Rivers render in IxMaps projection (zoom 3+)
- [ ] Icecaps render in IxMaps projection
- [ ] Climate layer toggles in IxMaps projection
- [ ] No tile seams at boundaries
- [ ] Prime meridian at 30°E (IxEarth convention)

---

### 3. Map Type Testing

Test each projection with all 3 map types:

**Map Type: "Map" (Standard)**
- [ ] Mercator: All layers visible
- [ ] Globe: All layers visible
- [ ] Equal Earth: All layers visible
- [ ] Natural Earth: All layers visible
- [ ] IxMaps: All layers visible

**Map Type: "Terrain"**
- [ ] Mercator: Terrain colors dominant, political subtle
- [ ] Globe: Terrain colors dominant, political subtle
- [ ] Equal Earth: Terrain colors dominant, political subtle
- [ ] Natural Earth: Terrain colors dominant, political subtle
- [ ] IxMaps: Terrain colors dominant, political subtle

**Map Type: "Climate"**
- [ ] Mercator: Climate overlay at 70% opacity
- [ ] Globe: Climate overlay at 70% opacity
- [ ] Equal Earth: Climate overlay at 70% opacity
- [ ] Natural Earth: Climate overlay at 70% opacity
- [ ] IxMaps: Climate overlay at 70% opacity

---

### 4. Interaction Testing

**Country Hover/Click:**
- [ ] Hover changes border color to blue in all projections
- [ ] Click opens info window in all projections
- [ ] Info window shows correct country name

**Projection Switching:**
- [ ] Mercator → Equal Earth: Smooth transition, no errors
- [ ] Equal Earth → Natural Earth: Smooth transition, no errors
- [ ] Natural Earth → IxMaps: Smooth transition, no errors
- [ ] IxMaps → Globe: Smooth transition, no errors
- [ ] Globe → Mercator: Smooth transition, no errors

**Zoom/Pan:**
- [ ] Zoom in/out works in all projections
- [ ] Pan works in all projections
- [ ] Tiles load progressively (no white squares)

---

### 5. Performance Testing

**Cache Effectiveness:**
```bash
# Test cache hit rates (should be fast after first load)
time curl -s http://localhost:3000/api/tiles/projections/equalearth/altitudes/2/1/1 > /dev/null
# First: ~200-500ms (PostGIS transform)
# Second: ~5-20ms (Redis cache hit)
```

**Browser DevTools:**
- [ ] Network tab shows 200 OK for all tile requests
- [ ] No 404 or 500 errors
- [ ] `X-Cache-Status: HIT-REDIS` appears on subsequent loads
- [ ] No console errors or warnings
- [ ] MapLibre loads all sources successfully

**Client Performance:**
- [ ] CPU usage minimal (no transformation overhead)
- [ ] Memory usage reasonable (~100MB for tile cache)
- [ ] 60fps during pan/zoom operations

---

### 6. Visual Regression Testing

Compare screenshots for each projection:

**Mercator Baseline:**
- Screenshot at zoom 2, center [0, 0]

**Globe Baseline:**
- Screenshot at zoom 2, center [0, 0]

**Equal Earth:**
- [ ] Landmasses appear compressed vertically near poles
- [ ] Equatorial regions wider than Mercator
- [ ] Antarctica significantly smaller than Mercator
- [ ] Greenland proportional to Africa (equal-area property)

**Natural Earth:**
- [ ] Smoother pole compression than Mercator
- [ ] Moderate equatorial expansion
- [ ] Visually balanced (compromise projection)

**IxMaps:**
- [ ] Map centered at 30°E (not 0°)
- [ ] Linear appearance (equirectangular-like)
- [ ] Prime meridian vertical line at center

---

## Known Issues / Limitations

### Not Issues (Expected Behavior):
- **Rivers not visible at zoom < 3**: This is intentional (minzoom: 3 in style)
- **Custom projections look "squished"**: Equal Earth compresses poles by design
- **IxMaps looks "stretched"**: Linear projection has no area correction

### Real Issues to Watch For:
- Tile seams at tile boundaries (indicates coordinate mismatch)
- Missing geometries (indicates ST_Transform failure)
- Console errors about protocol or fetch failures
- White/blank tiles (indicates empty MVT response)

---

## Rollback Instructions

If custom projections fail:

1. **Quick fix**: Disable custom projections in UI
   ```typescript
   // In ProjectionInfoPanel.tsx or similar
   const availableProjections = ['mercator', 'globe'];
   ```

2. **Revert client changes**:
   ```bash
   git checkout HEAD -- src/lib/maps/projection-protocol.ts
   git checkout HEAD -- src/lib/maps/google-map-style.ts
   ```

3. **Restore old API route** (if needed):
   ```bash
   git checkout HEAD -- src/app/api/tiles/projections/
   ```

4. **Remove PostGIS functions** (if needed):
   ```sql
   DROP FUNCTION IF EXISTS mvt_altitudes_equalearth CASCADE;
   -- ... repeat for all 15 functions
   ```

---

## Architecture Reference

### Server-Side Flow:
```
Client Protocol Request
  ↓ projection-equalearth://altitudes/2/1/1
MapLibre Custom Protocol Handler
  ↓ Fetch: /api/tiles/projections/equalearth/altitudes/2/1/1
Next.js API Route
  ↓ Cache Check (Redis)
  ↓ If miss: Fetch from Martin
Martin Tile Server
  ↓ Execute: mvt_altitudes_equalearth(2, 1, 1)
PostGIS Function
  ↓ ST_Transform(geometry, 8857) [Equal Earth SRID]
  ↓ ST_AsMVTGeom() → ST_AsMVT()
Return MVT Tile (Protocol Buffer)
  ↓ Cache in Redis (30 days)
  ↓ Cache in Client (LRU, 500 tiles)
Render on Map
```

### Projection SRIDs:
- **Equal Earth**: EPSG:8857 (official)
- **Natural Earth**: SRID:900001 (custom, added to spatial_ref_sys)
- **IxMaps**: SRID:900002 (custom, equirectangular + 30° offset)

### Tile Endpoints:
- Standard (Mercator/Globe): `/api/tiles/{layer}/{z}/{x}/{y}`
- Custom Projections: `/api/tiles/projections/{projection}/{layer}/{z}/{x}/{y}`

---

## Success Criteria

✅ **All backend services operational:**
- 15 PostGIS functions created
- Martin serving all functions
- API routes responding with valid MVT

✅ **All client code updated:**
- Protocol handlers fetch from server
- Style generator uses protocol for all layers
- No client-side transformation logic

✅ **Broken code removed:**
- mvt-transformer.ts deleted
- geojson-vt dependency unused
- Old API route structure deleted

🧪 **Pending manual testing:**
- Visual verification of custom projections
- Interaction testing (hover, click, zoom)
- Performance validation (cache effectiveness)

---

## Next Steps

1. **Manual Testing**: Open http://localhost:3000/maps and test all projections
2. **Screenshot Comparison**: Verify visual correctness of custom projections
3. **Performance Profiling**: Check browser DevTools for cache hits and render performance
4. **User Acceptance**: Get feedback on projection accuracy and visual quality

---

_Testing documentation generated during server-side custom projection fix implementation._
_Last updated: 2025-10-31_
