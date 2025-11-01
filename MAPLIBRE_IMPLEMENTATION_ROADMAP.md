# MapLibre GL JS Custom Projection - Implementation Roadmap

**Date**: October 31, 2025
**Project**: Equal Earth, Natural Earth, and IxMaps Projection Implementation
**Timeline**: 7-10 weeks (3 phases)

---

## Quick Start Guide

### Week 1: Setup & RFC

```bash
# 1. Fork and clone repository
git clone https://github.com/YOUR_USERNAME/maplibre-gl-js.git
cd maplibre-gl-js

# 2. Install dependencies
npm install

# 3. Generate code artifacts
npm run codegen

# 4. Verify build works
npm run build-dev

# 5. Start development environment
npm start  # Opens http://localhost:9966

# 6. In another terminal, run type checking
npm run typecheck
```

### Week 1: Post RFC

Create discussion post at https://github.com/maplibre/maplibre/discussions with:
- Link to architecture document
- Request for feedback from @HarelM, @wipfli, @kylebarron
- Proposed timeline
- Open questions

Wait for at least 2 maintainer approvals before proceeding.

---

## Phase 1: Equal Earth Projection (Weeks 2-5)

### Week 2: Core Implementation

#### Step 1.1: Create Projection Class

**File**: `src/geo/projection/equal_earth.ts`

```typescript
import {Projection} from './projection';
import {ProjectionParams} from './projection_data';
import type {Painter} from '../../render/painter';
import type {Mesh} from '../../render/mesh';
import type {TileID} from '../../source/tile_id';

/**
 * Equal Earth Projection
 *
 * An equal-area pseudocylindrical projection that accurately represents
 * relative sizes of landmasses while maintaining a visually pleasing shape.
 *
 * Reference: Šavrič, B., Patterson, T., & Jenny, B. (2018).
 * The Equal Earth map projection.
 *
 * EPSG:8857
 */
export class EqualEarthProjection implements Projection {
    readonly name = 'equalEarth';
    readonly shaderVariantName = 'equalEarth';
    readonly shaderDefine = '#define EQUAL_EARTH';
    readonly useSubdivision = true;
    readonly subdivisionGranularity = 4;

    // Projection state
    private _zoom: number = 0;
    private _center: {lng: number, lat: number} = {lng: 0, lat: 0};
    private _bearing: number = 0;
    private _pitch: number = 0;

    /**
     * Shader prelude code for fragment shaders
     */
    get shaderPreludeCode(): string {
        return '';  // No special fragment shader code needed
    }

    /**
     * Vertex shader prelude code
     */
    get vertexShaderPreludeCode(): string {
        // Returns the shader code from _projection_equal_earth.vertex.glsl
        // This is auto-injected by the build system
        return '';
    }

    get transitionState(): number {
        // Equal Earth is static (no transition like Globe->Mercator)
        return 1.0;
    }

    hasTransition(): boolean {
        return false;
    }

    recalculate(params: ProjectionParams): void {
        // Update projection state based on map parameters
        this._zoom = params.zoom;
        this._center = params.center;
        this._bearing = params.bearing;
        this._pitch = params.pitch;

        // Equal Earth doesn't need dynamic recalculation like Globe
        // The projection is stable at all zoom levels
    }

    updateGPUdependent(painter: Painter): void {
        // Called every frame for GPU-side updates
        // Equal Earth doesn't need per-frame GPU updates
    }

    destroy(): void {
        // Clean up any GPU resources
        // Equal Earth has no GPU resources to clean up
    }

    getMeshFromTileID(tileID: TileID): Mesh {
        // Generate subdivided mesh for tile
        // The subdivision system handles creating the mesh
        // based on subdivisionGranularity
        return this._subdivisionSystem.createMesh(
            tileID,
            this.subdivisionGranularity
        );
    }

    setErrorQueryLatitudeDegrees(lat: number): void {
        // Used for Globe's atan() error correction
        // Not needed for Equal Earth (no GPU precision issues)
    }

    // Additional helper methods

    /**
     * Calculate the bounds of the Equal Earth projection in projected coordinates
     */
    getProjectionBounds(): {minX: number, maxX: number, minY: number, maxY: number} {
        // Equal Earth bounds (approximate):
        // X: ±2.6544 (at equator)
        // Y: ±1.3182 (at poles)
        return {
            minX: -2.6544,
            maxX: 2.6544,
            minY: -1.3182,
            maxY: 1.3182
        };
    }

    /**
     * Check if a point in projected coordinates is visible
     */
    isPointVisible(x: number, y: number): boolean {
        const bounds = this.getProjectionBounds();
        return x >= bounds.minX && x <= bounds.maxX &&
               y >= bounds.minY && y <= bounds.maxY;
    }
}
```

**Lines**: ~150
**Complexity**: Medium

---

#### Step 1.2: Create Transform Class

**File**: `src/geo/projection/equal_earth_transform.ts`

