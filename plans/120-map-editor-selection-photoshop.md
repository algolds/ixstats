# Plan 120: Photoshop-Grade Map Editor Selection

**Status**: Implemented
**Scope**: Map Editor selection precision (`EditorMap.tsx`, `useMapLayers.ts`, `useMapEditor.ts`, `usePointDrag.ts`, `useMapEditorOverlayState.ts`, `LayerPanel.tsx`, `ToolOptionsBar.tsx`)
**Goal**: Predictable, layer-aware selection that feels like Photoshop — nearest-hit wins, click-vs-drag separated, rect marquee + lasso with polygon support, clear selected/hover visuals, locked layers excluded.

---

## 0. Why this exists

Hit-testing is a fixed ±6px bbox with an arbitrary "points-first" stable sort (`EditorMap.tsx:669-683`, `753-767`). Overlapping points, a point near a polygon edge, or a label over a point produce unpredictable winners. There is no drag-vs-click discrimination (a click after panning still selects; `usePointDrag.ts:58` starts a drag on any mousedown). Lasso is points-only, no rectangle marquee exists, locked layers are still selectable, and points have no on-map selection visual.

---

## 1. Phases

### P1. Deterministic distance-based hit-testing (core)
New `src/components/maps/editor/utils/hit-test.ts`:
- Per-layer-type tolerance table: points ±8px, point-labels ±6px, polygons/gaps exact (±2px).
- Two-phase query: point layers via bbox + pixel distance; polygon/gap layers via exact-point containment.
- Ranking: closest point hit ≤2px beats polygon containment; else containment; else closest point within tolerance. Tie-break by layer priority (capital > city > poi > story-pin > map-label).
- Hover and click share the same function. Respect locked layers (P5).

### P2. Click-vs-drag discrimination
- Track mousedown→mouseup screen distance in `EditorMap.tsx` (events at 895-913). >4px = drag.
- `onClickFeature` + empty-space deselect (797-803) bail if the gesture was a drag.
- `usePointDrag`: enter drag state only after >4px movement, not on mousedown.

### P3. Rectangle marquee selection
- Shift+drag in `view` mode draws rubber-band rect (add), Alt = subtract.
- M tool gains Rect/Freehand sub-toggle in `ToolOptionsBar.tsx`; reuses same marquee path.
- Render via existing `editor-lasso` source/layers; drag disables `dragPan`.

### P4. Selection math includes polygons
- `applyLassoSelection` (`useMapEditor.ts:3867`) + marquee resolver share one helper `selectFeaturesInGeometry(geometry, mode)`.
- Points: point-in-polygon/rect. Subdivisions: turf `booleanIntersects`.

### P5. Layer-aware selection — locked layers unselectable
- Plumb `lockedLayers` from LayerPanel through overlay state into hit-testing.
- Not-allowed cursor over locked features; locked layers excluded from interactiveLayers.

### P6. On-map selection visuals
- Split hover/selection: add `editor-subdivisions-selected` layer (distinct stroke).
- Add `editor-points-selected` circle layer (radius bump + halo) driven by feature-state via `geoJSONPatcher.setFeatureState`.
- `selectedFeature.id` + `selectedIds` → setFeatureState; reset stale states.

### P7. Cursor & hover polish
- Centralize cursor resolver (mode effect + mousemove).
- Cache last hovered id; only setFilter/setFeatureState on change.
- Shift+click = add to multi-select, Alt+click = remove (map parity with list).

---

## 2. Files

| File | Change |
|------|--------|
| `src/components/maps/editor/utils/hit-test.ts` | **new** — distance-based hit-test, tolerances, priority |
| `src/components/maps/editor/EditorMap.tsx` | P1/P2/P3/P7 handlers, click-intent tracker, marquee drag, selection-visual filters |
| `src/components/maps/editor/hooks/useMapLayers.ts` | P6 — `editor-subdivisions-selected`, `editor-points-selected` |
| `src/hooks/useMapEditor.ts` | P4 — `selectFeaturesInGeometry` (points contained + polygons intersect), rect selection, mode params |
| `src/components/maps/editor/hooks/usePointDrag.ts` | P2 — 4px drag threshold |
| `src/components/maps/editor/hooks/useMapEditorOverlayState.ts` | P5 — lockedLayers state, handleSelectFeature multi-select |
| `src/components/maps/editor/LayerPanel.tsx` + `MapEditorOverlay.tsx` | P5 — plumb lock → selectable; wire `selectedIds`/`onToggleSelect`/`applyRectSelection`/`lassoTool` |
| `src/components/maps/editor/ToolOptionsBar.tsx` | P3 — Rect/Freehand toggle |

---

## 3. Verification

```bash
bun run typecheck:ui
bun run typecheck:trpc
bun run audit:arch
bun run test -- src/lib/__tests__/country-geo-service.test.ts src/lib/__tests__/geo-validation.test.ts
```

**Status (verified 2026-08-06):**
- `typecheck:ui` — exit 0, **zero errors in touched files** (pre-existing elsewhere: Clerk dual-cluster, `useGeometryWorker`, `realm-map-committer`, `subdivisions.ts:353`, `realms-pipeline`, `intent.ts`, `thinkpages/accounts`).
- `typecheck:trpc` — clean for touched files (hit-test.ts is typechecked here; no new errors).
- `audit:arch` — 12 pre-existing violations unchanged (all in `src/server/api/routers/`; none touched by 120). `hit-test.ts` at 218 lines (new, ceiling 700).
- Geo tests — 2 suites / 17 tests pass.
- `@turf/boolean-intersects` confirmed present in node_modules (named export works).

Manual:
- Hover always matches click; click-on-city-over-region picks the city.
- Drag never selects; pan doesn't deselect.
- Shift+drag marquee (view mode) or Rect tool (lasso-select) selects points + intersecting subdivisions.
- Locked region ignores clicks (not-allowed cursor).
- Selected points show halo; selected regions show distinct stroke.

---

## 4. Changelog / versioning

Per standing instruction: after implementation, decide whether to bump platform `Major.Minor.Patch` or a component capability integer. This is internal UX — likely a **patch** bump unless it ships with feature work.
