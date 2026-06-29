# Plan 059: Fix and consolidate MyLeague QuickSim onto the working next-match-day path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 3a4e3324..HEAD -- src/components/myleague/LeagueSidebarNav.tsx "src/app/myleague/[id]/page.tsx" src/server/api/routers/sports/seasons/matches.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3a4e3324`, 2026-06-17

## Why this matters

The QuickSim widget in the MyLeague left sidebar is completely non-functional.
`QuickSimWidget` calls the `simulateMatchDay` mutation with a **hardcoded
`matchDay: 0`**, but the mutation's Zod input requires `matchDay:
z.number().int().min(1)` — so every click is rejected by input validation before
any simulation runs. The right-side "next match" hub works because the page
computes the real next day with `findNextScheduledMatchDayFromSchedule(schedule)`
and passes it. This plan makes the sidebar QuickSim use that same value, so both
sim entry points share one correct source of truth (the user asked to
"consolidate").

## Current state

**File: `src/components/myleague/LeagueSidebarNav.tsx`** — `QuickSimWidget`
(starts line 473). It only receives `seasonId` and hardcodes the day:

```ts
export function QuickSimWidget({
  seasonId,
  onSimulated,
}: {
  seasonId: string;
  onSimulated?: () => void;
}) {
  const utils = api.useUtils();
  const simulateMatchDay = api.sports.simulateMatchDay.useMutation({
    onSuccess: () => {
      utils.sports.getLeague.invalidate();
      onSimulated?.();
    },
  });
  // ...
  <Button
    onClick={() =>
      simulateMatchDay.mutate({
        seasonId,
        matchDay: 0,        // ← BUG: rejected by min(1); never simulates
      })
    }
    disabled={simulateMatchDay.isPending}
  >
```

**File: `src/server/api/routers/sports/seasons/matches.ts:204-206`** — the
mutation contract that rejects `0`:

```ts
simulateMatchDay: protectedProcedure
  .input(z.object({ seasonId: z.string(), matchDay: z.number().int().min(1) }))
```

**File: `src/app/myleague/[id]/page.tsx`** — the page already has the correct
helper and value:

- `findNextScheduledMatchDayFromSchedule(schedule)` is defined at line 82 and
  returns `number | null` (the lowest still-`scheduled` match day, or `null`
  when the season is complete).
- The page computes `const nextMatchDay = activeSeason ? findNextScheduledMatchDayFromSchedule(schedule) : null;` (line 316) and the working hub buttons call
  `simulateMatchDay.mutate({ seasonId, matchDay: nextMatchDay })` (lines 608, 1183).
- The sidebar widget is rendered around line 300 and currently passes only
  `seasonId` + `onSimulated`:

```tsx
{activeSeason && activeSeason.id && (
  <QuickSimWidget
    seasonId={activeSeason.id}
    onSimulated={() => {
      utils.sports.getLeague.invalidate({ id });
    }}
  />
)}
```

**Note on render order**: `nextMatchDay` is declared at line 316, *after* the
sidebar JSX block that renders `<QuickSimWidget>` (~line 300). You must move the
`nextMatchDay` computation above the sidebar block (or compute it inline where
the widget is rendered) so it is in scope. It depends only on `activeSeason` and
`schedule`, which are already defined earlier — confirm that before moving it.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (widget) | `bun run typecheck:file src/components/myleague/LeagueSidebarNav.tsx` | exit 0 |
| Typecheck (page) | `bun run typecheck:file "src/app/myleague/[id]/page.tsx"` | exit 0 |
| Lint | `bun run lint` | exit 0 (no new error in touched files) |

Do **NOT** run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`
(they OOM the server — see `plans/README.md` evergreen facts).

## Scope

**In scope**:
- `src/components/myleague/LeagueSidebarNav.tsx` (`QuickSimWidget` signature + call)
- `src/app/myleague/[id]/page.tsx` (pass `nextMatchDay`; reorder its computation)

**Out of scope**:
- The `simulateMatchDay` mutation in `matches.ts` — it is correct; do NOT lower
  the `min(1)` validation.
- `MatchTickerSim.tsx` and the hub buttons — they already work; leave them.
- Any change to season/standings logic.

## Git workflow

- Branch: `advisor/059-quicksim-consolidation`
- Conventional commit, e.g. `fix(sports): QuickSim simulates the real next match day`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Make `QuickSimWidget` take the next match day

In `src/components/myleague/LeagueSidebarNav.tsx`, change the `QuickSimWidget`
signature to accept `nextMatchDay: number | null`, use it in the mutate call,
and disable the button when there is no next day:

```ts
export function QuickSimWidget({
  seasonId,
  nextMatchDay,
  onSimulated,
}: {
  seasonId: string;
  nextMatchDay: number | null;
  onSimulated?: () => void;
}) {
  // ...unchanged useMutation...
  // button:
  onClick={() => {
    if (nextMatchDay == null) return;
    simulateMatchDay.mutate({ seasonId, matchDay: nextMatchDay });
  }}
  disabled={simulateMatchDay.isPending || nextMatchDay == null}
  // label: show "Season complete" when nextMatchDay == null, else
  // "Simulate Day {nextMatchDay}"
```

Remove the hardcoded `matchDay: 0` entirely.

**Verify**: `grep -n "matchDay: 0" src/components/myleague/LeagueSidebarNav.tsx`
→ no matches. `bun run typecheck:file src/components/myleague/LeagueSidebarNav.tsx` → exit 0.

### Step 2: Pass `nextMatchDay` from the page

In `src/app/myleague/[id]/page.tsx`:

1. Move the `const nextMatchDay = activeSeason ? findNextScheduledMatchDayFromSchedule(schedule) : null;` declaration so it appears **before** the sidebar JSX that renders `<QuickSimWidget>` (currently ~line 300). Verify `activeSeason` and `schedule` are already defined above the new location.
2. Pass it to the widget:

```tsx
<QuickSimWidget
  seasonId={activeSeason.id}
  nextMatchDay={nextMatchDay}
  onSimulated={() => {
    utils.sports.getLeague.invalidate({ id });
  }}
/>
```

**Verify**: `bun run typecheck:file "src/app/myleague/[id]/page.tsx"` → exit 0.
`grep -n "nextMatchDay={nextMatchDay}" "src/app/myleague/[id]/page.tsx"` → 1 match.

### Step 3: Lint

**Verify**: `bun run lint` → exit 0 (no new errors in the two files).

## Test plan

- No unit test (UI + tRPC mutation; this repo relies on lint + typecheck +
  browser smoke for league page widgets — see `plans/README.md` evergreen facts).
- **Manual smoke (do if a dev server is available; else mark deferred):** open a
  league with an in-progress season, click the sidebar **QuickSim** button →
  the same match day advances as the right-side hub "Simulate Day N" button (no
  console Zod/`BAD_REQUEST` error), and standings/schedule update. When the
  season is complete, the QuickSim button is disabled with a "Season complete"
  style label.

## Done criteria

ALL must hold:

- [ ] `grep -n "matchDay: 0" src/components/myleague/LeagueSidebarNav.tsx` → nothing
- [ ] `bun run typecheck:file src/components/myleague/LeagueSidebarNav.tsx` exits 0
- [ ] `bun run typecheck:file "src/app/myleague/[id]/page.tsx"` exits 0
- [ ] `bun run lint` exits 0 with no new error in the touched files
- [ ] Only the two in-scope files are modified (`git status`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `page.tsx` no longer defines
  `findNextScheduledMatchDayFromSchedule` or no longer computes `nextMatchDay`.
- `activeSeason`/`schedule` are NOT in scope above the sidebar block (then the
  reorder is unsafe — report the actual structure).
- The `simulateMatchDay` input no longer requires `min(1)` (the bug may have been
  fixed differently; reconcile before changing the widget).

## Maintenance notes

- **Reviewer should scrutinize**: that the page computes `nextMatchDay` exactly
  once and both the sidebar widget and the hub button consume that single value
  (the consolidation goal — no second source of truth).
- **Future**: if a "simulate to end of season" control is added to the sidebar,
  reuse `simulateFullSeason` (already wired on the page) rather than looping
  `simulateMatchDay`.
