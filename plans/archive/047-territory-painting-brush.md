# Plan 047: Territory Painting Brush Tool

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat b23b953b..HEAD -- src/hooks/useMapEditor.ts src/components/maps/editor/EditorMap.tsx src/components/maps/editor/ToolOptionsBar.tsx`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/045-map-topology-engine.md
- **Category**: direction
- **Planned at**: commit `b23b953b`, 2026-06-19

## Why this matters

Administering subdivisions currently requires clicking individual regions, entering forms, or manually dragging vertices to transfer borders. A Territory Painting Brush allows CK3-style map-mode editing: clicking and dragging a brush across region boundaries to "absorb" territory from a losing province into a gaining province in real-time.

Under the hood, the brush uses Turf.js buffer computations to carve out boundary curves dynamically and relies on the Plan 045 topology engine to keep coincident vertices conformance-aligned without producing overlapping geometries or micro-gaps.

## Current state

- `src/hooks/useMapEditor.ts` — Manages editing modes and features list. Holds subdivision color/type/level configuration form states.
- `src/components/maps/editor/EditorMap.tsx` — MapLibre event controller. Renders layers, tracks clicks, and handles vertex drags.
- `src/components/maps/editor/ToolOptionsBar.tsx` — Handles active options. Paint bucket (G) is already wired, but is click-only (does not support mouse dragging brushes).

## Commands you will need

| Purpose   | Command                                                            | Expected on success |
|-----------|--------------------------------------------------------------------|---------------------|
| Lint      | `bun run lint`                                                     | exit 0, no errors   |
| Typecheck | `bun run typecheck:file <file-path>`                               | exit 0, no errors   |
| Dev Server| `bun run dev`                                                      | starts successfully |

## Scope

**In scope**:
- `src/hooks/useMapEditor.ts`
- `src/components/maps/editor/EditorMap.tsx`
- `src/components/maps/editor/ToolOptionsBar.tsx`

**Out of scope**:
- Direct adjustments to global country borders (the brush only paints borders between internal subdivisions).

## Steps

### Step 1: Add Brush Mode state
In `useMapEditor.ts`:
1. Add `"brush-paint"` to the `EditorMode` type.
2. Define states: `brushRadius` (number, default `15` km) and `activePaintingSubdivisionId` (string | null).
3. Expose a callback `applyTerritoryPaint(coords: [number, number], radiusKm: number, targetSubdivisionId: string)`.

**Verify**: `bun run typecheck:file src/hooks/useMapEditor.ts` passes.

### Step 2: Implement Turf.js Buffer Clipping
In `useMapEditor.ts` inside `applyTerritoryPaint`:
1. Use `@turf/buffer` to generate a circular polygon buffer around the cursor coordinates `coords` with a radius of `radiusKm`.
2. Locate the subdivision under the cursor (the "losing" subdivision) and the `activePaintingSubdivisionId` (the "gaining" subdivision).
3. Calculate the new geometries:
   - Losing subdivision: `turf.difference(losingGeometry, brushBuffer)`.
   - Gaining subdivision: `turf.union(gainingGeometry, brushBuffer)`.
4. Apply the Plan 045 topology cascade to rebuild shared boundary coordinates.
5. Optimistically update local query caches before triggering transactional mutations to ensure 60fps rendering feedback.

**Verify**: Verify helper math behaves correctly in local tests.

### Step 3: Map Interaction & Cursor Ring
In `EditorMap.tsx`:
1. Add a visual circular cursor overlay (`editor-brush-ring`) that dynamically resizes to match `brushRadius` in kilometers on the map when `mode === "brush-paint"`.
2. Implement mouse handlers:
   - `mousedown`: Set dragging flag, record start subdivision, call `applyTerritoryPaint`.
   - `mousemove`: If dragging, update the brush circle position, track coordinates, and trigger `applyTerritoryPaint` along the mouse path.
   - `mouseup`: Clear drag flags and save changes.

**Verify**: Open `/mycountry/map-editor`, select the Brush tool. Verify a circle follows the mouse cursor, and dragging carves borders.

### Step 4: Configure Toolbar Controls
In `ToolOptionsBar.tsx`:
1. Render custom options for `"brush-paint"` mode:
   - A **Brush Size** slider (5km to 100km).
   - A selection dropdown to choose the active "gaining" subdivision.
   - Snapping options (snap to rivers/coastlines while painting).

**Verify**: Run `bun run lint` to confirm code style validation passes.

## Done criteria

- [ ] `bun run lint` returns no errors on changed files.
- [ ] Brushing across boundaries transfers territory cleanly in real-time.
- [ ] No overlapping geometry fragments or detached islands are left behind.
- [ ] Persistence transaction successfully updates subdivision boundaries in PostgreSQL.

## STOP conditions

- If Turf difference calculations return empty geometries (e.g. the user erased a subdivision completely), STOP and report back. The system must prevent erasing subdivisions to 0 area.
