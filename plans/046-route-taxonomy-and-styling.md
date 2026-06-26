# Plan 046: Extend the transport route taxonomy (pipelines, power, fiber, military) + styling

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 2a15532d..HEAD -- src/components/maps/overlays/TransportOverlay.tsx src/components/maps/editor/properties/TransportPropertyForm.tsx src/server/api/routers/transport/routeMutations.ts`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none (foundational — Plans 047 and 049 build on the extended types)
- **Category**: direction (feature) / tech-debt (de-duplicate hardcoded type lists)
- **Planned at**: commit `2a15532d`, 2026-06-16

## Why this matters

The map editor's "Routes" feature is fully built (data model `TransportRoute`,
`api.transport.*` CRUD, the `TransportOverlay` renderer, property forms, route
cards). But the route **taxonomy is hardcoded to 7 transport types** — `rail,
highway, road, shipping_lane, canal, air_corridor, ferry`. The product direction
is to also model **pipelines, power grids, fiber networks, and military logistics
(supply + naval)**. The data column `routeType` is already a free `String` and
`createRoute` accepts `z.string()`, so the *data layer already supports any type*;
the gap is purely that the **type list, colors, widths, and cost factors are
hardcoded in three places** that must agree. This plan adds the new types and, in
the process, makes the overlay's color/width expressions generate from the config
maps so the lists can't silently desync again.

## Current state

Three files independently hardcode the 7-type list:

**1. `src/components/maps/overlays/TransportOverlay.tsx`** — the MapLibre renderer.
`ROUTE_COLORS` and `ROUTE_WIDTHS` config maps (lines 31–49), plus
`buildColorExpression()` (lines 62–82) and `buildWidthExpression()` (lines 84–109)
which **repeat** the type list as hardcoded MapLibre `match` arms:

```ts
export const ROUTE_COLORS: Record<string, string> = {
  rail: "#374151",        // gray-700
  highway: "#f97316",     // orange-500
  road: "#92400e",        // amber-800
  shipping_lane: "#3b82f6",
  canal: "#06b6d4",
  air_corridor: "#a855f7",
  ferry: "#14b8a6",
};

const ROUTE_WIDTHS: Record<string, number> = {
  rail: 3, highway: 2.5, road: 1.5, shipping_lane: 2,
  canal: 1.5, air_corridor: 2, ferry: 1.5,
};

function buildColorExpression(): any[] {
  return [
    "match", ["get", "routeType"],
    "rail", ROUTE_COLORS.rail!,
    "highway", ROUTE_COLORS.highway!,
    // ... one arm per type ...
    "#888888", // fallback
  ];
}
```

The `icon-color` of the arrow layer (line 361) also calls `buildColorExpression()`.

**2. `src/components/maps/editor/properties/TransportPropertyForm.tsx`** (top of
file is `// @ts-nocheck`) — the editor UI type dropdown, `ROUTE_TYPES` (lines
22–30):

```ts
const ROUTE_TYPES = [
  { value: "rail", label: "Rail", color: "#374151" },
  { value: "highway", label: "Highway", color: "#f97316" },
  { value: "road", label: "Road", color: "#92400e" },
  { value: "shipping_lane", label: "Shipping", color: "#3b82f6" },
  { value: "canal", label: "Canal", color: "#06b6d4" },
  { value: "air_corridor", label: "Air", color: "#a855f7" },
  { value: "ferry", label: "Ferry", color: "#14b8a6" },
] as const;
```

**3. `src/server/api/routers/transport/routeMutations.ts`** — `calculateRouteCosts`
(lines 19–50) switches on `routeType` for a `baseCostPerKm`. It **has a `default`
(`0.01`)**, so unknown types won't crash — but new types should get sensible cost
factors:

