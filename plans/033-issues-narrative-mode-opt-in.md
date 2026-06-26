# Plan 033: Make the National Issues "game loop" opt-in (narrative mode by default)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3a52c4a..HEAD -- src/server/api/routers/national-issues/ src/lib/national-issues-consequences.ts src/lib/national-issues-engine.ts`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (pairs with plan 034)
- **Category**: direction
- **Planned at**: commit `f3a52c4a`, 2026-06-15

## Why this matters

The National Issues system is explicitly modeled on NationStates
([national-issues-engine.ts:5](../src/lib/national-issues-engine.ts#L5) — *"Inspired
by NationStates' issue system"*). It has three "browser-game" behaviors that
recent stakeholder feedback singled out as the wrong direction for what is meant
to be a worldbuilding engine, not a game players must *tend*:

1. **Auto-generation**: opening the inbox silently generates new issues from the
   country's stats ([player.ts:159-168](../src/server/api/routers/national-issues/player.ts#L159)).
2. **Forced resolution**: issues with a deadline cannot be dismissed
   ([player.ts:333-338](../src/server/api/routers/national-issues/player.ts#L333)).
3. **Engagement reward**: resolving an issue pays IxCredits (25/15/8/3 by
   severity), zero for inaction ([national-issues-consequences.ts:387-396](../src/lib/national-issues-consequences.ts#L387)).

The decision (from the advisor session) is **not to delete the system** — keep
the loop, but make it **opt-in and off by default**. Default behavior becomes
"narrative mode": issues are optional prompts that appear only when a community
DM injects them (plan 034) or were already generated; nothing is auto-spawned,
nothing is forced, no credits are farmed. An operator can re-enable the classic
loop via environment flags. This is reversible, needs no DB migration (writes are
blocked anyway), and directly answers the feedback while preserving the code.

## Current state

Three call sites carry the gamey behavior:

- **Auto-generation** — `src/server/api/routers/national-issues/player.ts:157-169`,
  inside `getMyIssues`:

  ```ts
  // Trigger evaluation if stale
  const shouldEval = await NationalIssuesEngine.shouldEvaluate(input.countryId, ctx.db as any);
  if (shouldEval) {
    // Run evaluation in background - don't block the query
    NationalIssuesEngine.evaluateCountry(
      input.countryId,
      ctx.db as any,
      input.domain ? { forceDomain: input.domain } : undefined
    ).catch((err) => {
      console.error("[NationalIssues] Background evaluation failed:", err);
    });
  }
  ```

- **Forced resolution** — `src/server/api/routers/national-issues/player.ts:318-353`,
  inside `dismiss`:

  ```ts
  if (issue.deadlineIxTime) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot dismiss issues with deadlines",
    });
  }
  ```

- **Engagement reward** — `src/lib/national-issues-consequences.ts:387-396`,
  inside the private `calculateIxCredits`:

  ```ts
  private static calculateIxCredits(issue: any, isAutoResolve: boolean): number {
    if (isAutoResolve) return 0; // No reward for inaction

    const severityRewards: Record<string, number> = {
      critical: 25, CRITICAL: 25,
      high: 15, HIGH: 15,
      medium: 8, MEDIUM: 8,
      low: 3, LOW: 3,
    };
    // ... (returns reward by severity)
  }
  ```

There may also be a **deadline auto-resolver** (force-resolves expired issues with
`isAutoResolve = true`). You will locate and gate it in Step 4.

**Convention to follow** — there is no existing global feature-flag module in
`src/lib/` for gameplay; you will create a small one. Match the project's plain
TypeScript module style (see any file in `src/lib/`, e.g. `src/lib/ixtime.ts`
for the export-const-object idiom). Mark the deliberate default with a `ponytail:`
comment as is done elsewhere in the repo.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (file) | `bun run typecheck:file src/lib/national-issues-consequences.ts` | exit 0, no errors |
| Typecheck (file) | `bun run typecheck:file src/server/api/routers/national-issues/player.ts` | exit 0, no errors |
| Tests | `bun run test -- src/lib/gameplay-flags.test.ts` | all pass |
| Lint | `bun run lint` | exit 0 (pre-existing warnings tolerated) |

(Never run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build` — they OOM the server.)

## Scope

**In scope** (the only files you should modify/create):
- `src/lib/gameplay-flags.ts` (create)
- `src/lib/gameplay-flags.test.ts` (create)
- `src/server/api/routers/national-issues/player.ts` (gate auto-gen + dismiss)
- `src/lib/national-issues-consequences.ts` (gate credits)
- `src/lib/national-issues-engine.ts` (ONLY if Step 4 finds a deadline
  auto-resolver here — gate it; otherwise do not touch)

**Out of scope** (do NOT touch):
- `src/server/api/routers/national-issues/templates.ts` — DM authoring is plan 034.
- The consequence *application* logic (the part that mutates Country fields on
  resolve) — that stays exactly as-is; a player who *chooses* to resolve an issue
  still gets the real effects. We only gate auto-spawn, forced-dismiss, and credits.
- `seedSplashShowcaseIssues` — the splash seed uses `forceGenerate` directly and
  should keep working regardless of the flag. Do not gate it.

## Git workflow

- Branch: `advisor/033-issues-narrative-mode`
- Conventional commits, e.g. `feat(issues): make auto-gen/deadlines/credits opt-in (narrative mode default)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the gameplay-flags module

Create `src/lib/gameplay-flags.ts`:

```ts
/**
 * Gameplay feature flags.
 *
 * Default posture is "narrative mode": the browser-game-style loops are OFF.
 * Issues are optional prompts (surfaced by community DMs via plan 034), not an
 * auto-spawning chore queue with deadlines and reward farming. An operator can
 * opt back into the classic NationStates-style loop by setting the env vars.
 *
 * ponytail: global flags read from env at module load — simplest reversible
 * switch, no DB migration. Upgrade path: if per-world or per-country control is
 * ever needed, replace these reads with a settings lookup keyed by world/country.
 */
function envBool(name: string, dflt: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return dflt;
  return v === "1" || v.toLowerCase() === "true";
}

export const GAMEPLAY_FLAGS = {
  /** Auto-generate national issues from country state when the inbox is opened. */
  issuesAutoGenerate: envBool("ISSUES_AUTO_GENERATE", false),
  /** Enforce issue deadlines: block dismiss of deadline issues + auto-resolve on expiry. */
  issuesEnforceDeadlines: envBool("ISSUES_ENFORCE_DEADLINES", false),
  /** Award IxCredits for resolving issues (engagement reward). */
  issuesAwardCredits: envBool("ISSUES_AWARD_CREDITS", false),
} as const;
```

**Verify**: `bun run typecheck:file src/lib/gameplay-flags.ts` → exit 0.

### Step 2: Gate auto-generation in `getMyIssues`

In `src/server/api/routers/national-issues/player.ts`, add the import near the
other imports (top of file):

```ts
import { GAMEPLAY_FLAGS } from "~/lib/gameplay-flags";
```

Then wrap the existing evaluation block so it only runs when auto-gen is on:

```ts
// Auto-generation is opt-in (narrative mode is the default). When off, issues
// only appear via DM injection (plan 034) or prior generation.
if (GAMEPLAY_FLAGS.issuesAutoGenerate) {
  const shouldEval = await NationalIssuesEngine.shouldEvaluate(input.countryId, ctx.db as any);
  if (shouldEval) {
    NationalIssuesEngine.evaluateCountry(
      input.countryId,
      ctx.db as any,
      input.domain ? { forceDomain: input.domain } : undefined
    ).catch((err) => {
      console.error("[NationalIssues] Background evaluation failed:", err);
    });
  }
}
```

The rest of `getMyIssues` (the query + return) is unchanged.

**Verify**: `bun run typecheck:file src/server/api/routers/national-issues/player.ts` → exit 0.

### Step 3: Make deadline issues dismissible when deadlines aren't enforced

In the same file, in the `dismiss` mutation, gate the deadline block:

```ts
if (GAMEPLAY_FLAGS.issuesEnforceDeadlines && issue.deadlineIxTime) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Cannot dismiss issues with deadlines",
  });
}
```

Leave the subsequent `status !== "pending" && status !== "viewed"` check as-is.

### Step 4: Gate the deadline auto-resolver (if one exists)

Find where expired issues are force-resolved:

`grep -rn "isAutoResolve: true\|isAutoResolve = true\|resolveIssue(.*true)\|auto_resolved\|expired" src/lib/national-issues-engine.ts src/server/api/routers/national-issues/`

If there is a code path that auto-resolves or expires issues on deadline
(passing `isAutoResolve = true` to `resolveIssue`, or setting status to
`auto_resolved`/`expired` based on `deadlineIxTime`), wrap that path in
`if (GAMEPLAY_FLAGS.issuesEnforceDeadlines) { ... }` so deadlines do nothing in
narrative mode. Import `GAMEPLAY_FLAGS` into that file if needed.

**If you cannot clearly identify a single deadline auto-resolver path, STOP and
report** what you found rather than guessing — gating the wrong branch could
suppress legitimate player-initiated resolution.

### Step 5: Gate the IxCredits reward

In `src/lib/national-issues-consequences.ts`, add the import:

```ts
import { GAMEPLAY_FLAGS } from "./gameplay-flags";
```

In `calculateIxCredits`, return 0 when the reward loop is off (first line of the
method body, before the existing `isAutoResolve` check):

```ts
private static calculateIxCredits(issue: any, isAutoResolve: boolean): number {
  if (!GAMEPLAY_FLAGS.issuesAwardCredits) return 0; // narrative mode: no reward farming
  if (isAutoResolve) return 0; // No reward for inaction
  // ... existing severity table unchanged
}
```

**Verify**: `bun run typecheck:file src/lib/national-issues-consequences.ts` → exit 0.

### Step 6: Write the flag test

Create `src/lib/gameplay-flags.test.ts` — model its structure after any existing
`*.test.ts` in the repo (e.g. look at `src/server/api/routers/__tests__/policies.test.ts`
for the import + `describe/it/expect` shape; this is a plain Jest test, no tRPC harness needed).

Because flags are read at module load, test the parser via the documented
behavior: defaults are `false`, and `"1"`/`"true"` flip them. Use
`jest.isolateModules` + `process.env` mutation to re-import with different env:

```ts
describe("GAMEPLAY_FLAGS", () => {
  const ENV = process.env;
  afterEach(() => { process.env = ENV; });

  it("defaults all issue loops OFF (narrative mode)", () => {
    jest.isolateModules(() => {
      process.env = { ...ENV };
      delete process.env.ISSUES_AUTO_GENERATE;
      delete process.env.ISSUES_ENFORCE_DEADLINES;
      delete process.env.ISSUES_AWARD_CREDITS;
      const { GAMEPLAY_FLAGS } = require("./gameplay-flags");
      expect(GAMEPLAY_FLAGS.issuesAutoGenerate).toBe(false);
      expect(GAMEPLAY_FLAGS.issuesEnforceDeadlines).toBe(false);
      expect(GAMEPLAY_FLAGS.issuesAwardCredits).toBe(false);
    });
  });

  it("opts into the classic loop when env flags are set", () => {
    jest.isolateModules(() => {
      process.env = { ...ENV, ISSUES_AUTO_GENERATE: "1", ISSUES_AWARD_CREDITS: "true" };
      const { GAMEPLAY_FLAGS } = require("./gameplay-flags");
      expect(GAMEPLAY_FLAGS.issuesAutoGenerate).toBe(true);
      expect(GAMEPLAY_FLAGS.issuesAwardCredits).toBe(true);
    });
  });
});
```

**Verify**: `bun run test -- src/lib/gameplay-flags.test.ts` → all pass.

## Test plan

- New: `src/lib/gameplay-flags.test.ts` — covers (a) defaults are all `false`,
  (b) `"1"`/`"true"` env values flip them on. This guards the money-ish reward
  path (credits) and the auto-spawn default.
- Structural pattern: follow `src/server/api/routers/__tests__/policies.test.ts`.
- The procedure-level branches (auto-gen / dismiss / auto-resolve) are simple
  guards; they are covered by typecheck + lint + the flag test. No tRPC
  integration test is required.

## Done criteria

ALL must hold:

- [ ] `src/lib/gameplay-flags.ts` exists and exports `GAMEPLAY_FLAGS` with three `false`-default flags
- [ ] `getMyIssues` only calls `evaluateCountry` when `GAMEPLAY_FLAGS.issuesAutoGenerate`
- [ ] `dismiss` only blocks deadline issues when `GAMEPLAY_FLAGS.issuesEnforceDeadlines`
- [ ] `calculateIxCredits` returns 0 when `GAMEPLAY_FLAGS.issuesAwardCredits` is false
- [ ] Any deadline auto-resolver is gated behind `issuesEnforceDeadlines` (or Step 4 reported as unclear)
- [ ] `bun run test -- src/lib/gameplay-flags.test.ts` passes
- [ ] `bun run typecheck:file` passes for both edited backend files
- [ ] `bun run lint` exits 0
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift).
- Step 4: you cannot unambiguously identify the deadline auto-resolver path.
- `calculateIxCredits` has been refactored to not be a single private method, or
  credits are awarded somewhere other than this method.
- Gating auto-generation appears to break `seedSplashShowcaseIssues` or any
  non-issue feature (it should not — they use `forceGenerate` directly).

## Maintenance notes

- These flags are global (env-driven). If the platform later wants per-world or
  per-country control (e.g. one community runs the classic loop, another runs
  pure narrative), replace the `envBool` reads with a settings lookup — the call
  sites stay the same. This is the documented upgrade path in the module header.
- Plan 034 (DM event injection) is the intended *replacement* source of issues in
  narrative mode. Land 033 and 034 together for a coherent player experience, or
  land 033 first and accept that inboxes go quiet until 034 ships.
- Reviewer: confirm the consequence-*application* path (Country field mutation on
  a player-chosen resolve) is untouched — we only removed the auto/forced/reward
  scaffolding, not the actual decision→effect link.
