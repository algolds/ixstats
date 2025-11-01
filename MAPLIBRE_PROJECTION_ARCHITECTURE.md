# MapLibre GL JS Custom Projection Architecture Analysis

**Date**: October 31, 2025
**Project**: Custom Projection Support for MapLibre GL JS
**Target Projections**: Equal Earth (EPSG:8857), Natural Earth I, IxMaps Custom

---

## Executive Summary

This document provides a comprehensive analysis of MapLibre GL JS's projection architecture based on the successful Globe projection implementation (v5.0.0). Our goal is to contribute custom projection support for Equal Earth, Natural Earth, and IxMaps projections to the MapLibre ecosystem, addressing community issues #168 and #272.

**Key Findings**:
- MapLibre has a modular projection system introduced with Globe in v5.0
- Projections require coordinated changes across 5 major components
- An existing Equal Earth plugin exists but uses a limited approach
- Full integration requires core modifications, not just plugins
- The Globe implementation serves as our blueprint

---

## Repository Overview

### Basic Information
- **Repository**: https://github.com/maplibre/maplibre-gl-js
- **License**: 3-Clause BSD License
- **Current Version**: v5.x (Globe support added in v5.0.0)
- **Total Commits**: 13,263+
- **Main Branch**: `main`
- **Language**: TypeScript with WebGL shaders

### Fork & Clone Commands
```bash
# Fork via GitHub UI, then:
git clone https://github.com/YOUR_USERNAME/maplibre-gl-js.git
cd maplibre-gl-js
git remote add upstream https://github.com/maplibre/maplibre-gl-js.git
npm install
npm run codegen
npm run build-dev
```

---

## Projection Architecture

### Current Projection System

MapLibre supports three projection types as of v5.0:

1. **Mercator** (`mercator`) - Default Web Mercator (EPSG:3857)
2. **Globe** (`globe`) - Spherical perspective projection with Mercator fallback at high zoom
3. **Vertical Perspective** (`vertical-perspective`) - Tilted globe view

### Core Architecture Components

The projection system consists of 5 tightly integrated components:

#### 1. Projection Class (`src/geo/projection/*.ts`)

**Interface Contract** (from `src/geo/projection/projection.ts`):

```typescript
interface Projection {
  // Identification
  name: string;                    // e.g., 'mercator', 'globe'
  shaderVariantName: string;       // Shader variant identifier
  shaderDefine: string;            // Preprocessor macro (e.g., '#define GLOBE')

  // Configuration
  useSubdivision: boolean;         // Whether geometry needs subdivision
  subdivisionGranularity: number;  // Level of subdivision detail

  // Shader Integration
  shaderPreludeCode: string;       // Fragment shader code injection
  vertexShaderPreludeCode: string; // Vertex shader code injection

  // Lifecycle Methods
  recalculate(params: ProjectionParams): void;  // Update projection state
  updateGPUdependent(painter: Painter): void;   // Per-frame GPU updates
  destroy(): void;                              // Cleanup GPU resources

  // Rendering
  getMeshFromTileID(tileID: TileID): Mesh;     // Generate tile geometry

  // Transitions (for adaptive projections)
  transitionState: number;         // 0..1 interpolation value
  hasTransition(): boolean;        // Whether projection transitions
  setErrorQueryLatitudeDegrees(lat: number): void;  // Error correction
}
```

**Key Design Principles**:
- Projections are singleton instances
- Self-managed GPU resources
- Dynamic shader code generation
- Support for transition/interpolation between projections

#### 2. Transform Class (`src/geo/projection/*_transform.ts`)

**Purpose**: Handles coordinate transformations between projection space and screen space.

**Key Methods** (based on Globe implementation):
- `projectTileCoordinates()` - Convert tile coords to projected coords
- `unprojectCoordinates()` - Reverse projection
- `calculateMatrices()` - Generate projection matrices
- `getPixelScale()` - Handle zoom-dependent scaling

**Example**: `globe_transform.ts` handles:
- Mercator-to-spherical coordinate conversion
- Adaptive transition at zoom level ~12
- Horizon clipping calculations
- Camera positioning for perspective projection

#### 3. Camera Helper (`src/geo/projection/*_camera_helper.ts`)

**Purpose**: Manages camera positioning and interaction for the projection.

**Responsibilities**:
- Pan/zoom calculations specific to projection
- Constraint handling (e.g., prevent panning beyond globe edge)
- Animation support (flyTo, easeTo)
- Mouse/touch interaction transformations

#### 4. Shader Implementation (`src/shaders/_projection_*.vertex.glsl`)

**Purpose**: GPU-side coordinate transformation and rendering.

**Globe Shader Structure** (`_projection_globe.vertex.glsl`):

```glsl
// Key Functions:

// Convert 2D Mercator tile coords to 3D sphere
vec3 projectToSphere(vec2 tileCoords, float elevation) {
    // 1. Convert Mercator Y to latitude
    float lat = atan(sinh(tileY));

    // 2. Convert to spherical coords
    float cosLat = cos(lat);
    vec3 spherePos = vec3(
        cosLat * cos(tileLon),
        cosLat * sin(tileLon),
        sin(lat)
    );

    // 3. Apply elevation
    return spherePos * (1.0 + elevation / earthRadius);
}

// Interpolate between Mercator and Globe
vec4 interpolateProjection(vec2 mercatorPos, vec3 globePos, float t) {
    vec4 mercatorProjected = u_projection_matrix * vec4(mercatorPos, 0, 1);
    vec4 globeProjected = u_projection_matrix * vec4(globePos, 1);
    return mix(mercatorProjected, globeProjected, t);
}

// Clip geometry beyond horizon
float globeComputeClippingZ(vec3 spherePos, vec3 cameraPos) {
    // Compute distance from horizon plane
    return dot(spherePos - cameraPos, horizonNormal);
}
```

