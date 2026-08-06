# Plan 114: Google Maps-Style Dynamic River Hydrography

**Target System**: `src/lib/map-config.ts`, `src/components/maps/core/hooks/useWorldMapLayers.ts`, `src/components/maps/editor/hooks/useMapLayers.ts`, `src/lib/map-styles/`  
**Goal**: Transform static, prominent 2.5px neon-blue rivers into dynamic Google Maps / Mapbox cartographic hydrography with zoom-interpolated opacity, hairline globe scaling, and harmonious water color palettes.

---

## 1. Problem Statement

Currently at Globe view ($z \approx 1.5 - 3.0$), rivers render as a solid 2.5px neon-cyan (`#0284c7`) web at 90% opacity over all landmasses.
This clutters the globe, obscures country border colors, and makes landmasses look covered in heavy bright lines.

---

## 2. Cartographic Design (Google Maps & Mapbox Standard)

### A. Zoom-Interpolated Line Width (`line-width`)
- **Globe Overview ($z = 0 - 2$)**: `0.4px - 0.6px` (thin, subtle hairline drainage paths)
- **Continent View ($z = 3 - 5$)**: `0.8px - 1.2px`
- **Local View ($z = 6 - 9+$)**: `1.8px - 3.2px` (full crisp river channels)

Expression:
```json
["interpolate", ["exponential", 1.2], ["zoom"], 0, 0.4, 2, 0.6, 4, 1.0, 6, 1.8, 9, 3.2]
```

### B. Zoom-Interpolated Line Opacity (`line-opacity`)
- **Globe Overview ($z = 0 - 2$)**: `0.25 - 0.35` (faded, elegant water veins)
- **Continent View ($z = 3 - 5$)**: `0.45 - 0.60`
- **Local View ($z = 6 - 8+$)**: `0.75 - 0.90`

Expression:
```json
["interpolate", ["linear"], ["zoom"], 0, 0.25, 2, 0.35, 4, 0.55, 6, 0.75, 8, 0.90]
```

### C. Soft Water Color Harmonization (`line-color`)
- Replace `#0284c7` (neon primary cyan) with `#5295c4` / `#4a8db7` (soft harmonious water blue matching oceanic backgrounds).

---

## 3. Proposed Changes

### `src/lib/map-config.ts`
- Update `LAYER_CONFIGS.rivers` `strokeColor` to `#5295c4` and `strokeWidth` to `1.0`.

### `src/components/maps/core/hooks/useWorldMapLayers.ts` & `src/components/maps/editor/hooks/useMapLayers.ts`
- Update `fill-rivers` paint definition to use dynamic zoom-interpolated `line-width` and `line-opacity`.

### `src/lib/map-styles/standard.json`, `dark.json`, `paper.json`
- Update theme template river layer definitions to match dynamic scale curves.

---

## 4. Verification Plan

### Machine-Checkable Tests
```bash
# Verify UI typecheck
bun run typecheck:ui

# Verify maps core tests
bun run test -- src/components/maps/core
```

### Visual Verification
- Inspect Globe mode at $z = 2.0$: Landmasses and country fills are clean and dominant, rivers are soft 0.4px hairlines at 0.30 opacity.
- Zoom into a nation ($z = 6.0$): Rivers smoothly fade in and widen into detailed hydrographic networks.
