# Plan C-1 — Contextual Tool Toolbar

Part of the **Map Editor Improvements** initiative. **Self-contained** — you need no other plan to execute this.

> **STATUS: DONE (core) — executed via advisor `execute`.** Steps 1–3 landed in worktree branch `worktree-agent-a3620fd633780eeb3` @ commit `943854f9` (unmerged; merge is the owner's call). **Step 4 (Geoman region geometry ops) was DESCOPED** — the executor fabricated the Geoman API and left a build-breaking import; it was removed and deferred to a follow-up **C-1b** that must verify the real `@geoman-io/maplibre-geoman-free@0.8.x` API against the installed `.d.ts` first. Owner to run `bun run typecheck:file` on the 3 changed source files + a visual `bun run dev` check (both deferred during execution for server-RAM safety).

**Repo:** `/ixwiki/public/projects/ixstats` · **Branch:** `v2` · **Base commit:** `35274d70`
**Stack:** Next.js 16.2 / React 19 / tRPC / Prisma (Postgres + PostGIS) · `maplibre-gl@5.24` · `@turf/turf@7.3.5`. Package manager: **bun**.

## Conventions (must follow)
- **bun only** (never npm/yarn/pnpm).
- Owner-gated tRPC mutations use `standardMutationCountryOwnerProcedure` (see `src/server/api/routers/countryGeo.ts`).
- **Never** run global `tsc --noEmit` / `bun run typecheck:full` (crashes the server). Use `bun run typecheck:file <path>` and `bun run lint`.
- Match surrounding code style; these editor files start with `// @ts-nocheck` + `"use client"` — keep that.

## Why
This is the highest-leverage, lowest-effort win. A complete Photoshop-style context bar **already exists but is never imported** (`src/components/maps/editor/ToolOptionsBar.tsx`, 385 lines: per-tool config + a selection mode with Duplicate/Delete). The current contextual prompt is a single static line (`src/components/maps/editor/toolbars/MapHintPill.tsx:23-29`). And the context-menu "Duplicate" is a **no-op** (`src/components/maps/editor/components/EditorContextMenuWrapper.tsx:37` just closes the menu) — there is no `duplicateFeature` in `useMapEditor`.

## Files in scope
- `src/components/mycountry/EnhancedMapEditorContent.tsx`
- `src/components/maps/editor/ToolOptionsBar.tsx`
- `src/hooks/useMapEditor.ts`
- `src/components/maps/editor/components/EditorContextMenuWrapper.tsx`
- `src/components/maps/editor/toolbars/MapHintPill.tsx`
- new `src/hooks/useGeomanGeometryOps.ts`
- `package.json` (add Geoman)

## Out of scope (do NOT touch)
- `src/components/maps/editor/hooks/useSubdivisionDraw.ts` and the custom vertex editor — leave the custom drawer working.
- `MapEditorToolbar.tsx` tool list (other than what C-2 adds; not this plan).

## Steps

### 1. Wire `ToolOptionsBar` into the top edit-bar
In `EnhancedMapEditorContent.tsx`, the top bar currently renders only `<MapEditorToolbar .../>` at lines 277-282. Import and render `<ToolOptionsBar .../>` immediately after it (same top bar; it's a 32px slim row designed to sit under the title bar).

Wire its props to the `editor` object (from `useMapEditor`):
- city → `cityType={editor.cityForm.cityType}` / `onCityTypeChange={(t)=>editor.setCityForm(p=>({...p,cityType:t}))}`; `isNationalCapital`/`onCapitalChange` similarly.
- region → `subdivisionType`/`subdivisionLevel` ↔ `editor.subdivisionForm.type`/`.level`.
- POI → `poiCategory` ↔ `editor.poiForm.category`.
- label → `labelFontSize`/`labelColor`/`labelBold` ↔ `editor.mapLabelForm.fontSize`/`.color`/`.fontWeight === "bold"`.
- route → `routeTypes`/`onRouteTypesChange` via a small `useState<string[]>` in the parent.
- selection → `selectedCount={editor.selectedIds.size}`, `onDelete={editor.bulkDeleteSelected}`, `onDuplicate={…step 2}`.

**Verify:** `bun run dev`, open the editor, switch tools (C/R/P/T/S/L) → the bar shows the matching controls; set a control then place a feature → the value persists.

### 2. Implement `duplicateFeature` and wire the dead handler
Add `duplicateFeature(feature)` to `useMapEditor.ts` (it does not exist today). It should: clone the feature's fields; append `" (copy)"` to `name`; offset point `coordinates` by ~`0.05°` (for a region, offset the polygon by its centroid delta); call the existing upsert for the type — `countryGeo.upsertCity` / `upsertPoi` / `upsertSubdivision` / `upsertMapLabel` / `upsertStoryPin`, and `transport.createRoute` for routes; push an undo action via the existing history; return the new feature. Export it from the hook.

Then replace the no-op at `EditorContextMenuWrapper.tsx:37` (`onDuplicate={() => { setContextMenu(null); }}`) with a real call to `editor.duplicateFeature(...)`, and pass `editor.duplicateFeature` (bound to current selection) as `ToolOptionsBar.onDuplicate`.

**Verify:** right-click a city → Duplicate → a `"<name> (copy)"` appears offset and survives reload. Repeat for POI and a region.

### 3. Per-tool action affordances
`ToolOptionsBar` already renders a selection branch (Duplicate/Delete) and per-tool config branches. Add per-tool **action** buttons in the relevant branches:
- city/POI selected → Duplicate, Copy coordinates, Move-to-coords (open a tiny lng/lat input that calls `editor.updatePointCoordinates`).
- region selected → Split / Merge / Rotate / Scale / Smooth / Simplify (wired in step 4).
- route mode → Finish / Undo last waypoint / Reverse (foundation shared with plan C-3; safe to add the buttons here calling existing `editor.finishRoute` etc.).

Keep `MapHintPill` for the one-line hint; the controls now live in the bar.

**Verify:** selecting each feature type shows its action set; Copy coordinates puts `"lat, lng"` on the clipboard.

### 4. Region geometry ops via MapLibre-Geoman (lazy-loaded)
- Add dependency: `@geoman-io/maplibre-geoman-free@^0.8.3` (MIT). Install with `bun add`. **Do not** import it at module top level.
- New hook `src/hooks/useGeomanGeometryOps.ts`. On demand (when the user clicks Split/Merge/Rotate/Scale on a selected subdivision):
  - `const { Geoman } = await import("@geoman-io/maplibre-geoman-free")` and load its CSS (`@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css`).
  - `const gm = new Geoman(map, { settings: { controlsUiEnabledByDefault: false }, controls: { helper: { snapping: { uiEnabled: false, active: true } } } })`; await `map.on("gm:loaded", ...)`; load the selected subdivision's GeoJSON into Geoman so it becomes editable.
  - Enable the requested op: split → `gm.enableMode("edit","split")`; rotate → `gm.enableGlobalRotateMode()`; scale → `gm.enableMode("edit","scale")`; cut → `gm.enableGlobalCutMode()`.
  - Listen via `gm.setGlobalEventsListener(({ name, payload }) => ...)` to capture the resulting geometry/geometries.
  - On commit, **tear Geoman down** (remove its instance/layers) before returning control to the custom editor.
- **Persist using existing mutations — add no new endpoints:**
  - split → `countryGeo.upsertSubdivision` to update the original polygon + a second `upsertSubdivision` to create the new polygon (carry over `type`/`level`/`color`, append `" (split)"` to the name).
  - merge → `@turf/turf` `union` of the two selected polygons → `upsertSubdivision` on one + `geoFeatures.deleteSubdivision` on the other.
  - rotate / scale / cut → `editor.updateSubdivisionGeometry(featureId, geometry)`.
  - smooth → Chaikin (~15 lines) or `@turf` `bezierSpline`; simplify → `@turf` `simplify`. Both then `editor.updateSubdivisionGeometry`.

**Verify:** select a region → Split → cut → two subdivisions persist (reload). Merge two adjacent → one remains. `bun run typecheck:file src/hooks/useGeomanGeometryOps.ts`.

**Escape hatches:**
- Geoman manages its own MapLibre sources/layers. If they collide with the editor's existing layer IDs, **STOP and report** — the fallback is to run Geoman on a dedicated map instance inside a modal rather than the main canvas.
- Geoman is `0.x`: the exact `gm:` event names and payload shapes may differ from public docs. **Verify them against the installed package's TypeScript types**, not from memory. If the event API doesn't expose split results cleanly, STOP and report before improvising.

## Done criteria
- Context bar renders the correct controls per active tool and per selection.
- Duplicate works for all point feature types and for regions (persists across reload).
- Region Split / Merge / Rotate / Scale / Smooth / Simplify all persist correctly.
- Geoman is dynamically imported (confirm it's absent from the initial editor JS chunk).
- `bun run lint` clean on changed files; `bun run typecheck:file` passes on each changed file.

## Test plan
No Jest suite exists for the editor. Add `src/hooks/__tests__/duplicateFeature.test.ts` covering the **pure** clone/offset/name logic (no map needed) — follow any existing `src/lib/*.test.ts` for structure. Geoman and UI wiring are verified manually per the Verify lines.

## Maintenance note
Adding a feature type later = one branch in `ToolOptionsBar` + one case in `duplicateFeature`. Pin Geoman to `0.8.x`; re-check `gm:` event names on any upgrade.
