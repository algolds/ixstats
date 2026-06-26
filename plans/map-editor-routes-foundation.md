# Plan C-3 — Routes Foundation

Part of the **Map Editor Improvements** initiative. **Self-contained** — you need no other plan to execute this (step 3 is nicer after plan C-1's `ToolOptionsBar` wiring, but works standalone).

**Repo:** `/ixwiki/public/projects/ixstats` · **Branch:** `v2` · **Base commit:** `35274d70`
**Stack:** Next.js 16.2 / React 19 / tRPC / Prisma (Postgres + PostGIS) · `maplibre-gl@5.24` · `@turf/turf@7.3.5`. Package manager: **bun**.

## Conventions (must follow)
- **bun only.**
- Owner-gated mutations use `standardMutationCountryOwnerProcedure` (transport mutations live in `src/server/api/routers/transport/routeMutations.ts`).
- **Never** run global `tsc`/`typecheck:full`. Use `bun run typecheck:file <path>` and `bun run lint`.

## Why
The routes foundation is solid (model `TransportRoute` at `prisma/schema/maps.prisma:563`; great-circle geometry in `src/lib/route-geometry.ts`; CRUD + generate in `src/server/api/routers/transport/`; economic modifiers via `syncTransportEconomicModifiers`). The user wants routes developed further but **the foundation right first**. So this plan fixes correctness and consolidates, and **explicitly defers** richness. Keep it the smallest of the three plans.

## Files in scope
- `src/lib/transport-generator.ts`
- `src/server/api/routers/transport/routeMutations.ts`
- `src/lib/map-config.ts` (or new `src/lib/route-style.ts`)
- `src/components/maps/editor/EditorMap.tsx` (route render)
- `src/components/maps/editor/properties/TransportPropertyForm.tsx`
- `src/components/maps/editor/ToolOptionsBar.tsx` (route-mode actions)

## Out of scope — DEFER and say so in the PR description
- Terrain-aware pathfinding / obstacle avoidance.
- Network/graph analysis (centrality, connectivity).
- flightcn-style animated arc rendering.
- Multi-modal trip planning.

## Steps

### 1. Compute `lengthKm` + `terrainDifficulty` from real data
Today `terrainDifficulty` (model field `maps.prisma:577`) is only ever set by the generator and never reflects actual terrain. On route create/update — `createRoute` / `updateRoute` / `updateRouteGeometry` in `routeMutations.ts`, and in `transport-generator.ts`:
- `lengthKm` = `polylineLengthKm(coordinates)` from `src/lib/geo-math.ts`.
- `terrainDifficulty` = sample elevation at N evenly-spaced points along the line via `getTerrainAtPoint` (`src/lib/base-layer-query.ts`), then normalize elevation variance / cumulative gain to `0-1`.

**Verify:** a route over the altitudes (mountain) layer gets a higher `terrainDifficulty` than a flat one; `lengthKm` matches `formatDistance` output for the same line.

### 2. Single source of route styling
Add `ROUTE_STYLES: Record<routeType, { color: string; width: number; dash?: number[] }>` to `map-config.ts` (or a new `route-style.ts`). Consume it in both `EditorMap.tsx` route layers and the main map (`src/components/maps/core/IxWorldMap.tsx`). Adding a route type becomes a one-line change.

**Verify:** rail vs highway vs shipping render distinctly, sourced from the shared config in both the editor and the main map.

### 3. Contextual route actions (in `ToolOptionsBar` route mode)
Add: Finish, Undo last waypoint, Reverse direction, Snap-to-cities toggle. Wire to existing `useMapEditor` route state/handlers (`routeWaypoints`, `finishRoute`, `addRouteWaypointWithSnap`). (If plan C-1 has wired `ToolOptionsBar`, these slot into the route branch; otherwise add the small bar for route mode.)

**Verify:** while drawing a route, Undo removes the last waypoint; Reverse flips the stop order.

### 4. Stops editor
In `TransportPropertyForm.tsx`, surface `route.stops` (the data exists, there's no UI): list stops, allow add / remove / reorder, persist via `updateRoute`.

**Verify:** editing stops persists across reload.

## Done criteria
- New/edited routes carry accurate `lengthKm` and terrain-derived `terrainDifficulty`.
- Route styling comes from one shared config used by editor + main map.
- Route tool has contextual actions (Finish/Undo/Reverse/Snap toggle).
- Stops are editable from the property form.
- Deferred items (pathfinding, network analysis, animated arcs, trip planning) named in the PR description.
- `bun run lint` clean; `bun run typecheck:file` passes on changed files.

## Test plan
Add `src/lib/__tests__/route-terrain.test.ts` for the `terrainDifficulty` normalization (pure function, fixture elevation samples), following an existing `src/lib/*.test.ts`.

## Maintenance note
Accurate `lengthKm`/`terrainDifficulty` flows into the existing `syncTransportEconomicModifiers` economic bonuses automatically — after this change, sanity-check that the transport GDP/trade modifiers don't swing wildly for existing routes.
