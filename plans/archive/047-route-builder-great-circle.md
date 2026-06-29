# Plan 047: Route Builder — great-circle arc geometry for air/sea routes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 2a15532d..HEAD -- src/hooks/useMapEditor.ts`
> If `useMapEditor.ts` changed since this plan was written, compare the "Current
> state" excerpt of `finishRoute` against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (independent of 046, but reads nicer after it — 046 adds
  `military_naval`, one of the curved types this plan recognizes)
- **Category**: direction (feature)
- **Planned at**: commit `2a15532d`, 2026-06-16

## Why this matters

The route editor already lets an author draw a route by clicking waypoints
(origin → … → destination) and finishing — see `finishRoute` in
`src/hooks/useMapEditor.ts`. But it always stores the waypoints as **straight
segments**. For aviation and maritime routes that looks wrong: an air corridor
"Buffalo → Toronto" or a shipping lane "Paris → Rome" should follow a **great-
circle arc**, the curved path real airline/shipping maps show. This plan adds a
small pure geometry helper that converts the clicked endpoints into a great-circle
LineString for air/sea route types (straight for everything else), and wires it
into the single place new-route geometry is built. No new dependency — Turf
(`@turf/turf`, already installed) provides `greatCircle`. The server already
recomputes `lengthKm` from the geometry, so a curved path also yields a more
accurate length for free.

This is the highest-leverage slice of the "Route Builder" vision: the existing
multi-click draw flow already *is* an origin→destination builder; the only missing
piece is the curved geometry.

## Current state

`src/hooks/useMapEditor.ts` (the file starts with `// @ts-nocheck`, so the
typechecker will NOT catch errors in it — edit carefully). The relevant function,
`finishRoute` (lines ~806–824):

```ts
const finishRoute = useCallback(
  async (routeType = "road", name?: string) => {
    if (!countryId || routeWaypoints.length < 2) return;
    const geometry = {
      type: "LineString" as const,
      coordinates: routeWaypoints,
    };
    await createRoute.mutateAsync({
      countryId,
      routeType,
      name,
      geometry,
    });
    setRouteWaypoints([]);
    setRouteDrawingHistory([]);
    setSnapTarget(null);
  },
  [countryId, routeWaypoints, createRoute]
);
```

Facts confirmed during recon:
- `routeWaypoints` is `[number, number][]` (lng, lat pairs).
- This is the **only** place route geometry is *constructed from waypoints* for a
  new route. The other `createRoute` call sites (lines ~338, ~448) pass an already-
  built `d.geometry` (paste/redo) — out of scope. The geometry build at line ~860
  is the path-**edit** commit (`commitRouteEdit`/`updateRouteGeometry`) — that must
  stay freehand (the user is hand-dragging vertices) — out of scope.
- `createRoute` (server, `routeMutations.ts`) recomputes `lengthKm` from the
  geometry coordinates via haversine, so denser geometry → more accurate length.
- Turf is installed as `@turf/turf` and re-exports `greatCircle`
  (`import { greatCircle } from "@turf/turf"`). `greatCircle(start, end, opts)`
  returns a `Feature<LineString | MultiLineString>` — MultiLineString when the arc
  crosses the antimeridian.

### Conventions to follow

- Pure, framework-free logic goes in `src/lib/*.ts` and is unit-tested with Jest
  (`bun run test`). This matches the repo's documented "modular component
  architecture" (`src/lib/*.ts` = pure business logic, fully testable). Put the
  helper there, not inside the React hook.
- GeoJSON types come from the `geojson` package (`import type { LineString } from "geojson"`).

## Commands you will need

| Purpose           | Command                                              | Expected on success |
|-------------------|------------------------------------------------------|---------------------|
| Typecheck helper  | `bun run typecheck:file src/lib/route-geometry.ts`   | exit 0              |
| Unit test         | `bun run test -- src/lib/route-geometry.test.ts`     | all pass            |
| Lint              | `bun run lint`                                       | exit 0 (pre-existing warnings OK) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run check`.
(`useMapEditor.ts` is `@ts-nocheck`, so `typecheck:file` on it is not a meaningful
gate — rely on `lint` + the helper's own typecheck/test.)

## Scope

**In scope:**
- `src/lib/route-geometry.ts` (create)
- `src/lib/route-geometry.test.ts` (create)
- `src/hooks/useMapEditor.ts` (wire the helper into `finishRoute` only)

**Out of scope (do NOT touch):**
- The path-edit commit (`commitRouteEdit` / line ~860 geometry) — keep freehand.
- The other `createRoute` call sites (~338, ~448) that pass pre-built geometry.
- The server `createRoute` mutation — it already recomputes length; no change.
- Any UI file — curving is automatic by route type; no toggle is added (see
  Maintenance for the optional toggle).

## Git workflow

- Branch: `advisor/047-route-builder-great-circle` off `v2`. Conventional commit,
  e.g. `feat(maps): great-circle geometry for air/sea route builder`.
- Do NOT push or open a PR unless asked.

## Steps

### Step 1: Create the pure geometry helper

Create `src/lib/route-geometry.ts`:

```ts
import { greatCircle } from "@turf/turf";
import type { LineString } from "geojson";

/** Route types whose geometry should follow a great-circle arc. */
const CURVED_TYPES = new Set(["air_corridor", "shipping_lane", "ferry", "military_naval"]);

/**
 * Build a GeoJSON LineString from clicked waypoints. For air/sea route types the
 * segments between consecutive waypoints are densified into great-circle arcs
 * (the curved path airline/shipping maps show); all other types stay as straight
 * segments. Falls back to a straight segment if an arc can't be computed (e.g.
 * antimeridian crossing → Turf returns a MultiLineString) or on any error.
 */
