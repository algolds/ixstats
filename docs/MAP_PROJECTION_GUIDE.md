# Map Projection Guide

## Overview

IxStats map system uses **Natural Earth projection** as default for minimal polar distortion, with support for Web Mercator, Equal Earth, and Globe projections. Data is stored in **PostGIS as WGS84 (EPSG:4326)** after transformation from the IxWiki custom coordinate system, and rendered in user-selected projections via MapLibre GL JS.

This guide explains:
- Why different projections exist (trade-offs between shape, area, distance)
- **Natural Earth**: Our default projection for balanced world maps
- How smart auto-switching works (Natural Earth ↔ Mercator based on zoom)
- Best practices for choosing projections

> **Important Notes:**
> - **Coordinate Data**: All geographic data is transformed from the IxWiki custom CRS to WGS84. See [Coordinate Transformation Guide](./COORDINATE_TRANSFORMATION_GUIDE.md).
> - **Area Data**: Country areas come from the **World Roster** (`public/World-Roster.xlsx`), not from projection calculations. See [World Roster Integration](./WORLD_ROSTER_INTEGRATION.md).
> - **Scale Factor**: The IxEarth Scale Factor (1.4777x) reconciles canonical World Roster areas with calculated geographic areas. See [IxEarth Metrics](./IXEARTH_METRICS.md).

## Understanding Map Projections

### The Fundamental Problem

**It's mathematically impossible to perfectly flatten a 3D sphere (Earth) onto a 2D surface (a map) without distortion.**

Every map projection must sacrifice something:
- **Shape** (angular distortion)
- **Area** (size distortion)
- **Distance** (distance distortion)
- **Direction** (bearing distortion)

### Web Mercator (EPSG:3857)

**What it preserves**: Local shapes (conformal projection)
**What it distorts**: Areas, especially near the poles

#### Area Distortion by Latitude

| Latitude | Area Distortion | Example |
|----------|----------------|---------|
| 0° (Equator) | 100% (accurate) | Accurate representation |
| 45° | ~140% | North USA, Southern Europe |
| 60° | ~200% | Alaska, Scandinavia |
| 70° | ~300% | Northern Canada |
| 80° | ~600% | Arctic regions |
| 85° | ~1700%! | Near polar regions |

#### Famous Examples

1. **Greenland vs. Africa**:
   - **On Mercator**: Greenland appears similar in size to Africa
   - **Reality**: Africa is 14.2x larger than Greenland!

2. **Antarctica**:
   - **On Mercator**: Appears as massive continent spanning entire bottom
   - **Reality**: Stretched infinitely due to mathematical limits

3. **Russia**:
   - **On Mercator**: Appears enormous
   - **Reality**: Still large, but distorted by ~300% at high latitudes

### Equal Earth Projection

**What it preserves**: Accurate areas (equal-area projection)
**What it distorts**: Shapes slightly (minimal, balanced distortion)

#### Benefits

✅ **Accurate area comparison** - Countries shown at true relative sizes
✅ **No polar distortion** - High-latitude regions appear at correct sizes
✅ **Visually pleasing** - Balanced aesthetics without extreme distortion
✅ **Perfect for data visualization** - Population, GDP, resources shown accurately
✅ **Modern standard** - Used by National Geographic, data journalists

### Natural Earth Projection (Default) ⭐

**What it preserves**: Balanced appearance with minimal distortion at all latitudes
**What it uses**: Compromise projection designed by Tom Patterson (National Geographic)

#### Why Natural Earth is Our Default

Natural Earth solves the polar distortion problem while maintaining familiarity:

| Projection | Distortion at 60°N | Distortion at 80°N | Visual Quality |
|------------|-------------------|-------------------|----------------|
| **Mercator** | 200% | 600% | ❌ Extreme polar stretching |
| **Equirectangular** | 200% | 600% | ❌ Even worse than Mercator |
| **Natural Earth** | **15%** | **40%** | ✅ Minimal distortion |
| **Equal Earth** | 0% | 0% | ✅ Perfect areas, unfamiliar shapes |

#### Benefits

✅ **Minimal polar distortion** - Only ~40% at 80°N (vs 600% for Mercator)
✅ **Familiar appearance** - Natural-looking, aesthetically pleasing
✅ **Industry standard** - Used by National Geographic, ESRI, world atlases
✅ **Best for world maps** - Designed specifically for global visualization
✅ **Already built-in** - Native MapLibre projection (fast, reliable)

