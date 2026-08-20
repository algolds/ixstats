# Plan 107: MapLibre Incremental GeoJSON Feature Source Patching

**Phase**: 2 of 4  
**Target System**: `src/components/maps/editor/hooks/useMapLayers.ts`, `src/components/maps/editor/EditorMap.tsx`  
**Goal**: Replace full-collection GeoJSON stringification (`JSON.stringify` of 500+ features) with targeted feature-level source patching and MapLibre `setFeatureState`.

---

## 1. Problem Statement

Currently, when any feature property or vertex geometry updates, `useMapLayers.ts` converts the entire array of 500+ features into a new GeoJSON `FeatureCollection` and calls `map.getSource(layerId).setData(geoJson)`.
This forces MapLibre to:
1. Re-parse the entire GeoJSON string in WebGL memory.
2. Re-build spatial index trees for unchanged features.
3. Re-upload all vertex buffers to the GPU, causing 30–80ms frame stalls.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **Incremental Patching**: Never re-upload unchanged geometry.
- **MapLibre Feature State**: Use MapLibre's built-in `setFeatureState` API for visual state toggles (`selected`, `hovered`, `highlighted`) instead of re-creating GeoJSON feature objects.

### TypeScript Expert Pattern
- Discriminated union type for GeoJSON mutation operations:

```typescript
export type GeoJSONMutation =
  | { type: "UPDATE_FEATURE"; featureId: string; geometry: GeoJSON.Geometry; properties?: Record<string, unknown> }
  | { type: "ADD_FEATURE"; feature: GeoJSON.Feature }
  | { type: "REMOVE_FEATURE"; featureId: string };
```

---

## 3. Implementation Steps

### Step 1: Create `GeoJSONPatchEngine` (`src/components/maps/editor/utils/geoJsonPatcher.ts`)
Implement an incremental source updater that applies single-feature mutations to existing MapLibre sources.

```typescript
export function patchMapLibreSource(
  map: maplibregl.Map,
  sourceId: string,
  mutation: GeoJSONMutation
): void {
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
  if (!source) return;
  // Apply targeted update via source setData with cached feature map
}
```

### Step 2: Integrate `setFeatureState` for Selection & Hover
Update `useMapLayers.ts` to toggle `selected: true` / `hovered: true` using MapLibre `map.setFeatureState({ source: 'subdivisions', id: featureId }, { selected: true })` instead of regenerating polygon styles in JS.

---

## 4. Machine-Checkable Verification

```bash
# Verify UI build
bun run typecheck:ui

# Verify Map Editor tests
bun run test -- src/components/maps/editor
```

### Expected Output
- Moving a vertex or selecting a feature takes $< 2\text{ms}$ execution time (no full GeoJSON re-serialization).