```ts
function calculateRouteCosts(routeType: string, lengthKm: number, terrainDifficulty: number) {
  let baseCostPerKm = 0.01; // default road
  switch (routeType) {
    case "rail": baseCostPerKm = 0.04; break;
    case "highway": baseCostPerKm = 0.05; break;
    case "shipping_lane": baseCostPerKm = 0.001; break;
    case "canal": baseCostPerKm = 0.1; break;
    case "road": baseCostPerKm = 0.01; break;
    case "air_corridor": baseCostPerKm = 0.08; break;
    case "ferry": baseCostPerKm = 0.02; break;
  }
  const costBillion = lengthKm * baseCostPerKm * (1 + terrainDifficulty * 1.5);
  // ...
}
```

Note: `generateRoutes` (same file, ~line 167) has a Zod `enum` of the 7 *terrain-
generatable* types. **Do NOT add the new types to that enum** — pipelines, power,
fiber, and military routes are author-placed, not procedurally generated from
terrain. Leave `generateRoutes` alone.

### New types to add (canonical values, colors, widths, costs)

Use these exact `routeType` string values and styling (Tailwind palette hexes, to
match the existing convention in the file comments):

| routeType | label | color (hex) | width | baseCostPerKm |
|-----------|-------|-------------|-------|---------------|
| `pipeline` | Pipeline | `#eab308` (yellow-500) | 2 | 0.03 |
| `power_grid` | Power | `#f59e0b` (amber-500) | 1.5 | 0.02 |
| `fiber` | Fiber | `#e5e7eb` (gray-200) | 1 | 0.005 |
| `military_supply` | Mil. Supply | `#dc2626` (red-600) | 2 | 0.02 |
| `military_naval` | Mil. Naval | `#7f1d1d` (red-900) | 2 | 0.005 |

(Military air corridors reuse the existing `air_corridor` type — no new value.)

### Conventions to follow

- Match the existing comment style (`// color-name`) next to each hex.
- The overlay file is a normal typed `.tsx` (NOT `@ts-nocheck`) — it must
  typecheck. The property form IS `@ts-nocheck` — read edits there carefully since
  the typechecker won't catch mistakes.

## Commands you will need

| Purpose            | Command                                                                       | Expected on success |
|--------------------|-------------------------------------------------------------------------------|---------------------|
| Typecheck overlay  | `bun run typecheck:file src/components/maps/overlays/TransportOverlay.tsx`     | exit 0              |
| Typecheck server   | `bun run typecheck:server`                                                     | exit 0              |
| Lint               | `bun run lint`                                                                 | exit 0 (pre-existing warnings OK) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run check`.

> If `bun run typecheck:ui`/`:server` errors because `tsconfig.*.json` is missing
> (untracked, absent in a fresh worktree), fall back to
> `bun run typecheck:file <path>` per file.

## Scope

**In scope:**
- `src/components/maps/overlays/TransportOverlay.tsx`
- `src/components/maps/editor/properties/TransportPropertyForm.tsx`
- `src/server/api/routers/transport/routeMutations.ts`

**Out of scope (do NOT touch):**
- `generateRoutes` Zod enum in `routeMutations.ts` — terrain generation only.
- The `TransportRoute` Prisma model / any migration — `routeType` is already a
  free `String`; no schema change is needed or wanted.
- `TransportPropertyForm`'s per-type property fields (gauge/lanes/etc.) — adding
  bespoke fields for pipeline diameter / grid voltage / fiber bandwidth is a
  separate enhancement; this plan only adds the types + styling.

## Git workflow

- Branch: `advisor/046-route-taxonomy` off `v2`. Conventional commit, e.g.
  `feat(maps): add pipeline/power/fiber/military transport route types`.
- Do NOT push or open a PR unless asked.

## Steps

### Step 1: Extend the overlay config maps and generate the match expressions

In `src/components/maps/overlays/TransportOverlay.tsx`:

1. Add the 5 new entries to `ROUTE_COLORS` and `ROUTE_WIDTHS` using the table above.
2. Replace the hardcoded `match` arms in `buildColorExpression()` and
   `buildWidthExpression()` with arms **generated from the config maps**, so the
   lists can never desync again. Target shape:

```ts
function buildColorExpression(): any[] {
  const arms: any[] = ["match", ["get", "routeType"]];
  for (const [type, color] of Object.entries(ROUTE_COLORS)) {
    arms.push(type, color);
  }
  arms.push("#888888"); // fallback
  return arms;
}

