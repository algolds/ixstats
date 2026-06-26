# Plan 053: Map Editor Panel Memoization Optimization

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 30ba5922..HEAD -- src/components/mycountry/EnhancedMapEditorContent.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `30ba5922`, 2026-06-22

## Why this matters

The `LayerPanel` component inside the Map Editor lists geographic layers and counts the number of features inside them. It is wrapped in `React.memo`, but the parent component `EnhancedMapEditorContent.tsx` passes inline arrays (`layers`), inline objects (`featureCounts`), and inline callback functions (`onToggleVisibility`, `onOpacityChange`).
- Every minor parent state change (e.g. mouse cursor movements, zoom bucket updates, location picking mode toggles) recreates these object references.
- This bypasses `React.memo`, causing `LayerPanel` to completely re-render and re-filter hundreds of items unnecessarily.
- Additionally, `featureCounts` is calculated by running five separate filter passes on the feature array, wasting CPU cycles on every render.
Memoizing these dependencies and computing counts in a single pass resolves these performance issues.

## Current state

- [EnhancedMapEditorContent.tsx](file:///ixwiki/public/projects/ixstats/src/components/mycountry/EnhancedMapEditorContent.tsx) — Main page container for the Map Editor.
- Current inline instantiation of `LayerPanel` (lines 458–527):

```typescript
              <LayerPanel
                layers={[
                  {
                    id: "border",
                    name: "Country Border",
                    icon: Globe,
                    visible: layerStates.border?.visible ?? true,
                    locked: false,
                  },
                  // ... (other layers)
                ]}
                onToggleVisibility={(id) => {
                  if (id === "altitude" || id === "rivers" || id === "lakes") {
                    toggleLayer(id === "altitude" ? "altitudes" : id);
                  }
                  setLayerStates((s) => ({
                    ...s,
                    [id]: { ...s[id]!, visible: !s[id]?.visible },
                  }));
                }}
                onToggleLock={() => {}}
                onOpacityChange={(id, opacity) => {
                  setLayerStates((s) => ({
                    ...s,
                    [id]: { ...s[id]!, opacity },
                  }));
                }}
                featureCounts={{
                  regions: editor.allFeatures.filter((f) => f.type === "subdivision").length,
                  cities: editor.allFeatures.filter((f) => f.type === "city").length,
                  pois: editor.allFeatures.filter((f) => f.type === "poi").length,
                  stories: editor.allFeatures.filter((f) => f.type === "storyPin").length,
                  labels: editor.allFeatures.filter((f) => f.type === "mapLabel").length,
                }}
              />
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run typecheck:ui`   | exit 0, no errors   |
| Lint      | `bun run lint`           | exit 0              |

## Scope

**In scope**:
- `src/components/mycountry/EnhancedMapEditorContent.tsx`

**Out of scope**:
- Modifications to `LayerPanel.tsx` component implementation (handled in another plan)

## Git workflow

- Branch: `perf/053-map-layer-memo`
- Commit message style: `perf(editor): memoize LayerPanel props and callbacks`

## Steps

### Step 1: Declare Memoized Variables and Callbacks

In [EnhancedMapEditorContent.tsx](file:///ixwiki/public/projects/ixstats/src/components/mycountry/EnhancedMapEditorContent.tsx):
1. Locate the top of the `EnhancedMapEditorContent` function definition.
2. Declare `editorLayers` using `useMemo`, dependent on `layerStates`.
3. Declare `featureCounts` using `useMemo`, dependent on `editor.allFeatures`, executing a single O(N) loop to count the different feature types.
4. Declare `handleToggleVisibility` and `handleOpacityChange` using `useCallback`.

Use this implementation shape:

```typescript
  const editorLayers = useMemo(() => {
    return [
      {
        id: "border",
        name: "Country Border",
        icon: Globe,
        visible: layerStates.border?.visible ?? true,
        locked: false,
      },
      {
        id: "regions",
        name: "Subdivisions",
        icon: Globe,
        visible: layerStates.regions?.visible ?? true,
        locked: false,
        opacity: layerStates.regions?.opacity,
      },
      {
        id: "cities",
        name: "Cities",
        icon: Globe,
        visible: layerStates.cities?.visible ?? true,
        locked: false,
      },
      {
        id: "pois",
        name: "Points of Interest",
        icon: Globe,
        visible: layerStates.pois?.visible ?? true,
        locked: false,
      },
      {
        id: "stories",
        name: "Story Pins",
        icon: Globe,
        visible: layerStates.stories?.visible ?? true,
        locked: false,
      },
      {
        id: "labels",
        name: "Map Labels",
        icon: Globe,
        visible: layerStates.labels?.visible ?? true,
        locked: false,
      },
    ];
  }, [layerStates]);

  const featureCounts = useMemo(() => {
    let regions = 0;
    let cities = 0;
    let pois = 0;
    let stories = 0;
    let labels = 0;
    for (const f of editor.allFeatures) {
      if (f.type === "subdivision") regions++;
      else if (f.type === "city") cities++;
      else if (f.type === "poi") pois++;
      else if (f.type === "storyPin") stories++;
      else if (f.type === "mapLabel") labels++;
    }
    return { regions, cities, pois, stories, labels };
  }, [editor.allFeatures]);

  const handleToggleVisibility = useCallback((id: string) => {
    if (id === "altitude" || id === "rivers" || id === "lakes") {
      toggleLayer(id === "altitude" ? "altitudes" : id);
    }
    setLayerStates((s) => ({
      ...s,
      [id]: { ...s[id]!, visible: !s[id]?.visible },
    }));
  }, [toggleLayer]);

  const handleOpacityChange = useCallback((id: string, opacity: number) => {
    setLayerStates((s) => ({
      ...s,
      [id]: { ...s[id]!, opacity },
    }));
  }, []);
```

**Verify**:
- Run `bun run typecheck:ui` and ensure it compiles successfully.

### Step 2: Bind Memoized Props to LayerPanel

In [EnhancedMapEditorContent.tsx](file:///ixwiki/public/projects/ixstats/src/components/mycountry/EnhancedMapEditorContent.tsx):
1. Update the `LayerPanel` jsx instantiation to use the new memoized props:
   - `layers={editorLayers}`
   - `onToggleVisibility={handleToggleVisibility}`
   - `onOpacityChange={handleOpacityChange}`
   - `featureCounts={featureCounts}`

**Verify**:
- Run `bun run typecheck:ui` to ensure no compilation issues.
- Run `bun run lint` to ensure no lint/formatting issues.

## Done criteria

- [ ] `bun run typecheck:ui` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] No inline array/object/function allocations remain in `LayerPanel` props wiring.

## STOP conditions

- If layer visibility updates stop reflecting on the map, verify `layerStates` is correctly synced to the map's state via hooks.
