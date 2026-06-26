# Plan 045: Shared-Edge Topology Editor

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat b23b953b..HEAD -- src/lib/border-editor.ts src/components/maps/editor/hooks/useSubdivisionVertexEdit.ts src/hooks/useMapEditor.ts src/server/api/routers/geo/features/subdivisions.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `b23b953b`, 2026-06-19

## Why this matters

Currently, moving a vertex/edge on a subdivision boundary only edits that single feature. The neighbor's adjacent boundary is left unchanged, opening up micro-gaps, overlaps, and sliver polygons (the "Pescorto-style" defects mentioned in `maps.md`). 

By implementing a client-side hybrid topology engine, adjacent boundaries are matched dynamically at runtime. Dragging a shared boundary vertex will cascade the edit to both matching polygons simultaneously in-memory, keeping them aligned. The edits are then saved transactionally in a single PostGIS/Prisma operation with neighbor boundary conformance checks.

## Current state

- `src/lib/border-editor.ts` — Contains core geometry helper functions. `findSharedBorders()` detects coincident edges, but is only used for snapping, not cascading updates.
- `src/components/maps/editor/hooks/useSubdivisionVertexEdit.ts` — Controls client-side vertex editing interaction on drag.
- `src/hooks/useMapEditor.ts` — State hook managing feature updates and the undo/redo stack.
- `src/server/api/routers/geo/features/subdivisions.ts` — Houses `updateSubdivision` endpoint which writes to the database.

## Commands you will need

| Purpose   | Command                                                            | Expected on success |
|-----------|--------------------------------------------------------------------|---------------------|
| Lint      | `bun run lint`                                                     | exit 0, no errors   |
| Typecheck | `bun run typecheck:file <file-path>`                               | exit 0, no errors   |
| Dev Server| `bun run dev`                                                      | starts successfully |

## Scope

**In scope**:
- `src/lib/topology-engine.ts` (NEW)
- `src/components/maps/editor/hooks/useSubdivisionVertexEdit.ts`
- `src/hooks/useMapEditor.ts`
- `src/server/api/routers/geo/features/subdivisions.ts`

**Out of scope**:
- Database schema changes (do NOT alter Prisma models for subdivisions).
- `src/components/maps/editor/hooks/useSubdivisionDraw.ts` (keep custom polygon drawing separate).

## Steps

### Step 1: Create `src/lib/topology-engine.ts`
Create a pure JavaScript module `topology-engine.ts` implementing client-side topological index mapping:
1. **Coordinate Quantization (`vkey`)**: Formulate a function `vkey(coord: [number, number]): string` returning a snap-grid key rounded to 5 decimal places (e.g. `"${lng.toFixed(5)},${lat.toFixed(5)}"`).
2. **Topology Indexing (`buildTopologyIndex`)**: Map every vertex coordinate in all subdivisions into a spatial-hash bucket: `Map<string, {featureId: string, ringIndex: number, vertexIndex: number}[]>`.
3. **Cascade Updates (`cascadeMoveVertex`)**: When a coordinate at `vkey` is moved, locate all matching references in the index and update their geometries to the exact same target coordinates.
4. **Winding Order Snapping (`findConsecutiveEdge`)**: Find shared segments and adjust winding order coordinates when adding or removing vertices.

**Verify**: `bun run typecheck:file src/lib/topology-engine.ts` passes.

### Step 2: Implement Client-Side Live Drag Cascades
In `useSubdivisionVertexEdit.ts`:
1. On start of drag, index the coordinates using `buildTopologyIndex`.
2. In the dragging move event handler (around line 360), query the spatial hash. If the vertex being dragged is shared with adjacent subdivisions, update the geometries of all participating features in the state simultaneously.
3. Verify that the matching neighbor edge follows the cursor in-sync, leaving no gaps or overlaps.

**Verify**: Run `bun run lint` and verify files are compile-safe.

### Step 3: Transactional Server-Authoritative Writes
In `src/server/api/routers/geo/features/subdivisions.ts` under the `updateSubdivision` procedure:
1. Extract neighbors that share boundary segments with the updated subdivision.
2. In a single Prisma database transactional operation (`ctx.db.$transaction`), save the updated geometries of the edited subdivision and all cascaded neighbor subdivisions.
3. Validate post-conditions using Turf.js `difference` / `intersect` checks. If a new overlap or gap exceeds a threshold, roll back the transaction and throw a `BAD_REQUEST` error.

**Verify**: `bun run typecheck:file src/server/api/routers/geo/features/subdivisions.ts` passes.

### Step 4: Multi-Feature Undo/Redo history
In `useMapEditor.ts`:
1. Modify `pushAction` and the undo stack (`EditorHistory` state) to accept multiple features in a single undo entry, allowing cascaded changes to be reverted atomically in one step.

**Verify**: Select a shared boundary vertex, drag it, save, and hit Ctrl+Z. Verify both regions revert to their original shape simultaneously.

## Done criteria

- [ ] `bun run lint` returns no errors on modified files.
- [ ] Dragging shared borders updates adjacent subdivisions in real-time.
- [ ] Saving updates writes changes transactionally to PostgreSQL.
- [ ] Reverting with Ctrl+Z rolls back all modified geometries atomically.

## STOP conditions

- If the winding order check on complex MultiPolygons fails or produces invalid self-intersecting loops, stop and report back.
- If spatial database constraints throw PostGIS topology errors during clipping, stop and consult on the tolerance bounds.