```typescript
import {Transform} from '../transform';
import {LngLat} from '../lng_lat';
import {MercatorCoordinate} from '../mercator_coordinate';
import {equalEarthProject, equalEarthUnproject} from './equal_earth_utils';

/**
 * Transform class for Equal Earth projection
 *
 * Handles coordinate transformations between:
 * - Geographic coordinates (lng/lat)
 * - Equal Earth projected coordinates
 * - Screen coordinates (pixels)
 */
export class EqualEarthTransform extends Transform {
    /**
     * Project geographic coordinates to Equal Earth space
     */
    projectLngLat(lngLat: LngLat): {x: number, y: number} {
        const [x, y] = equalEarthProject(
            lngLat.lng * Math.PI / 180,  // Convert to radians
            lngLat.lat * Math.PI / 180
        );

        // Normalize to 0-1 range for MapLibre's coordinate system
        // Equal Earth X range: ±2.6544, Y range: ±1.3182
        const normalizedX = (x + 2.6544) / (2 * 2.6544);
        const normalizedY = (1.3182 - y) / (2 * 1.3182);

        return {x: normalizedX, y: normalizedY};
    }

    /**
     * Unproject screen coordinates to geographic coordinates
     */
    unprojectPoint(point: {x: number, y: number}): LngLat {
        // Convert from 0-1 normalized to Equal Earth projected space
        const x = point.x * (2 * 2.6544) - 2.6544;
        const y = 1.3182 - point.y * (2 * 1.3182);

        // Inverse projection
        const [lonRad, latRad] = equalEarthUnproject(x, y);

        return new LngLat(
            lonRad * 180 / Math.PI,
            latRad * 180 / Math.PI
        );
    }

    /**
     * Calculate projection matrix for rendering
     */
    calculateMatrices(): void {
        // Calculate orthographic or perspective matrix for Equal Earth
        const scale = this.worldSize / (2 * 2.6544);  // Map world units to projected space

        // Create orthographic projection matrix
        this._projectionMatrix = this.createOrthographicMatrix(
            -2.6544 * scale,  // left
            2.6544 * scale,   // right
            1.3182 * scale,   // bottom
            -1.3182 * scale,  // top
            -1,               // near
            1                 // far
        );

        // Apply zoom, center, rotation
        this.applyTransformations();
    }

    /**
     * Get the scale factor at a given point
     * (for symbol sizing, collision detection, etc.)
     */
    getScaleAt(lngLat: LngLat): number {
        // Equal Earth has varying scale factors
        // Calculate local scale distortion
        const lat = lngLat.lat * Math.PI / 180;
        const l = Math.asin(0.8660254037844387 * Math.sin(lat));  // M = sqrt(3)/2

        // Scale factor depends on latitude
        // Equator: ~1.0, Poles: ~1.18
        return Math.cos(l);
    }

    /**
     * Convert Mercator tile coordinates to Equal Earth projected coordinates
     * (Used for rendering Mercator tiles in Equal Earth projection)
     */
    projectTileCoordinates(tileX: number, tileY: number, tileZ: number): {x: number, y: number} {
        // Convert tile coords to lng/lat
        const lngLat = this.tileCoordToLngLat(tileX, tileY, tileZ);

        // Project to Equal Earth
        return this.projectLngLat(lngLat);
    }

    /**
     * Helper: Convert tile coordinates to lng/lat
     */
    private tileCoordToLngLat(x: number, y: number, z: number): LngLat {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        return new LngLat(
            x / Math.pow(2, z) * 360 - 180,
            180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
        );
    }

    /**
     * Helper: Create orthographic projection matrix
     */
    private createOrthographicMatrix(
        left: number, right: number,
        bottom: number, top: number,
        near: number, far: number
    ): mat4 {
        const lr = 1 / (left - right);
        const bt = 1 / (bottom - top);
        const nf = 1 / (near - far);

        return new Float32Array([
            -2 * lr, 0, 0, 0,
            0, -2 * bt, 0, 0,
            0, 0, 2 * nf, 0,
            (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1
        ]);
    }

    /**
     * Apply zoom, pan, rotation transformations to projection matrix
     */
    private applyTransformations(): void {
        // Apply camera transformations
        // This is where zoom, center, bearing, pitch are applied
        // Implementation depends on MapLibre's Transform base class
    }

    /**
     * Calculate visible tile bounds for the current view
     */
    calculateVisibleTiles(): TileID[] {
        // Determine which tiles need to be loaded
        // Based on current zoom and center
        // Account for Equal Earth's specific bounds
    }
}
```

**Lines**: ~300-400
**Complexity**: High

---

#### Step 1.3: Create Utility Functions

**File**: `src/geo/projection/equal_earth_utils.ts`

