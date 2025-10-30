# Tile Rendering Debugging Checklist

## Current Status
Map shows only small fragment in upper-left corner despite:
- ✅ Tiles being generated (33KB at zoom 1)
- ✅ 82 invalid geometries fixed
- ✅ Bounds added to MapLibre config
- ✅ Maxzoom increased to 18

## Things to Check in Browser

### 1. Open Browser DevTools Console
Look for:
```
[VectorTiles] Adding tile source: ...
[VectorTiles] Adding political fills layer
[VectorTiles] Adding political borders layer
[VectorTiles] Map sources: [...]
[VectorTiles] Map layers: [...]
```

### 2. Check Network Tab
Filter for `tiles/political`:
- Should see requests like `/api/tiles/political/1/0/0`
- Status should be 200 OK
- Size should be >1KB for tiles with data
- Response should be `application/x-protobuf`

### 3. Check for Errors
Look for:
- "Failed to fetch" errors
- CORS errors
- "source-layer" not found errors
- Vector tile parsing errors

### 4. Inspect Map State
In console, run:
```javascript
// Get map instance (if you can access it)
const map = window.map; // if exposed

// Check sources
map.getStyle().sources

// Check layers
map.getStyle().layers

// Check if tiles are loading
map.on('data', (e) => {
  if (e.dataType === 'source') {
    console.log('Source data loaded:', e.sourceId);
  }
});

// Check tile requests
map.on('dataloading', (e) => {
  if (e.dataType === 'source') {
    console.log('Loading from source:', e.sourceId);
  }
});
```

## Common Issues & Solutions

### Issue 1: Wrong source-layer name
**Symptom**: Tiles load but map is blank
**Check**: Source layer name must match Martin's output

```bash
# Check what Martin calls the layer
curl http://localhost:3800/map_layer_political/1/0/0 | \
  protoc --decode_raw | grep -A5 "1:"
```

**Fix**: Update `source-layer` in the code to match

### Issue 2: Coordinate system mismatch
**Symptom**: Tiny fragment renders
**Check**: Ensure geometries are in EPSG:4326 (WGS84)

```sql
SELECT DISTINCT ST_SRID(geometry) FROM map_layer_political;
-- Should return: 4326
```

### Issue 3: Tile extent mismatch
**Symptom**: Features clipped or misaligned
**Check**: Martin uses extent 4096 by default

```typescript
// Should match in API route
const mvtExtent = 4096;
```

### Issue 4: Empty tiles not handled
**Symptom**: Some areas blank
**Check**: API should return empty MVT (not 404) for empty tiles

## Quick Diagnostic Commands

```bash
# 1. Check if Martin is serving tiles
curl -I http://localhost:3800/map_layer_political/1/0/0

# 2. Check if API proxy works
curl -I http://localhost:3000/api/tiles/political/1/0/0

# 3. Check tile content
curl http://localhost:3800/map_layer_political/1/0/0 | \
  hexdump -C | head -20

# 4. Verify geometry bounds
psql -d ixstats -c "SELECT ST_Extent(geometry) FROM map_layer_political;"
```

## MapLibre Debugging

### Enable Debug Mode
Add to map initialization:
```typescript
const mapInstance = new maplibregl.Map({
  ...otherOptions,
  hash: true, // Add URL hash for position
  renderWorldCopies: false, // Disable world wrapping
});

// Log tile loads
mapInstance.showTileBoundaries = true; // Show tile boundaries
mapInstance.showCollisionBoxes = true; // Show collision boxes
```

### Log All Tile Requests
```typescript
mapInstance.on('data', (e) => {
  if (e.sourceDataType === 'metadata') {
    console.log('Source loaded:', e.sourceId);
  }
  if (e.sourceDataType === 'content') {
    console.log('Tile data loaded:', e.sourceId, e.tile?.tileID);
  }
});

mapInstance.on('error', (e) => {
  console.error('Map error:', e);
});

mapInstance.on('sourcedataloading', (e) => {
  console.log('Loading data from:', e.sourceId);
});
```

## Next Steps

1. **Refresh browser** and check console logs
2. **Check Network tab** for tile requests
3. **Look for errors** in console
4. **Verify tile content** using diagnostic commands
5. **Compare with working examples** from MapLibre docs

## Reference
- MapLibre Vector Tiles: https://maplibre.org/maplibre-style-spec/sources/#vector
- PostGIS ST_AsMVT: https://postgis.net/docs/ST_AsMVT.html
- MVT Specification: https://github.com/mapbox/vector-tile-spec
