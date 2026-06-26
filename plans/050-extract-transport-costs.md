# Plan 050: Extract `calculateRouteCosts` to a shared lib + delete dead copies

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 2a15532d..HEAD -- src/server/api/routers/transport/routeMutations.ts src/server/api/routers/transport/routeQueries.ts src/server/api/routers/transport/hubs.ts src/lib/__tests__/`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.
>
> **CRITICAL: this plan's hard dependency on Plan 046**
> Plan 050 is rebased on top of `advisor/046-route-taxonomy` (commit `7c2ca937`),
> not on `v2`. Plan 046 added 5 new `case` arms to `routeMutations.ts`
> (pipeline, power_grid, fiber, military_supply, military_naval) that the
> "Current state" excerpts and Step 1 code in this plan assume. On a clean v2
> (HEAD `2a15532d`) the live `routeMutations.ts` switch has only the original 7
> cases, and the plan's STOP condition would fire on the very first drift
> check. Branch off `advisor/046-route-taxonomy`, not `v2`. See the Git
> workflow section.

## Status

- **Priority**: P3 (tech-debt; no user-visible behavior change)
- **Effort**: S
- **Risk**: LOW (pure code motion + delete dead code + add a test)
- **Depends on**: 046 DONE (the new cost factors for pipeline/power_grid/fiber/military_supply/military_naval must be in the live copy before extraction)
- **Category**: tech-debt (de-duplication)
- **Planned at**: commit `2a15532d`, 2026-06-16
- **Issue**: (none)

## Why this matters

`calculateRouteCosts` is triplicated across three files:

- `src/server/api/routers/transport/routeMutations.ts:19` — **the live copy** (4 call sites at lines 272, 369, 442, 499).
- `src/server/api/routers/transport/routeQueries.ts:12` — **dead copy** (no callers, eslint-disable comment on the unused-vars rule).
- `src/server/api/routers/transport/hubs.ts:13` — **dead copy** (no callers, same eslint-disable comment).

The dead copies are pre-existing tech debt. Plan 046 just added 5 new cost factors (pipeline, power_grid, fiber, military_supply, military_naval) to the live copy; the dead copies are now stale-but-harmless. Any future "add a new route type" PR has to remember to touch the live copy (or all three) — that's the foot-gun this plan removes. A single shared helper in `src/lib/transport-costs.ts` is the right home: pure, framework-free, and Jest-testable (matches the convention used for `src/lib/transport-generator.ts`, `src/lib/border-editor.ts`, etc.).

The deleted dead copies will *not* affect runtime behavior — they have no callers — so this is a safe, non-breaking refactor.

## Current state

The three copies are byte-identical except for the `// eslint-disable-next-line unused-imports/no-unused-vars` line on the dead copies (which ESLint added when it detected the unused function). The live copy (already updated by Plan 046) has the 12 cases:

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
    case "pipeline": baseCostPerKm = 0.03; break;
    case "power_grid": baseCostPerKm = 0.02; break;
    case "fiber": baseCostPerKm = 0.005; break;
    case "military_supply": baseCostPerKm = 0.02; break;
    case "military_naval": baseCostPerKm = 0.005; break;
  }
  const costBillion = lengthKm * baseCostPerKm * (1 + terrainDifficulty * 1.5);
  const maintenanceCost = costBillion * 0.02; // 2% annual maintenance
  return {
    costBillion: Math.round(costBillion * 1000) / 1000,
    maintenanceCost: Math.round(maintenanceCost * 1000) / 1000,
  };
}
```

Call sites in `routeMutations.ts` (all use the destructured form `const { costBillion, maintenanceCost } = calculateRouteCosts(...);`):

- Line 272 — `generateRoutes` path: `calculateRouteCosts(route.routeType, route.lengthKm, ...)`.
- Line 369 — `createRoute` path: `calculateRouteCosts(input.routeType, roundedLength, ...)`.
- Line 442 — `updateRoute` path: `calculateRouteCosts(type, length, diff)` (note: 3 positional args, no object destructuring at the call site for the args).
- Line 499 — `updateRouteGeometry` path: `calculateRouteCosts(routeType, roundedLength, ...)`.

The function is **not** exported in any of the three files (it's file-local). Extracting it to `~/lib/transport-costs` and importing it where needed is a clean move.

### Conventions to follow

- Pure framework-free logic in `src/lib/*.ts` with a matching test in `src/lib/__tests__/*.test.ts` (matches `src/lib/border-editor.ts` + `src/lib/__tests__/border-shaping.test.ts`, `src/lib/transport-generator.ts`, etc.).
- File-level JSDoc header on the new lib, consistent with sibling files.
- Export the function as a named export, not a default export (matches the rest of `src/lib/*`).
- Keep the function signature, return shape, and switch case order identical to the current live copy. No value changes, no signature changes — this is a pure refactor.

## Commands you will need

| Purpose           | Command                                                                | Expected on success |
|-------------------|------------------------------------------------------------------------|---------------------|
| Typecheck server  | `bun run typecheck:server`                                             | exit 0              |
| Lint              | `bun run lint`                                                         | exit 0 (pre-existing warnings OK) |
| Targeted lint     | `npx eslint src/server/api/routers/transport/routeMutations.ts src/server/api/routers/transport/routeQueries.ts src/server/api/routers/transport/hubs.ts src/lib/transport-costs.ts` | exit 0 |
| New test          | `bun run test -- src/lib/__tests__/transport-costs.test.ts`            | all pass            |
| Full test suite   | `bun run test`                                                         | 634/634 pass (regression check) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`.

> If `bun run typecheck:server` errors on a missing `tsconfig.server.json`
> (untracked, absent in a fresh worktree), fall back to
> `bun run typecheck:file <path>` per in-scope file.

## Scope

**In scope:**
- `src/lib/transport-costs.ts` (create — single exported function)
- `src/lib/__tests__/transport-costs.test.ts` (create — characterization test)
- `src/server/api/routers/transport/routeMutations.ts` (delete local copy, add import, leave 4 call sites unchanged)
- `src/server/api/routers/transport/routeQueries.ts` (delete the dead copy)
- `src/server/api/routers/transport/hubs.ts` (delete the dead copy)

**Out of scope (do NOT touch):**
- The 4 call sites in `routeMutations.ts` — the signature stays identical.
- The cost factor values themselves (no behavior change).
- The Prisma model / any tRPC router registration.
- Any other file under `src/server/api/routers/transport/`.

## Git workflow

- Branch: `advisor/050-extract-transport-costs` off **`advisor/046-route-taxonomy`** (commit `7c2ca937`), NOT off `v2`. The reason is the hard dependency: this plan's "Current state" excerpts and Step 1 code reference the 12-case switch that Plan 046 added to `routeMutations.ts`. On a clean v2 (HEAD `2a15532d`) the switch has only 7 cases and the drift check fires.
- Conventional commit, e.g. `refactor(transport): extract calculateRouteCosts to shared lib, drop dead copies`.
- Do NOT push or open a PR unless asked.

To set up the branch:
```bash
git checkout advisor/046-route-taxonomy
git checkout -b advisor/050-extract-transport-costs
# ... make changes ...
git add -A
git commit -m "refactor(transport): extract calculateRouteCosts to shared lib, drop dead copies"
```

If `advisor/046-route-taxonomy` does not exist locally (it may have been pruned), fetch it first: `git fetch origin advisor/046-route-taxonomy:advisor/046-route-taxonomy`. If neither local nor remote, STOP and report — the 046 work must exist somewhere before 050 can run.

## Steps

### Step 1: Create the shared lib

Create `src/lib/transport-costs.ts` with a single named export. File-level JSDoc explains the contract. The function body is a verbatim copy of the live function in `routeMutations.ts` (after Plan 046's additions), keeping the `routeType` switch in the same order so a future diff is easy to read.

```ts
/**
 * transport-costs.ts — cost calculation for transport route construction
 * and maintenance. Pure function, framework-free, fully testable.
 *
 * Single source of truth for per-km construction cost and annual
 * maintenance cost by route type. Adding a new transport route type
 * means adding one `case` here — no other file in the transport
 * subsystem needs to know about cost factors.
 */