```typescript
/**
 * Utility functions for Equal Earth projection calculations
 *
 * Mathematical formulas from:
 * - D3-geo: https://github.com/d3/d3-geo/blob/main/src/projection/equalEarth.js
 * - Šavrič et al. (2018): The Equal Earth map projection
 */

// Equal Earth projection constants
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;  // 0.8660254037844387
const EPSILON = 1e-12;
const MAX_ITERATIONS = 12;

/**
 * Forward projection: Geographic to Equal Earth
 *
 * @param lambda - Longitude in radians
 * @param phi - Latitude in radians
 * @returns [x, y] in Equal Earth projected coordinates
 */
export function equalEarthProject(lambda: number, phi: number): [number, number] {
    // Calculate intermediate variable l
    const l = Math.asin(M * Math.sin(phi));
    const l2 = l * l;
    const l6 = l2 * l2 * l2;

    // Calculate x coordinate
    const x = lambda * Math.cos(l) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)));

    // Calculate y coordinate
    const y = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2));

    return [x, y];
}

/**
 * Inverse projection: Equal Earth to Geographic
 *
 * Uses Newton-Raphson iteration to solve the inverse.
 *
 * @param x - X coordinate in Equal Earth projection
 * @param y - Y coordinate in Equal Earth projection
 * @returns [lambda, phi] longitude and latitude in radians
 */
export function equalEarthUnproject(x: number, y: number): [number, number] {
    let l = y;
    let l2: number, l6: number, delta: number;

    // Newton-Raphson iteration to solve for l
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        l2 = l * l;
        l6 = l2 * l2 * l2;

        const f = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - y;
        const fPrime = A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2);

        delta = f / fPrime;
        l -= delta;

        if (Math.abs(delta) < EPSILON) break;
    }

    l2 = l * l;
    l6 = l2 * l2 * l2;

    // Calculate longitude
    const lambda = M * x * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)) / Math.cos(l);

    // Calculate latitude
    const phi = Math.asin(Math.sin(l) / M);

    return [lambda, phi];
}

/**
 * Calculate the scale factor at a given latitude
 *
 * @param phi - Latitude in radians
 * @returns Scale factor (1.0 = no distortion)
 */
export function equalEarthScaleFactor(phi: number): number {
    const l = Math.asin(M * Math.sin(phi));
    return Math.cos(l);
}

/**
 * Get the bounds of the Equal Earth projection
 *
 * @returns Bounding box {minX, maxX, minY, maxY}
 */
export function equalEarthBounds(): {minX: number, maxX: number, minY: number, maxY: number} {
    // Calculate maximum x (at equator, lambda = π)
    const [maxX] = equalEarthProject(Math.PI, 0);

    // Calculate maximum y (at north pole)
    const [, maxY] = equalEarthProject(0, Math.PI / 2);

    return {
        minX: -maxX,
        maxX: maxX,
        minY: -maxY,
        maxY: maxY
    };
}

/**
 * Check if a point is within the valid Equal Earth projection area
 *
 * @param x - X coordinate in projected space
 * @param y - Y coordinate in projected space
 * @returns true if point is within bounds
 */
export function isValidEqualEarthPoint(x: number, y: number): boolean {
    const bounds = equalEarthBounds();
    return x >= bounds.minX && x <= bounds.maxX &&
           y >= bounds.minY && y <= bounds.maxY;
}

/**
 * Calculate the area scale at a given latitude
 * Equal Earth preserves area, so this should always be 1.0
 * (Useful for validation)
 *
 * @param phi - Latitude in radians
 * @returns Area scale (should be ~1.0)
 */
export function equalEarthAreaScale(phi: number): number {
    // Equal Earth is equal-area, so area scale is exactly 1.0
    return 1.0;
}
```

**Lines**: ~150
**Complexity**: Medium (mathematical functions)

---

#### Step 1.4: Create Vertex Shader

**File**: `src/shaders/_projection_equal_earth.vertex.glsl`

