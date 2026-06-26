# Plan 068: Integrate reasoning-capable sports LLM commentary

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat d4b7d3b6..HEAD -- src/lib/sports/commentary/narrator.ts src/server/api/routers/sports/seasons/matches.ts src/server/api/routers/sports/seasons/lifecycle.ts src/components/myleague/ScheduleView.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (flag-gated, async background execution)
- **Depends on**: plans/065-sports-llm-commentary-spike.md (DONE)
- **Category**: direction (feature)
- **Planned at**: commit `d4b7d3b6`, 2026-06-17

## Why this matters

Now that the commentary spike (Plan 065) has successfully run, we want to integrate the high-reasoning `nvidia/nemotron-3-ultra-550b-a55b` model into production. The integration must run asynchronously in the background immediately after match simulation, saving the final play-by-play commentary arrays into the existing `matchStats` JSON database column to prevent blocking the user experience or needing database migrations. In the UI, the commentary will render seamlessly, falling back to basic templated text if LLM generation fails or is disabled.

## Current State

- `src/lib/sports/commentary/narrator.ts` — Contains the `narrateEvents` helper. It needs to be updated to support the new `nvidia/nemotron-3-ultra-550b-a55b` model, setting `reasoning_budget: 16384` and `chat_template_kwargs: { enable_thinking: true }`.
- `src/server/api/routers/sports/seasons/matches.ts` — Executes `simulateMatchDay` and `simulatePlayoffRound` mutations. We need to trigger `narrateEvents` asynchronously in the background.
- `src/server/api/routers/sports/seasons/lifecycle.ts` — `getMatchDetails` query returns match records. We need to explicitly pass through the `commentary` field from the `matchStats` JSON.
- `src/components/myleague/ScheduleView.tsx` — Renders chronological match trace steps. We need to swap the plain `step.description` for `commentary[idx]` when available.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `bun run typecheck:file src/server/api/routers/sports/seasons/matches.ts` | exit 0 |
| Tests | `bun run test -- src/lib/sports/feed-bulletins.test.ts` | all pass |
| Lint | `bun run lint` | exit 0 (no new errors in touched files) |

Do **NOT** run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`.

## Scope

**In scope**:
- `src/lib/sports/commentary/narrator.ts`
- `src/server/api/routers/sports/seasons/matches.ts`
- `src/server/api/routers/sports/seasons/lifecycle.ts`
- `src/components/myleague/ScheduleView.tsx`

**Out of scope**:
- Database schema changes (reusing `matchStats` JSON is required).
- Streaming UI comments.

## Git workflow

- Branch: `advisor/068-sports-llm-commentary-integration`
- Conventional commit message, e.g. `feat(sports): integrate reasoning-capable LLM commentary`

---

## Steps

### Step 1: Update Narrator to use `nemotron-3-ultra-550b-a55b` with reasoning parameters

Modify `src/lib/sports/commentary/narrator.ts` to:
1. Default the `nvidia` provider's model to `nvidia/nemotron-3-ultra-550b-a55b`.
2. Add the custom headers/body payload properties `reasoning_budget: 16384` and `chat_template_kwargs: { enable_thinking: true }` when calling the NVIDIA endpoints.
3. Keep the API call non-streaming.

**Verify**: `bun run typecheck:file src/lib/sports/commentary/narrator.ts` → exit 0.

### Step 2: Wire up Background Async Narration in Match Mutations

In `src/server/api/routers/sports/seasons/matches.ts`:
1. In `simulateMatchDay`, inside the resolved results loop, add an asynchronous fire-and-forget block to generate the commentary and update `matchStats` in the database.
2. In `simulatePlayoffRound`, do the same for bracket results.

Background updates must use a safe try-catch container:
```ts
void (async () => {
  try {
    const { narrateEvents } = await import("~/lib/sports/commentary/narrator");
    const commentary = await narrateEvents(result.trace as any[], { sport: season.league.sportPreset });
    if (commentary && commentary.length > 0) {
      await ctx.db.sportMatch.update({
        where: { id: match.id },
        data: {
          matchStats: {
            ...((match.matchStats as any) || {}),
            commentary,
          } as any,
        },
      });
    }
  } catch (err) {
    console.error("[simulateMatchDay] background commentary failed:", err);
  }
})();
```

**Verify**: `bun run typecheck:file src/server/api/routers/sports/seasons/matches.ts` → exit 0.

### Step 3: Pass Through Commentary in getMatchDetails tRPC Query

In `src/server/api/routers/sports/seasons/lifecycle.ts`, update `getMatchDetails` query response mapping (around line 440):
```ts
        const stats = match.matchStats as any;
        return {
          ...match,
          evaluation: stats?.evaluation ?? null,
          trace: stats?.trace ?? null,
          commentary: stats?.commentary ?? null,
        };
```

**Verify**: `bun run typecheck:file src/server/api/routers/sports/seasons/lifecycle.ts` → exit 0.

### Step 4: Render Commentary in the Schedule View UI

In `src/components/myleague/ScheduleView.tsx`, update the `MatchCommentary` component (around line 121):
1. Extract `commentary` from the match response:
   ```ts
   const commentary = (match as any).commentary as string[] | null;
   ```
2. In the `trace.map((step, idx) => ...)` loop, swap the description for the corresponding commentary index if present:
   ```ts
   const displayDescription = (commentary && commentary[idx]) || step.description;
   ```
3. Render `{displayDescription}` instead of `{step.description}`.

---

## Test Plan

- Verify fallback behavior when `SPORTS_LLM_COMMENTARY=false` is set:
  `bun run scripts/eval-sports-commentary.ts` runs and outputs the default templates instantly.
- Test LLM generation using the eval script with the NVIDIA API key:
  `SPORTS_LLM_COMMENTARY=true SPORTS_LLM_API_KEY="nvapi-..." bun run scripts/eval-sports-commentary.ts`

## Done Criteria

- [ ] `bun run typecheck:file src/lib/sports/commentary/narrator.ts` exits 0
- [ ] `bun run typecheck:file src/server/api/routers/sports/seasons/lifecycle.ts` exits 0
- [ ] All unit tests pass cleanly
- [ ] UI correctly falls back to templated text if `commentary` is absent
- [ ] `plans/README.md` status row updated to DONE

## STOP Conditions

- If a background query fails due to a locked connection or transaction bounds.
- If the model schema returns reasoning blockages or JSON format mismatches in tests.