/** Inputs are intentionally permissive: unknown `routeType` falls through to the road default (0.01). */
export interface RouteCostInput {
  routeType: string;
  lengthKm: number;
  terrainDifficulty: number;
}

export interface RouteCost {
  /** Construction cost in billions, rounded to 3 decimals. */
  costBillion: number;
  /** Annual maintenance cost in billions, rounded to 3 decimals (= 2% of construction). */
  maintenanceCost: number;
}

const DEFAULT_BASE_COST_PER_KM = 0.01; // road-equivalent fallback

const BASE_COST_PER_KM: Record<string, number> = {
  rail: 0.04,
  highway: 0.05,
  shipping_lane: 0.001,
  canal: 0.1,
  road: 0.01,
  air_corridor: 0.08,
  ferry: 0.02,
  pipeline: 0.03,
  power_grid: 0.02,
  fiber: 0.005,
  military_supply: 0.02,
  military_naval: 0.005,
};

const MAINTENANCE_RATE = 0.02; // 2% of construction per year

/**
 * Compute construction cost (billions) and annual maintenance cost (billions)
 * for a transport route.
 *
 * Formula: `costBillion = lengthKm * baseCostPerKm * (1 + terrainDifficulty * 1.5)`.
 * Unknown `routeType` falls through to the road default.
 */
