# Plan 045: Shared-Edge Topology Editor

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat de8517e4..HEAD -- src/lib/topology-engine.ts src/lib/border-editor.ts src/components/maps/editor/hooks/useSubdivisionVertexEdit.ts src/hooks/useMapEditor.ts src/server/api/routers/geo/features/subdivisions.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `de8517e4`, 2026-06-29 (refreshed from `b23b953b`)

## Why this matters

Currently, moving a vertex/edge on a subdivision boundary only edits that single feature. The neighbor's adjacent boundary is left unchanged, opening up micro-gaps, overlaps, and sliver polygons. `findSharedBorders()` in `border-editor.ts:227` detects coincident edges but is only used for snapping — never for cascading vertex moves.

Server-side, `alignSubdivisionBorders()` in `src/lib/country-geo/spatial.ts:283` does insert matching vertices into neighbors when saving — but only vertex insertion, not moving matching vertices in sync during drag. The user sees gaps during editing and relies on the save-time alignment to fix them, which doesn't cascade *moves*.

## Current state (verified at `de8517e4`)

### `src/lib/border-editor.ts` (1,524 lines)
- Pure geometry operations. Exports `VertexRef`, `EdgeRef`, `moveVertex`, `addVertex`, `removeVertex`, `findSharedBorders`, `getAllRings`, `getVertices`, `alignSharedVertices`, `snapToNeighborBorders`, `sanitizeRegionShape`, etc.
- `findSharedBorders(geomA, geomB, tolerance)` at line 227: finds coincident edges between two polygons. Returns `{edgeA, edgeB}[]`.
- `moveVertex(geometry, ref, target)`: moves a single vertex in one geometry. Does NOT cascade to neighbors.

### `src/components/maps/editor/hooks/useSubdivisionVertexEdit.ts` (738 lines, `@ts-nocheck`)
- Line 330: `vertexEditRef.current` stores `{ featureId, currentGeometry }` — only the single selected feature.
- Line 394–444: `onMouseMove` drag handler — snaps the target coordinate (to borders, neighbors, guides), then calls `moveVertex()` on the single feature's geometry. No neighbor cascading.
- Line 265–291: `handleSave()` — clips to border, then calls `snapToNeighborBorders()` to snap edges to existing neighbors (cosmetic post-snap, not coordinated move). Calls `onGeometryUpdate(featureId, finalGeo)` for ONE feature.
- Line 42: `onGeometryUpdate?: (featureId: string, geometry: object) => void` — callback accepts one feature.

### `src/hooks/useMapEditor.ts` (4,261 lines, `@ts-nocheck`)
- Line 152: `EditorAction` = `{ type, featureType, featureId, previousData?, newData? }` — tracks ONE feature per undo entry.
- Line 458: `pushAction(action: EditorAction)` — pushes one action to the undo stack.
- Line 476–727: `reverseAction()` / `reapplyAction()` — undo/redo one feature at a time. `reverseAction` for `update` calls the matching mutation with `previousData`.

### `src/server/api/routers/geo/features/subdivisions.ts` (727 lines)
- Line 273: `updateSubdivision` procedure — accepts `{ countryId, subdivisionId, geometry?, ... }`. Updates ONE row. Already calls `alignSubdivisionBorders()` (line 308–314) which inserts vertices into neighbors on the server, but doesn't propagate the vertex *moves* to neighbors — only matching vertex insertion.

## Repo conventions (follow these)

