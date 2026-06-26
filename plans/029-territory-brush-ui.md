# Plan 029: Territory brush UI — pointer-drag tool in border editor

## Status
- **Priority**: P3
- **Effort**: M (~3h UI wiring + 2h browser probes)
- **Risk**: MED (geometry edits via brush; flag-gate until browser-verified)
- **Depends on**: 012 (DONE — math + hook action), 024 (DONE — editor surface)
- **Category**: direction (feature)
- **Planned at**: commit `daecb2ed`, 2026-06-15

## Why this matters

Plan 012 promoted `applyBrushStroke` to a permanent library and added `applyBrushTransfer` to `useBorderEditor`. But there is no UI to use it — no brush mode button, no pointer-drag collection, no preview. The `docs/design/territory-brush.md` design doc has 6 OPEN probes that need browser resolution before this feature can be marked complete.

## Current state

- `src/lib/territory-brush.ts` — `applyBrushStroke(strokePoints, radiusKm, source, target)` → `BrushStrokeResult | null` (6/6 tests).
- `src/hooks/useBorderEditor.ts` — `BorderEditorActions.applyBrushTransfer(strokePoints, radiusKm, targetFeatureId)` → `boolean`. Updates `state.geometry`, `state.dirtyNeighbors`, pushes undo, marks dirty.
- `src/components/maps/editor/BorderEditorToolbar.tsx` — no brush mode (modes: select, vertex_edit, split, merge, trace).
- `src/components/maps/editor/BorderEditorMap.tsx` — no brush pointer-drag handling.
- `docs/design/territory-brush.md` §5 — 6 OPEN probes: self-intersections, multi-neighbor, perf, slivers, undo granularity, mounting point.

## Scope

**In scope:**
- `BorderEditorToolbar.tsx` — add `"brush"` mode to the `MODES` array with a Paintbrush icon.
- `BorderEditorMap.tsx` — add brush pointer-drag: `mousedown` starts stroke collection, `mousemove` appends stroke points, `mouseup` commits via `applyBrushTransfer`.
- `BorderEditorPanel.tsx` — show neighbors list with click-to-select target when brush mode is active.
- Brush size slider/input (radius km) in the toolbar or panel.

**Out of scope:**
- PostGIS fallback mutation (only if OPEN probes fail — see design doc §4).
- Multi-neighbor strokes (v1 = one target at a time per design doc).
- Preview layer (dashed outline of transfer area) — nice-to-have, deferred.

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Tests | `bun run test` | 604/604 |
| Lint | `bun run lint` | 0 errors |
| Typecheck UI | `bun run typecheck:file <path>` | exit 0 |

## Steps

### 1. Add brush mode to `BorderEditorToolbar`
- Import a paintbrush icon (e.g., `Paintbrush` from `lucide-react`).
- Add `{ id: "brush", label: "Brush", icon: <Paintbrush />, tip: "Paint territory into a neighbor" }` to the `MODES` array.
- **Verify:** `bun run typecheck:file src/components/maps/editor/BorderEditorToolbar.tsx` → exit 0.

### 2. Add brush-size control
- When `mode === "brush"`, show a slider or number input for `radiusKm` (default 20, range 1–200) below the mode buttons.
- Store `brushRadius` in local state.
- **Verify:** toolbar renders without error.

### 3. Add neighbor target selector in `BorderEditorPanel`
- When `mode === "brush"`, show the neighbors list as clickable target buttons. Highlight the selected target.
- Pass `selectedBrushTarget` (featureId) and `onSelectBrushTarget` to the panel.
- **Verify:** neighbors list appears when brush mode is active.

### 4. Wire brush pointer-drag in `BorderEditorMap`
- In brush mode: `mousedown` → clear stroke, set `isBrushing = true`, store first point.
- `mousemove` while brushing → append point to stroke array.
- `mouseup` → if stroke has ≥ 1 point and a target is selected, call `borderActions.applyBrushTransfer(strokePoints, brushRadius, targetFeatureId)`. Show result (success or warn if stroke doesn't overlap).
- **Verify:** `bun run lint` → 0 errors.

### 5. Browser smoke test (OPEN probes from design doc)
- **P1:** Draw a brush stroke at fine resolution near a concave border. Check for self-intersections in browser console.
- **P2:** Try painting into multiple neighbors — confirm v1 behavior (one target at a time) feels correct.
- **P3:** Time `applyBrushStroke` on a country with >5,000 vertices.
- **P4:** Draw a very narrow stroke barely clipping a corner — check if slivers appear.
- **P5:** Confirm undo-per-stroke (commit on mouseup) feels correct.

## Done criteria

- [ ] Brush mode visible in toolbar with Paintbrush icon.
- [ ] Brush-size slider controls radius km.
- [ ] Neighbors show as clickable targets when brush mode is active.
- [ ] Pointer-drag collects stroke points; mouseup commits via `applyBrushTransfer`.
- [ ] 604/604 tests. 0 new lint errors.
- [ ] `plans/README.md` row updated.

## STOP conditions

- `applyBrushTransfer` returns false for a valid stroke — check the geometry.
- Self-intersections consistently appear (P1 fails) — implement PostGIS fallback or Turf cleanCoords.
- Performance > 100ms at high vertex counts (P3 fails) — add simplify-before-transfer.

## Maintenance notes

- The brush mode shares the `border-editor` surface with split/merge/trace. Ensure mode transitions clear brush state.
- Multi-neighbor strokes (P2) should be revisited after v1 ships.
