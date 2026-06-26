# Plan 051: Map Zoom Performance Optimization

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 30ba5922..HEAD -- src/components/maps/core/IxWorldMap.tsx`
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

Currently, `IxWorldMap.tsx` listens to the map's `"zoom"` event. The `"zoom"` event fires repeatedly (dozens of times per second) during zoom animations and wheel events. On every fire, the handler checks if the zoom bucket has changed, and if so, runs a loop filtering and calling `source.setData` with new GeoJSON features for progressive topography layers (rivers, lakes, etc.). 
- Calling `setData` blocks the browser's main thread with GeoJSON serialization and parsing.
- Doing this mid-animation causes visible stutter and dropped frames.
Changing this to execute on `"zoomend"` removes calculations from the rendering hot-path, making zoom interactions extremely smooth.

## Current state

- [IxWorldMap.tsx](file:///ixwiki/public/projects/ixstats/src/components/maps/core/IxWorldMap.tsx) — Renders the main map view.
- Current zoom listener in `src/components/maps/core/IxWorldMap.tsx` lines 283–300:

```typescript
          // Progressive feature loading based on zoom
          let lastFilterZoom = -1;
          const dataRef = fullLayerDataRef;
          map.on("zoom", () => {
            const zoom = map.getZoom();

            const zoomBucket = Math.floor(zoom);
            if (zoomBucket !== lastFilterZoom) {
              lastFilterZoom = zoomBucket;
              for (const layerType of Object.keys(PROGRESSIVE_THRESHOLDS)) {
                const sourceId = `source-${layerType}`;
                const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
                const fullData = dataRef.current.get(layerType);
                if (!source || !fullData) continue;
                const minArea = getMinArea(layerType, zoom);
                source.setData(filterByArea(fullData, minArea));
              }
            }
          });
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Typecheck | `bun run typecheck:ui`   | exit 0, no errors   |
| Lint      | `bun run lint`           | exit 0              |

## Scope

**In scope**:
- `src/components/maps/core/IxWorldMap.tsx`

**Out of scope**:
- Changes to map layer configurations or Turf styling
- Changes to map themes or projection mode logic

## Git workflow

- Branch: `perf/051-map-zoom`
- Commit message style: `perf(map): optimize progressive filtering by moving to zoomend`

## Steps

### Step 1: Change zoom listener event to zoomend

In [IxWorldMap.tsx](file:///ixwiki/public/projects/ixstats/src/components/maps/core/IxWorldMap.tsx):
1. Locate the map initialization effect where `map.on("zoom", ...)` is bound (around lines 282–300).
2. Change the event name from `"zoom"` to `"zoomend"`.

**Verify**:
- Run `bun run typecheck:ui` and ensure it exits 0.
- Run `bun run lint` and ensure no new lint errors are introduced.

## Done criteria

- [ ] `bun run typecheck:ui` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] Map zoom transitions do not trigger CPU-bound data filtering until the zoom animation is complete.

## STOP conditions

- If `map.on("zoomend")` causes the progressive layers to render incorrectly on initial load, stop and verify `lastFilterZoom` initialization.
- If the `"zoom"` event was relied upon by other child hooks (interactions, measure tool), stop and report.