**Mercator Shader Structure** (`_projection_mercator.vertex.glsl`):

```glsl
// Simple matrix projection
vec4 projectTile(vec2 p) {
    return u_projection_matrix * vec4(p, 0.0, 1.0);
}

// Handle pole vertices by killing triangles
vec4 projectTile(vec2 p, float t) {
    float projectToPoleMeridian = 1.0 - t;
    if (p.y > 1.0001 || p.y < -0.0001) {
        return vec4(0.0, 0.0, -1000000.0, 1.0);  // Kill triangle
    }
    return projectTile(p);
}
```

#### 5. Projection Factory (`src/geo/projection/projection_factory.ts`)

**Current Implementation**: Hardcoded switch statement

```typescript
function createProjectionFromName(name: string) {
    switch (name) {
        case 'mercator':
            return {
                projection: new MercatorProjection(),
                transform: new MercatorTransform(options),
                cameraHelper: new MercatorCameraHelper()
            };
        case 'globe':
            return {
                projection: new GlobeProjection(),
                transform: new GlobeTransform(options),
                cameraHelper: new GlobeCameraHelper()
            };
        case 'vertical-perspective':
            // ...
        default:
            return createProjectionFromName('mercator');
    }
}
```

**Limitation**: Not easily extensible - requires core modifications to add projections.

---

## Globe Implementation Analysis

### What Globe Taught Us

