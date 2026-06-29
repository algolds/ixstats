# Plan 048: Route Timeline — filter transport routes by built year via the scrubber

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 2a15532d..HEAD -- src/server/api/routers/transport/routeQueries.ts src/components/maps/overlays/TransportOverlay.tsx src/components/maps/editor/MapEditorOverlay.tsx src/components/maps/core/MapContainer.tsx`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches `MapContainer`, the central map component — but only adds
  one prop)
- **Depends on**: none
- **Category**: direction (feature)
- **Planned at**: commit `2a15532d`, 2026-06-16

## Why this matters

The map already has a **TimelineScrubber** (drag to a historical IxTime; the
political layer re-renders at that year). Transport routes carry a `builtYear`, and
each route has a `status` (`planned`/`under_construction`/`operational`/
`abandoned`). The product vision is to **watch the network grow over time** —
scrub from 2033 → 2060 and see railways/highways/airlines appear as they're built.
Today the route overlay ignores the scrubber: every route shows regardless of the
selected year. This plan wires the existing scrubber's year into the route overlay
so routes with `builtYear > selectedYear` are hidden. It's a small, faithful slice:
the scrubber exists, the data exists, only the filter + the plumbing are missing.

## Current state

**1. Query — `builtYear` is not exposed.** `src/server/api/routers/transport/routeQueries.ts`,
`getAllRoutesGeoJSON` (~lines 197–234) and `getCountryRoutes` (~lines 159–192)
build GeoJSON `properties` but **omit `builtYear`**. Excerpt from
`getAllRoutesGeoJSON`:

```ts
select: {
  id: true, routeType: true, name: true, geometry: true, status: true,
  lengthKm: true, terrainDifficulty: true, isInternational: true, properties: true,
  country: { select: { name: true } },
},
// ...
properties: {
  id: r.id, name: r.name, routeType: r.routeType, status: r.status,
  lengthKm: r.lengthKm, terrainDifficulty: r.terrainDifficulty,
  isInternational: r.isInternational, countryName: r.country?.name ?? null,
  ...((r.properties as Record<string, unknown>) ?? {}),
},
```

**2. Overlay — no year filter.** `src/components/maps/overlays/TransportOverlay.tsx`
filters only by route *type* via `useFilteredRouteData(routeData, visibleRouteTypes)`
(lines ~516–531) and the props interface (~lines 158–172) has no year prop:

```ts
function useFilteredRouteData(
  data: FeatureCollection,
  visibleTypes: string[] | undefined
): FeatureCollection {
  if (!visibleTypes || visibleTypes.length === 0) return data;
  const typeSet = new Set(visibleTypes);
  return {
    type: "FeatureCollection",
    features: data.features.filter(
      (f) => f.properties && typeSet.has(f.properties.routeType as string)
    ),
  };
}
```

**3. The overlay is mounted in `MapEditorOverlay`** (`src/components/maps/editor/MapEditorOverlay.tsx`,
~line 730):

```tsx
{transportRouteData && mapInstance && (
  <TransportOverlay
    map={mapInstance}
    routeData={transportRouteData}
    visible={layerStates.routes?.visible ?? true}
    selectedRouteId={selectedRouteId}
    onRouteClick={handleRouteClick}
  />
)}
```

`MapEditorOverlay`'s props interface (~line 93) is `{ countryId?, mapLayers?,
onExit, isWorldMode? }`.

**4. The scrubber value lives in `MapContainer`.** `src/components/maps/core/MapContainer.tsx`:
- `const [historicalIxTime, setHistoricalIxTime] = useState<number | null>(null);` (~line 205)
- `{showControls && <TimelineScrubber value={historicalIxTime} onChange={setHistoricalIxTime} />}` (~line 434)
- It mounts `MapEditorOverlay` in two places (~lines 416–428): the country editor
  (`isEditing && editingCountryId`) and the world editor (`isWorldEditing`).

`historicalIxTime` is `null` when the user hasn't scrubbed (→ show all routes).

**5. Year helper.** `src/lib/ixtime.ts` exports
`IxTime.getCurrentGameYear(ixTime?: number): number` (`2028 + floor(yearsSinceEpoch)`).
Import as `import { IxTime } from "~/lib/ixtime";`.

### Conventions to follow

- Additive props only; default behavior (no scrubbing → `null` → no filter) must be
  unchanged.
- Routes with a **null `builtYear`** must always show (unknown build date ≠ future).

## Commands you will need

| Purpose            | Command                                                                   | Expected on success |
|--------------------|---------------------------------------------------------------------------|---------------------|
| Typecheck server   | `bun run typecheck:server`                                                | exit 0              |
| Typecheck overlay  | `bun run typecheck:file src/components/maps/overlays/TransportOverlay.tsx` | exit 0              |
| Typecheck container| `bun run typecheck:file src/components/maps/core/MapContainer.tsx`         | exit 0              |
| Lint               | `bun run lint`                                                            | exit 0 (pre-existing warnings OK) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run check`. If
`typecheck:server` errors on a missing `tsconfig.server.json` (untracked, absent in
a fresh worktree), fall back to `bun run typecheck:file <path>`.