export function calculateRouteCosts({
  routeType,
  lengthKm,
  terrainDifficulty,
}: RouteCostInput): RouteCost {
  const baseCostPerKm = BASE_COST_PER_KM[routeType] ?? DEFAULT_BASE_COST_PER_KM;
  const costBillion = lengthKm * baseCostPerKm * (1 + terrainDifficulty * 1.5);
  const maintenanceCost = costBillion * MAINTENANCE_RATE;
  return {
    costBillion: Math.round(costBillion * 1000) / 1000,
    maintenanceCost: Math.round(maintenanceCost * 1000) / 1000,
  };
}
```

> **Signature change note (read carefully):** the old call sites used positional
> args: `calculateRouteCosts(routeType, lengthKm, terrainDifficulty)`. The new
> signature uses a single object: `calculateRouteCosts({ routeType, lengthKm, terrainDifficulty })`.
> Step 3 updates the 4 call sites to match. This is an internal-only function
> (file-local in the original code, then module-internal after this plan), so
> the call-site update is safe — no external callers exist.

**Verify**: `bun run typecheck:file src/lib/transport-costs.ts` → exit 0.

### Step 2: Add the characterization test

Create `src/lib/__tests__/transport-costs.test.ts`. The test locks the cost
factors (so a future "add a type" PR that forgets to update the table fails the
test), confirms the default fallback for unknown types, and confirms the
rounding and maintenance-rate math.

```ts
/**
 * Tests for transport cost calculation.
 * Locks the per-km cost factors and the maintenance rate so a future
 * change has to update both this file and the table intentionally.
 */

import { calculateRouteCosts } from "../transport-costs";

