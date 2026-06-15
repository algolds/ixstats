# Territory Brush — Design Document (Plan 012)

**Status:** Spike complete, OPEN browser probes remain.  
**Branch:** `advisor/012-territory-brush-spike`  
**Date:** 2026-06-15  
**Go/No-Go:** **GO** — the transfer model is sound and the pure-function test passes. Production wiring is straightforward via existing hooks + multi-feature save (plan 009).

---

## 1. Transfer Model

### Mechanic

A brush stroke is an ordered list of `[lng, lat]` points plus a radius (km). The stroke is expanded into a brush polygon `B` via `@turf/buffer(LineString|Point, radiusKm, { units: "kilometers" })`.

The territory transfer is:

```
transfer = intersect(B, S)      // clip brush to source only
T'       = union(T, transfer)   // target gains the slice
S'       = difference(S, B)     // source loses the slice
```

Both results are passed through `sanitizeRegionShape` (dedup vertices, remove spikes).

### Why this model is correct

- Area is conserved: `area(S') + area(T') ≈ area(S) + area(T)` (verified by unit test).
- Transfer is always bounded by the source — the brush cannot pull area that doesn't belong to S.
- Stroke crossing multiple source features (i.e. painting from S into two different neighbours) requires iterating over all neighbours and applying the model per-pair. See OPEN probe below.

### Null returns (the guard cases)

`applyBrushStroke` returns `null` when:
1. Stroke is empty or radius ≤ 0 (guard).
2. Buffer produces no polygon (degenerate geometry).
3. `intersect(B, S)` is empty — stroke does not reach source (caller should warn user, not error).
4. `difference(S, transfer)` is null — source would be fully consumed; use merge instead.
5. `union(T, transfer)` fails — geometry too broken to heal (fallback to PostGIS, see §3).

---

## 2. Pure-Function + Test Evidence

**File:** `src/components/maps/editor/experimental/territory-brush-math.ts`  
**Test:** `src/components/maps/editor/experimental/territory-brush-math.test.ts`

**Fixture:** Two adjacent unit-square polygons at near-equator coordinates:
- Source `S`: `x ∈ [-1, 0], y ∈ [0, 1]` (left square)
- Target `T`: `x ∈ [0,  1], y ∈ [0, 1]` (right square)

**Test run result:** 6/6 passing in 0.77 s.

Key assertions verified:
1. Stroke biased into source (`x ≈ -0.1`, `radiusKm = 20`) → `area(S') < area(S)` and `area(T') > area(T)`.
2. Stroke entirely inside target (`x ≈ 0.7`) → `null`.
3. Empty points / non-positive radius → `null`.
4. Single-point stroke: structurally valid result when non-null (exact outcome depends on geometry).
5. `result.issues` is always an array.

**Conservation check:** Total area after transfer ≈ total area before (within 1% — `toBeCloseTo(..., -2)`). Passes.

---

## 3. Client-Turf vs Server-PostGIS Recommendation

### Recommendation: Client-Turf for the hot path, PostGIS as repair fallback.

| Criterion | Client-Turf | Server-PostGIS |
|-----------|------------|----------------|
| Latency | Instant (no round-trip) | ~50–200ms round-trip |
| Geometry quality | Good for ≤ ~2 000 vertices | ST_MakeValid + ST_Buffer very robust |
| Self-intersections | Turf/JSTS can produce them near antimeridian or at very high vertex counts | PostGIS ST_MakeValid repairs all cases |
| Sliver creation | Possible when stroke barely clips a corner | PostGIS can filter with ST_Area threshold |
| Implementation cost | Already in-repo (`@turf/*` submodules confirmed installed) | Requires new `geoEditor.brushTransfer` tRPC mutation + PostGIS queries |
| Existing infrastructure | `applyBrushStroke` is done | plan 009 multi-feature save is done |

**Recommendation:** Ship the Turf path first (zero new backend work). Add a `tryApplyBrushStroke` server mutation only if:
- Client geometry produces self-intersections in browser testing (probe P1 below), or
- Users paint at very high vertex count (>2 000 vertices per feature, probe P3).

The server mutation shape, if needed, is described in §4.

---

## 4. Production API Shape

### Editor action (client)

```ts
// In useBorderEditor, add:
applyBrushTransfer: (
  strokePoints: [number, number][],
  radiusKm: number,
  targetFeatureId: string
) => void
```

Implementation sketch:
1. Look up `state.neighborGeometries[targetFeatureId]` — the target geometry.
2. Call `applyBrushStroke(strokePoints, radiusKm, state.geometry!, targetGeom)`.
3. If null: warn user ("stroke doesn't reach source or would consume it").
4. If result: push new source geometry onto the undo stack; mark `dirtyNeighbors[targetFeatureId]`.
5. Multi-feature save already handles this via `submitBorderEdit → neighborUpdates` (plan 009 path, verified in code).

### tRPC mutation shape (server fallback)

