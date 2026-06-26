# Plan 054: Feature List Filter Loop Optimization

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 30ba5922..HEAD -- src/components/maps/editor/LayerPanel.tsx src/components/maps/editor/FeatureList.tsx`
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

Both `LayerPanel.tsx` and `FeatureList.tsx` display feature groups (cities, subdivisions, POIs, story pins, map labels, routes) in collapsible side-panels. 
- Currently, they split the main `features` array by running six separate `.filter()` calls inside their render paths.
- For countries with hundreds of features, this wastes precious CPU cycles re-traversing the arrays repeatedly on every single render.
- Grouping features in a single-pass `useMemo` loop solves this efficiency issue, resulting in faster rendering.

## Current state

- [LayerPanel.tsx](file:///ixwiki/public/projects/ixstats/src/components/maps/editor/LayerPanel.tsx) — Displays the hierarchy of editor layers.
  - Current filtering helper (lines 108–118):

```typescript
  const getLayerFeatures = (layerId: string) => {
    return features.filter((f) => {
      if (layerId === "regions") return f.type === "subdivision";
      if (layerId === "cities") return f.type === "city";
      if (layerId === "pois") return f.type === "poi";
      if (layerId === "stories") return f.type === "storyPin";
      if (layerId === "labels") return f.type === "mapLabel";
      if (layerId === "routes") return f.type === "route";
      return false;
    });
  };
```

- [FeatureList.tsx](file:///ixwiki/public/projects/ixstats/src/components/maps/editor/FeatureList.tsx) — Displays lists of features in groups.
  - Current filtering calls (lines 151–165):

```typescript
  // Group by type
  const cities = features.filter((f) => f.type === "city");
  const subdivisions = features.filter((f) => f.type === "subdivision");
  const pois = features.filter((f) => f.type === "poi");
  const storyPins = features.filter((f) => f.type === "storyPin");
  const mapLabels = features.filter((f) => f.type === "mapLabel");
  const routes = features.filter((f) => f.type === "route");

  const groups: Array<{ label: string; items: EditorFeature[]; type: FeatureType }> = [
    { label: "Cities", items: cities, type: "city" },
    { label: "Regions", items: subdivisions, type: "subdivision" },
    { label: "Points of Interest", items: pois, type: "poi" },
    { label: "Story Pins", items: storyPins, type: "storyPin" },
    { label: "Map Labels", items: mapLabels, type: "mapLabel" },
    { label: "Routes", items: routes, type: "route" },
  ].filter((g) => g.items.length > 0);
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run typecheck:ui`   | exit 0, no errors   |
| Lint      | `bun run lint`           | exit 0              |

## Scope

**In scope**:
- `src/components/maps/editor/LayerPanel.tsx`
- `src/components/maps/editor/FeatureList.tsx`

**Out of scope**:
- Modifications to database models or server-side API routers

## Git workflow

- Branch: `perf/054-list-filter-opt`
- Commit message style: `perf(editor): group map features in a single memoized pass`

## Steps

### Step 1: Optimize LayerPanel Feature Filtering

In [LayerPanel.tsx](file:///ixwiki/public/projects/ixstats/src/components/maps/editor/LayerPanel.tsx):
1. Delete the `getLayerFeatures` function (lines 108–118).
2. Inside `LayerPanel`, declare `groupedFeatures` using `useMemo` dependent on `features`:

```typescript
  const groupedFeatures = useMemo(() => {
    const groups = {
      regions: [] as any[],
      cities: [] as any[],
      pois: [] as any[],
      stories: [] as any[],
      labels: [] as any[],
      routes: [] as any[],
    };

    for (const f of features) {
      if (f.type === "subdivision") groups.regions.push(f);
      else if (f.type === "city") groups.cities.push(f);
      else if (f.type === "poi") groups.pois.push(f);
      else if (f.type === "storyPin") groups.stories.push(f);
      else if (f.type === "mapLabel") groups.labels.push(f);
      else if (f.type === "route") groups.routes.push(f);
    }

    return groups;
  }, [features]);
```

3. Update the inner render block (line 207) to read from `groupedFeatures`:
   - Change `const layerFeatures = getLayerFeatures(layer.id);` to `const layerFeatures = (groupedFeatures as any)[layer.id] ?? [];`
4. Add `useMemo` import at the top of [LayerPanel.tsx](file:///ixwiki/public/projects/ixstats/src/components/maps/editor/LayerPanel.tsx) if not already present.

**Verify**:
- Run `bun run typecheck:ui` and ensure it succeeds.

### Step 2: Optimize FeatureList Feature Filtering

In [FeatureList.tsx](file:///ixwiki/public/projects/ixstats/src/components/maps/editor/FeatureList.tsx):
1. Locate the grouping filters and variable declarations (lines 151–165).
2. Replace them with a single-pass `useMemo` that directly generates the sorted `groups` list:

```typescript
  const groups = useMemo(() => {
    const cities: EditorFeature[] = [];
    const subdivisions: EditorFeature[] = [];
    const pois: EditorFeature[] = [];
    const storyPins: EditorFeature[] = [];
    const mapLabels: EditorFeature[] = [];
    const routes: EditorFeature[] = [];

    for (const f of features) {
      if (f.type === "city") cities.push(f);
      else if (f.type === "subdivision") subdivisions.push(f);
      else if (f.type === "poi") pois.push(f);
      else if (f.type === "storyPin") storyPins.push(f);
      else if (f.type === "mapLabel") mapLabels.push(f);
      else if (f.type === "route") routes.push(f);
    }

    return [
      { label: "Cities", items: cities, type: "city" as const },
      { label: "Regions", items: subdivisions, type: "subdivision" as const },
      { label: "Points of Interest", items: pois, type: "poi" as const },
      { label: "Story Pins", items: storyPins, type: "storyPin" as const },
      { label: "Map Labels", items: mapLabels, type: "mapLabel" as const },
      { label: "Routes", items: routes, type: "route" as const },
    ].filter((g) => g.items.length > 0);
  }, [features]);
```

**Verify**:
- Run `bun run typecheck:ui` to ensure successful compilation.
- Run `bun run lint` to verify eslint rules pass.

## Done criteria

- [ ] `bun run typecheck:ui` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] Multiple `.filter()` calls inside `FeatureList` and `LayerPanel` render functions are replaced by a single-pass `useMemo` loop.

## STOP conditions
- None.