#### When to Use

**Use Natural Earth for** (default):
- World and regional overview maps
- Thematic mapping at global/continental scale
- Educational and reference maps
- Any view showing large portions of Earth

**Switch to other projections for**:
- **Mercator**: Local/street-level navigation (distortion imperceptible at high zoom)
- **Equal Earth**: Data visualization requiring accurate area comparison
- **Globe**: 3D perspective and true spatial relationships

### Globe View (3D)

**What it preserves**: Everything! (No distortion)
**Limitations**: Only shows one hemisphere at a time, requires 3D rendering

## Implementation

### Coordinate System Flow

```
Source GeoJSON (EPSG:4326 WGS84)
        ↓
PostGIS Storage (EPSG:3857 Web Mercator)
        ↓
Vector Tile Generation (ST_AsMVT)
        ↓
API Output (EPSG:4326 GeoJSON)
        ↓
MapLibre GL Rendering (User-selected projection)
```

### Projection Support

#### Natural Earth (Default) ⭐
```typescript
mapInstance.setProjection({ type: 'naturalEarth' });
```

- **Use for**: World maps, regional overviews, thematic mapping
- **Pros**: Minimal distortion, industry standard, familiar appearance
- **Cons**: Not conformal (angles slightly distorted), not equal-area

**IxStats Enhancement**: Automatically selected at low zoom levels (world view) for minimal distortion.

#### Web Mercator
```typescript
mapInstance.setProjection({ type: 'mercator' });
```

- **Use for**: Navigation, street maps, local views
- **Pros**: Industry standard, preserves angles, excellent at high zoom
- **Cons**: Severe area distortion at high latitudes

**IxStats Enhancement**: Automatically bounded to ±85.0511° latitude to hide extreme polar distortion.

#### Equal Earth
```typescript
mapInstance.setProjection({ type: 'equalEarth' });
```

- **Use for**: Data visualization, thematic maps, area comparison
- **Pros**: Accurate areas, minimal distortion, visually balanced
- **Cons**: Shapes slightly distorted (acceptable tradeoff)

#### Globe (3D)
```typescript
mapInstance.setProjection({ type: 'globe' });
```

- **Use for**: World view, education, spatial understanding
- **Pros**: No distortion, true perspective
- **Cons**: Performance intensive, only shows one hemisphere

## Polar Distortion Fixes Applied

### 1. Coordinate Clamping

**Problem**: 2 features in altitudes layer extended beyond Web Mercator bounds (>85.05°)

**Fix**: SQL script to clamp all coordinates to ±85.05°

```sql
-- script: scripts/clamp-mercator-coordinates.sql
UPDATE map_layer_altitudes
SET wkb_geometry = clamp_geometry_to_mercator(wkb_geometry)
WHERE wkb_geometry IS NOT NULL
  AND (
    ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) > 85.05112878
    OR ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) < -85.05112878
  );
```

**Result**: All features now within valid Mercator bounds

### 2. Tile Bounds Validation

**Enhancement**: Added clamping and validation to vector tile API

```typescript
// Clamp tile bounds to Web Mercator limits (±85.05°)
maxY = Math.min(maxY, MERCATOR_MAX_Y);
minY = Math.max(minY, MERCATOR_MIN_Y);

// Return empty tile if completely outside bounds
if (minY > MERCATOR_MAX_Y || maxY < MERCATOR_MIN_Y) {
  return new NextResponse(Buffer.from([]), {
    status: 200,
    headers: {
      "X-Tile-Status": "outside-mercator-bounds",
    },
  });
}
```

### 3. Alternative Projection Support

**Implementation**: Added Equal Earth and Globe projections

- User can switch between projections via UI
- Projection information panel explains tradeoffs
- Automatic fallback to Mercator if projection unsupported

### 4. User Education

**Features Added**:
- ✅ Projection switcher with descriptions
- ✅ "Learn More" button linking to comprehensive info panel
- ✅ Visual indicators showing projection characteristics
- ✅ Detailed comparison table
- ✅ Famous examples and use cases

## Diagnostic Tools

### Projection Diagnostic Script

```bash
npx tsx scripts/diagnose-projection.ts
```

**Output**:
- Total features per layer
- Features beyond Mercator bounds
- Latitude/longitude ranges
- Distortion analysis
- Recommendations

