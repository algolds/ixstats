# Plan 049: Maritime Route Editor & Transit Calculator

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat b23b953b..HEAD -- src/components/maps/editor/hooks/useRouteEdit.ts src/components/maps/editor/ToolOptionsBar.tsx src/components/maps/core/RouteInfoPanel.tsx`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `b23b953b`, 2026-06-19

## Why this matters

Shipping routes in the world simulation are currently visualized as flat lengths in kilometers. However, actual sea travel is heavily influenced by physical forces: ocean currents (like the warm Dolong Current or the cold Absurian flow) and global wind belts (trade winds and westerlies). 

This plan builds an interactive transit time calculator. For any drawn route, the system calculates the bearing of each segment, intersects it with the climate simulator's vector fields, and determines the effective travel speed. The options bar and route inspection panels will display the total travel time in days across different ship classes (ULCV container, bulk carrier, and eco-steaming speeds).

## Current state

- `src/components/maps/editor/hooks/useRouteEdit.ts` — Manages coordinate points and edit states for transportation lines.
- `src/components/maps/editor/ToolOptionsBar.tsx` — Shows route options (undo, finish, snap toggles).
- `src/components/maps/core/RouteInfoPanel.tsx` — Displays statistics (length, speed, stops) for saved routes.
- `docs/IXWORLD_OCEANOGRAPHY_REPORT.md` — Documents the exact physical parameters, current speeds, wind bands, and Haversine math.

## Commands you will need

| Purpose   | Command                                                            | Expected on success |
|-----------|--------------------------------------------------------------------|---------------------|
| Lint      | `bun run lint`                                                     | exit 0, no errors   |
| Typecheck | `bun run typecheck:file <file-path>`                               | exit 0, no errors   |
| Dev Server| `bun run dev`                                                      | starts successfully |

## Scope

**In scope**:
- `src/lib/route-transit-calculator.ts` (NEW)
- `src/components/maps/editor/hooks/useRouteEdit.ts`
- `src/components/maps/editor/ToolOptionsBar.tsx`
- `src/components/maps/core/RouteInfoPanel.tsx`

**Out of scope**:
- Altering the physical coordinates or names of ocean basins/seas in the database.

## Steps

### Step 1: Create `route-transit-calculator.ts`
Create a new file `src/lib/route-transit-calculator.ts` implementing vector math:
1. **Bearing Calculation (`calculateSegmentBearing`)**: Compute the heading angle $\theta$ (0° to 360°) of a line segment between `pt1` and `pt2` on the sphere.
2. **Current/Wind Vector Fields (`getCurrentAndWindVectors`)**: Model current and wind speeds at coordinates based on the formulas in `docs/IXWORLD_OCEANOGRAPHY_REPORT.md`:
   - Dolong Current: Northward, 2.0 knots between 18°N and 45°N along 90°E–100°E.
   - NE Trades: Southwestward, 15 knots between 10°N and 30°N.
   - Westerlies: Northeastward, 20 knots between 35°N and 60°N.
3. **Effective Speed (`calculateEffectiveSpeed`)**:
   $$V_{\text{effective}} = V_{\text{ship}} + V_{\text{current}} \cdot \cos(\theta_{\text{bearing}} - \theta_{\text{current}}) + V_{\text{wind}} \cdot \cos(\theta_{\text{bearing}} - \theta_{\text{wind}})$$
4. **Transit Calculator (`calculateTransitTime`)**: Iterate all segments in a route, sum segment travel times, and output the total in days for three ship classes (15 kn express, 13 kn bulk, 10 kn eco-steam).

**Verify**: `bun run typecheck:file src/lib/route-transit-calculator.ts` passes.

### Step 2: Show Real-Time Calculation during Drawing
In `useRouteEdit.ts` and `ToolOptionsBar.tsx`:
1. Calculate the active transit times on every route coordinates modification.
2. When drawing or editing a route, update the Options Bar to display:
   `Total Length: X km | Est. Transit: Y days (Express) / Z days (Eco-Steam)`.

**Verify**: Draw a route along the Dolong Current northward path. Verify the estimated transit days count is shorter than drawing the same path southward.

### Step 3: Add "Transit Details" Sheet in Route Panel
In `RouteInfoPanel.tsx`:
1. Add a **"Transit Details"** tab.
2. Render a comparison card displaying:
   - Base distance in nautical miles (nm).
   - Current/Wind drag or boost factors.
   - Projected travel duration and fuel efficiency scores across different speeds.

**Verify**: Open the public `/maps` page, click an active shipping route. Confirm the Transit Details panel lists correct statistics.

## Done criteria

- [ ] `bun run lint` returns no errors on changed files.
- [ ] Shipping routes calculate active wind/current offsets dynamically.
- [ ] UI correctly compares transit duration across express and slow-steaming container ship speeds.

## STOP conditions

- If route coordinates loop over the antimeridian and trigger negative travel times or divisions-by-zero, STOP and handle seam-crossing bounds checks.