## Scope

**In scope:**
- `src/server/api/routers/transport/routeQueries.ts` (add `builtYear` to both
  query selects + properties)
- `src/components/maps/overlays/TransportOverlay.tsx` (add `maxBuiltYear` prop +
  filter)
- `src/components/maps/editor/MapEditorOverlay.tsx` (accept + forward a year prop)
- `src/components/maps/core/MapContainer.tsx` (compute year from `historicalIxTime`
  and pass it to both `MapEditorOverlay` mounts)

**Out of scope (do NOT touch):**
- `TimelineScrubber` itself.
- The `status` semantics / any status-based rendering already in the overlay.
- Mounting `TransportOverlay` on the non-editor public map (it is currently only
  rendered inside `MapEditorOverlay`) — see Maintenance; that's a separate change.

## Git workflow

- Branch: `advisor/048-route-timeline-filter` off `v2`. Conventional commit, e.g.
  `feat(maps): filter transport routes by built year via timeline scrubber`.
- Do NOT push or open a PR unless asked.

## Steps

### Step 1: Expose `builtYear` from the queries

In `src/server/api/routers/transport/routeQueries.ts`:
- In `getAllRoutesGeoJSON`: add `builtYear: true` to the `select`, and
  `builtYear: r.builtYear,` to the `properties` object.
- In `getCountryRoutes`: it uses `findMany` without an explicit `select` (returns
  full rows), so `r.builtYear` is already available — just add
  `builtYear: r.builtYear,` to its `properties` object.

**Verify**:
- `grep -c "builtYear" src/server/api/routers/transport/routeQueries.ts` → `≥ 3`
- `bun run typecheck:server` → exit 0.

### Step 2: Add the year filter to the overlay

In `src/components/maps/overlays/TransportOverlay.tsx`:
1. Add `maxBuiltYear?: number | null;` to `TransportOverlayProps` (with a comment:
   "Hide routes built after this game year; null/undefined = show all").
2. Destructure `maxBuiltYear` in the component signature and pass it to the filter:
   `const filteredData = useFilteredRouteData(routeData, visibleRouteTypes, maxBuiltYear);`
3. Extend `useFilteredRouteData`:
   ```ts
   function useFilteredRouteData(
     data: FeatureCollection,
     visibleTypes: string[] | undefined,
     maxBuiltYear?: number | null
   ): FeatureCollection {
     const typeSet =
       visibleTypes && visibleTypes.length > 0 ? new Set(visibleTypes) : null;
     if (!typeSet && (maxBuiltYear === undefined || maxBuiltYear === null)) return data;
     return {
       type: "FeatureCollection",
       features: data.features.filter((f) => {
         if (!f.properties) return false;
         if (typeSet && !typeSet.has(f.properties.routeType as string)) return false;
         if (maxBuiltYear !== undefined && maxBuiltYear !== null) {
           const by = f.properties.builtYear;
           if (typeof by === "number" && by > maxBuiltYear) return false;
         }
         return true;
       }),
     };
   }
   ```