**Example Output**:
```
📍 POLITICAL BOUNDARIES:
  Total features: 185
  Features out of bounds: 0
  Latitude range: -74.77° to 76.00°
  Longitude range: -178.56° to 171.71°

⚠️  HIGH LATITUDE FEATURES DETECTED
   Max latitude: 76.00°
   At these latitudes, Web Mercator has significant area distortion:
   - At 70°: ~200% area distortion
   - At 80°: ~600% area distortion
```

## Best Practices

### Choosing a Projection

1. **For Navigation/Street Maps**: Use Web Mercator
   - Standard web mapping projection
   - Excellent for local/regional views
   - Preserves shapes and angles

2. **For Data Visualization**: Use Equal Earth
   - Accurate area comparison
   - Perfect for choropleth maps (population, GDP, etc.)
   - Minimal distortion, balanced aesthetics

3. **For World Overview**: Use Globe (3D)
   - Most accurate representation
   - Educational purposes
   - Understanding spatial relationships

### Implementation Checklist

When adding map features:
- ✅ Validate coordinates are within ±85.05° for Mercator
- ✅ Use Equal Earth for area-dependent visualizations
- ✅ Provide projection switcher for user choice
- ✅ Document projection tradeoffs in UI
- ✅ Test with high-latitude features

## Performance Considerations

### Web Mercator
- ✅ **Excellent**: Highly optimized, industry standard
- ✅ **Tile generation**: ~50-200ms per tile
- ✅ **Browser support**: Universal

### Equal Earth
- ✅ **Good**: Well-supported by MapLibre GL
- ✅ **Performance**: Comparable to Mercator
- ⚠️ **Support**: Requires MapLibre GL v2.0+

### Globe (3D)
- ⚠️ **Moderate**: 3D rendering overhead
- ⚠️ **Memory**: Higher memory usage
- ⚠️ **Browser**: Requires WebGL support
- ⚠️ **Mobile**: May impact performance on older devices

## Common Issues and Solutions

### Issue: "Greenland looks huge!"
**Solution**: This is correct for Web Mercator. Switch to Equal Earth for accurate area representation.

### Issue: "Antarctica is stretched out"
**Solution**: Web Mercator becomes infinite at poles. This is by design. Use Globe or Equal Earth.

### Issue: "Russia appears larger than Africa"
**Solution**: Web Mercator distortion at high latitudes. Equal Earth shows true sizes (Africa is larger).

### Issue: "Features missing near poles"
**Solution**: Features beyond ±85.05° are clamped or excluded. This is a Mercator limitation.

## Further Reading

### Technical Documentation
- [Web Mercator (EPSG:3857)](https://en.wikipedia.org/wiki/Web_Mercator_projection)
- [Equal Earth Projection](https://en.wikipedia.org/wiki/Equal_Earth_projection)
- [MapLibre GL Projections](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ProjectionSpecification/)

### Interactive Tools
- [The True Size Of...](https://thetruesize.com/) - Compare true sizes of countries
- [Map Projection Transitions](https://www.jasondavies.com/maps/transition/) - Visualize projection distortion
- [Projection Wizard](https://projectionwizard.org/) - Choose optimal projection for your map

### Educational Resources
- [Why Web Maps Use Mercator](https://www.mapbox.com/blog/web-mercator) - Mapbox blog post
- [Understanding Map Projections](https://www.axismaps.com/guide/general/map-projections/) - Axis Maps guide
- [The Problems with the Mercator Projection](https://www.youtube.com/watch?v=kIID5FDi2JQ) - Vox video

## Conclusion

The IxStats map system uses **Natural Earth projection as the default** to minimize polar distortion while maintaining familiar world map appearance. We've implemented:

1. ✅ **Natural Earth projection** as default for minimal distortion (~40% at 80°N vs 600% for Mercator)
2. ✅ **Smart auto-switching** between Natural Earth (world view) and Mercator (local navigation)
3. ✅ **Coordinate validation and clamping** to stay within Mercator bounds (±85.0511°)
4. ✅ **Equal Earth projection** for accurate area comparison when needed
5. ✅ **Globe view** for true 3D perspective
6. ✅ **User education** through comprehensive UI explanations
7. ✅ **Diagnostic tools** to monitor projection health

Users now have the choice of projection based on their needs:
- **Natural Earth** (default) for world maps and regional overviews with minimal distortion
- **Mercator** for navigation and street-level maps
- **Equal Earth** for accurate area visualization and data comparison
- **Globe** for 3D world-scale viewing

All projections are fully functional, optimized for performance, and seamlessly integrated with MapLibre GL JS.
