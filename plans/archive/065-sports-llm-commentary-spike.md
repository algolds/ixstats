# Plan 065: Spike — free-LLM (Nemotron 3 Ultra) commentary inference for the sports sim

> **Executor instructions**: This is a **research spike**. The deliverable is a
> decision document plus a thin, flag-gated prototype — NOT a production feature.
> Do not wire the LLM into the live simulation path. Follow the steps, record
> findings, and STOP for a human decision at the gate. Update the status row in
> `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat d4b7d3b6..HEAD -- src/lib/sports/resolver.ts`
> If `resolver.ts` changed materially, re-read its event/result shape before
> relying on the excerpts here.

## Status

- **Priority**: P3 (research)
- **Effort**: M
- **Risk**: LOW (spike; flag-gated, no production wiring)
- **Depends on**: none (informs `plans/063-*` increment C2 / Plan 068)
- **Category**: direction (spike)
- **Planned at**: commit `d4b7d3b6`, 2026-06-17

## Why this matters

The owner is considering a free LLM (Nemotron 3 Ultra free, or an alternative)
to generate richer per-sport play-by-play commentary. Before committing to an
integration, we need an evidence-based decision on quality, latency, cost,
reliability, and — critically — **architecture safety**: the simulator is
deterministic (seeded RNG in `resolver.ts`), and that invariant must not be
compromised. The right shape is an **async narration layer** that consumes
already-resolved events and produces flavor text, with a templated fallback that
is always present. This spike validates whether a free LLM can do that well
enough to bother, and produces a go/no-go recommendation.

## Hard invariant (non-negotiable)

The LLM **must never affect match outcomes**. `resolveMatch`/`resolveRace`
(`src/lib/sports/resolver.ts`) stay pure and seeded. The LLM only *describes* a
result/event stream that already exists. Any prototype that feeds LLM output back
into scoring, standings, or RNG is an automatic STOP/redesign.

## Current state (context for the spike)

- `resolveMatch(...)` (`resolver.ts:270`) returns an `ExtendedMatchResult` with a
  per-sport event list (the `description: "..."` strings around lines 2048–2075
  are the current templated commentary — e.g. "Tactical Shift: …"). This event
  stream is the LLM's input.
- There is **no existing LLM client in the sports path** (grep confirmed). If the
  repo has a shared Anthropic/LLM client elsewhere, prefer reusing its config
  pattern; otherwise the spike adds an isolated, flagged client.
- The project default for AI work is the latest Claude models (see the repo's
  AI guidance) — include Claude as a quality/cost baseline in the comparison even
  though the prompt names Nemotron, so the recommendation is grounded.

## Deliverables

1. **A decision document**: `docs/research/sports-llm-commentary.md` (create)
   covering, with measured numbers where possible:
   - Candidates: Nemotron 3 Ultra (free tier), plus ≥2 alternatives (a free/cheap
     hosted option and a Claude baseline). For each: access method, rate/again
     limits, latency (p50/p95 for a ~200-token commentary completion), cost at
     projected volume, output quality on the per-sport prompt, and reliability.
   - Recommended architecture: async, post-resolution narration; flag-gated;
     templated fallback; where it would attach (the `resolveMatch` event stream
     feeding Plan 068).
   - Go / no-go recommendation with the reasoning.
2. **A thin, flag-gated prototype** behind an env flag (default OFF), proving the
   async narration path end-to-end on **one** sport, without touching the
   simulation:
   - `src/lib/sports/commentary/narrator.ts` (create): `async function narrateEvents(events, { sport }): Promise<string[]>` that, when the flag is on, calls the chosen LLM; when off or on any error, returns the existing templated strings (the fallback is the source of truth).
   - The flag: `SPORTS_LLM_COMMENTARY` (read from env; OFF unless explicitly set).
   - **Do not call `narrateEvents` from `simulateMatchDay`/`resolver` yet** — the
     prototype is exercised by the test/eval script only.