```glsl
// Equal Earth projection shader
// Implements the Equal Earth pseudocylindrical equal-area projection
// EPSG:8857

// Equal Earth constants
const float EE_A1 = 1.340264;
const float EE_A2 = -0.081106;
const float EE_A3 = 0.000893;
const float EE_A4 = 0.003796;
const float EE_M = 0.8660254037844387;  // sqrt(3) / 2
const float EE_EPSILON = 0.0000001;
const int EE_MAX_ITERATIONS = 12;

/**
 * Convert Mercator tile coordinates to longitude/latitude
 *
 * @param tileCoords - Tile coordinates in [0,1] range
 * @return vec2(longitude, latitude) in radians
 */
vec2 mercatorToLngLat(vec2 tileCoords) {
    // Longitude: simple linear mapping
    float lon = (tileCoords.x - 0.5) * 2.0 * PI;

    // Latitude: inverse Mercator formula
    float y = (0.5 - tileCoords.y) * 2.0;  // [-1, 1]
    float lat = atan(sinh(y * PI));

    return vec2(lon, lat);
}

/**
 * Forward Equal Earth projection
 *
 * @param lon - Longitude in radians
 * @param lat - Latitude in radians
 * @return vec2(x, y) in Equal Earth projected coordinates
 */
vec2 equalEarthProject(float lon, float lat) {
    // Calculate intermediate variable l
    float l = asin(EE_M * sin(lat));
    float l2 = l * l;
    float l6 = l2 * l2 * l2;

    // Calculate x coordinate
    float x = lon * cos(l) / (EE_M * (EE_A1 + 3.0 * EE_A2 * l2 + l6 * (7.0 * EE_A3 + 9.0 * EE_A4 * l2)));

    // Calculate y coordinate
    float y = l * (EE_A1 + EE_A2 * l2 + l6 * (EE_A3 + EE_A4 * l2));

    return vec2(x, y);
}

/**
 * Normalize Equal Earth coordinates to [0,1] range
 * For MapLibre's coordinate system
 *
 * @param projected - Equal Earth projected coordinates
 * @return Normalized coordinates in [0,1] range
 */
vec2 normalizeEqualEarth(vec2 projected) {
    // Equal Earth bounds (approximate):
    // X: ±2.6544, Y: ±1.3182
    const float maxX = 2.6544;
    const float maxY = 1.3182;

    float normalizedX = (projected.x + maxX) / (2.0 * maxX);
    float normalizedY = (maxY - projected.y) / (2.0 * maxY);

    return vec2(normalizedX, normalizedY);
}

/**
 * Main projection function: Tile coordinates to screen space
 *
 * @param tileCoords - Mercator tile coordinates [0,1]
 * @return Projected position in clip space
 */
vec4 projectTile(vec2 tileCoords) {
    // 1. Convert Mercator tile coords to lng/lat
    vec2 lngLat = mercatorToLngLat(tileCoords);

    // 2. Project to Equal Earth
    vec2 equalEarth = equalEarthProject(lngLat.x, lngLat.y);

    // 3. Normalize for MapLibre coordinate system
    vec2 normalized = normalizeEqualEarth(equalEarth);

    // 4. Apply projection matrix (handles zoom, pan, rotation)
    return u_projection_matrix * vec4(normalized, 0.0, 1.0);
}

/**
 * Project tile with elevation
 * For 3D rendering (fill extrusions, terrain)
 *
 * @param tileCoords - Mercator tile coordinates [0,1]
 * @param elevation - Elevation in meters
 * @return Projected position in clip space with elevation
 */
vec4 projectTileWithElevation(vec2 tileCoords, float elevation) {
    // 1. Convert Mercator tile coords to lng/lat
    vec2 lngLat = mercatorToLngLat(tileCoords);

    // 2. Project to Equal Earth
    vec2 equalEarth = equalEarthProject(lngLat.x, lngLat.y);

    // 3. Normalize for MapLibre coordinate system
    vec2 normalized = normalizeEqualEarth(equalEarth);

    // 4. Convert elevation to projection space
    // Equal Earth is 2D, so elevation becomes Z offset
    float elevationScale = 0.0001;  // Scale to appropriate range
    float z = elevation * elevationScale;

    // 5. Apply projection matrix
    return u_projection_matrix * vec4(normalized, z, 1.0);
}

/**
 * Project tile for 3D rendering
 * Similar to projectTileWithElevation but with different coordinate handling
 */
vec4 projectTileFor3D(vec2 tileCoords) {
    // For Equal Earth, 3D is handled the same as 2D
    // (Unlike Globe where this differs significantly)
    return projectTile(tileCoords);
}

/**
 * Calculate clipping for geometry
 * Equal Earth doesn't need horizon clipping like Globe
 *
 * @param tileCoords - Tile coordinates
 * @return Clipping z value (positive = visible)
 */
float calculateClipping(vec2 tileCoords) {
    // Check if point is within Equal Earth bounds
    vec2 lngLat = mercatorToLngLat(tileCoords);
    vec2 equalEarth = equalEarthProject(lngLat.x, lngLat.y);

    const float maxX = 2.6544;
    const float maxY = 1.3182;

    // Return positive if within bounds, negative otherwise
    if (abs(equalEarth.x) > maxX || abs(equalEarth.y) > maxY) {
        return -1.0;  // Clip this fragment
    }

    return 1.0;  // Visible
}
```

**Lines**: ~150
**Complexity**: Medium (shader math)

---

### Week 3: Camera Helper & Integration

#### Step 1.5: Create Camera Helper

**File**: `src/geo/projection/equal_earth_camera_helper.ts`