function buildWidthExpression(selectedRouteId: string | null | undefined): any[] {
  const typeArms: any[] = ["match", ["get", "routeType"]];
  for (const [type, width] of Object.entries(ROUTE_WIDTHS)) {
    typeArms.push(type, width);
  }
  typeArms.push(1.5); // fallback
  return ["case", ["==", ["get", "id"], selectedRouteId ?? ""], 6, typeArms];
}
```

Leave the `icon-color` usage (`buildColorExpression()` at the arrow layer) as-is —
it now picks up the new colors automatically.

**Verify**: `bun run typecheck:file src/components/maps/overlays/TransportOverlay.tsx` → exit 0.

### Step 2: Add the new types to the editor dropdown

In `src/components/maps/editor/properties/TransportPropertyForm.tsx`, append the 5
new entries to `ROUTE_TYPES` (value/label/color from the table). Keep the
`as const`.

**Verify**: `grep -c "military_naval" src/components/maps/editor/properties/TransportPropertyForm.tsx` → `1`.

### Step 3: Add cost factors for the new types

In `src/server/api/routers/transport/routeMutations.ts`, add `case` arms to the
`calculateRouteCosts` switch using the `baseCostPerKm` column from the table
(`pipeline` 0.03, `power_grid` 0.02, `fiber` 0.005, `military_supply` 0.02,
`military_naval` 0.005). Leave the `default` as the road fallback.

**Verify**:
- `grep -c "case \"power_grid\"" src/server/api/routers/transport/routeMutations.ts` → `1`
- `bun run typecheck:server` → exit 0.

### Step 4: Lint

**Verify**: `bun run lint` → exit 0 (no new errors in the three in-scope files).

## Test plan

No automated test harness exists for these specific files and this is config/data
plus a small expression refactor. Do not scaffold a new framework. Verification is
the typecheck + grep gates above plus a manual check:

- Manual (non-blocking, if a dev server is available): open the map editor, create
  a route of type `pipeline` (and `military_naval`), confirm it renders in the new
  color and the type appears in the editor dropdown and the route card.

## Done criteria

- [ ] `bun run typecheck:file src/components/maps/overlays/TransportOverlay.tsx` exits 0
- [ ] `bun run typecheck:server` exits 0
- [ ] `bun run lint` exits 0 with no new errors in the in-scope files
- [ ] `grep -c "military_naval" src/components/maps/overlays/TransportOverlay.tsx` → `1` (in ROUTE_COLORS)
- [ ] `grep -c "case \"pipeline\"" src/server/api/routers/transport/routeMutations.ts` → `1`
- [ ] `git status --porcelain` shows only the three in-scope paths modified
- [ ] `plans/README.md` status row for 046 updated

## STOP conditions

Stop and report back if:

- The "Current state" excerpts don't match the live code (drift).
- `ROUTE_COLORS`/`ROUTE_WIDTHS` are consumed somewhere else that assumes exactly 7
  keys (search `grep -rn "ROUTE_COLORS\|ROUTE_WIDTHS" src` before finishing).
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- After this, `buildColorExpression`/`buildWidthExpression` are generated from the
  config maps — adding a future type means adding one entry to `ROUTE_COLORS`,
  `ROUTE_WIDTHS`, `ROUTE_TYPES`, and a cost `case`. Keep those four in sync.
- Per-type bespoke property fields (pipeline diameter, grid voltage, fiber
  bandwidth, military classification) are deferred — the generic property form
  still works for the new types via the free-form `properties` JSON.
- Per-type **dash patterns** (the vision's "teal dotted / white dashed") are NOT
  added here: MapLibre `line-dasharray` is not data-driven, so per-type dashes
  require splitting the single line layer into per-dash-style layers — a separate,
  larger change. Reviewer: don't expect dashes in this PR.
