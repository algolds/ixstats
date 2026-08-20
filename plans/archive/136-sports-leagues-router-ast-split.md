# Plan 136: Sports Leagues Router AST Split Under 700-Line Ceiling

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 928bd..HEAD -- src/server/api/routers/sports/leagues.ts src/server/api/routers/sports/index.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/135-keyvalidation-layering-and-autosync-boilerplate-trim.md
- **Category**: architecture / modularity
- **Planned at**: commit `928bd`, 2026-08-20
- **Status**: DONE

## Why this matters

`src/server/api/routers/sports/leagues.ts` is 1,381 lines, making it the single largest god file currently recorded in `scripts/audit/arch-baseline.json`. Splitting it into cohesive domain sub-files (`crud.ts`, `schedule.ts`, `presets.ts`, `admin.ts`) under `src/server/api/routers/sports/leagues/` combined with `mergeRouters` preserves all 26 procedures at `api.sports.*` with zero call-site breakage while bringing all files comfortably under the 700-line architecture ceiling.

## Current state

- `src/server/api/routers/sports/leagues.ts` (1,381 lines) exports `sportsLeaguesRouter`.
- Registered in `src/server/api/routers/sports/index.ts:16`:
  ```ts
  import { sportsLeaguesRouter } from "./leagues";
  ```
- 26 procedures:
  - League CRUD: `getLeagues`, `getLeague`, `createLeague`, `updateLeague`, `deleteLeague`, `exportLeagueData`
  - Schedule & Ops: `getSchedule`, `regenerateSchedule`, `resetSeason`, `overrideMatchResult`, `transferTeam`
  - Presets & Drafts: `getSportPresets`, `searchSportsEntities`, `getDraftPicks`
  - Narrator & Admin: `generateMatchReport`, `generateMatchPreview`, `generateMatchCommentary`, `testLLMNarrator`, `getAdminGlobalStats`, `reseedSportsData`, `saveGlobalAINarratorSettings`, `getGlobalAINarratorSettings`, `getNotificationSettings`, `saveNotificationSettings`, `getFeaturedLeagueId`, `setFeaturedLeague`, `clearSportsCache`

## Commands you will need

| Purpose   | Command                                      | Expected on success |
|-----------|----------------------------------------------|---------------------|
| Audit Arch| `bun run audit:arch`                         | exit 0, no errors   |
| Update Base| `bun run scripts/audit/audit-arch.ts --update` | baseline ratchets down |
| Lint      | `bun run lint`                               | exit 0              |

## Scope

**In scope**:
- Create directory `src/server/api/routers/sports/leagues/`
- Create `src/server/api/routers/sports/leagues/crud.ts` (≤ 400 lines)
- Create `src/server/api/routers/sports/leagues/schedule.ts` (≤ 400 lines)
- Create `src/server/api/routers/sports/leagues/presets.ts` (≤ 250 lines)
- Create `src/server/api/routers/sports/leagues/admin.ts` (≤ 450 lines)
- Create `src/server/api/routers/sports/leagues/index.ts` (merges sub-routers, exports `sportsLeaguesRouter`)
- Delete `src/server/api/routers/sports/leagues.ts`
- Update `scripts/audit/arch-baseline.json` via `--update`

**Out of scope**:
- Any changes to procedure inputs, outputs, or internal logic.
- Other sports routers (handled in separate plans).

## Steps

### Step 1: Create domain sub-routers under src/server/api/routers/sports/leagues/

1. Create `src/server/api/routers/sports/leagues/crud.ts`:
   - Contains `getLeagues`, `getLeague`, `createLeague`, `updateLeague`, `deleteLeague`, `exportLeagueData`.
   - Exports `sportsLeaguesCrudRouter`.
2. Create `src/server/api/routers/sports/leagues/schedule.ts`:
   - Contains `recalculateStandings` helper, `getSchedule`, `regenerateSchedule`, `resetSeason`, `overrideMatchResult`, `transferTeam`.
   - Exports `sportsLeaguesScheduleRouter`.
3. Create `src/server/api/routers/sports/leagues/presets.ts`:
   - Contains `getSportPresets`, `searchSportsEntities`, `getDraftPicks`.
   - Exports `sportsLeaguesPresetsRouter`.
4. Create `src/server/api/routers/sports/leagues/admin.ts`:
   - Contains `generateMatchReport`, `generateMatchPreview`, `generateMatchCommentary`, `testLLMNarrator`, `getAdminGlobalStats`, `reseedSportsData`, `saveGlobalAINarratorSettings`, `getGlobalAINarratorSettings`, `getNotificationSettings`, `saveNotificationSettings`, `getFeaturedLeagueId`, `setFeaturedLeague`, `clearSportsCache`.
   - Exports `sportsLeaguesAdminRouter`.

### Step 2: Combine with mergeRouters in src/server/api/routers/sports/leagues/index.ts

Create `src/server/api/routers/sports/leagues/index.ts`:
```ts
import { mergeRouters } from "~/server/api/trpc";
import { sportsLeaguesCrudRouter } from "./crud";
import { sportsLeaguesScheduleRouter } from "./schedule";
import { sportsLeaguesPresetsRouter } from "./presets";
import { sportsLeaguesAdminRouter } from "./admin";

export const sportsLeaguesRouter = mergeRouters(
  sportsLeaguesCrudRouter,
  sportsLeaguesScheduleRouter,
  sportsLeaguesPresetsRouter,
  sportsLeaguesAdminRouter
);
```

### Step 3: Delete monolith and verify AST parity

1. Delete `src/server/api/routers/sports/leagues.ts`.
2. Run `bun run audit:arch --update` to ratchet the baseline down.

**Verify**: `bun run audit:arch` → exits 0 with no violations.

## Done criteria

- [ ] `src/server/api/routers/sports/leagues.ts` is deleted
- [ ] `src/server/api/routers/sports/leagues/index.ts` exports `sportsLeaguesRouter`
- [ ] Every sub-file in `src/server/api/routers/sports/leagues/` is $\le 700$ lines
- [ ] `bun run audit:arch` passes
- [ ] `plans/README.md` status row updated

## STOP conditions

- If procedure names differ or any procedure key is dropped.
- If cross-router imports are introduced.