```typescript
import {LngLat} from '../lng_lat';
import type {Transform} from '../transform';

/**
 * Camera helper for Equal Earth projection
 * Handles user interactions and camera positioning
 */
export class EqualEarthCameraHelper {
    private _transform: Transform;

    constructor(transform: Transform) {
        this._transform = transform;
    }

    /**
     * Handle pan gesture
     * @param dx - Screen delta X in pixels
     * @param dy - Screen delta Y in pixels
     */
    panBy(dx: number, dy: number): void {
        // Convert screen delta to world coordinates
        const scale = this._transform.worldSize / this._transform.width;

        // Apply pan
        const currentCenter = this._transform.center;
        const newCenter = this.screenDeltaToLngLat(currentCenter, dx * scale, dy * scale);

        this._transform.setCenter(newCenter);
    }

    /**
     * Handle zoom gesture
     * @param delta - Zoom delta (positive = zoom in)
     * @param point - Screen point to zoom toward (optional)
     */
    zoomBy(delta: number, point?: {x: number, y: number}): void {
        const newZoom = this._transform.zoom + delta;

        if (point) {
            // Zoom toward specific point
            const lngLat = this._transform.screenPointToLngLat(point);
            this._transform.setZoom(newZoom);
            // Re-center to keep point under cursor
            const newScreenPoint = this._transform.lngLatToScreenPoint(lngLat);
            const dx = newScreenPoint.x - point.x;
            const dy = newScreenPoint.y - point.y;
            this.panBy(-dx, -dy);
        } else {
            // Simple zoom
            this._transform.setZoom(newZoom);
        }
    }

    /**
     * Apply constraints to prevent invalid camera positions
     */
    applyConstraints(): void {
        // Prevent zooming too far out (world must fill screen)
        const minZoom = this.calculateMinZoom();
        if (this._transform.zoom < minZoom) {
            this._transform.setZoom(minZoom);
        }

        // Prevent panning beyond valid bounds
        const center = this._transform.center;
        const bounds = this.getValidBounds();

        if (center.lng < bounds.minLng || center.lng > bounds.maxLng ||
            center.lat < bounds.minLat || center.lat > bounds.maxLat) {
            const clampedCenter = new LngLat(
                Math.max(bounds.minLng, Math.min(bounds.maxLng, center.lng)),
                Math.max(bounds.minLat, Math.min(bounds.maxLat, center.lat))
            );
            this._transform.setCenter(clampedCenter);
        }
    }

    /**
     * Animate camera to target position
     * @param target - Target camera state
     * @param options - Animation options
     */
    easeTo(target: CameraTarget, options: EaseOptions = {}): void {
        const duration = options.duration || 500;
        const easing = options.easing || this.defaultEasing;

        const start = {
            center: this._transform.center,
            zoom: this._transform.zoom,
            bearing: this._transform.bearing
        };

        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const t = Math.min(1, elapsed / duration);
            const easedT = easing(t);

            // Interpolate camera parameters
            this._transform.setCenter(
                this.interpolateLngLat(start.center, target.center, easedT)
            );
            this._transform.setZoom(
                start.zoom + (target.zoom - start.zoom) * easedT
            );
            this._transform.setBearing(
                start.bearing + (target.bearing - start.bearing) * easedT
            );

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                options.onComplete?.();
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Fly animation (zooms out, pans, zooms back in)
     */
    flyTo(target: CameraTarget, options: FlyOptions = {}): void {
        // Implement smooth fly animation
        // Similar to Mercator's flyTo but accounting for Equal Earth's bounds
    }

    // Private helper methods

    private screenDeltaToLngLat(center: LngLat, dx: number, dy: number): LngLat {
        // Convert screen pixel delta to lng/lat delta
        // Account for Equal Earth's non-uniform scale
        const scale = this.getScaleAt(center);

        return new LngLat(
            center.lng + dx * scale,
            center.lat - dy * scale  // Y is inverted
        );
    }

    private getScaleAt(lngLat: LngLat): number {
        // Equal Earth has varying scale
        const lat = lngLat.lat * Math.PI / 180;
        const l = Math.asin(0.8660254037844387 * Math.sin(lat));
        return Math.cos(l);
    }

    private calculateMinZoom(): number {
        // Calculate minimum zoom where entire world fits in viewport
        const worldSize = 512;  // Base world size in pixels
        const viewportSize = Math.min(this._transform.width, this._transform.height);
        return Math.log2(viewportSize / worldSize);
    }

    private getValidBounds(): {minLng: number, maxLng: number, minLat: number, maxLat: number} {
        return {
            minLng: -180,
            maxLng: 180,
            minLat: -85,  // Equal Earth handles near-poles better than Mercator
            maxLat: 85
        };
    }

    private interpolateLngLat(a: LngLat, b: LngLat, t: number): LngLat {
        return new LngLat(
            a.lng + (b.lng - a.lng) * t,
            a.lat + (b.lat - a.lat) * t
        );
    }

    private defaultEasing(t: number): number {
        // Cubic ease-in-out
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
}

interface CameraTarget {
    center?: LngLat;
    zoom?: number;
    bearing?: number;
}

interface EaseOptions {
    duration?: number;
    easing?: (t: number) => number;
    onComplete?: () => void;
}

interface FlyOptions extends EaseOptions {
    curve?: number;  // How much to zoom out during flight
}
```

**Lines**: ~250
**Complexity**: Medium

---

#### Step 1.6: Update Projection Factory

**File**: `src/geo/projection/projection_factory.ts`

