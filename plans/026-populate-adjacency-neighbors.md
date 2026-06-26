# Plan 026: Populate adjacency neighbors — run `rebuildAdjacency`

## Status
- **Priority**: P2
- **Effort**: S (one admin command)
- **Risk**: LOW (read-only on existing data, single idempotent write)
- **Depends on**: — (independent; needs production server access)
- **Category**: correctness (data)
- **Planned at**: commit `daecb2ed`, 2026-06-15

## Why this matters

Plan 011 added a `neighbors` column to `MapLayer` and the `rebuildAdjacency` admin procedure. The column is live on the production DB but **empty** — the procedure has never been run. Without neighbors, the territory brush's `neighborGeometries` lookup (`useBorderEditor`) has no data, and neighbor-aware snapping is disabled.

## Current state

- `src/server/api/routers/geo/editor/borders.ts:481` — `rebuildAdjacency` mutation: computes intersecting political features via PostGIS `ST_Intersects`, deduplicates bidirectional pairs, writes `neighbors: [featureId, ...]` to each `MapLayer`.
- Requires PostGIS (`isPostGISAvailable` guard).
- Input: `{ worldId: string }` (defaults to `"default"`).

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Tests | `bun run test` | 604/604 |

## Steps

1. **Deploy to production** (if `daecb2ed` or later is not on prod): `scripts/deploy-production.sh`
2. **Run the procedure**: via tRPC playground or admin panel: `api.geoEditor.rebuildAdjacency({ worldId: "default" })`
3. **Verify**: query `SELECT COUNT(*) FROM map_layers WHERE "layerType" = 'political' AND neighbors IS NOT NULL AND array_length(neighbors, 1) > 0` — should return a positive count.
4. **Verify territory brush**: open the border editor on any country, confirm `neighborGeometries` populates in `useBorderEditor` state.

## Done criteria

- [ ] `rebuildAdjacency` executes successfully (returns `{ features: N, pairs: M }` with N > 0).
- [ ] Neighbor data is queryable via `SELECT`.
- [ ] No regressions: 604/604 tests.

## STOP conditions

- PostGIS unavailable on the target server — run `SELECT PostGIS_Version()` to confirm.

## Maintenance notes

- Rerun after bulk geometry edits (split/merge) if neighbor relationships change. Could be added as a post-save hook in the future.