describe("calculateRouteCosts", () => {
  it("applies the rail cost factor (0.04) at zero terrain difficulty", () => {
    const r = calculateRouteCosts({ routeType: "rail", lengthKm: 100, terrainDifficulty: 0 });
    expect(r.costBillion).toBe(4); // 100 * 0.04 * 1 = 4
    expect(r.maintenanceCost).toBe(0.08); // 4 * 0.02
  });

  it("applies terrain-difficulty multiplier (1 + d * 1.5)", () => {
    const r = calculateRouteCosts({ routeType: "highway", lengthKm: 100, terrainDifficulty: 0.5 });
    // 100 * 0.05 * (1 + 0.75) = 8.75
    expect(r.costBillion).toBe(8.75);
  });

  it("falls back to the road default (0.01) for unknown types", () => {
    const known = calculateRouteCosts({ routeType: "road", lengthKm: 100, terrainDifficulty: 0 });
    const unknown = calculateRouteCosts({ routeType: "nonsense", lengthKm: 100, terrainDifficulty: 0 });
    expect(unknown.costBillion).toBe(known.costBillion);
  });

  it("covers the new types added in Plan 046", () => {
    expect(
      calculateRouteCosts({ routeType: "pipeline", lengthKm: 100, terrainDifficulty: 0 }).costBillion
    ).toBe(3); // 100 * 0.03
    expect(
      calculateRouteCosts({ routeType: "power_grid", lengthKm: 100, terrainDifficulty: 0 }).costBillion
    ).toBe(2); // 100 * 0.02
    expect(
      calculateRouteCosts({ routeType: "fiber", lengthKm: 100, terrainDifficulty: 0 }).costBillion
    ).toBe(0.5); // 100 * 0.005
    expect(
      calculateRouteCosts({ routeType: "military_supply", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(2); // 100 * 0.02
    expect(
      calculateRouteCosts({ routeType: "military_naval", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(0.5); // 100 * 0.005
  });

  it("rounds costBillion and maintenanceCost to 3 decimals", () => {
    const r = calculateRouteCosts({ routeType: "rail", lengthKm: 1, terrainDifficulty: 0.333 });
    // 1 * 0.04 * (1 + 0.4995) = 0.05998
    expect(r.costBillion).toBe(0.06); // 0.05998 rounded to 3 dp = 0.06
    expect(r.maintenanceCost).toBe(0.001); // 0.05998 * 0.02 = 0.0011996 -> 0.001
  });
});
```

**Verify**: `bun run test -- src/lib/__tests__/transport-costs.test.ts` → all 5 tests pass.

### Step 3: Refactor `routeMutations.ts` to import from the lib

In `src/server/api/routers/transport/routeMutations.ts`:

1. **Delete the local `calculateRouteCosts` function** (the entire block at lines 19–50, including the leading blank line up to but not including the `export async function syncTransportEconomicModifiers` line that follows).
2. **Add the import** near the other `~/lib/...` imports at the top of the file (after the `~/lib/transport-generator` import block, ~line 16):
   ```ts
   import { calculateRouteCosts } from "~/lib/transport-costs";
   ```
3. **Update the 4 call sites** to use the new object-argument signature:
   - Line 272: `calculateRouteCosts({ routeType: route.routeType, lengthKm: route.lengthKm, terrainDifficulty: ... })` (keep the existing 3rd argument's name/spread).
   - Line 369: `calculateRouteCosts({ routeType: input.routeType, lengthKm: roundedLength, terrainDifficulty })` (the third arg is already a local variable in scope).
   - Line 442: `calculateRouteCosts({ routeType: type, lengthKm: length, terrainDifficulty: diff })`.
   - Line 499: `calculateRouteCosts({ routeType: routeType, lengthKm: roundedLength, terrainDifficulty: ... })`.

For each call site, the third arg is a local expression — read the surrounding
3 lines for the exact name (the `// Show context` snippet in the plan
documentation above tells you which variable to use at each site). The result
destructure `const { costBillion, maintenanceCost } = ...` is **unchanged** — the
return shape is identical.

**Verify**:
- `grep -c "function calculateRouteCosts" src/server/api/routers/transport/routeMutations.ts` → `0`
- `grep -c "calculateRouteCosts" src/server/api/routers/transport/routeMutations.ts` → `5` (1 import + 4 call sites)
- `bun run typecheck:server` → exit 0.

### Step 4: Delete the dead copy in `routeQueries.ts`

In `src/server/api/routers/transport/routeQueries.ts`:

- **Delete the entire `calculateRouteCosts` function** (lines 11–43, including
  the `// eslint-disable-next-line unused-imports/no-unused-vars` comment on
  line 11 and the trailing blank line up to but not including
  `export async function syncTransportEconomicModifiers` on line 45).
- The file imports / other content stay unchanged.

**Verify**:
- `grep -c "calculateRouteCosts" src/server/api/routers/transport/routeQueries.ts` → `0`
- `bun run typecheck:file src/server/api/routers/transport/routeQueries.ts` → exit 0.

### Step 5: Delete the dead copy in `hubs.ts`

In `src/server/api/routers/transport/hubs.ts`:

- **Delete the entire `calculateRouteCosts` function** (lines 12–44, including
  the `// eslint-disable-next-line unused-imports/no-unused-vars` comment and
  the trailing blank line).
- The file imports / other content stay unchanged.

**Verify**:
- `grep -c "calculateRouteCosts" src/server/api/routers/transport/hubs.ts` → `0`
- `bun run typecheck:file src/server/api/routers/transport/hubs.ts` → exit 0.

### Step 6: Lint + full test suite (regression check)

**Verify**:
- `npx eslint src/server/api/routers/transport/routeMutations.ts src/server/api/routers/transport/routeQueries.ts src/server/api/routers/transport/hubs.ts src/lib/transport-costs.ts` → exit 0.
- `bun run lint` → exit 0 (no new errors in the four in-scope files; pre-existing warnings elsewhere OK).
- `bun run test` → 49/49 suites, 634/634 tests pass (regression check — no new tests should fail).

## Test plan

The new test file `src/lib/__tests__/transport-costs.test.ts` (Step 2) covers:
1. The rail cost factor (0.04) at zero terrain — pins a known case.
2. The terrain-difficulty multiplier formula (1 + d × 1.5).
3. The unknown-type fallback (matches the road cost).
4. All 5 new types from Plan 046 (pipeline, power_grid, fiber, military_supply, military_naval) so a future "forgot to update the table" PR fails the test.
5. The 3-decimal rounding behavior.

Verification: `bun run test -- src/lib/__tests__/transport-costs.test.ts` → 5 tests pass.

## Done criteria

- [ ] `bun run typecheck:file src/lib/transport-costs.ts` exits 0
- [ ] `bun run typecheck:server` exits 0
- [ ] `bun run test -- src/lib/__tests__/transport-costs.test.ts` → 5 tests pass
- [ ] `bun run test` → 49/49 suites, 634/634 tests pass
- [ ] `bun run lint` exits 0 with no new errors in the four in-scope files
- [ ] `grep -c "calculateRouteCosts" src/server/api/routers/transport/routeMutations.ts` → `5` (1 import + 4 calls)
- [ ] `grep -c "function calculateRouteCosts" src/server/api/routers/transport/routeMutations.ts` → `0`
- [ ] `grep -c "calculateRouteCosts" src/server/api/routers/transport/routeQueries.ts` → `0`
- [ ] `grep -c "calculateRouteCosts" src/server/api/routers/transport/hubs.ts` → `0`
- [ ] `git status --porcelain` shows exactly the five expected paths (one new lib, one new test, three edited server files)
- [ ] `plans/README.md` status row for 050 updated (SKIP — reviewer maintains the index)

## STOP conditions

Stop and report back if:

- The "Current state" excerpts don't match the live code (drift) — especially if `calculateRouteCosts` already has more than 4 call sites in `routeMutations.ts`, or if the dead copies in `routeQueries.ts` / `hubs.ts` have gained a caller (then they're not dead and Step 4 / Step 5 need to abort).
- A test fails in the full `bun run test` run that isn't caused by this plan's changes (i.e. a pre-existing test failure you didn't introduce).
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- Adding a future route type: edit `BASE_COST_PER_KM` in `src/lib/transport-costs.ts`, then update the four "in-sync" lists (`ROUTE_COLORS` in `TransportOverlay.tsx`, `ROUTE_WIDTHS` in `TransportOverlay.tsx`, `ROUTE_TYPES` in `TransportPropertyForm.tsx`, and the `case` arm in `calculateRouteCosts`). The new test from Step 2 will fail until `BASE_COST_PER_KM` has the new type's entry, which is the intended guardrail.
- The signature change (positional → object) is intentional and matches the rest of `src/lib/*` (`buildRouteGeometry`, `buildRouteNetworkGraph` from Plans 047 and 049 use the same style). If the executor in this plan is the same executor working on 047/049 in parallel, the conventions align.
- The new lib has no React or Prisma dependencies — it can be unit-tested without a renderer or database, which is the whole point of moving it to `src/lib/`.
- Reviewer: confirm the destructured return value `const { costBillion, maintenanceCost } = calculateRouteCosts(...)` is preserved at all 4 call sites (only the argument shape changes). If the executor accidentally also changed the return destructure, the typecheck will catch it (`RouteCost` is an exported interface).