```typescript
// Add import
import {EqualEarthProjection} from './equal_earth';
import {EqualEarthTransform} from './equal_earth_transform';
import {EqualEarthCameraHelper} from './equal_earth_camera_helper';

// Modify createProjectionFromName function
export function createProjectionFromName(name: string, transformOptions: TransformOptions) {
    switch (name) {
        case 'mercator':
            return {
                projection: new MercatorProjection(),
                transform: new MercatorTransform(transformOptions),
                cameraHelper: new MercatorCameraHelper()
            };

        case 'globe':
            return {
                projection: new GlobeProjection(),
                transform: new GlobeTransform(transformOptions),
                cameraHelper: new GlobeCameraHelper()
            };

        case 'equal-earth':  // ADD THIS CASE
            return {
                projection: new EqualEarthProjection(),
                transform: new EqualEarthTransform(transformOptions),
                cameraHelper: new EqualEarthCameraHelper()
            };

        case 'vertical-perspective':
            return {
                projection: new VerticalPerspectiveProjection(),
                transform: new VerticalPerspectiveTransform(transformOptions),
                cameraHelper: new VerticalPerspectiveCameraHelper()
            };

        default:
            console.warn(`Unknown projection: ${name}, falling back to mercator`);
            return createProjectionFromName('mercator', transformOptions);
    }
}
```

**Lines**: 5 new lines
**Complexity**: Trivial

---

### Week 4: Testing

#### Step 2.1: Unit Tests

**File**: `src/geo/projection/equal_earth.test.ts`

```typescript
import {describe, test, expect} from 'vitest';
import {equalEarthProject, equalEarthUnproject, equalEarthBounds} from './equal_earth_utils';

describe('Equal Earth Projection', () => {
    describe('Forward Projection', () => {
        test('projects origin correctly', () => {
            const [x, y] = equalEarthProject(0, 0);
            expect(x).toBeCloseTo(0, 10);
            expect(y).toBeCloseTo(0, 10);
        });

        test('projects equator points', () => {
            const [x, y] = equalEarthProject(Math.PI / 2, 0);  // 90° E, 0° N
            expect(x).toBeGreaterThan(0);
            expect(y).toBeCloseTo(0, 10);
        });

        test('projects poles', () => {
            const [x, y] = equalEarthProject(0, Math.PI / 2);  // 0° E, 90° N
            expect(x).toBeCloseTo(0, 10);
            expect(y).toBeGreaterThan(0);
        });

        test('handles negative coordinates', () => {
            const [x1, y1] = equalEarthProject(Math.PI / 4, Math.PI / 4);
            const [x2, y2] = equalEarthProject(-Math.PI / 4, -Math.PI / 4);
            expect(x2).toBeCloseTo(-x1, 10);
            expect(y2).toBeCloseTo(-y1, 10);
        });
    });

    describe('Inverse Projection', () => {
        test('inverts origin correctly', () => {
            const [lon, lat] = equalEarthUnproject(0, 0);
            expect(lon).toBeCloseTo(0, 10);
            expect(lat).toBeCloseTo(0, 10);
        });

        test('round-trip accuracy', () => {
            const testCases = [
                [0, 0],
                [Math.PI / 2, 0],
                [0, Math.PI / 2],
                [Math.PI, 0],
                [Math.PI / 4, Math.PI / 4],
                [-Math.PI / 2, -Math.PI / 4]
            ];

            for (const [lon, lat] of testCases) {
                const [x, y] = equalEarthProject(lon, lat);
                const [lon2, lat2] = equalEarthUnproject(x, y);
                expect(lon2).toBeCloseTo(lon, 6);
                expect(lat2).toBeCloseTo(lat, 6);
            }
        });
    });

    describe('Bounds', () => {
        test('calculates correct bounds', () => {
            const bounds = equalEarthBounds();
            expect(bounds.maxX).toBeGreaterThan(2.6);
            expect(bounds.maxX).toBeLessThan(2.7);
            expect(bounds.maxY).toBeGreaterThan(1.3);
            expect(bounds.maxY).toBeLessThan(1.4);
        });

        test('bounds are symmetric', () => {
            const bounds = equalEarthBounds();
            expect(bounds.minX).toBeCloseTo(-bounds.maxX, 10);
            expect(bounds.minY).toBeCloseTo(-bounds.maxY, 10);
        });
    });

    describe('Area Preservation', () => {
        test('preserves area (equal-area property)', () => {
            // Equal Earth should preserve area
            // Test by checking that Jacobian determinant = 1
            // This is a simplified test; full validation would require
            // numerical integration over the sphere

            const testLatitudes = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3];

            for (const lat of testLatitudes) {
                // Calculate local scale factors
                // For equal-area projection: scaleX * scaleY = 1
                const delta = 0.0001;

                const [x1, y1] = equalEarthProject(0, lat);
                const [x2, y2] = equalEarthProject(delta, lat);
                const [x3, y3] = equalEarthProject(0, lat + delta);

                const scaleX = (x2 - x1) / delta;
                const scaleY = (y3 - y1) / delta;
                const areaScale = Math.abs(scaleX * scaleY);

                // Should be close to 1 (within numerical precision)
                expect(areaScale).toBeCloseTo(1, 2);
            }
        });
    });

    describe('Edge Cases', () => {
        test('handles date line', () => {
            const [x1, y1] = equalEarthProject(Math.PI - 0.001, 0);
            const [x2, y2] = equalEarthProject(-Math.PI + 0.001, 0);
            // Should be close to opposite sides
            expect(Math.abs(x1 + x2)).toBeGreaterThan(5);
        });

        test('handles near-pole latitudes', () => {
            const nearPole = Math.PI / 2 - 0.0001;
            const [x, y] = equalEarthProject(0, nearPole);
            expect(isFinite(x)).toBe(true);
            expect(isFinite(y)).toBe(true);
        });
    });
});
```

