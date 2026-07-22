# Design Spec: Unified Physical Geography Engine & Scientific Accuracy Audit Suite

**Date:** July 21, 2026  
**Status:** Approved  
**Target Component:** Physical Geography Base & Accuracy Audit Suite (`src/lib/map-pipeline/physical-geography-engine.ts`, `src/lib/map-pipeline/geographical-accuracy-analyzer.ts`)

---

## 1. Overview & Vision

The **Unified Physical Geography Engine** establishes a continuous, 2D vector physical base (`background`, `altitudes`, `climate`, `rivers`, `lakes`) upon which the political layer (`political`) is drawn as an overlay.

All physical systems follow strict Earth science and thermodynamics principles, enforced by an automated **Geographical Accuracy & Scientific Audit Suite** requiring a composite realism score $\ge 85\%$.

---

## 2. Architecture & Layer Hierarchy

```
+-------------------------------------------------------------------+
|                    POLITICAL OVERLAY LAYER                        |
|  - political (Country borders & nation claim polygons)            |
|  - cities & sovereignty labels                                    |
+-------------------------------------------------------------------+
                                 │ Overlaid on top
                                 ▼
+-------------------------------------------------------------------+
|               UNIFIED PHYSICAL GEOGRAPHY BASE                     |
|  - rivers (Hydrographic LineStrings, strokeWidth: 2.2px)          |
|  - lakes (Inland water basin polygons, fill: #7cb5d2)             |
|  - climate (Trewartha biomes derived from latitude & altitude)    |
|  - altitudes (Smooth 9-zone topographic isoline contours)         |
|  - background (Solid landmass base polygon #e8e5da)               |
+-------------------------------------------------------------------+
```

---

## 3. Scientific Earth & IxEarth Principles (85%+ Accuracy Standard)

### A. Hydrological Downhill Flow ($\ge 85\%$ Score)
- Rivers spawn at mountain origins ($h \ge 160$) and trace continuous downhill gradients ($\Delta h < 0$).
- Tributaries merge downstream into main river trunks, discharging into coastal bays or inland lake basins.

### B. Altitude Thermodynamic Lapse Rate ($\ge 85\%$ Score)
- Temperature drops $6.5^\circ\text{C}$ per $1000\text{m}$ elevation.
- High mountain peaks ($h \ge 213$, Zone 7–8) automatically form Alpine Glaciers/Tundra.

### C. Orogenic Rain-Shadow Effect ($\ge 85\%$ Score)
- Moist oceanic prevailing winds deposit heavy rainfall on windward mountain slopes (Rainforest/Forest).
- Leeward mountain slopes form dry rain-shadow steppe and desert biomes.

### D. Hypsometric Elevation Curve ($\ge 85\%$ Score)
- Land height distribution conforms to Earth's hypsometric curve:
  - 35% Coastal Lowlands & Low Hills (Zones 0–1)
  - 45% Rolling Hills, Uplands & Low Mountains (Zones 2–4)
  - 20% Mid, High & Alpine Mountains (Zones 5–8)

---

## 4. Verification & Scientific Audit Suite

### Automated Test Execution
```bash
bun run test -- src/lib/map-pipeline/geographical-accuracy-analyzer.test.ts
```

- **`geographical-accuracy-analyzer.ts`**: Audits 10 random seeds against Hydrological Flow, Thermodynamic Lapse Rate, Orogenic Rain Shadow, and Hypsometric Curve metrics.
- **Pass Criterion**: Composite accuracy score $\ge 85\%$ across all seeds.
