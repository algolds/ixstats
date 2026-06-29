# Plan 032: Remove the orphaned MyCountry executive-actions router

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3a52c4a..HEAD -- src/server/api/routers/mycountry/`
> If `actions.ts` or `index.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `f3a52c4a`, 2026-06-15

## Why this matters

`src/server/api/routers/mycountry/actions.ts` (390 lines) is a fully-typed
"executive command suite" — 9 actions with cooldowns, budget costs, and
requirements — that **nothing in the app calls**. It is not a player loop being
removed; it is dead code:

- No UI component or hook references `api.mycountry.getExecutiveActions` or
  `api.mycountry.executeAction` (the only `executeAction` used in the app is the
  unrelated `api.intelCore.executeAction`).
- Its cooldown logic is broken anyway: `getExecutiveActions` looks up prior runs
  with `inputType: "executive_action"` ([actions.ts:187](../src/server/api/routers/mycountry/actions.ts#L187))
  but `executeAction` writes the effect with `inputType: def.inputType` (e.g.
  `"GDP_ADJUSTMENT"`, [actions.ts:320](../src/server/api/routers/mycountry/actions.ts#L320)),
  so no executed action ever matches the cooldown query.
- It duplicates the Policy system, which is the live, UI-wired path for the same
  intent (enact something → it affects the country). Plan 035 makes Policy
  produce real simulation effects; this router would be a competing, gamier,
  dead alternative.

Removing it deletes confusing dead code and removes a broken browser-game
cooldown/cost surface that the project's design direction has moved away from.

## Current state

- `src/server/api/routers/mycountry/actions.ts` — the orphaned router. Exports
  `myCountryActionsRouter` with two procedures: `getExecutiveActions` and
  `executeAction`. ~390 lines.
- `src/server/api/routers/mycountry/index.ts` — merges the three MyCountry
  sub-routers. Current content:

  ```ts
  import { mergeRouters } from "~/server/api/trpc";
  import { myCountryDashboardRouter } from "./dashboard";
  import { myCountryIntelligenceRouter } from "./intelligence";
  import { myCountryActionsRouter } from "./actions";

  export const myCountryRouter = mergeRouters(
    myCountryDashboardRouter,
    myCountryIntelligenceRouter,
    myCountryActionsRouter
  );
  ```

- `src/app/mycountry/README.md:45` documents the (dead) endpoints:
  `- Executive Actions: \`api.mycountry.getExecutiveActions\` ... \`api.mycountry.executeAction\` ...`

- The merged router is registered once in `src/server/api/root.ts:262`:
  `mycountry: safeRouter("mycountry", () => myCountryRouter),` — leave this line
  untouched; the `mycountry` namespace stays (dashboard + intelligence remain).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Confirm zero callers | `grep -rn "getExecutiveActions\|mycountry.executeAction\|myCountryActionsRouter" src` | only matches inside `actions.ts`, `index.ts`, and `app/mycountry/README.md` |
| Typecheck (file) | `bun run typecheck:file src/server/api/routers/mycountry/index.ts` | exit 0, no errors |
| Lint | `bun run lint` | exit 0 (pre-existing warnings tolerated) |

(Never run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build` — they OOM the server.)

## Scope

**In scope** (the only files you should modify):
- `src/server/api/routers/mycountry/actions.ts` (delete)
- `src/server/api/routers/mycountry/index.ts` (remove the import + merge arg)
- `src/app/mycountry/README.md` (remove the dead Executive Actions doc line)

**Out of scope** (do NOT touch):
- `src/server/api/root.ts` — the `mycountry` registration stays.
- `src/types/mycountry.ts` — the `ExecutiveAction` type may be used elsewhere; do
  not delete it.
- `dashboard.ts`, `intelligence.ts` — the other two MyCountry sub-routers stay.
- Anything under `intelCore` — `api.intelCore.executeAction` is a different,
  live router. Do not touch it.

## Git workflow

- Branch: `advisor/032-remove-executive-actions`
- Conventional-commit message, e.g. `refactor(mycountry): remove orphaned executive-actions router (dead code)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Re-confirm there are no live callers

Run: `grep -rn "getExecutiveActions\|mycountry.executeAction\|myCountryActionsRouter" src`

Expected: matches ONLY in `src/server/api/routers/mycountry/actions.ts`,
`src/server/api/routers/mycountry/index.ts`, and `src/app/mycountry/README.md`.

**If any match appears in `src/components/`, `src/hooks/`, or `src/app/` (other
than the README), STOP** — a caller exists and this plan's premise is wrong.

### Step 2: Delete the router file

Delete `src/server/api/routers/mycountry/actions.ts`.

### Step 3: Update the index barrel

Edit `src/server/api/routers/mycountry/index.ts` to remove the `actions` import
and the merge argument:

```ts
import { mergeRouters } from "~/server/api/trpc";
import { myCountryDashboardRouter } from "./dashboard";
import { myCountryIntelligenceRouter } from "./intelligence";

export const myCountryRouter = mergeRouters(
  myCountryDashboardRouter,
  myCountryIntelligenceRouter
);
```

Also update the doc comment at the top of the file: remove the `- actions:` bullet
from the "Domains:" list so the comment stays accurate.

**Verify**: `bun run typecheck:file src/server/api/routers/mycountry/index.ts` → exit 0, no errors.

### Step 4: Remove the dead doc line

In `src/app/mycountry/README.md`, delete the line beginning
`- Executive Actions: \`api.mycountry.getExecutiveActions\``.

### Step 5: Final grep + lint

Run `grep -rn "getExecutiveActions\|myCountryActionsRouter" src` → expect **no
matches**. Run `bun run lint` → exit 0.

## Test plan

No new tests. This is a pure deletion of unreferenced code. The verification is:
- typecheck of the index file passes (nothing imports the removed router),
- grep shows zero remaining references.

If a test file references `myCountryActionsRouter` or these endpoints (it should
not — confirm in Step 1), STOP and report.

## Done criteria

ALL must hold:

- [ ] `src/server/api/routers/mycountry/actions.ts` no longer exists
- [ ] `grep -rn "getExecutiveActions\|myCountryActionsRouter" src` returns no matches
- [ ] `bun run typecheck:file src/server/api/routers/mycountry/index.ts` exits 0
- [ ] `bun run lint` exits 0 (pre-existing warnings tolerated)
- [ ] Only the three in-scope files are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's grep finds a caller in `src/components/`, `src/hooks/`, or a page —
  the router is not actually dead.
- `index.ts` no longer matches the "Current state" excerpt (it was refactored).
- Typecheck reports an error implying something imported a symbol from `actions.ts`.

## Maintenance notes

- The product intent behind "executive actions" is superseded by Policy (see
  plan 035, which makes Policy produce real `StorytellerEffect` simulation
  effects + narrative). If executive-style one-click actions are ever wanted
  again, build them as Policy templates, not as a parallel router.
- Reviewer: confirm the diff is deletions only plus the two small edits — no
  behavior change to dashboard/intelligence procedures.