**File**: `src/geo/projection/equal_earth_transform.test.ts`

```typescript
import {describe, test, expect} from 'vitest';
import {EqualEarthTransform} from './equal_earth_transform';
import {LngLat} from '../lng_lat';

describe('EqualEarthTransform', () => {
    let transform: EqualEarthTransform;

    beforeEach(() => {
        transform = new EqualEarthTransform({
            width: 512,
            height: 512,
            zoom: 0,
            center: new LngLat(0, 0)
        });
    });

    test('projects lng/lat to screen coordinates', () => {
        const point = transform.projectLngLat(new LngLat(0, 0));
        expect(point.x).toBeCloseTo(0.5, 2);  // Center of normalized space
        expect(point.y).toBeCloseTo(0.5, 2);
    });

    test('unprojects screen coordinates to lng/lat', () => {
        const lngLat = transform.unprojectPoint({x: 0.5, y: 0.5});
        expect(lngLat.lng).toBeCloseTo(0, 1);
        expect(lngLat.lat).toBeCloseTo(0, 1);
    });

    test('round-trip projection', () => {
        const original = new LngLat(45, 30);
        const projected = transform.projectLngLat(original);
        const unprojected = transform.unprojectPoint(projected);
        expect(unprojected.lng).toBeCloseTo(original.lng, 1);
        expect(unprojected.lat).toBeCloseTo(original.lat, 1);
    });

    test('calculates scale correctly', () => {
        const equatorScale = transform.getScaleAt(new LngLat(0, 0));
        const poleScale = transform.getScaleAt(new LngLat(0, 90));

        // Scale varies with latitude in Equal Earth
        expect(equatorScale).toBeGreaterThan(poleScale);
    });
});
```

**Lines**: ~150 per test file
**Complexity**: Medium

---

#### Step 2.2: Render Tests

**File**: `test/integration/render/equal-earth/basic.json`

```json
{
  "id": "equal-earth-basic",
  "width": 512,
  "height": 512,
  "projection": "equal-earth",
  "center": [0, 0],
  "zoom": 1,
  "sources": {
    "geojson": {
      "type": "geojson",
      "data": {
        "type": "Feature",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-180, -85],
            [180, -85],
            [180, 85],
            [-180, 85],
            [-180, -85]
          ]]
        }
      }
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": {
        "background-color": "#f0f0f0"
      }
    },
    {
      "id": "world",
      "type": "fill",
      "source": "geojson",
      "paint": {
        "fill-color": "#3388ff",
        "fill-opacity": 0.5
      }
    }
  ]
}
```

**Additional Render Tests**:
- `equal-earth-fill.json` - Test fill layers
- `equal-earth-line.json` - Test line layers
- `equal-earth-circle.json` - Test circle layers
- `equal-earth-symbol.json` - Test symbol placement
- `equal-earth-zoom.json` - Test at various zoom levels

**Lines**: N/A (JSON test cases)
**Complexity**: Medium (10-20 test cases)

---

### Week 5: Documentation & Examples

#### Step 3.1: Developer Guide

**File**: `developer-guides/equal-earth-projection.md`

```markdown
# Equal Earth Projection

## Overview

The Equal Earth projection is an equal-area pseudocylindrical projection designed for world maps. It accurately represents the relative sizes of landmasses while maintaining a visually pleasing shape.

## Usage

```javascript
const map = new maplibregl.Map({
  container: 'map',
  projection: 'equal-earth',
  center: [0, 0],
  zoom: 1
});
```

## Features

- **Equal-area**: Preserves relative sizes of regions
- **Pseudocylindrical**: Straight parallels, curved meridians
- **Visually appealing**: Similar to Robinson but mathematically precise
- **Vector tile rendering**: Works with standard Mercator tiles

## Technical Details

- **EPSG Code**: 8857
- **Type**: Pseudocylindrical equal-area
- **Subdivision**: Uses geometry subdivision for smooth curves
- **Bounds**: X: ±2.65, Y: ±1.32 (approximate)

## Implementation

See [Architecture Documentation](../MAPLIBRE_PROJECTION_ARCHITECTURE.md) for implementation details.
```

---

#### Step 3.2: Example Page

