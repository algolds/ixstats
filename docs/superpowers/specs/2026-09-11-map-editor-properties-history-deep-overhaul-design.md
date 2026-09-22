# Design Specification: Map Editor Deep Properties Inspector & Live History Engine

## Overview
This specification details the comprehensive overhaul of the IxMaps / IxWorld Map Editor right-hand Properties Inspector subsystem and the live-wiring of the History timeline engine. It transforms the editor into a professional desktop-grade GIS workstation (drawing inspiration from Apple Keynote, Figma, Blender, and QGIS) while strictly enforcing global cartographic consistency, Apple tactile physics, and zero-latency interaction.

---

## 1. Core Principles

1. **Omnipresent Inspector Model**: Eliminates modal barriers (`edit-<type>`). Selecting any feature on the map or in the layer list immediately opens its live properties in the inspector.
2. **Document-First Fallback**: When no individual feature is selected, the inspector does not collapse into empty space; it becomes the **Country & Canvas Document Inspector**, surfacing territory-level telemetry, feature totals, and creation launchpads.
3. **Physical & Tactile Direct Manipulation**: Coordinate inputs support horizontal scrubbing (Figma/Blender style) with pointer lock, step multipliers (`Shift`/`Alt`), and 1-click crosshair map location picking.
4. **Strict Global Cartographic Inheritance (Ponytail Principle)**: Visual appearance (colors, stroke patterns, zoom thresholds) is strictly enforced from global realm themes, classification tiers, and hypsometry. Manual per-feature styling pickers are omitted to avoid cartographic chaos and database bloat.
5. **Full Bidirectional Synchronized History**: The History panel is live-wired to record every create, update, delete, vertex drag, and geometry operation, executing instantaneous optimistic React Query cache updates (`setData`) alongside background tRPC mutations on undo, redo, and timeline jumping.

---

## 2. Information Architecture

### A. Document Inspector (No Feature Selected)
- **National Identity & Territory Header**:
  - Country flag / crest thumbnail
  - Country name & Realm identifier
  - Sovereignty status badge
- **National Spatial Telemetry Card**:
  - Total Land Area (km²) with `tabular-nums`
  - Coastline & Border Perimeter (km)
  - Transport Network Density (km of road/rail)
- **Live Feature Breakdown Chips**:
  - Cities count badge
  - Subdivisions count badge
  - Routes count badge
  - Geographic features count badge (Peaks, Rivers, Lakes)
- **Quick Creation Launchpad**:
  - Action buttons with keyboard shortcuts:
    - Draw Region (`R`)
    - Place City (`C`)
    - Draw Route (`T`)

### B. Feature Inspector (Single Feature Selected)
Composed of four progressive disclosure accordion cards:

#### 1. Identity & Administration
- **Feature Name**: Inline text input with debounced persistence.
- **Classification Selector**:
  - **City**: Segmented pill control (`Capital`, `City`, `Town`, `Port`, `Fortress`).
  - **Region**: Administrative tier selector (`Province`, `State`, `Prefecture`, `County`).
  - **Route**: Infrastructure tier selector (`Highway`, `Primary`, `Rail`, `Trail`, `Waterway`).
  - **POI**: Category selector (`Historical`, `Religious`, `Cultural`, `Natural`, `Military`).
- **Parent Subdivision & Sovereignty Claim**:
  - Dropdown linkage to assign the feature to a parent province/subdivision.
  - Country claim assignment selector.

#### 2. Spatial & Geodetic Telemetry
- **Scrubbable Coordinates**:
  - `Lng:` and `Lat:` labels that scrub horizontally on drag (pointer capture, $\Delta x$ accumulation).
  - Stepper nudges: `ArrowUp`/`ArrowDown` ($\pm 0.001^\circ$), `Shift+Arrow` ($\pm 0.01^\circ$).
  - One-click crosshair picker button to activate canvas relocation.
- **Live Topography & Hypsometry Chips**:
  - Live query via `api.countryGeo.sampleTerrainAt`.
  - Elevation readout in meters (with metric/imperial toggle).
  - Hypsometric Tint Zone badge (e.g. `Zone 2: Lowland Hills`).
  - Koppen Climate Classification chip (e.g. `Cfb: Oceanic`).