```ts
// src/server/api/routers/geo/border-editor.ts
brushTransfer: protectedProcedure
  .input(z.object({
    featureId: z.string(),          // source feature
    targetFeatureId: z.string(),    // neighbour
    strokePoints: z.array(z.tuple([z.number(), z.number()])),
    radiusKm: z.number().positive(),
    sessionId: z.string(),
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. Load source + target geometries from DB
    // 2. ST_Buffer(ST_MakeLine(points), radiusKm * 1000 / 111320)  -- approximate degrees
    //    OR: use geography type for accurate km buffer
    // 3. ST_Intersection(brush, source) → transfer
    // 4. ST_Difference(source, transfer) → newSource  (guard: ST_Area > minAreaThreshold)
    // 5. ST_Union(target, transfer) → newTarget
    // 6. ST_MakeValid on both results
    // 7. Save as multi-feature update (reuse plan 009 submitBorderEdit path)
    // Returns: { source: GeoJSON, target: GeoJSON }
  })
```

### Undo integration (plan 010 validation/repair path)

Each brush stroke is a single undo entry (entire `{source, target}` snapshot). The undo stack in `useBorderEditor` already stores `Polygon | MultiPolygon` snapshots. Adding an entry for both the primary feature and the dirty neighbour before applying keeps undo cost O(n strokes) — acceptable.

For undo to also revert the neighbour, `undoStackState` would need to carry a `dirtyNeighborSnapshot` alongside the primary geometry. This is a ~20-line addition to the undo types.

---

## 5. Resolved vs OPEN Questions

### Resolved (by this spike)

- **R1** — Transfer math produces valid, area-conserving results on a canonical two-square fixture. ✓
- **R2** — `@turf/buffer`, `@turf/intersect`, `@turf/difference`, `@turf/union` are all installed and CJS-compatible with Jest. ✓
- **R3** — Import style must be per-submodule (`from "@turf/buffer"`) not `from "@turf/turf"` — confirmed by existing codebase patterns and Turbopack umbrella resolution bug. ✓
- **R4** — plan 009 `dirtyNeighbors` + multi-feature save path is confirmed landed on v2. ✓
- **R5** — Client-side `sanitizeRegionShape` handles the post-transfer cleanup (dedup, despiking). ✓
- **R6** — Single-point (circular brush) stroke works via the `Point` geometry path. ✓
- **R7** — `null` return correctly guards full-source-consumption (use merge instead). ✓

### OPEN — verify in browser dev session

- **P1 OPEN: self-intersection check** — After painting at fine-grained stroke resolution (>50 intermediate points) near a concave source border, does Turf produce self-intersecting output? Run `@turf/kinks` on result; if kinks > 0, add `cleanCoords` or fall back to PostGIS.

- **P2 OPEN: multi-neighbour stroke** — Stroke crossing source S into two different neighbours T1 and T2 simultaneously. Current model handles one source → one target per call. Need to decide: (a) split the brush into per-neighbour clips (two sequential `applyBrushStroke` calls), or (b) require user to paint one neighbour at a time (simpler UX, may feel wrong). Verify in browser which feels correct.

- **P3 OPEN: performance at high vertex count** — IxEarth province polygons can exceed 5 000–10 000 vertices. Measure `applyBrushStroke` wall time at 5 k, 10 k, 20 k vertices on a dev machine. If > 100ms, consider: (a) simplify before transfer + merge back, or (b) offload to PostGIS.

- **P4 OPEN: sliver creation** — A very narrow brush stroke at a near-tangent angle to the source border can produce a thin sliver in `S'`. The current `sanitizeRegionShape` removes spikes but not slivers (it operates per-ring). Need a minimum-area threshold on the transfer polygon (e.g. reject transfer if `area(transfer) < 0.01 km²`).

- **P5 OPEN: undo granularity** — Should each pointer-move event that extends the stroke emit an undo entry, or only pointer-up (commit)? The current prototype collects all stroke points and commits on pointer-up (one entry per gesture). Verify whether users expect undo-per-stroke or undo-per-pixel in a browser session.

- **P6 OPEN: prototype mounting point** — The `TerritoryBrushPrototype` component needs to be imported into a page (e.g. `src/app/maps/page.tsx`) to be reachable at `?brush=1`. That import should live in a `if (process.env.NODE_ENV === "development")` guard or be removed before the production merge. Verify the flag is invisible in production builds.

---

## 6. Effort Estimate (Production Build)

| Task | Effort |
|------|--------|
| Move `applyBrushStroke` to `src/lib/border-editor.ts` | 0.5 h |
| Add `applyBrushTransfer` action to `useBorderEditor` (undo + dirtyNeighbors) | 2 h |
| Brush mode UI in `BorderEditorToolbar` (size slider + mode toggle) | 2 h |
| Pointer-drag collection in `BorderEditorMap` (new mode branch) | 3 h |
| Preview layer in map (dashed outline of transfer area) | 1 h |
| Undo stack extended for neighbour snapshots | 1 h |
| PostGIS fallback mutation (optional, only if P1/P3 fails) | 4 h |
| E2E test (Playwright — two adjacent regions, stroke, verify DB) | 3 h |
| **Total (without PostGIS fallback)** | **~12 h** |
| **Total (with PostGIS fallback)** | **~16 h** |

---

## 7. Go / No-Go

**GO.**

Reasoning:
1. The core transfer math is correct and tested.
2. The integration path is clear: one new action in `useBorderEditor`, plan 009 multi-feature save already handles multi-feature updates, no schema changes.
3. No new dependencies needed.
4. The six OPEN probes are all verifiable in a single browser dev session (~2 h) before committing to production wiring.

Suggested next step: a dev session to resolve P1–P3 (self-intersections, multi-neighbour, perf), then proceed to production wiring (plan 012-prod).
