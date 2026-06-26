# Plan 030: Province generator preview → commit UX

## Status
- **Priority**: P3
- **Effort**: M (~4h UI + 2h browser probes)
- **Risk**: MED (bulk-creates subdivisions; gate behind preview/commit)
- **Depends on**: 015 (DONE — server mutation), 024 (DONE — editor surface)
- **Category**: direction (feature)
- **Planned at**: commit `daecb2ed`, 2026-06-15

## Why this matters

`commitGeneratedSubdivisions` server mutation exists (`daecb2ed`) but is dead code without a client UI. The spike's `ProvinceGeneratorPreview` component was deleted after Plan 015. A generate→preview→keep/discard flow is needed so users can auto-subdivide a country into N provinces, see the result on the map, and commit or discard.

## Current state

- `src/lib/province-generator.ts` — `generateProvinces(country, count, opts?)` → `(Polygon | MultiPolygon)[]`. 16/16 tests, deterministic by seed. Pure client-side Turf math.
- `src/server/api/routers/geo/features/subdivisions.ts` — `commitGeneratedSubdivisions({ countryId, count, seed?, names? })` mutation. Clips cells via `clipAndValidatePolygon` (PostGIS), creates `Subdivision` rows with `status: "approved"`.
- `src/components/maps/editor/experimental/ProvinceGeneratorPreview.tsx` — DELETED. Was a spike prototype rendering generated cells on a map.
- `docs/design/province-generator.md` — commitment API + OPEN probes (islands, concave borders, perf at count=50).

## Scope

**In scope:**
- New component `ProvinceGeneratorPanel.tsx` in `src/components/maps/editor/components/` — generate button, count slider (2–50), seed input (optional), names input (optional).
- Preview: render generated cells on the editor map as a semi-transparent overlay layer (reuse `EditorMap`'s layer system).
- Commit/Discard buttons after generation.
- Wire into `MapEditorOverlay` as a "Generate subdivisions" contextual action on selected claimed countries.

**Out of scope:**
- Population-weighted seeding (equal-area first — design doc follow-up).
- Post-processing after commit (e.g., rebuilding adjacency, terrain profile).

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Tests | `bun run test` | 604/604 |
| Lint | `bun run lint` | 0 errors |
| Typecheck UI | `bun run typecheck:file <path>` | exit 0 |

## Steps

### 1. Create `ProvinceGeneratorPanel.tsx`
- Accept props: `countryGeometry` (Polygon | MultiPolygon), `countryId`, `onCommit(count, seed, names)`, `onClose`.
- UI: count slider (2–50, default 10), seed input (number, default 42), names textarea (optional, one per line).
- "Generate" button: calls `generateProvinces(countryGeometry, count, { seed })` and draws cells on the map as a preview layer.
- "Commit" button: calls `api.geoFeatures.commitGeneratedSubdivisions.mutateAsync(...)`.
- "Discard" button: clears preview and resets form.
- **Verify:** `bun run typecheck:file src/components/maps/editor/components/ProvinceGeneratorPanel.tsx` → exit 0.

### 2. Add preview layer rendering
- Use the `EditorMap` ref or a temporary MapLibre source to render generated cells as a semi-transparent fill layer.
- Each cell gets a distinct pastel color (hash from index).
- Clean up the preview layer on discard/close.
- **Verify:** `bun run lint` → 0 errors.

### 3. Wire into the editor as a contextual action
- In `PropertiesPanelContent`, when a claimed country is selected in world mode, add a "Generate subdivisions…" button in the action buttons section.
- The button opens `ProvinceGeneratorPanel` (modal or slide-in panel).
- **Verify:** button renders for claimed countries only.

### 4. Browser smoke test (OPEN probes from design doc)
- Generate 10 subdivisions on a test country — verify cells cover the country without gaps.
- Test with concave borders — verify clipping works (no out-of-bounds cells).
- Test at count=50 — verify performance and that all cells are clipped.
- Test with islands (MultiPolygon) — verify generator handles multi-polygon countries.

## Done criteria

- [ ] "Generate subdivisions…" button appears for claimed countries in world editor.
- [ ] Count slider + seed input produce preview cells on the map.
- [ ] Commit creates Subdivision rows; discard clears preview.
- [ ] Preview layer is removed after close.
- [ ] 604/604 tests. 0 new lint errors.
- [ ] `plans/README.md` row updated.

## STOP conditions

- `generateProvinces` returns empty array for a valid country — check the country geometry.
- `commitGeneratedSubdivisions` fails with server error — check PostGIS availability.
- Cells consistently fail to clip on concave borders — add the PostGIS repair path described in `docs/design/province-generator.md`.

## Maintenance notes

- Population-weighted seeding (read city/CountryGeoProfile data) is the next step.
- After commit, run `rebuildAdjacency` (Plan 026) to populate new subdivision neighbors.