- **Vector Spatial Metrics**:
  - For Regions: Area (km²), perimeter (km), vertex count.
  - For Routes: Total path length (km), waypoint count.
  - For Points: Proximity to nearest coast / river (km).

#### 3. WikiOS & Narrative Lore
- **WikiOS Linkage Card**:
  - Article status chip (Stub, Verified, Missing).
  - Article title & thumbnail preview.
  - Quick Spotlight search to re-link or detach article.
  - 1-click button: `"Open in WikiOS Canvas"`.
- **Narrative Lore (POI & Historical Features)**:
  - Markdown-supported story summary.
  - IxTime calendar year & historical era tag.
  - Narrative importance rating (Minor, Notable, Major, Milestone).

#### 4. Contextual Geometry Operations
- **City**:
  - `Promote to Capital`: Promotes city to national capital, automatically downgrading previous capital.
  - `Snap to Coast/River`: Shifts coordinates to the closest shoreline or river polyline edge.
  - `Center on Map`: Smooth spring `flyTo` animation.
  - `Duplicate Feature`: Clones feature with offset.
  - `Delete Feature`: Destructive button with confirmation & history undo registration.
- **Region**:
  - `Pathfinder Operations`: Union, Subtract, Intersect with adjacent regions.
  - `Calculate Centroid`: Computes and centers capital or marker at geometric center.
  - `Simplify Polygon`: Reduces vertex density preserving topological contours.
  - `Center on Map` / `Duplicate` / `Delete`.
- **Route**:
  - `Reverse Direction`: Flips waypoint vertex order from start-to-finish.
  - `Snap Vertices to Cities`: Snaps start and end terminals to nearest city coordinates.
  - `Smooth Spline (Catmull-Rom)`: Interpolates natural curve subdivisions.
  - `Center on Map` / `Delete`.

### C. Batch Selection Inspector (Multi-Select)
- Selected features counter with type badges.
- Pathfinder Boolean tools (`Union`, `Subtract`, `Intersect`).
- Spatial Alignment bar (Align Left, Center, Right, Top, Middle, Bottom).
- Batch Parent Assignment (e.g. assign 5 cities to "Northern Province").
- Batch Delete with atomic undo action snapshot.

---

## 3. History Engine Architecture

### Action Recording Schema
```ts
export interface EditorAction {
  type: "create" | "delete" | "update";
  featureType: "city" | "subdivision" | "poi" | "peak" | "river" | "lake" | "route";
  featureId: string;
  description: string;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  timestamp: number;
}
```

### Execution & Rollback Pipeline
1. **Action Trigger**:
   - Create / Update / Delete mutations in `useMapFeatureMutations.ts` push an `EditorAction` to `useMapHistory`.
   - Vertex drag completions in `usePointDrag.ts` and `useRouteEdit.ts` push coordinate update actions.
2. **Optimistic React Query Cache Update**:
   - `utils.geoCore.getCountryFeatures.setData` and `utils.transport.getCountryRoutes.setData` immediately apply changes for 0ms visual latency.
3. **History Jump Engine (`jumpToHistoryPosition`)**:
   - Calculates directional step between `position` and `targetPos`.
   - Iterates through actions applying inverse mutations (undo) or forward mutations (redo).
   - Inverts:
     - Undo `create` $\rightarrow$ call `delete<FeatureType>`
     - Undo `delete` $\rightarrow$ call `create<FeatureType>` with `previousData`
     - Undo `update` $\rightarrow$ call `update<FeatureType>` with `previousData`
4. **Global Keyboard Shortcuts**:
   - `Cmd+Z` / `Ctrl+Z` (Undo) and `Cmd+Shift+Z` / `Ctrl+Shift+Z` (Redo).
   - Guarded with `isKeyboardInputTarget()` to prevent canvas undo while typing in inputs.

---

## 4. Design & Polish Standards

- **Materials**: Facet translucent glass (`bg-card/70 border-border/40 backdrop-blur-md`).
- **Tactile Compression**: `active:scale-[0.98]` on all interactive elements.
- **Typography**: Tabular numerals (`tabular-nums font-mono text-xs`) for coordinates, areas, and lengths.
- **Color Standards**: 100% semantic Tailwind v4 tokens (zero raw hex codes).
- **Line Ceiling Compliance**: All modified and created files strictly adhere to the project's line limits (≤700 lines for components/routers, ≤500 lines for sub-panels and hooks).