3. **An eval script** `scripts/eval-sports-commentary.ts` that runs a fixed set
   of resolved-event fixtures through `narrateEvents` for each candidate and
   prints latency + output for side-by-side comparison (used to fill the doc).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (narrator) | `bun run typecheck:file src/lib/sports/commentary/narrator.ts` | exit 0 |
| Run eval | `bun run scripts/eval-sports-commentary.ts` | prints comparison; exit 0 |
| Lint | `bun run lint` | exit 0 (no new error in touched files) |

Do **NOT** run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`.
Do **NOT** commit any API key — read keys from env only; if a key is needed and
absent, the eval prints "skipped (no key)" for that candidate.

## Scope

**In scope** (spike artifacts only):
- `docs/research/sports-llm-commentary.md` (create)
- `src/lib/sports/commentary/narrator.ts` (create — flag-gated, fallback-first)
- `scripts/eval-sports-commentary.ts` (create)

**Out of scope** (explicitly):
- `src/lib/sports/resolver.ts` and the simulation mutations — **no edits**. The
  narrator is not wired into them in this spike.
- Production rollout, caching, queueing — those come *after* the go decision
  (Plan 068).
- Any new runtime dependency beyond a single LLM HTTP client; prefer `fetch`.

## Steps

### Step 1: Narrator with templated fallback (flag OFF default)
Create `src/lib/sports/commentary/narrator.ts`. With the flag off (default) or on
any LLM error/timeout, return the templated commentary unchanged. Only when the
flag is on does it attempt an LLM call. This guarantees the sim is never blocked.

**Verify**: `bun run typecheck:file src/lib/sports/commentary/narrator.ts` → exit 0.
Manually confirm: flag unset → returns templated strings without any network call.

### Step 2: Eval script + fixtures
Create `scripts/eval-sports-commentary.ts` with 2–3 hardcoded resolved-event
fixtures per sport (soccer, F1, boxing minimum), run them through each configured
candidate, and print latency + output. Missing keys → "skipped".

**Verify**: `bun run scripts/eval-sports-commentary.ts` → prints a comparison
table; exit 0 even when some candidates are skipped for missing keys.

### Step 3: Write the decision doc
Fill `docs/research/sports-llm-commentary.md` from the eval output + research on
limits/cost. End with a clear go/no-go and the recommended attach point.

### Step 4: STOP at the decision gate
Do **not** proceed to wire anything. Report the recommendation and hand off the
go/no-go to the human. If "go", a follow-up (Plan 068) does the production
integration.

## Done criteria

ALL must hold:

- [ ] `docs/research/sports-llm-commentary.md` exists with candidate comparison + go/no-go
- [ ] `src/lib/sports/commentary/narrator.ts` exists; with the flag OFF it returns templated text and makes no network call
- [ ] `scripts/eval-sports-commentary.ts` runs and prints a comparison (skips missing-key candidates)
- [ ] `grep -rn "resolveMatch\|resolveRace" src/lib/sports/commentary/narrator.ts` → no matches (no coupling to outcome computation)
- [ ] `git status` shows only the three spike files (no `resolver.ts` / mutation edits)
- [ ] `bun run lint` exits 0; `bun run typecheck:file` clean on the narrator
- [ ] `plans/README.md` status row updated to DONE with the recommendation summarized

## STOP conditions

Stop and report back (do not improvise) if:

- The only way to get usable latency is to call the LLM **inside** the sim path —
  that violates the determinism invariant; report it as a no-go reason instead.
- Nemotron 3 Ultra "free" has no usable programmatic access (no API / blocking
  rate limits) — record that and lean on the alternatives for the recommendation.
- A candidate requires a paid key the operator hasn't provided — skip it in the
  eval (don't block), and note the gap in the doc.

## Maintenance notes

- The decision doc + flag-gated narrator are the durable artifacts; the eval
  script can be deleted after the decision or kept for regression of prompt
  quality.
- If "go": Plan 068 wires `narrateEvents` as **async enrichment** of the resolved
  event stream (never blocking the sim), with caching keyed by `(matchId, seed)`
  so narration is itself reproducible, plus per-sport prompts.
- Keep the determinism grep (`narrator` must not import the resolver's outcome
  functions) as a permanent review check.