- **Package manager**: `bun` only. Never npm/yarn/pnpm.
- **TypeScript**: Files in scope use `@ts-nocheck` (existing pattern — preserve it, don't fix unrelated type errors).
- **Pure libs in `src/lib/`**: No React, no database. Geometry functions are pure.
- **Hooks in `src/hooks/`**: React hooks with `useCallback`, `useRef` patterns.
- **Lint**: `bun run lint` (pre-existing issues expected, ensure no new errors).
- **Typecheck single file**: `bun run typecheck:file <path>` (NOT global tsc).
- **Prettier**: 2-space indent, semicolons, trailing commas.
- **Unused vars**: Prefix with `_`.

## Commands you will need

| Purpose    | Command                                        | Expected on success |
|------------|-------------------------------------------------|---------------------|
| Lint       | `bun run lint`                                  | exit 0, no errors   |
| Typecheck  | `bun run typecheck:file <file-path>`            | exit 0, no errors   |
| Tests      | `bun run test -- src/lib/topology-engine`       | all tests pass      |

## Scope

**In scope**:
- `src/lib/topology-engine.ts` (NEW)
- `src/lib/__tests__/topology-engine.test.ts` (NEW)
- `src/components/maps/editor/hooks/useSubdivisionVertexEdit.ts`
- `src/hooks/useMapEditor.ts`
- `src/server/api/routers/geo/features/subdivisions.ts`

**Out of scope** (do NOT touch):
- `src/lib/border-editor.ts` — do not modify; import from it.
- `src/components/maps/editor/hooks/useSubdivisionDraw.ts` — polygon drawing is separate.
- Prisma schema / database migrations.
- Any global typecheck or build commands.

## Steps

### Step 1: Create `src/lib/topology-engine.ts`

Create a pure TypeScript module with NO React or database dependencies. Imports only from `geojson` types and `~/lib/border-editor`.

```typescript
import type { Position, Polygon, MultiPolygon } from "geojson";
import { getAllRings } from "~/lib/border-editor";
```

Implement these functions:

#### 1a. `vkey(coord: Position): string`
Quantize a coordinate to 5 decimal places for spatial hashing.
```typescript
export function vkey(coord: Position): string {
  return `${coord[0]!.toFixed(5)},${coord[1]!.toFixed(5)}`;
}
```

#### 1b. `TopologyRef` type and `buildTopologyIndex`
```typescript
export interface TopologyRef {
  featureId: string;
  ringIndex: number;
  vertexIndex: number;
}

export type TopologyIndex = Map<string, TopologyRef[]>;

export function buildTopologyIndex(
  features: Array<{ id: string; geometry: Polygon | MultiPolygon }>
): TopologyIndex {
  const index: TopologyIndex = new Map();
  for (const feat of features) {
    const rings = getAllRings(feat.geometry);
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri]!;
      // Skip the closing vertex (same as first)
      for (let vi = 0; vi < ring.length - 1; vi++) {
        const key = vkey(ring[vi]!);
        if (!index.has(key)) index.set(key, []);
        index.get(key)!.push({ featureId: feat.id, ringIndex: ri, vertexIndex: vi });
      }
    }
  }
  return index;
}
```

#### 1c. `cascadeMoveVertex`
Given a topology index, the id of the feature being dragged, the old coordinate key, and the new target coordinate — return a map of `featureId → updated geometry` for all features that share that vertex.

```typescript
export function cascadeMoveVertex(
  index: TopologyIndex,
  geometries: Map<string, Polygon | MultiPolygon>,
  oldKey: string,
  newCoord: Position
): Map<string, Polygon | MultiPolygon> {
  const refs = index.get(oldKey);
  const updated = new Map<string, Polygon | MultiPolygon>();
  if (!refs || refs.length === 0) return updated;

  for (const ref of refs) {
    const geom = geometries.get(ref.featureId);
    if (!geom) continue;

    // Deep clone to avoid mutation
    const clone: Polygon | MultiPolygon = JSON.parse(JSON.stringify(geom));
    const rings = getAllRings(clone);
    const ring = rings[ref.ringIndex];
    if (!ring || ref.vertexIndex >= ring.length) continue;

    // Move the vertex
    ring[ref.vertexIndex] = [newCoord[0]!, newCoord[1]!];

    // If this is the first or last vertex (ring closure), sync both
    if (ref.vertexIndex === 0) {
      ring[ring.length - 1] = [newCoord[0]!, newCoord[1]!];
    } else if (ref.vertexIndex === ring.length - 2) {
      // The vertex IS the second-to-last, and ring[length-1] should equal ring[0]
      // But ring[0] wasn't touched, so only this case matters if ring is stored open+closed
    }

    updated.set(ref.featureId, clone);
  }

  // Update the topology index: remove old key entries, add new key
  const newKey = vkey(newCoord);
  if (oldKey !== newKey) {
    const movedRefs = index.get(oldKey) || [];
    index.delete(oldKey);
    if (!index.has(newKey)) index.set(newKey, []);
    for (const ref of movedRefs) {
      index.get(newKey)!.push(ref);
    }
  }

  return updated;
}
```

**Verify**: `bun run typecheck:file src/lib/topology-engine.ts` passes with exit 0.

### Step 2: Create tests `src/lib/__tests__/topology-engine.test.ts`

Write tests following the existing pattern in `src/lib/__tests__/territory-brush.test.ts`:

1. **`vkey` quantization** — verify rounding to 5 decimals.
2. **`buildTopologyIndex` basic** — two squares sharing an edge, verify shared vertices appear in the index with refs to both features.
3. **`cascadeMoveVertex`** — move a shared vertex, verify both output geometries have the new coordinate, and the non-shared vertices are unchanged.
4. **`cascadeMoveVertex` ring closure** — verify that moving vertex 0 also updates the closing vertex of the ring.

Use these test fixtures — two adjacent unit squares sharing the edge at x=1:
```typescript
const SQUARE_A: Polygon = {
  type: "Polygon",
  coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]]
};
const SQUARE_B: Polygon = {
  type: "Polygon",
  coordinates: [[[1,0],[2,0],[2,1],[1,1],[1,0]]]
};
```

**Verify**: `bun run test -- src/lib/__tests__/topology-engine.test.ts` — all tests pass.

### Step 3: Integrate client-side live drag cascades into `useSubdivisionVertexEdit.ts`

Modify the hook to cascade vertex moves to adjacent features during drag.

#### 3a. Import the topology engine
At the top of the file (around line 19, after existing imports):
```typescript
import { buildTopologyIndex, cascadeMoveVertex, vkey } from "~/lib/topology-engine";
import type { TopologyIndex } from "~/lib/topology-engine";
```

#### 3b. Add a topology index ref
Inside the hook function (around line 72, after `hoveredVertexRef`):
```typescript
const topologyIndexRef = useRef<TopologyIndex | null>(null);
const neighborGeometriesRef = useRef<Map<string, Polygon | MultiPolygon>>(new Map());
```

#### 3c. Build the topology index when entering vertex edit mode
In the `mode === "edit-subdivision"` branch (around line 313, after `vertexEditRef.current = { ... }`):
```typescript
// Build topology index from all subdivision features for cascade editing
const subdivisionFeatures: Array<{ id: string; geometry: Polygon | MultiPolygon }> = [];
for (const feat of featuresRef.current) {
  if (feat.type === "subdivision" && feat.geometry) {
    subdivisionFeatures.push({
      id: feat.id,
      geometry: (feat.id === selectedFeature.id ? geo : feat.geometry) as Polygon | MultiPolygon,
    });
  }
}
topologyIndexRef.current = buildTopologyIndex(subdivisionFeatures);
neighborGeometriesRef.current = new Map(
  subdivisionFeatures
    .filter(f => f.id !== selectedFeature.id)
    .map(f => [f.id, JSON.parse(JSON.stringify(f.geometry))])
);
```

#### 3d. Cascade moves during drag
In the `onMouseMove` handler (around line 440, after `moveVertex` call), add cascade logic:
```typescript
// After: vertexEditRef.current.currentGeometry = newGeo as Polygon | MultiPolygon;
// Cascade to neighbors via topology index
if (topologyIndexRef.current && draggingRef.current) {
  const oldCoord = draggingRef.current.coord;
  const oldKey = vkey(oldCoord);
  const allGeoms = new Map(neighborGeometriesRef.current);
  allGeoms.set(vertexEditRef.current.featureId, newGeo as Polygon | MultiPolygon);

  const cascaded = cascadeMoveVertex(topologyIndexRef.current, allGeoms, oldKey, target);

  // Update neighbor geometries in our tracking map
  for (const [fid, updatedGeom] of cascaded) {
    if (fid !== vertexEditRef.current.featureId) {
      neighborGeometriesRef.current.set(fid, updatedGeom);
      // Update the neighbor's visual on the map source
      if (onGeometryUpdateRef.current) {
        // We'll handle this via a new multi-feature callback — for now,
        // update the GeoJSON source directly for visual feedback
        const src = map?.getSource("editor-subdivisions") as any;
        if (src) {
          const fc = src._data || src._options?.data;
          if (fc && fc.features) {
            const idx = fc.features.findIndex((f: any) => f.properties?.id === fid);
            if (idx >= 0) {
              fc.features[idx].geometry = updatedGeom;
              src.setData(fc);
            }
          }
        }
      }
    }
  }
  // Update dragging ref coord to new position for next frame
  draggingRef.current.coord = target;
}
```

#### 3e. Clean up on cancel/exit
In `cancelVertexEdit` (around line 293):
```typescript
topologyIndexRef.current = null;
neighborGeometriesRef.current = new Map();
```

#### 3f. Include cascaded neighbor geometries in `handleSave`
In `handleSave` (around line 265), after snapping the primary geometry, also pass cascaded neighbor geometries through the save callback. Modify the function to return the cascaded updates:

After the `onGeometryUpdateRef.current(state.featureId, finalGeo)` call at line 290, add:
```typescript
// Save cascaded neighbor geometries
for (const [fid, geom] of neighborGeometriesRef.current) {
  if (onGeometryUpdateRef.current) {
    onGeometryUpdateRef.current(fid, geom);
  }
}
```

**Verify**: `bun run lint` exits with 0 errors. Visually: dragging a shared boundary vertex should update the neighbor subdivision shape in real time.

### Step 4: Multi-feature undo/redo in `useMapEditor.ts`

#### 4a. Extend `EditorAction` to support batch updates
At line 152, add an optional `batchUpdates` field:
```typescript
interface EditorAction {
  type: "create" | "delete" | "update";
  featureType: FeatureType;
  featureId: string;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  /** For topology-cascaded updates: additional features changed in the same action */
  cascadedUpdates?: Array<{
    featureId: string;
    featureType: FeatureType;
    previousData: Record<string, unknown>;
    newData: Record<string, unknown>;
  }>;
}
```

#### 4b. Handle cascaded updates in `reverseAction`
In `reverseAction` (line 476), after the main switch, add:
```typescript
// Reverse cascaded updates (topology neighbors)
if (action.cascadedUpdates) {
  for (const cu of action.cascadedUpdates) {
    // Same pattern as the main update reversal
    switch (cu.featureType) {
      case "subdivision":
        if (cu.previousData?.geometry) {
          await m.updateSubdivision?.mutateAsync({
            countryId,
            subdivisionId: cu.featureId,
            geometry: cu.previousData.geometry as Record<string, unknown>,
          });
        }
        break;
    }
  }
}
```

#### 4c. Handle cascaded updates in `reapplyAction`
Mirror the same pattern in `reapplyAction` (line 730), applying `cu.newData` instead.

**Verify**: `bun run typecheck:file src/hooks/useMapEditor.ts` passes. Ctrl+Z after dragging a shared boundary vertex should revert both the primary and neighbor subdivisions.

### Step 5: Transactional server writes in `subdivisions.ts`

In `updateSubdivision` (line 273), the existing flow already calls `alignSubdivisionBorders()` which does vertex insertion. For topology cascading, add an optional `cascadedNeighbors` input field:

#### 5a. Extend the input schema
Add to the `.input(z.object({...}))`:
```typescript
cascadedNeighbors: z.array(z.object({
  subdivisionId: z.string(),
  geometry: z.record(z.string(), z.unknown()),
})).optional(),
```

#### 5b. Wrap the update in a transaction when cascadedNeighbors is present
After the primary `ctx.db.subdivision.update(...)` at line 326, add:
```typescript
// Save cascaded neighbor geometries in a transaction
if (input.cascadedNeighbors && input.cascadedNeighbors.length > 0) {
  await ctx.db.$transaction(
    input.cascadedNeighbors.map((neighbor) =>
      ctx.db.subdivision.update({
        where: { id: neighbor.subdivisionId },
        data: { geometry: neighbor.geometry },
      })
    )
  );
}
```

**Verify**: `bun run typecheck:file src/server/api/routers/geo/features/subdivisions.ts` passes.

## Done criteria

- [ ] `src/lib/topology-engine.ts` exists and `bun run typecheck:file src/lib/topology-engine.ts` passes.
- [ ] `bun run test -- src/lib/__tests__/topology-engine.test.ts` — all tests pass.
- [ ] `bun run lint` returns no NEW errors on modified files.
- [ ] Dragging shared borders updates adjacent subdivisions in real-time (visually on the map).
- [ ] Saving updates writes changes for the primary AND cascaded neighbor subdivisions.
- [ ] Ctrl+Z rolls back all modified geometries (primary + cascaded) atomically.

## STOP conditions

- If `getAllRings` returns unexpected shapes from MultiPolygon geometries causing the index to mis-reference vertices, STOP and report the specific geometry shape.
- If updating the MapLibre GeoJSON source directly in step 3d causes rendering glitches or "source not found" errors, STOP and report — the source name `"editor-subdivisions"` may have changed.
- If the `@ts-nocheck` files produce runtime errors from the new code that can't be caught at lint time, STOP and describe the error.

## Git workflow

After all steps pass:
```bash
git add src/lib/topology-engine.ts src/lib/__tests__/topology-engine.test.ts \
  src/components/maps/editor/hooks/useSubdivisionVertexEdit.ts \
  src/hooks/useMapEditor.ts \
  src/server/api/routers/geo/features/subdivisions.ts
git commit -m "feat(maps): shared-edge topology engine — cascade vertex drags to adjacent subdivisions

Plan 045. Adds topology-engine.ts (spatial-hash index + cascadeMoveVertex),
integrates live drag cascading in useSubdivisionVertexEdit, extends undo
stack to support multi-feature atomic revert, and adds cascadedNeighbors
to the updateSubdivision endpoint for transactional server writes."
```

## Maintenance note

- The topology index is rebuilt on each vertex-edit session entry. If subdivision count grows very large (>500), consider caching or only indexing neighbors within a bounding box.
- `alignSubdivisionBorders()` on the server still runs independently — it handles vertex *insertion* (adding new vertices where edges cross). The topology engine handles vertex *move cascading*. They are complementary.
- Future: the territory brush (`useBorderEditor.ts`) could also use this topology index for its `applyBrushTransfer` action.
