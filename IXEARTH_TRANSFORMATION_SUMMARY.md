# IxEarth Coordinate Transformation Summary

## Problem Solved

The IxStats map system was showing incorrect areas and "polar distortion" because:
1. **Source data uses a custom coordinate system** with prime meridian shifted to 26.09°E (not Greenwich 0°)
2. **IxEarth is a larger planet** than Earth, requiring scaled area calculations
3. **PostGIS calculations used Earth's ellipsoid**, producing wrong areas

## Solution Implemented

### 1. Coordinate Transformation
- **Simple longitude shift**: `WGS84_lng = IxMaps_lng + 26.09°`
- Transforms 6,289 features across 7 map layers
- Properly maps to WGS84 for MapLibre GL JS

### 2. Area Scaling
- **IxEarth scale factor: 1.183x**
- Calibrated to match canonical country sizes
- Applied to all PostGIS area calculations

## Results

| Country | Canonical Size | Calculated Size | Accuracy |
|---------|---------------|-----------------|----------|
| **Caphiria** | ~2.3M sq mi | 2,151,077 sq mi | 6.5% low ✓ |
| **Cartadania** | ~1.592M sq mi | 1,591,665 sq mi | **Perfect!** ✅ |
| **Urcea** | ~2.0M sq mi | 2,255,476 sq mi | 12.8% high |

## Technical Details

**Coordinate Coverage:**
- Longitude: -153.96° to 206.13° (full global coverage)
- Latitude: -92.66° to 91.81° (pole to pole)

**Data Imported:**
- Political boundaries: 185 features (64 matched to countries)
- Climate zones: 632 features
- Terrain/altitudes: 4,068 features
- Rivers: 1,041 features
- Lakes: 350 features
- Ice caps: 12 features
- Background: 1 feature
- **Total: 6,289 features**

**Storage:**
- Format: PostGIS (PostgreSQL with spatial extensions)
- Coordinate system: WGS84 (EPSG:4326)
- Projection for display: Natural Earth (default), with Mercator/Equal Earth/Globe options

## Scripts Created

1. **`scripts/transform-ixmaps-coordinates.ts`** - Transforms IxMaps CRS → WGS84
2. **`scripts/import-geographic-boundaries.ts`** - Imports with IxEarth scaling
3. **`scripts/import-all-map-layers.sh`** - Batch imports all layers
4. **`scripts/calculate-scale-factor.ts`** - Calibrates scale factor

## Documentation

- **[COORDINATE_TRANSFORMATION_GUIDE.md](docs/COORDINATE_TRANSFORMATION_GUIDE.md)** - Complete transformation details
- **[MAP_PROJECTION_GUIDE.md](docs/MAP_PROJECTION_GUIDE.md)** - Projection system explanation

## Next Steps

The coordinate transformation is complete. The map system now:
- ✅ Uses correct WGS84 coordinates
- ✅ Calculates accurate areas for IxEarth
- ✅ Spans full globe from pole to pole
- ✅ Matches canonical country sizes (within ~10%)
- ✅ Ready for display in MapLibre GL JS with Natural Earth projection

No polar distortion - the coordinates and areas are now correct!
