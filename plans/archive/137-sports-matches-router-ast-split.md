# Plan 137: Sports Matches & Simulation Router AST Split

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 928bd..HEAD -- src/server/api/routers/sports/seasons/matches.ts src/server/api/routers/sports/seasons/index.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/136-sports-leagues-router-ast-split.md
- **Category**: architecture / modularity
- **Planned at**: commit `928bd`, 2026-08-20
- **Status**: DONE

## Why this matters

`src/server/api/routers/sports/seasons/matches.ts` is 844 lines (recorded in baseline at 953 lines). It contains three large match/race simulation procedures (`simulateMatchDay`, `simulatePlayoffRound`, `simulateRace`). Splitting these into focused domain sub-routers (`matchDay.ts`, `playoffs.ts`, `race.ts`) under `src/server/api/routers/sports/seasons/matches/` with `mergeRouters` keeps all three simulation procedures intact while bringing all sub-files under the 700-line architecture ceiling.

## Current state

- `src/server/api/routers/sports/seasons/matches.ts` exports `sportsSeasonsMatchesRouter`.
- Registered in `src/server/api/routers/sports/seasons/index.ts`:
  ```ts
  import { sportsSeasonsMatchesRouter } from "./matches";
  ```
- 3 simulation mutation procedures:
  - `simulateMatchDay`: regular season matchday execution and stats updates (~420 lines)
  - `simulatePlayoffRound`: knockout bracket round execution (~260 lines)
  - `simulateRace`: motorsport / racing event simulation (~130 lines)

## Commands you will need

| Purpose   | Command                                      | Expected on success |
|-----------|----------------------------------------------|---------------------|
| Audit Arch| `bun run audit:arch`                         | exit 0, no errors   |
| Update Base| `bun run scripts/audit/audit-arch.ts --update` | baseline ratchets down |
| Lint      | `bun run lint`                               | exit 0              |

## Scope

**In scope**:
- Create directory `src/server/api/routers/sports/seasons/matches/`
- Create `src/server/api/routers/sports/seasons/matches/matchDay.ts` (`simulateMatchDay`)
- Create `src/server/api/routers/sports/seasons/matches/playoffs.ts` (`simulatePlayoffRound`)
- Create `src/server/api/routers/sports/seasons/matches/race.ts` (`simulateRace`)
- Create `src/server/api/routers/sports/seasons/matches/index.ts` (merges sub-routers, exports `sportsSeasonsMatchesRouter`)
- Delete `src/server/api/routers/sports/seasons/matches.ts`
- Update `scripts/audit/arch-baseline.json` via `--update`

**Out of scope**:
- Simulation resolution math in `src/lib/sports/` (read-only callers).

## Steps

### Step 1: Create domain sub-routers under src/server/api/routers/sports/seasons/matches/

1. Create `src/server/api/routers/sports/seasons/matches/matchDay.ts`:
   - Contains `simulateMatchDay`.
   - Exports `sportsSeasonsMatchDayRouter`.
2. Create `src/server/api/routers/sports/seasons/matches/playoffs.ts`:
   - Contains `simulatePlayoffRound`.
   - Exports `sportsSeasonsPlayoffsRouter`.
3. Create `src/server/api/routers/sports/seasons/matches/race.ts`:
   - Contains `simulateRace`.
   - Exports `sportsSeasonsRaceRouter`.

### Step 2: Combine with mergeRouters in index.ts

Create `src/server/api/routers/sports/seasons/matches/index.ts`:
```ts
import { mergeRouters } from "~/server/api/trpc";
import { sportsSeasonsMatchDayRouter } from "./matchDay";
import { sportsSeasonsPlayoffsRouter } from "./playoffs";
import { sportsSeasonsRaceRouter } from "./race";

export const sportsSeasonsMatchesRouter = mergeRouters(
  sportsSeasonsMatchDayRouter,
  sportsSeasonsPlayoffsRouter,
  sportsSeasonsRaceRouter
);
```

### Step 3: Delete monolith and update baseline

1. Delete `src/server/api/routers/sports/seasons/matches.ts`.
2. Run `bun run audit:arch --update` to ratchet the baseline down.

**Verify**: `bun run audit:arch` → exits 0 with no violations.

## Done criteria

- [ ] `src/server/api/routers/sports/seasons/matches.ts` is deleted
- [ ] `src/server/api/routers/sports/seasons/matches/index.ts` exports `sportsSeasonsMatchesRouter`
- [ ] Every sub-file in `src/server/api/routers/sports/seasons/matches/` is $\le 450$ lines
- [ ] `bun run audit:arch` passes
- [ ] `plans/README.md` status row updated

## STOP conditions

- If any procedure name is altered or dropped.