**Verify**: `bun run typecheck:file src/components/maps/overlays/TransportOverlay.tsx` → exit 0.

### Step 3: Forward a year prop through MapEditorOverlay

In `src/components/maps/editor/MapEditorOverlay.tsx`:
1. Add `historicalYear?: number | null;` to `MapEditorOverlayProps` (~line 93).
2. Destructure `historicalYear` in the component signature (~line 100).
3. Pass it to the `TransportOverlay` mount (~line 730):
   `maxBuiltYear={historicalYear}` (add this prop to the existing `<TransportOverlay ... />`).

**Verify**: `grep -c "historicalYear" src/components/maps/editor/MapEditorOverlay.tsx` → `≥ 3`.

### Step 4: Compute the year in MapContainer and pass it down

In `src/components/maps/core/MapContainer.tsx`:
1. Ensure `IxTime` is imported (`import { IxTime } from "~/lib/ixtime";` — add only
   if not already imported).
2. Near where `historicalIxTime` is used, derive:
   ```ts
   const historicalYear =
     historicalIxTime === null ? null : IxTime.getCurrentGameYear(historicalIxTime);
   ```
3. Add `historicalYear={historicalYear}` to **both** `<MapEditorOverlay ... />`
   mounts (~lines 417 and 426).

**Verify**:
- `grep -c "historicalYear" src/components/maps/core/MapContainer.tsx` → `≥ 3`
- `bun run typecheck:file src/components/maps/core/MapContainer.tsx` → exit 0.

### Step 5: Lint

**Verify**: `bun run lint` → exit 0 (no new errors in the four in-scope files).

## Test plan

No unit-test harness fits this (it's React prop wiring + a MapLibre overlay). Use
the typecheck + grep gates above plus a manual check:

- Manual (non-blocking, if a dev server is available): open the world/country
  editor with the timeline controls visible. Ensure some routes have a `builtYear`
  (set one in the editor if needed). Drag the scrubber to a year *before* a route's
  `builtYear` and confirm that route disappears; scrub forward and it reappears.
  Routes with no `builtYear` stay visible at all times.

## Done criteria

- [ ] `bun run typecheck:server` exits 0
- [ ] `bun run typecheck:file src/components/maps/overlays/TransportOverlay.tsx` exits 0
- [ ] `bun run typecheck:file src/components/maps/core/MapContainer.tsx` exits 0
- [ ] `bun run lint` exits 0 with no new errors in the in-scope files
- [ ] `grep -c "builtYear" src/server/api/routers/transport/routeQueries.ts` → `≥ 3`
- [ ] `grep -c "maxBuiltYear" src/components/maps/overlays/TransportOverlay.tsx` → `≥ 2`
- [ ] `git status --porcelain` shows only the four in-scope paths modified
- [ ] `plans/README.md` status row for 048 updated

## STOP conditions

Stop and report back if:

- The "Current state" excerpts don't match the live code (drift) — especially if
  `MapEditorOverlay` no longer mounts `TransportOverlay`, or `historicalIxTime`/
  `TimelineScrubber` is gone from `MapContainer`.
- `MapEditorOverlay` receives `transportRouteData` through a path that makes adding
  `historicalYear` non-trivial (e.g. it's not a plain functional-component prop).
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- `TransportOverlay` is currently only rendered inside `MapEditorOverlay` (the
  editor / world-edit views), so this timeline filter is active there. Rendering
  routes on the **public, non-editing** `/maps` view is a separate enhancement
  (mount `TransportOverlay` in `MapContainer` fed by `getAllRoutesGeoJSON`); when
  that lands, pass the same `historicalYear` to it. The plumbing in this plan
  (query `builtYear`, overlay `maxBuiltYear`) is reused as-is.
- Possible follow-up: also dim/hide `abandoned` routes past a "decommissioned year",
  or animate appearance. Out of scope here.
- Reviewer: confirm the default path (no scrubbing, `historicalIxTime === null`,
  `historicalYear === null`) shows all routes exactly as before.