The Globe projection (PR #3963) demonstrates the complete pattern for adding a new projection. Here's what was required:

#### New Files Created

**Projection Infrastructure**:
1. `src/geo/projection/globe.ts` - Main projection class
2. `src/geo/projection/globe_transform.ts` - Coordinate transformations
3. `src/geo/projection/globe_camera_helper.ts` - Camera/interaction logic
4. `src/geo/projection/globe_utils.ts` - Helper utilities
5. `src/geo/projection/globe_projection_error_measurement.ts` - Precision correction

**Shader Files**:
1. `src/shaders/_projection_globe.vertex.glsl` - Globe vertex shader
2. `src/shaders/projection_error_measurement.vertex.glsl` - Error correction shader
3. `src/shaders/projection_error_measurement.fragment.glsl` - Error readback

#### Modified Files

**Core Systems**:
- `src/geo/projection/projection_factory.ts` - Add globe case
- `src/render/painter.ts` - Handle globe rendering
- `src/render/subdivision.ts` - Add geometry subdivision logic
- `src/render/draw_custom.ts` - Custom layer API for globe

**Layer Adaptations** (each required updates):
- Fill layers
- Line layers
- Circle layers
- Raster layers
- Fill extrusion layers
- Hillshade layers
- Symbol layers

**Transform System**:
- `src/geo/transform_helper.ts` - Shared transformation utilities

**Bucket Classes** (data preparation):
- `src/data/bucket/fill_extrusion_bucket.ts`
- `src/data/bucket/circle_bucket.ts`
- Others as needed

### Key Technical Innovations

#### 1. Adaptive Projection Transition

Globe automatically transitions to Mercator at high zoom (~12) to avoid floating-point precision issues:

```typescript
// In globe_transform.ts
calculateTransitionState(zoom: number): number {
    if (zoom < 5) return 1.0;  // Full globe
    if (zoom > 12) return 0.0; // Full Mercator
    return (12 - zoom) / 7;    // Interpolate
}
```

#### 2. Geometry Subdivision

Mercator tiles are subdivided before rendering to create curved surfaces:

```typescript
// In subdivision.ts
subdivideGlobe(geometry: Geometry, granularity: number): Geometry {
    // Convert each triangle/line segment into smaller pieces
    // So they can curve smoothly under spherical projection
}
```

**Why needed**: Without subdivision, straight Mercator lines would render as straight lines on the globe instead of great circles.

#### 3. Horizon Clipping

Geometry on the back side of the globe is clipped using a horizon plane:

```glsl
// Compute horizon plane in fragment shader
vec3 horizonNormal = normalize(cameraPos);
float distanceFromHorizon = dot(spherePos, horizonNormal);
if (distanceFromHorizon < 0.0) discard;  // Behind horizon
```

#### 4. GPU Error Correction

Combat GLSL `atan()` precision issues with CPU verification:

```typescript
// Render 1x1 pixel with known latitude
// Read back atan result from GPU
// Compare with Math.atan reference
// Adjust projection matrix to compensate
```

This runs every second to maintain precision across different GPUs.

---

## Equal Earth Mathematical Implementation

### D3-geo Reference

From https://github.com/d3/d3-geo/blob/main/src/projection/equalEarth.js:

```javascript
// Constants
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;
const iterations = 12;

// Forward projection: (lon, lat) -> (x, y)
function equalEarthRaw(lambda, phi) {
    const l = Math.asin(M * Math.sin(phi));
    const l2 = l * l;
    const l6 = l2 * l2 * l2;

    return [
        lambda * Math.cos(l) / (M * (A1 + 3*A2*l2 + l6*(7*A3 + 9*A4*l2))),
        l * (A1 + A2*l2 + l6*(A3 + A4*l2))
    ];
}

// Inverse projection: (x, y) -> (lon, lat)
equalEarthRaw.invert = function(x, y) {
    let l = y;
    let l2, l6, delta;

    // Newton-Raphson iteration
    for (let i = 0; i < iterations; i++) {
        l2 = l * l;
        l6 = l2 * l2 * l2;
        delta = (l * (A1 + A2*l2 + l6*(A3 + A4*l2)) - y) /
                (A1 + 3*A2*l2 + l6*(7*A3 + 9*A4*l2));
        l -= delta;
        if (Math.abs(delta) < epsilon) break;
    }

    l2 = l * l;
    l6 = l2 * l2 * l2;

    return [
        M * x * (A1 + 3*A2*l2 + l6*(7*A3 + 9*A4*l2)) / Math.cos(l),
        Math.asin(Math.sin(l) / M)
    ];
};
```

### GLSL Shader Translation

```glsl
// Equal Earth constants
const float EE_A1 = 1.340264;
const float EE_A2 = -0.081106;
const float EE_A3 = 0.000893;
const float EE_A4 = 0.003796;
const float EE_M = 0.8660254037844387;  // sqrt(3) / 2

// Forward projection
vec2 equalEarthProject(float lon, float lat) {
    float l = asin(EE_M * sin(lat));
    float l2 = l * l;
    float l6 = l2 * l2 * l2;

    float x = lon * cos(l) / (EE_M * (EE_A1 + 3.0*EE_A2*l2 + l6*(7.0*EE_A3 + 9.0*EE_A4*l2)));
    float y = l * (EE_A1 + EE_A2*l2 + l6*(EE_A3 + EE_A4*l2));

    return vec2(x, y);
}

// Inverse projection (for mouse coordinates)
vec2 equalEarthUnproject(float x, float y) {
    float l = y;
    float l2, l6, delta;

    // Newton-Raphson (12 iterations)
    for (int i = 0; i < 12; i++) {
        l2 = l * l;
        l6 = l2 * l2 * l2;
        delta = (l * (EE_A1 + EE_A2*l2 + l6*(EE_A3 + EE_A4*l2)) - y) /
                (EE_A1 + 3.0*EE_A2*l2 + l6*(7.0*EE_A3 + 9.0*EE_A4*l2));
        l -= delta;
        if (abs(delta) < 0.0000001) break;
    }

    l2 = l * l;
    l6 = l2 * l2 * l2;

    float lon = EE_M * x * (EE_A1 + 3.0*EE_A2*l2 + l6*(7.0*EE_A3 + 9.0*EE_A4*l2)) / cos(l);
    float lat = asin(sin(l) / EE_M);

    return vec2(lon, lat);
}
```

---

## Existing Equal Earth Plugin Analysis

### Repository: pka/maplibre-gl-equal-earth

**Approach**: External plugin using coordinate transformation wrapper

**Limitations**:
1. **Not a true projection**: Transforms coordinates but doesn't change rendering
2. **Requires special tiles**: Needs pre-projected tiles in Equal Earth + Mercator hybrid
3. **Limited zoom levels**: Examples show maxZoom: 6
4. **No shader integration**: Client-side coordinate conversion only
5. **No geometry subdivision**: Tiles don't curve properly
6. **External dependency**: Not part of core MapLibre

**Architecture**:
```typescript
class EqualEarthCoordTransform {
    // Converts lng/lat to Equal Earth projected coords
    geogLonLat_to_eqmercLonLat(coords: [number, number]): [number, number]

    // Provides transformation for deck.gl overlays
    // But underlying map still uses Mercator rendering
}
```

**Use Case**: Suitable for overlaying GeoJSON on pre-projected raster tiles, but not for true vector tile rendering in Equal Earth projection.

**Our Approach**: We need full core integration like Globe, not a plugin wrapper.

---

## Technical Roadmap

### Phase 1: Equal Earth Core Implementation

#### 1.1 Create Projection Class

**File**: `src/geo/projection/equal_earth.ts`

```typescript
export class EqualEarthProjection implements Projection {
    name = 'equal-earth';
    shaderVariantName = 'equalEarth';
    shaderDefine = '#define EQUAL_EARTH';
    useSubdivision = true;
    subdivisionGranularity = 4;  // Similar to globe

    // Implement all required interface methods
    recalculate(params: ProjectionParams): void {
        // Update projection state based on zoom, center, etc.
    }

    updateGPUdependent(painter: Painter): void {
        // Per-frame GPU updates if needed
    }

    getMeshFromTileID(tileID: TileID): Mesh {
        // Generate subdivided tile mesh
        return this.subdivision.createMesh(tileID, this.subdivisionGranularity);
    }

    // ... other methods
}
```

**Estimated Complexity**: Medium (150-200 lines, follow Globe pattern)

#### 1.2 Create Transform Class

**File**: `src/geo/projection/equal_earth_transform.ts`

```typescript
export class EqualEarthTransform extends Transform {
    // Forward projection
    projectTileCoordinates(tileCoords: vec2): vec2 {
        const [lon, lat] = mercatorToLngLat(tileCoords);
        return equalEarthProject(lon, lat);
    }

    // Inverse projection (for mouse coords)
    unprojectCoordinates(projectedCoords: vec2): vec2 {
        const [lon, lat] = equalEarthUnproject(projectedCoords);
        return lngLatToMercator(lon, lat);
    }

    // Matrix calculations
    calculateMatrices(): void {
        // Generate projection matrix for Equal Earth
        // Use orthographic or perspective camera as appropriate
    }

    // ... other transform methods
}
```

**Estimated Complexity**: High (300-400 lines, complex math)

#### 1.3 Create Camera Helper

**File**: `src/geo/projection/equal_earth_camera_helper.ts`

```typescript
export class EqualEarthCameraHelper {
    // Handle panning
    panBy(dx: number, dy: number): void {
        // Convert screen delta to Equal Earth space
        // Update camera position
    }

    // Handle zooming
    zoomBy(delta: number, point: vec2): void {
        // Zoom toward point in Equal Earth coordinates
    }

    // Constraints
    applyConstraints(): void {
        // Prevent panning beyond map bounds
        // Clamp zoom levels
    }

    // Animation support
    easeTo(target: CameraOptions): Animation {
        // Smooth camera transitions
    }
}
```

**Estimated Complexity**: Medium (200-300 lines)

#### 1.4 Create Shader Implementation

**File**: `src/shaders/_projection_equal_earth.vertex.glsl`

```glsl
// Equal Earth constants
const float EE_A1 = 1.340264;
const float EE_A2 = -0.081106;
const float EE_A3 = 0.000893;
const float EE_A4 = 0.003796;
const float EE_M = 0.8660254037844387;

// Project Mercator tile coordinates to Equal Earth
vec2 projectToEqualEarth(vec2 tileCoords) {
    // 1. Convert Mercator to lng/lat
    float lon = (tileCoords.x - 0.5) * 2.0 * PI;
    float y = (0.5 - tileCoords.y) * 2.0;
    float lat = atan(sinh(y * PI));

    // 2. Apply Equal Earth projection
    float l = asin(EE_M * sin(lat));
    float l2 = l * l;
    float l6 = l2 * l2 * l2;

    float x = lon * cos(l) / (EE_M * (EE_A1 + 3.0*EE_A2*l2 + l6*(7.0*EE_A3 + 9.0*EE_A4*l2)));
    float y_ee = l * (EE_A1 + EE_A2*l2 + l6*(EE_A3 + EE_A4*l2));

    // 3. Normalize to screen space
    return vec2(x, y_ee);
}

// Main projection function
vec4 projectTile(vec2 tileCoords) {
    vec2 equalEarthCoords = projectToEqualEarth(tileCoords);
    return u_projection_matrix * vec4(equalEarthCoords, 0.0, 1.0);
}

// With elevation support
vec4 projectTileWithElevation(vec2 tileCoords, float elevation) {
    vec2 equalEarthCoords = projectToEqualEarth(tileCoords);
    // Equal Earth is 2D, so elevation becomes Z offset
    return u_projection_matrix * vec4(equalEarthCoords, elevation, 1.0);
}
```

**Estimated Complexity**: Medium (100-150 lines)

#### 1.5 Utility Functions

**File**: `src/geo/projection/equal_earth_utils.ts`

```typescript
// Helper functions for Equal Earth calculations
export function equalEarthProject(lon: number, lat: number): [number, number] {
    // Same math as shader but in TypeScript
    // For CPU-side calculations
}

export function equalEarthUnproject(x: number, y: number): [number, number] {
    // Inverse projection with Newton-Raphson
}

export function calculateBounds(): BoundingBox {
    // Equal Earth has specific bounds
    // X: approximately ±2.6
    // Y: approximately ±1.3
}

export function isPointVisible(x: number, y: number): boolean {
    // Check if point is within Equal Earth projection bounds
}
```

**Estimated Complexity**: Low (50-100 lines)

#### 1.6 Update Projection Factory

**File**: `src/geo/projection/projection_factory.ts`

```typescript
function createProjectionFromName(name: string) {
    switch (name) {
        // ... existing cases

        case 'equal-earth':
            return {
                projection: new EqualEarthProjection(),
                transform: new EqualEarthTransform(options),
                cameraHelper: new EqualEarthCameraHelper()
            };

        // ...
    }
}
```

**Estimated Complexity**: Trivial (5 lines)

#### 1.7 Update Subdivision System

**File**: `src/render/subdivision.ts`

```typescript
// Add Equal Earth to subdivision logic
if (projection.name === 'equal-earth') {
    return subdivideForEqualEarth(geometry, granularity);
}
```

**Estimated Complexity**: Low (20-30 lines)

### Phase 2: Natural Earth I Implementation

**Similar structure to Equal Earth, different math**

Natural Earth I uses a more complex polynomial approximation:

```javascript
// Natural Earth I constants (from D3-geo)
const epsilon = 1e-6;
const iterations = 25;

function naturalEarthRaw(lambda, phi) {
    const phi2 = phi * phi;
    const phi4 = phi2 * phi2;

    return [
        lambda * (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4))),
        phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4)))
    ];
}

// Inverse requires numerical solver (no closed form)
```

**Files to Create**:
1. `src/geo/projection/natural_earth.ts`
2. `src/geo/projection/natural_earth_transform.ts`
3. `src/geo/projection/natural_earth_camera_helper.ts`
4. `src/geo/projection/natural_earth_utils.ts`
5. `src/shaders/_projection_natural_earth.vertex.glsl`

**Estimated Complexity**: Similar to Equal Earth

### Phase 3: IxMaps Custom Projection

**Challenge**: IxMaps uses a non-standard coordinate system

**Approach**:
1. Document IxMaps mathematical transformation
2. Implement as custom projection following same pattern
3. Provide configuration for custom parameters

**Files to Create**: Same structure as above

### Phase 4: Testing & Integration

#### 4.1 Unit Tests

**Files**:
- `src/geo/projection/equal_earth.test.ts`
- `src/geo/projection/equal_earth_transform.test.ts`
- `src/geo/projection/equal_earth_utils.test.ts`

**Test Coverage**:
```typescript
describe('EqualEarthProjection', () => {
    test('projects coordinates correctly', () => {
        const [x, y] = equalEarthProject(0, 0);
        expect(x).toBeCloseTo(0, 6);
        expect(y).toBeCloseTo(0, 6);
    });

    test('round-trip projection accuracy', () => {
        const [lon, lat] = [45, 30];
        const [x, y] = equalEarthProject(lon, lat);
        const [lon2, lat2] = equalEarthUnproject(x, y);
        expect(lon2).toBeCloseTo(lon, 6);
        expect(lat2).toBeCloseTo(lat, 6);
    });

    test('handles edge cases', () => {
        // North pole
        const [x, y] = equalEarthProject(0, 90);
        expect(isFinite(x)).toBe(true);
        expect(isFinite(y)).toBe(true);
    });
});
```

**Estimated Complexity**: Medium (100-200 lines per projection)

#### 4.2 Render Tests

**Files**: `test/integration/render/equal-earth/*.json`

**Test Cases**:
1. Basic rendering at various zoom levels
2. Geometry subdivision correctness
3. Layer rendering (fill, line, circle, etc.)
4. Symbol placement accuracy
5. Tile loading and caching
6. Transition between projections (if applicable)

**Example Test Definition**:
```json
{
  "id": "equal-earth-basic",
  "width": 512,
  "height": 512,
  "projection": "equal-earth",
  "center": [0, 0],
  "zoom": 2,
  "sources": {
    "geojson": {
      "type": "geojson",
      "data": "test/data/world.geojson"
    }
  },
  "layers": [
    {
      "id": "world",
      "type": "fill",
      "source": "geojson",
      "paint": {
        "fill-color": "#3388ff"
      }
    }
  ]
}
```

**Estimated Complexity**: Medium (10-20 test cases per projection)

#### 4.3 Integration Tests

**Purpose**: Test projection in complete map scenarios

**Test Cases**:
1. Projection initialization
2. User interaction (pan, zoom, rotate)
3. Data loading and display
4. API compatibility
5. Performance benchmarks

**Estimated Complexity**: Medium (50-100 lines)

### Phase 5: Documentation & Examples

#### 5.1 Developer Guide

**File**: `developer-guides/custom-projections.md`

```markdown
# Custom Projections in MapLibre GL JS

## Overview
How to add new projections to MapLibre GL JS...

## Architecture
5-component system...

## Implementation Guide
Step-by-step process...

## API Reference
Projection interface details...
```

#### 5.2 Usage Examples

**Files**: `test/examples/equal-earth-*.html`

**Examples**:
1. Basic Equal Earth map
2. Natural Earth I map
3. Switching between projections
4. Custom data overlays
5. Integration with deck.gl

#### 5.3 API Documentation

Update TypeDoc comments for:
- Projection interfaces
- Transform classes
- Public API methods

---

## File-by-File Change Matrix

### New Files (Per Projection)

| File | Purpose | Lines | Complexity |
|------|---------|-------|-----------|
| `src/geo/projection/{name}.ts` | Main projection class | 150-200 | Medium |
| `src/geo/projection/{name}_transform.ts` | Coordinate transforms | 300-400 | High |
| `src/geo/projection/{name}_camera_helper.ts` | Camera/interaction | 200-300 | Medium |
| `src/geo/projection/{name}_utils.ts` | Helper functions | 50-100 | Low |
| `src/shaders/_projection_{name}.vertex.glsl` | GPU projection | 100-150 | Medium |
| `src/geo/projection/{name}.test.ts` | Unit tests | 100-200 | Medium |
| `test/integration/render/{name}/*.json` | Render tests | - | Medium |

**Total per projection**: ~900-1,350 lines + test files

### Modified Files (Shared Across All Projections)

| File | Modification | Complexity |
|------|-------------|-----------|
| `src/geo/projection/projection_factory.ts` | Add case to switch | Trivial |
| `src/render/subdivision.ts` | Add subdivision logic | Low |
| `src/render/painter.ts` | Handle new projection in renderer | Low-Medium |
| Layer files (`src/render/draw_*.ts`) | Ensure compatibility | Low each |
| `src/geo/projection/projection.ts` | Update interface if needed | Low |
| `developer-guides/*.md` | Add documentation | Medium |

**Total modifications**: ~100-200 lines across all files

---

## Implementation Challenges & Solutions

### Challenge 1: Floating-Point Precision

**Issue**: GLSL has limited precision, especially for trigonometric functions.

**Solutions**:
1. Use double-precision where available (`dvec2`, `dmat4`)
2. Implement error correction like Globe's `atan()` verification
3. Use Taylor series approximations for critical functions
4. Normalize intermediate values frequently

**Example**:
```glsl
// Instead of direct atan
float lat = atan(sinh(y));

// Use error-corrected version
float lat = atan_corrected(sinh(y), u_error_correction);
```

### Challenge 2: Geometry Subdivision

**Issue**: Mercator tiles have straight edges; projections need curved geometry.

**Solution**: Subdivide each triangle/line into smaller segments before projection.

```typescript
function subdivideTriangle(v1, v2, v3, depth): Triangle[] {
    if (depth === 0) return [new Triangle(v1, v2, v3)];

    const m12 = midpoint(v1, v2);
    const m23 = midpoint(v2, v3);
    const m31 = midpoint(v3, v1);

    return [
        ...subdivideTriangle(v1, m12, m31, depth - 1),
        ...subdivideTriangle(m12, v2, m23, depth - 1),
        ...subdivideTriangle(m31, m23, v3, depth - 1),
        ...subdivideTriangle(m12, m23, m31, depth - 1)
    ];
}
```

**Granularity**: Start with 4 (same as Globe) and tune based on visual quality.

### Challenge 3: Tile Boundaries

**Issue**: Tiles must align perfectly at boundaries to avoid seams.

**Solution**:
1. Use consistent subdivision at tile edges
2. Ensure neighboring tiles use identical edge vertices
3. Snap edge vertices to exact positions
4. Use coverage buffer to hide minor seams

```typescript
function ensureTileBoundaryAlignment(mesh: Mesh, tileID: TileID) {
    const neighbors = getNeighborTiles(tileID);

    for (const edge of mesh.edges) {
        if (edge.isOnTileBoundary) {
            // Force edge vertices to match neighbor
            edge.vertices = getSharedEdgeVertices(tileID, neighbors);
        }
    }
}
```

### Challenge 4: Symbol Placement

**Issue**: Text and icons need proper placement in projected space.

**Solution**:
1. Project symbol anchor points using projection transform
2. Keep text upright (don't rotate with projection distortion)
3. Adjust collision detection for projection space
4. Scale icons based on local projection scale factor

```typescript
function placeSymbol(symbol: Symbol, projection: Projection): Placement {
    const anchor = projection.project(symbol.coordinates);
    const scale = projection.getLocalScale(symbol.coordinates);

    return {
        position: anchor,
        rotation: 0,  // Keep upright
        scale: scale,
        collisionBox: symbol.bounds.scale(scale)
    };
}
```

### Challenge 5: Performance Optimization

**Issue**: Projection calculations can be expensive.

**Solutions**:
1. **Cache Matrices**: Recalculate projection matrices only when camera changes
2. **Batch Processing**: Process tiles in batches
3. **LOD System**: Use simpler geometry at lower zooms
4. **Shader Optimization**: Minimize branching in GLSL
5. **Web Workers**: Offload subdivision calculations

```typescript
class ProjectionOptimizations {
    private matrixCache: Map<string, mat4> = new Map();

    getProjectionMatrix(params: ProjectionParams): mat4 {
        const key = JSON.stringify(params);
        if (!this.matrixCache.has(key)) {
            this.matrixCache.set(key, calculateMatrix(params));
        }
        return this.matrixCache.get(key);
    }
}
```

---

## Build & Development Workflow

### Initial Setup

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/maplibre-gl-js.git
cd maplibre-gl-js

# Install dependencies
npm install

# Generate code (shaders, typings, etc.)
npm run codegen
```

### Development Cycle

```bash
# Start development server with live reload
npm start
# This runs:
# - CSS watch
# - Dev build watch
# - Local HTTP server (http://localhost:9966)

# In another terminal, run type checking
npm run typecheck

# Run linter
npm run lint
npm run lint-css
```

### Testing

```bash
# Run all tests
npm test

# Run specific test types
npm run test-unit                           # Unit tests
npm run test-unit -- equal_earth.test.ts   # Specific unit test
npm run test-integration                    # Integration tests
npm run test-render                         # Render tests
npm run test-render -- equal-earth         # Specific render tests

# Run benchmarks
npm run benchmark
```

### Building

```bash
# Development build (faster, includes source maps)
npm run build-dev

# Production build (optimized, minified)
npm run build-prod

# Build everything (CSS, typings, shaders, dev & prod)
npm run build-dist

# Analyze bundle size
npm run bundle-stats
```

### Key Development Files

**Local Testing**:
- `debug/index.html` - Test page for development
- `test/examples/` - Example pages
- `test/integration/` - Integration test specs

**Configuration**:
- `rollup.config.ts` - Build configuration
- `tsconfig.json` - TypeScript configuration
- `package.json` - Scripts and dependencies

### Hot Reload Development

The `npm start` command enables rapid iteration:

1. Edit projection TypeScript files → Auto-rebuilds
2. Edit shader files → Auto-rebuilds
3. Refresh browser → See changes immediately

**Tips**:
- Use `debug/index.html` for quick testing
- Add `console.log` in projection classes for debugging
- Use browser DevTools to inspect WebGL calls
- Enable performance profiling in Chrome DevTools

---

## Community Engagement Strategy

### Pre-Implementation: RFC (Request for Comments)

**Action**: Post detailed proposal in GitHub Discussions

**Template**:
```markdown
# RFC: Native Support for Equal Earth, Natural Earth, and Custom Projections

## Summary
Proposal to add native support for Equal Earth and Natural Earth projections,
plus a framework for custom projections.

## Motivation
- Community demand (Issue #168, Discussion #163)
- Existing plugin approach is limited
- Educational/scientific use cases
- Demonstration of MapLibre's extensibility

## Technical Design
[Link to this architecture document]

## Implementation Plan
- Phase 1: Equal Earth (3-4 weeks)
- Phase 2: Natural Earth (2-3 weeks)
- Phase 3: Custom projection API (2-3 weeks)
- Phase 4: Testing & documentation (2 weeks)

## Open Questions
1. Should projections be opt-in via bundle splitting?
2. What level of test coverage is required?
3. Any concerns about maintenance burden?

## Alternatives Considered
- Plugin-only approach (rejected - too limited)
- Proj4js integration (rejected - too heavy)

cc @HarelM @wipfli @kylebarron (key maintainers from discussions)
```

**Timing**: Post RFC 1-2 weeks before starting implementation

### During Implementation: Draft PR

**Action**: Create draft PR early for feedback

**PR Template**:
```markdown
# [Draft] Add Equal Earth Projection Support

**Status**: 🚧 Work in Progress

## Overview
Implements Equal Earth projection following the Globe pattern introduced in v5.0.

Addresses #168, #272

## Implementation Checklist
- [x] Projection class (`equal_earth.ts`)
- [x] Transform class (`equal_earth_transform.ts`)
- [x] Camera helper (`equal_earth_camera_helper.ts`)
- [x] Vertex shader (`_projection_equal_earth.vertex.glsl`)
- [x] Utility functions (`equal_earth_utils.ts`)
- [ ] Unit tests
- [ ] Render tests
- [ ] Integration tests
- [ ] Documentation
- [ ] Examples

## Screenshots
[Include comparison screenshots showing Equal Earth vs Mercator]

## Performance
[Include benchmark results]

## Questions for Reviewers
1. Is subdivision granularity appropriate?
2. Should we support transition to/from Mercator?
3. Any shader optimization suggestions?

## References
- D3-geo Equal Earth: https://github.com/d3/d3-geo/blob/main/src/projection/equalEarth.js
- Globe implementation: PR #3963
- Architecture doc: [link to this document]
```

**Timing**: Create draft PR after Phase 1.1-1.4 complete (basic implementation)

### Code Review Phase

**Key Maintainers to Engage** (from research):
- **@HarelM** - Led Globe implementation (PR #3963)
- **@wipfli** - Active in projection discussions
- **@kylebarron** - Participated in CRS discussions
- **@kubapelc** - Worked on Globe symbols

**Engagement Approach**:
1. Tag specific reviewers based on expertise
2. Respond promptly to feedback
3. Provide clear explanations for design decisions
4. Be willing to iterate based on maintainer preferences

### Post-Merge: Community Announcement

**Channels**:
1. MapLibre Slack (primary communication channel)
2. GitHub Discussions (technical detail)
3. Twitter/Social media (broader awareness)
4. Blog post on ixwiki.com (showcase implementation)

**Announcement Template**:
```markdown
🎉 MapLibre GL JS now supports Equal Earth projection!

Equal Earth is a projection that accurately represents area, making it ideal for
educational and scientific applications.

✨ Features:
- Native vector tile rendering (no special tile servers needed)
- Smooth geometry subdivision for curved surfaces
- Full layer support (fill, line, circle, etc.)
- Seamless integration with existing MapLibre APIs

🔗 Try it: [demo link]
📖 Docs: [developer guide link]
💻 Code: [PR link]

Next up: Natural Earth I and custom projection framework!

Thanks to @HarelM for the Globe implementation blueprint and the entire
MapLibre community for feedback.
```

---

## Recommended Implementation Approach

### Option A: Incremental PRs (Recommended)

**Approach**: Submit one projection at a time with complete implementation

**Advantages**:
- Easier to review (smaller changesets)
- Get feedback early, apply to later projections
- Show steady progress
- Less risk of merge conflicts
- Each PR can be merged independently

**Timeline**:
1. **PR #1**: Equal Earth Projection (3-4 weeks)
   - All 7 files + tests + docs
   - Most effort on establishing patterns
2. **PR #2**: Natural Earth I Projection (2-3 weeks)
   - Reuse patterns from PR #1
   - Focus on different math
3. **PR #3**: Custom Projection API (2-3 weeks)
   - Extensibility framework
   - Documentation for contributors

**Total**: 7-10 weeks

### Option B: Single Large PR

**Approach**: Implement all projections in one PR

**Advantages**:
- Demonstrates complete vision
- Shared infrastructure only added once
- Comprehensive testing across projections

**Disadvantages**:
- Harder to review (large changeset)
- More merge conflict risk
- All-or-nothing merge decision
- Longer feedback cycle

**Timeline**: 8-12 weeks

### Option C: Infrastructure First, Then Projections

**Approach**: PR #1 adds framework, subsequent PRs add projections

**Advantages**:
- Clean separation of concerns
- Framework can evolve independently
- Easy to add community-contributed projections later

**Disadvantages**:
- Framework PR has no visible benefit alone
- Risk of over-engineering framework

**Timeline**: Similar to Option A

### Recommendation: **Option A - Incremental PRs**

**Rationale**:
1. **Community Precedent**: Globe was added as a single, focused PR
2. **Review Feasibility**: Maintainers can thoroughly review smaller PRs
3. **Iterative Improvement**: Learn from feedback on Equal Earth before implementing Natural Earth
4. **Lower Risk**: Each PR can be accepted/rejected independently
5. **Visible Progress**: Community sees concrete results faster

**Suggested PR Sequence**:
1. **PR #1**: Equal Earth Projection (with full test suite, docs, examples)
2. **PR #2**: Natural Earth I Projection (following proven Equal Earth pattern)
3. **PR #3**: Custom Projection Documentation (guide for community contributors)
4. **PR #4**: IxMaps Projection (demonstrate custom projection capability)

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Precision issues in GLSL | Medium | High | Implement error correction like Globe |
| Performance degradation | Medium | Medium | Benchmark early, optimize shaders |
| Tile seam artifacts | High | Medium | Careful subdivision alignment |
| Symbol placement errors | Medium | Low | Reuse existing symbol logic |
| Browser compatibility | Low | Medium | Test on multiple browsers/GPUs |
| Maintenance burden | Low | Medium | Comprehensive docs and tests |

### Community/Process Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PR rejection | Low | High | Engage early with RFC, follow patterns |
| Scope creep requests | Medium | Medium | Clearly define v1 scope, defer enhancements |
| Slow review process | Medium | Low | Patient engagement, provide clear docs |
| Breaking changes needed | Low | High | Design for backward compatibility |
| Disagreement on approach | Low | Medium | Justify decisions with data/examples |

### Mitigation Strategies

**Before Starting**:
1. Post RFC in GitHub Discussions
2. Get at least 2 maintainer thumbs-up
3. Clarify scope and deliverables

**During Development**:
1. Create draft PR early (week 1)
2. Post progress updates in discussions
3. Respond to feedback within 24-48 hours
4. Keep PR description updated

**If Issues Arise**:
1. Be willing to pivot based on maintainer guidance
2. Ask clarifying questions rather than assuming
3. Provide benchmarks/data to support decisions
4. Consider breaking PR into smaller pieces if requested

---

## Success Criteria

### Phase 1: Equal Earth Implementation

**Definition of Done**:
- [ ] All 7 core files implemented
- [ ] Unit tests achieve >90% coverage
- [ ] 10+ render tests pass
- [ ] Documentation complete (API docs + guide)
- [ ] Example page functional
- [ ] Performance within 10% of Globe
- [ ] PR approved and merged

### Phase 2: Natural Earth I Implementation

**Definition of Done**:
- [ ] All 7 core files implemented
- [ ] Unit tests achieve >90% coverage
- [ ] 10+ render tests pass
- [ ] Documentation complete
- [ ] Example page functional
- [ ] Performance within 10% of Globe
- [ ] PR approved and merged

### Phase 3: Custom Projection API

**Definition of Done**:
- [ ] Documentation for adding custom projections
- [ ] Template/example for custom projection
- [ ] IxMaps projection implemented as proof-of-concept
- [ ] Community guide published

### Overall Project Success

**Metrics**:
1. **Code Quality**: All tests pass, no regressions
2. **Performance**: <10% overhead vs Mercator
3. **Community Reception**: Positive feedback in discussions
4. **Adoption**: 3+ community examples using new projections within 3 months
5. **Maintainability**: Zero critical bugs in first 6 months
6. **Documentation**: <5 "how do I use this?" questions

---

## Next Steps (Action Items)

### Immediate (Week 1)

1. **Fork Repository**
   ```bash
   # Via GitHub UI, then clone
   git clone https://github.com/YOUR_USERNAME/maplibre-gl-js.git
   cd maplibre-gl-js
   npm install
   npm run codegen
   ```

2. **Post RFC**
   - Draft RFC based on template above
   - Post in https://github.com/maplibre/maplibre/discussions
   - Tag @HarelM, @wipfli, @kylebarron

3. **Set Up Development Environment**
   ```bash
   npm start          # Terminal 1: Dev server
   npm run typecheck  # Terminal 2: Type checking
   ```

4. **Create Feature Branch**
   ```bash
   git checkout -b feat/equal-earth-projection
   ```

### Short-term (Weeks 2-4)

5. **Implement Equal Earth Core** (Phase 1.1-1.4)
   - Create `equal_earth.ts`
   - Create `equal_earth_transform.ts`
   - Create `equal_earth_camera_helper.ts`
   - Create `_projection_equal_earth.vertex.glsl`

6. **Create Draft PR**
   - Push basic implementation
   - Create draft PR with checklist
   - Request early feedback

7. **Add Tests** (Phase 1.6-1.7)
   - Unit tests
   - Render tests
   - Integration tests

### Medium-term (Weeks 5-8)

8. **Complete Equal Earth**
   - Address review feedback
   - Add documentation
   - Create examples
   - Mark PR ready for review

9. **Start Natural Earth I**
   - Apply lessons from Equal Earth
   - Reuse infrastructure
   - Create new PR

### Long-term (Weeks 9-12)

10. **Finalize Project**
    - Complete all PRs
    - Create custom projection guide
    - Implement IxMaps projection
    - Write blog post/announcement

11. **Community Engagement**
    - Present at MapLibre community meeting
    - Share on social media
    - Respond to community questions
    - Support adopters

---

## Appendix: Key Resources

### MapLibre Resources

- **Repository**: https://github.com/maplibre/maplibre-gl-js
- **Contributing Guide**: https://github.com/maplibre/maplibre-gl-js/blob/main/CONTRIBUTING.md
- **Developer Guides**: https://github.com/maplibre/maplibre-gl-js/tree/main/developer-guides
- **Slack**: https://slack.openstreetmap.us/ (#maplibre channel)
- **Discussions**: https://github.com/maplibre/maplibre/discussions

### Key Issues & PRs

- **Issue #168**: Support rendering in multiple CRS - https://github.com/maplibre/maplibre-gl-js/issues/168
- **Issue #272**: Bounty Direction: Custom Coordinate System - https://github.com/maplibre/maplibre/issues/272
- **Discussion #163**: Custom coordinate system / EPSG / non-Mercator tiles - https://github.com/maplibre/maplibre/discussions/163
- **Discussion #161**: Globe on zoom out via Adaptive Composite Map Projection - https://github.com/maplibre/maplibre/discussions/161
- **PR #3963**: Globe final PR - https://github.com/maplibre/maplibre-gl-js/pull/3963

### Projection References

**Equal Earth**:
- D3-geo implementation: https://github.com/d3/d3-geo/blob/main/src/projection/equalEarth.js
- Original paper: Šavrič, B., Patterson, T., & Jenny, B. (2018). The Equal Earth map projection. International Journal of Geographical Information Science.
- Existing plugin: https://github.com/pka/maplibre-gl-equal-earth

**Natural Earth**:
- D3-geo implementation: https://github.com/d3/d3-geo/blob/main/src/projection/naturalEarth1.js
- PROJ implementation: https://proj.org/operations/projections/natearth.html

**General Projection Math**:
- PROJ documentation: https://proj.org/
- Map Projections - A Working Manual (USGS): https://pubs.er.usgs.gov/publication/pp1395
- D3-geo documentation: https://github.com/d3/d3-geo

### WebGL & GLSL Resources

- WebGL Fundamentals: https://webglfundamentals.org/
- GLSL Reference: https://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf
- Shader precision: https://webglfundamentals.org/webgl/lessons/webgl-precision-issues.html

---

## Conclusion

MapLibre GL JS has a well-designed, extensible projection system introduced with Globe in v5.0. Adding Equal Earth, Natural Earth, and custom projections is feasible by following the proven pattern:

**5-Component Architecture**:
1. Projection class (TypeScript)
2. Transform class (TypeScript)
3. Camera helper (TypeScript)
4. Vertex shader (GLSL)
5. Utility functions (TypeScript)

**Recommended Approach**:
- Incremental PRs (one projection at a time)
- Equal Earth first (establishes pattern)
- Natural Earth second (validates pattern)
- Custom projection guide third (enables community)

**Estimated Timeline**: 7-10 weeks for core implementation

**Success Factors**:
1. Early community engagement via RFC
2. Following Globe implementation patterns closely
3. Comprehensive testing and documentation
4. Patient, responsive engagement with maintainers
5. Performance benchmarking throughout

This is a significant but achievable contribution that will benefit the MapLibre ecosystem and address long-standing community needs for non-Mercator projections.

---

**Document Version**: 1.0
**Last Updated**: October 31, 2025
**Author**: IxWiki Development Team
**Status**: Architecture Complete - Ready for RFC Posting