export function buildRouteGeometry(
  waypoints: [number, number][],
  routeType: string
): LineString {
  if (waypoints.length < 2 || !CURVED_TYPES.has(routeType)) {
    return { type: "LineString", coordinates: waypoints };
  }

  const coords: [number, number][] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const start = waypoints[i - 1]!;
    const end = waypoints[i]!;
    if (start[0] === end[0] && start[1] === end[1]) continue; // identical points

    let segment: [number, number][];
    try {
      const arc = greatCircle(start, end, { npoints: 64 });
      segment =
        arc.geometry.type === "LineString"
          ? (arc.geometry.coordinates as [number, number][])
          : [start, end]; // MultiLineString (antimeridian) → straight fallback
    } catch {
      segment = [start, end];
    }

    // Avoid duplicating the shared endpoint between consecutive arcs.
    if (coords.length > 0) segment = segment.slice(1);
    coords.push(...segment);
  }

  return { type: "LineString", coordinates: coords.length >= 2 ? coords : waypoints };
}
```

**Verify**: `bun run typecheck:file src/lib/route-geometry.ts` → exit 0.

### Step 2: Unit-test the helper

Create `src/lib/route-geometry.test.ts`:

```ts
import { buildRouteGeometry } from "./route-geometry";

describe("buildRouteGeometry", () => {
  const a: [number, number] = [-78.8, 42.9]; // Buffalo-ish
  const b: [number, number] = [-79.4, 43.7]; // Toronto-ish

  it("returns straight waypoints for non-curved types", () => {
    const geo = buildRouteGeometry([a, b], "rail");
    expect(geo.type).toBe("LineString");
    expect(geo.coordinates).toEqual([a, b]);
  });

  it("densifies air_corridor into a great-circle arc", () => {
    const geo = buildRouteGeometry([a, b], "air_corridor");
    expect(geo.type).toBe("LineString");
    expect(geo.coordinates.length).toBeGreaterThan(2); // arc is densified
    // endpoints preserved (approximately)
    expect(geo.coordinates[0]![0]).toBeCloseTo(a[0], 1);
    const last = geo.coordinates[geo.coordinates.length - 1]!;
    expect(last[0]).toBeCloseTo(b[0], 1);
  });

  it("returns input unchanged for <2 waypoints", () => {
    const geo = buildRouteGeometry([a], "air_corridor");
    expect(geo.coordinates).toEqual([a]);
  });

  it("does not crash on identical consecutive points", () => {
    expect(() => buildRouteGeometry([a, a, b], "shipping_lane")).not.toThrow();
  });
});
```

**Verify**: `bun run test -- src/lib/route-geometry.test.ts` → all 4 tests pass.

### Step 3: Wire the helper into finishRoute

In `src/hooks/useMapEditor.ts`:

1. Add the import near the other imports at the top of the file:
   ```ts
   import { buildRouteGeometry } from "~/lib/route-geometry";
   ```
2. In `finishRoute`, replace the inline geometry construction:
   ```ts
   const geometry = {
     type: "LineString" as const,
     coordinates: routeWaypoints,
   };
   ```
   with:
   ```ts
   const geometry = buildRouteGeometry(routeWaypoints, routeType);
   ```

Do not change anything else in the function (the `createRoute.mutateAsync` call,
the state resets, the deps array).

**Verify**:
- `grep -c "buildRouteGeometry" src/hooks/useMapEditor.ts` → `2` (import + call)
- `bun run lint` → exit 0 (no new errors).

## Test plan

- New `src/lib/route-geometry.test.ts` (Step 2) covers: straight type passthrough,
  air-corridor densification with endpoints preserved, <2-waypoint passthrough, and
  the identical-points no-crash guard.
- Verification: `bun run test -- src/lib/route-geometry.test.ts` → 4 pass.
- Manual (non-blocking, if a dev server is available): in the editor, draw a route
  of type `air_corridor` between two distant cities and finish — confirm the stored
  line renders as a curved arc, and a `rail` route between the same points renders
  straight.

## Done criteria

- [ ] `bun run typecheck:file src/lib/route-geometry.ts` exits 0
- [ ] `bun run test -- src/lib/route-geometry.test.ts` → 4 tests pass
- [ ] `bun run lint` exits 0 with no new errors in the in-scope files
- [ ] `grep -c "buildRouteGeometry" src/hooks/useMapEditor.ts` → `2`
- [ ] `git status --porcelain` shows only the three in-scope paths created/modified
- [ ] `plans/README.md` status row for 047 updated

## STOP conditions

Stop and report back if:

- `finishRoute` in `useMapEditor.ts` no longer matches the "Current state" excerpt
  (drift), or there is now more than one waypoint→geometry construction site for
  *new* routes.
- `@turf/turf` does not export `greatCircle` (then try `import { greatCircle } from
  "@turf/great-circle"` — the submodule exists — and report which worked).
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- Curved types are a `Set` in `route-geometry.ts` — adjust there if a future route
  type should curve.
- Optional follow-up (deferred): a "Curved arc" toggle in the draw tab of
  `TransportPropertyForm.tsx` to override the by-type default per route. Not needed
  for v1; the by-type default covers the common case.
- Reviewer: confirm the edit-path commit (`commitRouteEdit`) was NOT changed —
  hand-edited vertices must stay exactly where the user dragged them.
- If routes later need to snap endpoints to existing hubs/cities ("select origin
  hub → destination hub"), that's a UI addition on top of this helper, not a
  geometry change.
