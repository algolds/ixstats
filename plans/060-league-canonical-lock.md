# Plan 060: Lock the `isCanonical` league flag to system owners (keep the 500-credit charge)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 3a4e3324..HEAD -- src/server/api/routers/sports/leagues.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / integrity
- **Planned at**: commit `3a4e3324`, 2026-06-17

## Why this matters

`createLeague` and `updateLeague` write the `isCanonical` boolean **straight from
client input with no authorization check**. `isCanonical` is what marks a league
as official/canon (the public `getLeagues` filter surfaces canonical leagues as
first-class). Any signed-in user can therefore mint a league flagged as canon, or
flip an existing one, polluting the canonical set. The owner's decision: **keep
the existing 500-credit charge for creating a personal league** (it already works
— `exchangeService.spend(..., 500, "CHARTER_FEE", ...)`), but **restrict the
`isCanonical` flag to system owners**. Non-owners can still create leagues; their
leagues are simply forced non-canonical.

## Current state

**File: `src/server/api/routers/sports/leagues.ts`**

`createLeague` (`protectedProcedure`, starts line 319) charges credits then writes
`isCanonical` from input unguarded:

```ts
createLeague: protectedProcedure
  .input(z.object({
    name: z.string().min(1).max(200),
    sportPreset: z.string().min(1),
    teamCount: z.number().int().min(2).max(64),
    nationAffiliation: z.string().nullable().optional(),
    settings: z.record(z.string(), z.unknown()),
    isCanonical: z.boolean().optional().default(false),   // ← client-controlled
  }))
  .mutation(async ({ ctx, input }) => {
    // ...
    await exchangeService.spend(ctx.user.id, 500, "CHARTER_FEE", `LEAGUE_CREATE:${input.name}`, ctx.db as any);
    // ...
    const league = await ctx.db.sportLeague.create({
      data: {
        // ...
        isCanonical: input.isCanonical,                   // ← line ~357, unguarded
        // ...
      },
    });
```

`updateLeague` (`protectedProcedure`, starts line 431) — **read it**; it accepts
and writes `isCanonical` the same way. Apply the identical guard there.

**The established admin check** (used across the codebase, e.g.
`src/server/api/trpc.ts:349` and `:620`) is:

```ts
import { isSystemOwner } from "~/lib/system-owner-constants";
// ...
isSystemOwner(ctx.auth.userId)   // ctx.auth.userId is the Clerk user id
```

`isSystemOwner(clerkUserId: string): boolean` is defined in
`src/lib/system-owner-constants.ts:45`. **Note** the spend call uses
`ctx.user.id` (internal user id) while `isSystemOwner` needs `ctx.auth.userId`
(Clerk id) — both are present on `ctx` in `protectedProcedure`; use the right one
for each.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `bun run typecheck:file src/server/api/routers/sports/leagues.ts` | exit 0 |
| Lint | `bun run lint` | exit 0 (no new error in touched file) |

Do **NOT** run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`.

## Scope

**In scope**:
- `src/server/api/routers/sports/leagues.ts` (`createLeague`, `updateLeague`)

**Out of scope**:
- The `getLeagues` query's `isCanonical` *filter* (line ~217) — reading/filtering
  by the flag is fine; do not change it.
- The 500-credit `exchangeService.spend` call — keep it exactly as-is.
- The team/roster/coach generation block — unchanged.
- `LeagueCreator.tsx` UI — optional follow-up (see maintenance), not required.

## Git workflow

- Branch: `advisor/060-league-canonical-lock`
- Conventional commit, e.g.
  `fix(sports): restrict isCanonical league flag to system owners`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Guard `isCanonical` in `createLeague`

Add the import (with the other imports at the top of the file, if not already
present):

```ts
import { isSystemOwner } from "~/lib/system-owner-constants";
```

In the `createLeague` mutation body, compute an effective flag and use it in the
`create` data instead of the raw input:

```ts
const canonical = input.isCanonical === true && isSystemOwner(ctx.auth.userId);
// ...
const league = await ctx.db.sportLeague.create({
  data: {
    // ...
    isCanonical: canonical,   // was: input.isCanonical
    // ...
  },
});
```

A non-owner who sends `isCanonical: true` silently gets a non-canonical league
(no thrown error — keeps the create flow working).

**Verify**: `bun run typecheck:file src/server/api/routers/sports/leagues.ts` → exit 0.

### Step 2: Apply the same guard in `updateLeague`

Read `updateLeague` (line 431+). If it writes `isCanonical`, gate it the same
way: only let the value through when `isSystemOwner(ctx.auth.userId)` is true;
otherwise do **not** modify the existing `isCanonical` (leave the column
untouched for non-owners, rather than forcing it false — an update shouldn't
silently un-canon an admin's league). Concretely, build the update `data` so
`isCanonical` is only included when the caller is a system owner:

```ts
data: {
  // ...other fields...
  ...(isSystemOwner(ctx.auth.userId) && input.isCanonical !== undefined
    ? { isCanonical: input.isCanonical }
    : {}),
},
```

**Verify**: `bun run typecheck:file src/server/api/routers/sports/leagues.ts` → exit 0.

### Step 3: Lint

**Verify**: `bun run lint` → exit 0 (no new errors in the file).

## Test plan

- No unit test is added (the router is DB-bound; consistent with how the other
  `geoAdmin`/`sports` mutations are treated — no pure unit tests exist for them).
- **Manual smoke (if a dev server + a non-owner test account are available; else
  mark deferred):**
  1. As a **non-owner**, create a league with `isCanonical: true` (e.g. via the
     tRPC panel or a crafted call) → the resulting `sportLeague.isCanonical` is
     `false` in the DB; the 500-credit charge still applied.
  2. As a **system owner** (a Clerk id in `SYSTEM_OWNER_IDS`), create with
     `isCanonical: true` → the league is canonical.

## Done criteria

ALL must hold:

- [ ] `grep -n "isCanonical: input.isCanonical" src/server/api/routers/sports/leagues.ts` → no matches in `createLeague`/`updateLeague` (replaced by the guarded value)
- [ ] `grep -n "isSystemOwner" src/server/api/routers/sports/leagues.ts` → import + at least 2 uses
- [ ] `grep -n "exchangeService.spend" src/server/api/routers/sports/leagues.ts` → still present (charge untouched)
- [ ] `bun run typecheck:file src/server/api/routers/sports/leagues.ts` exits 0
- [ ] `bun run lint` exits 0 with no new error in the file
- [ ] Only `leagues.ts` is modified (`git status`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `ctx.auth.userId` is not available in this procedure's context (then find how
  other procedures in this router obtain the Clerk id and use that — do not
  invent one).
- `updateLeague` does not accept `isCanonical` at all (then Step 2 is a no-op —
  note it and skip, do not add the field).
- A separate `adminProcedure`/role middleware already exists and is the house
  convention for this kind of gate — prefer it over an inline `isSystemOwner`
  check and report the substitution.

## Maintenance notes

- **Reviewer should scrutinize**: that the credit charge is untouched and that a
  non-owner can still create a (non-canonical) league — this is a *flag* lock,
  not a *creation* lock.
- **Deferred UI follow-up**: hide the "canonical" toggle in `LeagueCreator.tsx`
  for non-owners so the UI matches the server gate (cosmetic; server is the
  source of truth and is now safe).
- **Interacts with**: any future "promote my league to canon" feature must route
  through an owner-only path; this guard is the chokepoint.