**File**: `test/examples/equal-earth-basic.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Equal Earth Projection</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="../../dist/maplibre-gl-dev.js"></script>
    <link rel="stylesheet" href="../../dist/maplibre-gl.css">
    <style>
        body { margin: 0; padding: 0; }
        #map { position: absolute; top: 0; bottom: 0; width: 100%; }
        #controls {
            position: absolute;
            top: 10px;
            right: 10px;
            background: white;
            padding: 10px;
            border-radius: 3px;
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <div id="controls">
        <label>
            <input type="radio" name="projection" value="mercator" onchange="changeProjection(this.value)">
            Mercator
        </label>
        <br>
        <label>
            <input type="radio" name="projection" value="equal-earth" checked onchange="changeProjection(this.value)">
            Equal Earth
        </label>
    </div>

    <script>
        const map = new maplibregl.Map({
            container: 'map',
            projection: 'equal-earth',
            center: [0, 30],
            zoom: 1.5,
            style: {
                version: 8,
                sources: {
                    'raster-tiles': {
                        type: 'raster',
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '&copy; OpenStreetMap contributors'
                    }
                },
                layers: [{
                    id: 'simple-tiles',
                    type: 'raster',
                    source: 'raster-tiles',
                    minzoom: 0,
                    maxzoom: 22
                }]
            }
        });

        function changeProjection(projection) {
            map.setProjection(projection);
        }
    </script>
</body>
</html>
```

---

#### Step 3.3: Create Draft PR

**Week 5 Action**: Create draft PR with:
- All implementation files
- Unit tests
- Render tests
- Documentation
- Example page

**PR Title**: `[Draft] Add Equal Earth Projection Support`

**PR Description**: Use template from Architecture document

---

## Phase 2: Natural Earth I Projection (Weeks 6-8)

### Repeat same structure as Equal Earth

**Key Differences**:
1. **Math is more complex** (polynomial approximation)
2. **No closed-form inverse** (requires Newton-Raphson)
3. **Different bounds** (wider aspect ratio)

### Natural Earth I Constants

```typescript
// Natural Earth I projection constants
const NE_epsilon = 1e-6;
const NE_iterations = 25;

function naturalEarthProject(lambda: number, phi: number): [number, number] {
    const phi2 = phi * phi;
    const phi4 = phi2 * phi2;

    const x = lambda * (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4)));
    const y = phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4)));

    return [x, y];
}
```

**Files to Create** (same structure):
1. `src/geo/projection/natural_earth.ts`
2. `src/geo/projection/natural_earth_transform.ts`
3. `src/geo/projection/natural_earth_camera_helper.ts`
4. `src/geo/projection/natural_earth_utils.ts`
5. `src/shaders/_projection_natural_earth.vertex.glsl`
6. Tests and docs

**Timeline**: 2-3 weeks (faster due to established pattern)

---

## Phase 3: IxMaps Custom Projection (Weeks 9-10)

### Depends on IxMaps Projection Math

**Prerequisites**:
1. Document IxMaps coordinate system
2. Derive forward/inverse projection formulas
3. Determine bounds and distortion characteristics

**Implementation**: Follow same structure as Equal Earth

**Timeline**: 2-3 weeks

---

## Continuous Activities

### Throughout All Phases

**Daily**:
- Run type checking: `npm run typecheck`
- Run linter: `npm run lint`
- Test locally: `npm start`

**Weekly**:
- Post progress update in GitHub discussion
- Run full test suite: `npm test`
- Update draft PR

**Before Each PR**:
- Run all tests: `npm test`
- Build production: `npm run build-prod`
- Check bundle size: `npm run bundle-stats`
- Update documentation
- Add examples

---

## Success Checklist

### Equal Earth Projection

- [ ] Projection class implemented
- [ ] Transform class implemented
- [ ] Camera helper implemented
- [ ] Utility functions implemented
- [ ] Vertex shader implemented
- [ ] Factory updated
- [ ] Unit tests written (>90% coverage)
- [ ] Render tests created (10+ cases)
- [ ] Integration tests added
- [ ] Documentation complete
- [ ] Example page created
- [ ] Performance benchmarked (<10% overhead vs Mercator)
- [ ] Draft PR created
- [ ] Maintainer feedback received
- [ ] PR ready for review
- [ ] PR approved and merged

### Natural Earth I Projection

- [ ] Same checklist as Equal Earth
- [ ] Polynomial approximation tested
- [ ] Inverse projection accuracy verified
- [ ] PR approved and merged

### IxMaps Custom Projection

- [ ] Same checklist as Equal Earth
- [ ] Custom coordinate system documented
- [ ] Projection math derived
- [ ] PR approved and merged

---

## Risk Mitigation

### If PRs are Slow to Review

**Action**: Engage on Slack, provide clear summaries, offer to present at community meeting

### If Maintainers Request Changes

**Action**: Respond within 24-48 hours, be willing to iterate

### If Performance is Insufficient

**Action**: Profile with Chrome DevTools, optimize shaders, reduce subdivision granularity

### If Tests Fail

**Action**: Debug systematically, add more test cases, consult Globe implementation

---

## Next Steps

1. **Fork repository** (done via GitHub UI)
2. **Clone and setup** (run commands from Week 1)
3. **Post RFC** (wait for feedback before coding)
4. **Begin implementation** (Week 2)

---

**Document Version**: 1.0
**Last Updated**: October 31, 2025
**Status**: Ready for Execution
