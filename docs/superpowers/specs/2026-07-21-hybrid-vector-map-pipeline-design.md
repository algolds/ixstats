# Design Spec: Hybrid Vector Seed Map Pipeline

**Date:** July 21, 2026  
**Status:** Approved  
**Target Component:** Map Pipeline / World Generator (`src/lib/worldgen/`, `src/lib/map-pipeline/`)

---

## 1. Overview & Vision

The **Hybrid Vector Seed Map Pipeline** replaces blocky low-poly Voronoi cell geometry with smooth, real-world and IxWorld vector seed geography. By combining pre-packaged GeoJSON vector cutouts (continents, 9-zone elevation contours, hydrographic river systems, and lake basins) with multi-octave harmonic noise perturbation, the engine synthesizes ultra-realistic, continuous vector maps that adhere to standard RFC 7946 GeoJSON and IxWorld's cartographic visual standard.

---

## 2. System Architecture

```
User Parameters (Seed, Land Ratio, Nations)
   │
   ▼
Vector Seed Selector (public/data/vector-seeds/)
   │
   ▼
Harmonic Vector Perturbation & Spline Deformation
   │
   ▼
Topographic Vector Overlay & Hydrographic Tracing
   │
   ▼
Sub-Cell Point-In-Polygon Claims & Biome Assignment
   │
   ▼
7-Layer Standard GeoJSON Output (RFC 7946 Compliant)
```

### 2.1 Components & Modules

1. **Vector Seed Registry (`public/data/vector-seeds/`)**:
   - `continents.json`: Real-world (Natural Earth 1:10m) and IxWorld (`master-map-updated.svg`) coastline MultiPolygons.
   - `elevation-contours.json`: Topographic elevation contour rings corresponding to the 9 canonical IxEarth elevation zones (`zone_0` to `zone_8`).
   - `rivers.json`: Natural hydrographic river systems with tapering LineStrings.
   - `lakes.json`: Inland lake basin polygons.

2. **Vector Synthesis Engine (`src/lib/map-pipeline/vector-synthesis.ts`)**:
   - **Spatial Seed Selection**: Selects real vector cutouts matching requested seed, land ratio, and continent count.
   - **Harmonic Vector Perturbation**: Applies continuous coordinate noise displacement and Chaikin spline smoothing directly to vector vertices.
   - **Sub-Cell Attribution**: Uses point-in-polygon queries to assign country claims, climate biomes, and settlement locations to smooth vector geography.

3. **GeoJSON Exporter (`src/lib/worldgen/export-geojson.ts`)**:
   - Emits 7 GeoJSON feature collections (`background`, `altitudes`, `climate`, `rivers`, `lakes`, `political`, `cities`).
   - Standardizes all floating-point coordinates to 4 decimal places (`round4`).
   - Assigns numeric integer `id` attributes to every feature object for MapLibre GL JS indexing.

---

## 3. Data Schema & Layer Parity

| Layer Key | Geometry Type | Color Palette / Styling | Description |
|---|---|---|---|
| `background` | MultiPolygon | Opaque `#e8e5da` | Opaque base landmass polygon |
| `altitudes` | MultiPolygon | Canonical 9-zone palette (`#a8c995` → `#6b563b`) | Smooth 9-zone topographic elevation contours |
| `climate` | MultiPolygon | Trewartha 12-type palette | Trewartha climate and biome regions |
| `lakes` | Polygon / MultiPolygon | `#7cb5d2` (0.85 opacity) | Inland waterbody basins |
| `rivers` | LineString | `#7cb5d2` (2.5–6.0px width) | Vector hydrographic river channels |
| `political` | MultiPolygon | State colors (0.4 opacity) | Nation political boundaries and territory fills |
| `cities` | Point | `#FF4444` | Settlement locations & capital markers |

---

## 4. Error Handling & Safeguards

1. **Topology Validation**: Checks all generated polygons for self-intersection and unclosed rings before emitting.
2. **Numeric ID Integrity**: Guarantees top-level `feature.id` values are numeric integers, preventing MapLibre `SymbolBucket` crashes.
3. **Empty Layer Guard**: Ensures symbol layers are only registered in MapLibre styles when features exist in the source data.

---

## 5. Verification Plan

### Automated Unit Tests
```bash
bun run test -- src/lib/map-pipeline/vector-synthesis.test.ts src/lib/map-pipeline/accuracy-normalizer.test.ts
```

1. **`vector-synthesis.test.ts`**: Verifies 100% clean RFC 7946 GeoJSON output across 10 random seeds with valid polygon rings and non-zero feature counts.
2. **`accuracy-normalizer.test.ts`**: Verifies land ratio accuracy, continent distribution, river channel tracing, and lake land share.
