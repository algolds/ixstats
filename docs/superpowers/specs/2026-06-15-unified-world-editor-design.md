# Unified World Editor — Design Spec

**Date:** 2026-06-15
**Status:** Approved (brainstorming). Implementation tracked as plans 021, 022, and the
production rewrites of 012 / 015 in `plans/`.

## Problem

The world map editor (`/admin/maps` → editor) has three modes — `view`, `forge`,
`border_edit` — and the capabilities a user needs are scattered across them:

- `view` shows a read-only Country Profile when you click a *claimed political* shape.
- `forge` holds the place-city/region/POI tools (and "does nothing" from the user's
  perspective — the mode is non-obvious and its tools don't feel connected).
- `border_edit` (wired in plan 020) holds border editing.

Symptoms reported:
- Clicking **unclaimed** territory (or non-political shapes) brings up nothing.
- "Forge does nothing."
- No clear path from a shape to its properties + the actions on it ("region access").
- The client lets you place features outside the country bounds, then the save fails
  server-side (containment IS enforced on the server — confusing UX, not a hole).

## Decision (approved)

**Unify the editor into one selection-first surface, the ponytail way: collapse the
UX, reuse the existing capabilities.** Keep the internal state machine
(`useMapEditorOverlayState`) to avoid a risky 2,300-line rewrite, but remove the
mode toggle from the UI. The user clicks a shape and acts; they never switch modes.

## Design

### A. Selection-first (replaces the mode toggle)
Clicking **any** shape — claimed country/region, unclaimed territory, or another
layer's feature — selects it and opens its properties in the panel. Selection works
regardless of internal mode. The `view`/`forge`/`border_edit` toggle is removed from
`EditorHeader`.

### B. Properties panel = the hub
Panel content + contextual actions are driven by the selection:
- **Claimed country/region** → props (name, owner, type, area, neighbors) +
  `[Edit Borders]` + `[Add City] [Add Region] [Add POI]`.
- **Unclaimed territory** → shape props + `[Assign to country ▾]` +
  `[Create new country from shape]` + `[Edit Borders]`.
- **Other-layer shape** → read-only props + `[Edit Borders]`.

`[Edit Borders]` reuses plan 020's `enterBorderEdit` (loads the feature into the
border editor and surfaces its toolbar). `[Add City/Region/POI]` reuse the existing
`useMapEditor` feature-creation tools, now always available from the panel instead of
gated behind "forge".

### C. Unclaimed territory actions
- `[Assign to country]` reuses the existing linkage mutation (`assignMutation` /
  `geoEditor` linkage) already wired in `useMapEditorOverlayState`.
- `[Create new country from shape]` is the **one new server endpoint**: an
  `adminProcedure` that creates a `Country` row and links the selected `MapLayer`
  political feature to it (sets `countryId`, `displayName`), reusing the same linkage
  the assign path uses.

### D. Forge removed
Delete the `forge` mode + its toggle. Its place-feature tools become the always-on
contextual actions in (B). This directly resolves "forge does nothing." Internally,
the `activeEditorMode` union loses `"forge"`; the editor defaults to selection and
enters `border_edit` only via `[Edit Borders]`.

### E. Containment (client UX only — server already enforces)
- Point features (city/POI/label/story-pin): on placement/drag, snap the point inside
  the country border using the existing `clampToGeometry(point, geometry)` from
  `src/lib/border-editor.ts`. The user can't drop a pin outside; it snaps to the edge.
- Region polygons: if a drawn region falls **fully outside** the country, block the
  save with a toast before the server round-trip. (Partially-overlapping regions are
  left to the server's existing `clipAndValidatePolygon`, which clips them.)
- No server change.

### F. Editor settings — snap control
Add a **Snap toggle + tolerance** control to the editor settings popover
(`MapSettingsPopover`). Wire it to the existing snap functions (`snapToLayerFeatures`,
`snapToBorderEdge`) so snapping can be turned off and its distance tuned.

### G. Maps Dynamic Island — admin dashboard link
Add an **admin-gated** "Admin Dashboard" link in the maps Dynamic Island settings /
user-settings area (`MapDynamicIsland`), visible only to admins, linking to `/admin`.

## Scope boundaries (ponytail)
- **Keep** the internal mode state machine; only collapse the UX and remove `forge`.
- The **only** new backend endpoint is "create country from shape." Everything else
  reuses existing mutations (`assign`, feature CRUD, border editor) and helpers
  (`clampToGeometry`).
- No new dependencies.
- Out of scope: rebuilding the procedural/forge generators; multi-feature-type bulk
  selection; redesigning the panel's visual system.

## Components & files (where the work lands)
- `src/components/maps/editor/hooks/useMapEditorOverlayState.ts` — selection model,
  drop `forge`, add `createCountryFromShape` wiring, containment clamp on placement.
- `src/components/maps/editor/MapEditorOverlay.tsx` — remove mode-gated rendering;
  always-available tool rail; selection-driven panel.
- `src/components/maps/editor/components/EditorHeader.tsx` — remove the Forge toggle.
- `src/components/maps/editor/components/PropertiesPanelContent.tsx` — the hub:
  contextual props + actions for claimed/unclaimed/other.
- `src/server/api/routers/geo/editor/linkage.ts` (or `borders.ts`) — new
  `createCountryFromShape` admin mutation.
- `src/components/maps/core/components/MapSettingsPopover.tsx` — snap control.
- `src/components/maps/core/MapDynamicIsland.tsx` — admin dashboard link.

## Testing
- Server: a unit/integration test for `createCountryFromShape` (creates a country,
  links the feature, rejects non-admin).
- Client containment: a pure test that `clampToGeometry` keeps an outside point on the
  border (already exists for the function; add a placement-path assertion if feasible).
- The selection/panel unification is verified by a browser smoke test (the editor is
  `@ts-nocheck` / stateful): click claimed → actions; click unclaimed → assign/create;
  forge toggle gone; placing a pin outside snaps inside.

## Follow-ups (separate plans, not this spec)
- **012** Territory Brush — production build from `docs/design/territory-brush.md`
  (wire `applyBrushStroke` into the unified editor as a brush action).
- **015** Province Generator — production build from
  `docs/design/province-generator.md` (generate → preview → commit subdivisions).
- Both integrate into the unified editor, so they land **after** the unified-editor
  core (plan 021).
