# Plan 062: Scope MyClub overview cache invalidations to the current team

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 3a4e3324..HEAD -- src/components/myclub/ "src/app/myclub/[teamId]/page.tsx"`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf / correctness
- **Planned at**: commit `3a4e3324`, 2026-06-17

## Why this matters

`getMyClubOverview` is the MyClub team page's primary query — ~6 DB round-trips
(team + players + coaches + league, active season, standing, upcoming matches,
two counts; `src/server/api/routers/sports/teams.ts:529`). Four action components
invalidate it with **no cache key** — `utils.sports.getMyClubOverview.invalidate()`
— which clears the cached overview for **every** team the user has touched and
forces a full refetch, instead of just the team being acted on. The page and
`TeamSettingsModal` already do it correctly with `invalidate({ teamId })`. This
is the most likely cause of the repeated `getMyClubOverview` fetches the owner
observed in the console. Scoping the four stragglers to the current team makes
invalidation precise and cuts redundant refetches. (Note: this is a targeted
cache-hygiene fix — it does **not** restructure the query.)

## Current state

Unkeyed invalidations (the four to fix):

- `src/components/myclub/RevenueCollector.tsx:35` — `utils.sports.getMyClubOverview.invalidate();`
- `src/components/myclub/PlayerTrainingButton.tsx:33` — same
- `src/components/myclub/TeamTrainingButton.tsx:19` — same
- `src/components/myclub/LineupBuilder.tsx:69` — same

Correct pattern already in use (the template to match):

- `src/app/myclub/[teamId]/page.tsx:176` — `utils.sports.getMyClubOverview.invalidate({ teamId });`
- `src/components/myleague/TeamSettingsModal.tsx:73` — `utils.sports.getMyClubOverview.invalidate({ teamId: team.id });`

The query's input is `z.object({ teamId: z.string() })`, so the cache key is
`{ teamId }`. Each of the four components is rendered on the team page with the
team in scope — confirm each has a `teamId` (or `team.id`) value available
(prop or context) before scoping its invalidation.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (each file) | `bun run typecheck:file src/components/myclub/RevenueCollector.tsx` (repeat per file) | exit 0 |
| Lint | `bun run lint` | exit 0 (no new error in touched files) |

Do **NOT** run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`.

## Scope

**In scope** (only the invalidation calls):
- `src/components/myclub/RevenueCollector.tsx`
- `src/components/myclub/PlayerTrainingButton.tsx`
- `src/components/myclub/TeamTrainingButton.tsx`
- `src/components/myclub/LineupBuilder.tsx`

**Out of scope**:
- `getMyClubOverview` server query in `teams.ts` — do NOT restructure/split it.
- The page's and `TeamSettingsModal`'s already-scoped invalidations.
- Any other `invalidate()` calls for *different* queries — leave them.

## Git workflow

- Branch: `advisor/062-myclub-overview-invalidation`
- Conventional commit, e.g. `perf(sports): scope getMyClubOverview invalidations to the active team`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Confirm `teamId` is in scope in each component

For each of the four files, read the component props/context. Identify the
team id it already uses (it performs a team-scoped mutation, so it has one — a
`teamId` prop, a `team` prop with `.id`, or a route param). If a file genuinely
has no team id available, that file is a STOP condition (report it; do not
fabricate an id).

### Step 2: Scope the invalidation

In each file, change `utils.sports.getMyClubOverview.invalidate();` to
`utils.sports.getMyClubOverview.invalidate({ teamId });` (or `{ teamId: team.id }`
matching that component's variable name).

**Verify**:
- `grep -rn "getMyClubOverview.invalidate()" src/components/myclub` → no matches.
- `bun run typecheck:file <each file>` → exit 0.

### Step 3: Lint

**Verify**: `bun run lint` → exit 0 (no new errors in touched files).

## Test plan

- No unit test (UI cache behavior; repo relies on lint/typecheck + browser smoke).
- **Manual smoke (if a dev server is available; else mark deferred):** open a
  team page with the Network/tRPC panel; perform a training/revenue/lineup
  action → exactly **one** `getMyClubOverview` refetch fires (for this team),
  not a burst. Switching teams and acting does not refetch the other team's
  overview.

## Done criteria

ALL must hold:

- [ ] `grep -rn "getMyClubOverview.invalidate()" src/components/myclub` → no matches
- [ ] `bun run typecheck:file` exits 0 for all four files
- [ ] `bun run lint` exits 0 with no new error in touched files
- [ ] Only the four in-scope files are modified (`git status`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the four components has no team id in scope (then scoping is impossible
  without a prop change — report it; a prop-threading change is a separate,
  larger task).
- After scoping, the manual smoke still shows a *burst* of `getMyClubOverview`
  fetches on plain page load — that points at a different cause (e.g. a
  `refetchOnWindowFocus`/`refetchOnMount` default or a re-mount loop); report the
  observed trigger rather than guessing.

## Maintenance notes

- **Reviewer should scrutinize**: that each scoped `teamId` matches the team the
  component actually mutates (a wrong id would invalidate the wrong cache entry).
- **If repeated fetches persist** after this fix, the next lever is to set
  `staleTime`/`refetchOnWindowFocus: false` on the page's `getMyClubOverview`
  query, or split the heavy parts (upcoming matches / counts) into a lighter
  secondary query — deliberately deferred out of this plan as it's a bigger change
  and may be unnecessary once invalidations are scoped.
