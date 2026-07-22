# Design Spec: 4-Octave Multi-Fractal Topography & Real-World Vector Topo Pipeline

**Date:** July 21, 2026  
**Status:** Approved  
**Target Component:** World Generator / Heightmap Engine (`src/lib/worldgen/heightmap.ts`, `public/data/vector-seeds/`)

---

## 1. Overview & Vision

The **4-Octave Multi-Fractal Topography & Real-World Vector Topo Pipeline** ensures 100% of all generated landmasses across every world seed feature rich, diverse, realistic topographic elevation (coastal lowlands, low hills, rolling hills, uplands, mid mountains, and high alpine peaks).

By combining pre-packaged real-world / IxWorld vector elevation contours (`public/data/vector-seeds/elevation-contours.json`) with a seed-driven 4-octave continuous noise field, the engine guarantees complete topographic coverage across every continent without sparse or localized concentration artifacts.

---

## 2. Architecture & 4-Octave Noise Field

```
World Seed + User Parameters
   │
   ▼
4-Octave Topographic Noise Engine
├── Octave 1: Macro Relief (f=0.015) — Continental Shields & Plateaus
├── Octave 2: Tectonic Fault Belts (f=0.04) — Ridge Mountain Chains
├── Octave 3: Hills & Valleys (f=0.09) — Rolling Hills & Valleys
└── Octave 4: Micro Surface Relief (f=0.22) — Local Crags & Roughness
   │
   ▼
Real-World Vector Topo Seed Overlay (public/data/vector-seeds/elevation-contours.json)
   │
   ▼
Coast-to-Interior Linear Elevation Normalization (h ∈ [52, 255])
   │
   ▼
7-Layer Standard GeoJSON Exporter (100% Spatially Aligned)
```

---

## 3. Topographic Elevation Zones (IxEarth 9-Zone Standard)

| Zone Index | Zone ID | Zone Name | Height Range | Color (Hex) | Geographic Feature |
|---|---|---|---|---|---|
| 0 | `zone_0` | Coastal Lowlands | 52 – 74 | `#a8c995` | Estuaries & coastal plains |
| 1 | `zone_1` | Low Hills | 75 – 97 | `#c3d3a1` | Low-lying inland hills |
| 2 | `zone_2` | Rolling Hills | 98 – 120 | `#dcdcac` | Undulating countryside |
| 3 | `zone_3` | Uplands | 121 – 143 | `#f7e6b8` | Elevated plateaus & highlands |
| 4 | `zone_4` | Low Mountains | 144 – 166 | `#dac497` | Mountain foothills |
| 5 | `zone_5` | Mid Mountains | 167 – 189 | `#bea276` | Major mountain ranges |
| 6 | `zone_6` | High Mountains | 190 – 212 | `#9c7b50` | Rugged mountain belts |
| 7 | `zone_7` | Alpine | 213 – 235 | `#796142` | Sub-alpine tree-line peaks |
| 8 | `zone_8` | Extreme Alpine | 236 – 255 | `#6b563b` | Permanent glaciated peaks |

---

## 4. Verification Plan

### Automated Unit Tests
```bash
bun run test -- src/lib/worldgen/heightmap.test.ts src/lib/map-pipeline/accuracy-normalizer.test.ts
```

1. **`heightmap.test.ts`**: Verifies 100% of generated landmasses contain a multi-zone elevation gradient (Zone 0 through Zone 7/8 present across every seed).
2. **`accuracy-normalizer.test.ts`**: Runs a 10-seed batch audit confirming land ratio, topographic zone distribution, and river density.
