# Plan 048: Smart Terrain Snapping & Border Generator

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat b23b953b..HEAD -- src/components/maps/editor/hooks/useSubdivisionDraw.ts src/components/maps/editor/EditorMap.tsx src/components/maps/editor/ToolOptionsBar.tsx`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `b23b953b`, 2026-06-19

## Why this matters

Subdivisions are often defined by natural geographical boundaries like rivers, lake edges, and ocean coastlines. Plotting these jagged outlines manually vertex-by-vertex is tedious. 

This plan implements real-time path snapping and tracing. Drawing standard boundary segments will snap the mouse cursor to the closest coordinates of natural lines (coastline/river paths). Users can trace along a feature (e.g., clicking node A on a river, then node B further down) and the editor will automatically generate the intermediate coordinates following the natural terrain shape.

## Current state

- `src/components/maps/editor/hooks/useSubdivisionDraw.ts` — Manages drawing coordinates stack when creating new polygons.
- `src/components/maps/editor/EditorMap.tsx` — Handles active MapLibre layers and coordinates projection under the cursor.
- `src/components/maps/editor/ToolOptionsBar.tsx` — Houses tool settings. Currently has a basic snap toggle, but only snaps to standard adjacent vertices, not natural terrain.

## Commands you will need

| Purpose   | Command                                                            | Expected on success |
|-----------|--------------------------------------------------------------------|---------------------|
| Lint      | `bun run lint`                                                     | exit 0, no errors   |
| Typecheck | `bun run typecheck:file <file-path>`                               | exit 0, no errors   |
| Dev Server| `bun run dev`                                                      | starts successfully |

## Scope

**In scope**:
- `src/components/maps/editor/hooks/useSubdivisionDraw.ts`
- `src/components/maps/editor/EditorMap.tsx`
- `src/components/maps/editor/ToolOptionsBar.tsx`

**Out of scope**:
- Altering server-side PostGIS natural features geometries (they are read-only).

## Steps

### Step 1: Client-Side Natural Vertex Search
In `EditorMap.tsx`:
1. Implement a helper function `findNearestNaturalVertex(screenPoint: { x: number, y: number }, map: maplibregl.Map): [number, number] | null`.
2. This helper queries MapLibre vector features inside a 12px bounding box using `map.queryRenderedFeatures` targeting layers: `"rivers-line"`, `"lakes-fill"`, and `"political-coastline"`.
3. Extract the closest vertex coordinate from the features' geometry and return it.

**Verify**: Verify coordinates are logged correctly when clicking near rivers or coastlines.

### Step 2: Snapping in Drawing/Vertex Edit Hooks
In `useSubdivisionDraw.ts` and `useSubdivisionVertexEdit.ts`:
1. Intercept the cursor movement during active draws or vertex drags.
2. If `"snap-terrain"` is active, query the helper. If a natural vertex is within the pixel threshold, override the mouse coordinates with the snapped terrain coordinate.
3. Draw a thin cyan line indicator from the cursor to the snapped vertex to provide visual feedback.

**Verify**: Drag a boundary vertex near a river. Confirm it snaps precisely onto the river path coordinate.

### Step 3: Implement Automated Path Tracing
In `useSubdivisionDraw.ts`:
1. Implement path tracing: when placing a point, check if both the prior point and the current point snap to the *same* natural line feature.
2. If yes, query the geometry coordinates of that line feature between the two clicked endpoints.
3. Inject the intermediate coordinate sequence into the polygon draw stack, generating an organic border matching the terrain shape.

**Verify**: Click two points along a river. Confirm that the boundary curves along the river instead of cutting across as a straight line.

### Step 4: UI Control Toggles
In `ToolOptionsBar.tsx`:
1. Add toggles in the subdivision creation/edit branches:
   - **Snap to Rivers**
   - **Snap to Coastline**
2. Bind these options to the drawing state.

**Verify**: Run `bun run lint` to verify that all code compiles clean of warnings.

## Done criteria

- [ ] `bun run lint` returns no errors on changed files.
- [ ] Borders snap to river/coastline paths dynamically when dragging or drawing.
- [ ] Tracing automatically interpolates intermediate vertices along linear natural features.

## STOP conditions

- If vector tile features do not yield coordinates at high zoom levels, fallback gracefully to a standard coordinate snap and log a warning.
