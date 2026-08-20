# Plan 109: Map Sidebar List Virtualization & CSS Content Containment

**Phase**: 4 of 4  
**Target System**: `src/components/maps/editor/FeatureList.tsx`, `src/components/maps/editor/LayerPanel.tsx`, `src/components/maps/editor/components/MapEditorSidebarPanels.tsx`  
**Goal**: Eliminate DOM tree lag when scrolling or selecting features by applying CSS `content-visibility: auto` containment and granular `React.memo` comparator boundaries.

---

## 1. Problem Statement

When a country has 200+ cities, regions, and POIs, `FeatureList.tsx` generates hundreds of DOM elements.
Even though collapsible group headers exist, expanding a group forces the browser layout engine to measure and paint hundreds of DOM nodes at once, causing scroll stutter and 40–100ms render delays on selection.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **Native CSS Containment**: Use `content-visibility: auto` and `contain-intrinsic-size: 1000px 36px` to let the browser skip layout & rendering for off-screen list items without adding virtualizer library bloat.
- **Granular Component Boundaries**: Wrap individual feature row items in `React.memo` with a custom `arePropsEqual` comparator that checks only `feature.id`, `isSelected`, `isMultiSelected`, and `name`.

### TypeScript Expert Pattern

```typescript
export interface FeatureRowProps {
  feature: EditorFeature;
  isSelected: boolean;
  isMultiSelected: boolean;
  onSelect: (feature: EditorFeature) => void;
  onEdit: (feature: EditorFeature) => void;
  onDelete: (feature: EditorFeature) => void;
}

export const FeatureRow = React.memo(
  function FeatureRow({ feature, isSelected, isMultiSelected, onSelect, onEdit, onDelete }: FeatureRowProps) {
    // Row rendering
  },
  (prev, next) =>
    prev.feature.id === next.feature.id &&
    prev.isSelected === next.isSelected &&
    prev.isMultiSelected === next.isMultiSelected &&
    prev.feature.name === next.feature.name
);
```

---

## 3. Implementation Steps

### Step 1: Extract `FeatureRow` Sub-Component
Extract `FeatureRow` from `FeatureList.tsx` into a memoized sub-component with custom memo comparator.

### Step 2: Apply CSS `content-visibility: auto` in `FeatureList.tsx`
Add CSS classes for list rendering optimization:

```tsx
<div className="space-y-0.5 pl-1 [content-visibility:auto] [contain-intrinsic-size:1000px_36px]">
  {visibleItems.map((feature) => (
    <FeatureRow key={feature.id} ... />
  ))}
</div>
```

---

## 4. Machine-Checkable Verification

```bash
# Verify UI typecheck
bun run typecheck:ui

# Verify FeatureList tests
bun run test -- src/components/maps/editor
```

### Expected Output
- Selecting a feature in a 500-item list re-renders ONLY the single selected row item ($\mathcal{O}(1)$ React diffing).
- Initial expansion of feature groups is instant ($< 5\text{ms}$).
