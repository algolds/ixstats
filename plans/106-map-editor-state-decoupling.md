# Plan 106: Map Editor React State Isolation & Transient Pointer Decoupling

**Phase**: 1 of 4  
**Target System**: `src/hooks/useMapEditor.ts`, `src/components/maps/editor/EditorMap.tsx`  
**Goal**: Decouple transient pointer movements, hover tooltips, and tool preview state from the main React component tree to stop top-level re-render storms on every mouse move.

---

## 1. Problem Statement

Currently, `useMapEditor.ts` maintains 40+ reactive state atoms in a single monolithic hook. Whenever a user moves their cursor over the map canvas, hovers over a feature, or drags a vertex:
1. `useMapEditor` state updates via `useState`.
2. The root container `EditorMapOverlay` and all child panels (`MapEditorSidebarPanels`, `DrawingToolbar`, `FeatureList`) re-render simultaneously.
3. React performs full VDOM diffing on hundreds of UI components per frame, causing 20–60ms frame drops during drawing and inspection.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **No unnecessary state**: Transient mouse coordinates, hover hints, and drag previews do NOT belong in global React state.
- **Direct Canvas / Ref Updates**: Use `useRef` for tracking current cursor position and active drag coordinates.
- **Targeted Subscriptions**: Implement `useSyncExternalStore` or lightweight event emitter for components that genuinely require hover state (e.g. `CoordinatesMapEmbed`).

### TypeScript Expert Pattern
- Branded nominal types for feature handles (`type FeatureId = Brand<string, 'FeatureId'>`).
- Strictly typed transient state store interface:

```typescript
export interface TransientEditorState {
  hoveredFeatureId: FeatureId | null;
  cursorCoords: [number, number] | null;
  activeVertexIndex: number | null;
}

export type StateListener = (state: TransientEditorState) => void;
```

---

## 3. Implementation Steps

### Step 1: Create `TransientEditorStore` (`src/components/maps/editor/utils/transientStore.ts`)
Create a zero-dependency external store to hold cursor coordinates and hover IDs outside React's render loop.

### Step 2: Refactor `useMapEditor.ts` Cursor & Hover Handlers
Replace top-level `setHoveredFeature` and `setCursorCoords` `useState` calls in `useMapEditor.ts` with direct calls to `transientStore.setHoveredFeatureId()`.

### Step 3: Update `EditorMap.tsx` Pointer Handlers
Connect MapLibre `mousemove` and `mouseleave` event listeners directly to `transientStore`, bypassing React state dispatches.

---

## 4. Machine-Checkable Verification

```bash
# Typecheck UI sub-project
bun run typecheck:ui

# Verify editor test suite
bun run test -- src/components/maps/editor
```

### Expected Output
- Zero re-renders of `MapEditorSidebarPanels` or `FeatureList` on cursor movement over the map.
- Frame rate during cursor panning remains locked at 60fps.
