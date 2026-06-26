# Topology Engine for the Map Editor

## Context

`docs/maps-1.1.md` is a "Forge Mode" map-editor wishlist that flags a **topology
engine** as the single biggest thing the editor is missing — and the analysis of the
current code agrees. Today the editor has a mature custom geometry engine
(`border-editor.ts`) with vertex move/add/remove, snapping, split/merge, simplify and
undo/redo — but **borders do not cascade**. `findSharedBorders()`
([border-editor.ts:226](src/lib/border-editor.ts#L226)) only *detects* coincident
edges and feeds one-directional snapping. Move a province edge and the neighbor stays
put → gaps, overlaps, slivers. With the planned hierarchy (countries → provinces →
counties → cities), manual border maintenance becomes impossible.

The `SharedVertex` Prisma model exists but is **underused**: it's only built for
top-level country borders (in `editor.ts importPipelineResult`), never for
subdivisions, and nothing consumes it to drive a cascade. `shared-vertex-builder.ts`'s
`moveSharedVertex` is effectively dead code.

**Goal:** when a user edits a vertex/edge that is shared between adjacent features, the
neighbor's coincident edge moves together automatically, with gap/overlap/sliver
prevention on write. This is the foundation everything else hierarchical depends on.

## Approach: derived, session-scoped topology (don't persist)

Compute coincidence **on the fly** from geometry, both client-side (live drag feedback)
and server-side (source of truth). Do **not** maintain a persisted `SharedVertex` index
for subdivisions — `vertexIndex` shifts on every add/remove and `simplifySubdivisions`
rewrites whole rings, so any persisted index goes stale instantly. At ~82 nations with
a handful-to-dozens of provinces each, building an in-memory index per session is
sub-millisecond. Keep the `SharedVertex` table only as an optional country-border-level
hint (Phase 6), never as source of truth.

The cascade engine is a **pure module** (no React, no DB) — same code runs in the
browser for live preview and on the server for the authoritative write, guaranteeing
preview == result. This mirrors how `border-editor.ts` and
`province-importer/topology.ts` are already structured.

### Core data structure (new `src/lib/topology-engine.ts`)

- **Vertex key:** quantize each coord to a snap grid (~1e-5 ≈ 1.1m, well above the
  1e-10 float noise in `coordsEqual` but below true vertex spacing): `vkey(coord)`.
- **Index:** `Map<QuantKey, FeatureVertexLoc[]>` where `FeatureVertexLoc =
  {featureId, ringIndex, vertexIndex}`, plus a `Map<featureId, geometry>` of working
  copies. The country border participates under a synthetic id `__border__` so
  border-coincident edits cascade too. A vertex is *shared* iff its bucket holds 2+
  distinct `featureId`s. This is the O(n) spatial-hash replacement for the O(n²)
  `findSharedBorders` scan.

### Cascade operations

- **Move:** look up the moved vertex's group; apply the **same canonical `to`
  coordinate** to every member via the existing `moveVertex` (handles ring closure).
  Writing the identical `to` to all members — not independently re-snapping each — is
  the key anti-sliver guarantee.
- **Add on shared edge:** insert into the edited feature, then into every neighbor whose
  ring has the same two endpoints consecutive. Must handle **reversed winding**
  (adjacent polygons traverse a shared border in opposite directions) — `reversed` flag
  picks the splice index. This is the most bug-prone case; needs a two-square unit test.
- **Remove on shared edge:** remove from all members; **reject** the whole cascade if it
  would drop any participating ring below 4 points or invalidate it.
- **After every op,** run `sanitizeRegionShape` + `validateGeometry`
  ([border-editor.ts](src/lib/border-editor.ts)) on each changed feature; rebuild the
  affected rings' index entries (vertexIndex shifts on add/remove).

### Prevention on write (reuse, don't rebuild)

Reuse `province-importer/topology.ts` `detectGaps` / `detectOverlaps` /
`autoFillGaps` / `resolveOverlaps` (Turf-based). Validate only the **bbox-affected
neighborhood**, and compare **before vs. after** — reject only *newly introduced*
defects so pre-existing slivers don't block every edit. Auto-fix tiny gaps; throw
`TRPCError BAD_REQUEST` otherwise.

### Group undo/redo

Generalize the per-feature undo to multi-feature group entries:
`{action, before: Map<id,geom>, after: Map<id,geom>}`. One drag = one group entry
(matching today's behavior). Touches the `UndoStack`/`UndoEntry` in
[border-editor.ts:359](src/lib/border-editor.ts#L359) and the `EditorHistory` in
`useMapEditor.ts`. Memory is trivial (≤50 × a few features).

## Critical files

| File | Change |
|------|--------|
| `src/lib/topology-engine.ts` | **NEW** — pure engine: `vkey`, `buildTopologyIndex`, `cascadeMoveVertex/AddVertex/RemoveVertex`, `findConsecutiveEdge` |
| `src/lib/border-editor.ts` | Reuse `moveVertex`/`addVertex`/`removeVertex`/`sanitizeRegionShape`/`validateGeometry`; generalize `UndoStack` to group entries |
| `src/components/maps/editor/hooks/useSubdivisionVertexEdit.ts` | Client live cascade on drag (replaces one-directional snap at lines ~362-369); report the full changed-feature set up to `useMapEditor` |
| `src/server/api/routers/geo/features.ts` | `updateSubdivision` (~line 505): server-authoritative cascade + transactional multi-feature write + validation |
| `src/lib/province-importer/topology.ts` | Reuse gap/overlap/sliver detectors + auto-fix for prevention-on-write |
| `src/hooks/useMapEditor.ts` | Group undo/redo (`EditorHistory`) |
| `src/server/api/routers/geo/editor.ts` | Phase 6 only: same engine in `submitBorderEdit` for country borders |

`shared-vertex-builder.ts` `moveSharedVertex` is dead code — `topology-engine.ts`
supersedes it.

## Incremental rollout (smallest shippable first)

1. **Pure engine + unit tests** — `topology-engine.ts` (`vkey`, index, `cascadeMoveVertex`, `findConsecutiveEdge`) with two-adjacent-square fixtures (move, reversed winding, MultiPolygon). No UI change, zero risk.
2. **Client live cascade — subdivision MOVE only** — wire into `useSubdivisionVertexEdit`; neighbors visibly follow the dragged vertex. Visual-only until save. **Delivers the headline capability.**
3. **Server source-of-truth — subdivision move** — extend `updateSubdivision` to rebuild the index server-side, write all changed subdivisions in one `$transaction`, reject newly-introduced gaps/overlaps.
4. **Group undo/redo** — generalize `EditorHistory` + `UndoStack` to multi-feature.
5. **Add/remove cascade** — wire `cascadeAddVertex`/`cascadeRemoveVertex` into midpoint-add and delete (higher risk: index reshuffle).
6. **Country-border level** — same engine in `submitBorderEdit` using its existing bbox neighbor query; per-country `BorderHistory`; `SharedVertex` table as index hint.
7. *(Note only, don't build)* multi-level hierarchy — engine is level-agnostic (keys on coordinates); extension = feed all levels' rings into one index + containment-aware write order.

## Risks

- **Float matching / slivers:** quantized `vkey` for matching, but write one canonical `to` to all group members — never re-snap independently.
- **Reversed winding** on `addVertex` — dedicated unit test required.
- **MultiPolygon / holes:** use the flat global `ringIndex` from `getAllRings` consistently across index, cascade, and rebuild.
- **Antimeridian:** Euclidean `vkey` breaks at ±180°; detect seam-crossing features and skip cascade in v1 (log warning) — known limitation.
- **Pre-existing defects:** validate deltas (new defects only), not absolute state.
- **Perf:** scope Turf union/gap checks to bbox-affected neighbors; re-index only moved keys during a drag, not full rebuild.

## Verification

- `bun run dev` (port 3000) → `/mycountry/map-editor` (owner) and `/admin/maps` World Editor (god-mode).
- **Move:** drag a vertex on a province edge shared with a neighbor → neighbor's edge follows; no visible gap/overlap opens. Save, reload → persisted for both features.
- **Add/remove:** insert/delete a vertex on a shared edge → neighbor gains/loses the matching vertex; rings stay valid.
- **Prevention:** attempt an edit that would overlap a neighbor → rejected (or tiny gap auto-filled); pre-existing slivers do **not** block unrelated edits.
- **Undo:** Ctrl+Z after a cascaded drag reverts the edited feature *and* all cascaded neighbors in one step.
- Cross-check with `province-importer/topology.ts` `detectGaps`/`detectOverlaps` on the country before/after.
- `bun run lint` for code quality. **Do NOT run global typecheck** (crashes the server); rely on `bun run dev` incremental checking.
