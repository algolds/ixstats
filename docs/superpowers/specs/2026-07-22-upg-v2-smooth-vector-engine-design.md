# Design Specification: Ultra-Fidelity UPG Vector Engine (v2)

## Overview

This specification documents the technical architecture for the **Ultra-Fidelity Unified Physical Geography (UPG v2) Vector Engine**. The engine generates high-resolution, cartographically smooth, and scientifically accurate fictional realm maps matching the aesthetic quality of the IxWorld reference map.

Execution speed is intentionally unconstrained in favor of maximum visual realism, continuous vector curves, realistic hypsometric elevation gradients, natural-border country generation, and 100% topological alignment across all exported GeoJSON layers.

---

## 1. Core Architecture & Pipeline

The pipeline runs in 8 strictly sequential stages:

1. **Ultra-Dense Spatial Mesh (100,000 Cells)**: Generates a 100,000-cell Voronoi mesh across WGS84 coordinates `[-180, 180] × [-84, 84]` using 5 iterations of Lloyd relaxation. The `Cell Resolution` slider is permanently removed from the UI.
2. **Tectonic Plate Simulation**: Seeds N plate centers via farthest-point sampling, assigns continental vs oceanic types, computes plate velocity vectors, and classifies convergent, divergent, and transform boundaries.
3. **Terrain Elevation & Coastal Hypsometric Damping**: Computes float heightmaps in meters. Applies coastal slope damping within 3 cells of water (`coastDist <= 3`) so subduction mountain ridges rise inland rather than creating glacial peaks (`zone_8` off-white) on water edges.
4. **Coastline & Archipelago Refinement**: Classifies landmass features (continents, peninsulas, bays, archipelagos), purges tiny land fragments (< 5 cells), and establishes coastal distance fields.
5. **Unified Hydrology & Climate Pass**: Runs 8 sub-passes (temperature, lapse rate, Coriolis wind, rain shadow, priority-queue depression filling, steepest-descent river flow, tributary tracing, lakes, and Trewartha biomes). Recalibrates `cells.elevZone` (0–8) to match the post-hydraulic filled heightmap.
6. **Automated Quality Gate**: Runs a 9-check scientific audit (land/water ratio, continent count, mountain continuity, river connectivity, biome distribution) and executes in-place repairs.
7. **Natural-Border Political Overlay**: Seeds culture centers, habitability-scored settlements, and expands countries via Dijkstra shortest-path on a natural-border resistance field (rivers, mountains, coastlines).
8. **RBF Marching Contours & Catmull-Rom Spline Vectorization**: Projects physical cell attributes onto a `2048×1024` grid via Radial Basis Functions (RBF), extracts dual contours, applies 4-pass Catmull-Rom spline curve subdivision, and exports 7 topology-locked GeoJSON layers.

---

## 2. Technical Algorithms & Mathematics

### Coastal Hypsometric Slope Damping (`terrain.ts`)

To prevent mountain ridges near oceanic subduction zones from placing glacial peaks (`zone_8` off-white) directly at the shoreline:

$$H_{\text{final}} = H_{\text{raw}} \cdot \min\left(1.0, 0.15 + 0.35 \cdot \text{coastDist}\right)$$

For coastal land cells (`coastDist <= 3`), elevation is smoothly damped so shoreline terrain stays within lowlands (`zone_0` / `zone_1`, 0–350m) before rising into alpine ranges inland.

### High-Density RBF Grid Interpolation (`vector-synthesis.ts`)

1. Constructs a continuous `2048 × 1024` floating-point grid matrix covering `[-180, 180] × [-84, 84]`.
2. Projects Voronoi cell attributes (`h`, `elevZone`, `biome`, `state`) onto grid points using Inverse Distance Weighted RBF interpolation:

$$V(x, y) = \frac{\sum_{i=1}^{k} w_i \cdot V(c_i)}{\sum_{i=1}^{k} w_i}, \quad w_i = \frac{1}{d(p, c_i)^2 + \epsilon}$$

3. Dual Marching Squares extracts floating-point contour crossing coordinates $(x,y)$ along cell boundaries, eliminating step-like cell artifacts.

### Catmull-Rom Spline Curve Subdivision (`chaikin.ts` / `export.ts`)

Replaces sharp polygon corners and step lines with 4-pass Catmull-Rom spline interpolation ($\tau = 0.5$):

$$P(t) = 0.5 \cdot \begin{bmatrix} 1 & t & t^2 & t^3 \end{bmatrix} \begin{bmatrix} 0 & 2 & 0 & 0 \\ -1 & 0 & 1 & 0 \\ 2 & -5 & 4 & -1 \\ -1 & 3 & -3 & 1 \end{bmatrix} \begin{bmatrix} P_0 \\ P_1 \\ P_2 \\ P_3 \end{bmatrix}$$

All shared boundary vertices across all 7 layers (`background`, `altitudes`, `climate`, `political`, `rivers`, `lakes`, `icecaps`) are extracted into a shared topology map and smoothed in a single pass before layer assembly, guaranteeing zero visual drift or gaps.

---

## 3. UI & Controls Refactor (`/labs/map-pipeline`)

1. **Remove Resolution Slider**: Remove the `Cell Resolution` slider from `MapPipelineControls.tsx`.
2. **Lock 100K Cell Default**: Update `MapPipelineLabPage` state to lock `cellCount: 100000`.
3. **Telemetry Badge**: Add a **"100K RBF Spline Vector Engine"** indicator to the telemetry header.

---

## 4. Verification & Testing Plan

### Automated Tests
- `bun test ./src/lib/worldgen/v2/__tests__/`
- Verify 100K mesh generation, Catmull-Rom spline output, and 7-layer GeoJSON export.
- `bun test ./src/lib/map-pipeline/`
- Enforce composite scientific accuracy $\ge 85\%$ across 10 random world seeds.

### Manual Verification
- Launch local dev server (`bun run dev`) and navigate to `http://localhost:3000/labs/map-pipeline`.
- Verify coastlines, elevation isolines, political borders, and rivers render with smooth curves and zero blocky staircases.
