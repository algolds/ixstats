# Plan 040: Defense conflicts produce canon — fire the conflict news templates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3a52c4a..HEAD -- src/server/api/routers/security/operations.ts src/lib/diplomatic-news-generator.ts`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `f3a52c4a`, 2026-06-15

## Why this matters

Wars resolve silently. The news generator already defines three conflict
templates — `pvp_conflict_proposed`, `pvp_conflict_accepted`,
`pvnpc_conflict_resolved` (diplomatic-news-generator.ts:102-113) — but
`operations.ts` only ever fires `military_deployed` (operations.ts:355). So when
a player proposes/accepts a PvP conflict or strikes an NPC, the conflict is
recorded in the DB and shown in the Defense panel, but **never appears as canon**
(no ThinkPages post, nothing in the national story).

This is the same "action → canon" pattern the Politics elections system already
implements well (`simulateElection` fires `election_result` news at
elections.ts:528). This plan brings Defense up to that bar with three
fire-and-forget news calls — cheap, low-risk, high narrative value.

## Current state

- **`operations.ts` already imports the generator** (line 9):
  `import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";`

- **The exemplar call** (the existing `military_deployed`, operations.ts:355):

  ```ts
  void generateDiplomaticNews(ctx.db as any, input.countryId, "military_deployed", {
    countryName: ...,
    ...
  });
  ```

  Fire-and-forget (`void`), `ctx.db as any`. Match this shape.

- **The three templates** (diplomatic-news-generator.ts:102-113) and the context
  fields they read:
  - `pvp_conflict_proposed` → uses `countryName`, `targetName`, `reason`
  - `pvp_conflict_accepted` → uses `countryName`, `targetName`
  - `pvnpc_conflict_resolved` → uses `countryName`, `targetName`, `winner`

- **`proposePvPConflict`** (operations.ts:453-541) creates the conflict with
  `include: { initiator: { id, name }, defender: { id, name } }` and ends:

  ```ts
      } catch {}

      return conflict;   // line 540
    }),
  ```

- **`respondToConflict`** accept branch (operations.ts:603-638) builds `accepted`
  with the same include and ends with `return accepted;` (line 637). (The decline
  branch at line 573-601 returns earlier — do NOT add news there.)

- **`resolvePvNPCConflict`** (operations.ts:675-803) creates a resolved `conflict`
  with `include: { initiator: { id, name }, defender: { id, name } }`, has
  `initiatorWins: boolean` (line 739) and `initiator` / `defender` vars in scope
  (used at lines 784/794), and ends with `return conflict;` (line 802).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (file) | `bun run typecheck:file src/server/api/routers/security/operations.ts` | exit 0, no errors |
| Lint | `bun run lint` | exit 0 (pre-existing warnings tolerated) |

(Never run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build` — they OOM the server.)

## Scope

**In scope**:
- `src/server/api/routers/security/operations.ts` (add three news calls)

**Out of scope** (do NOT touch):
- The decline branch of `respondToConflict` (no news for a declined conflict).
- Casualty / winner / economic-damage logic — unchanged.
- The news templates themselves — they already exist; do not edit
  `diplomatic-news-generator.ts`.
- Reframing "victory/defeat" semantics — that is a separate design discussion, not
  this plan. Use the existing template wording.

## Git workflow

- Branch: `advisor/040-conflict-canon`
- Conventional commits, e.g. `feat(defense): conflicts post to ThinkPages (canon)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: News on PvP conflict proposed

In `proposePvPConflict`, immediately before `return conflict;` (operations.ts:540),
add:

```ts
void generateDiplomaticNews(ctx.db as any, conflict.initiatorId, "pvp_conflict_proposed", {
  countryName: conflict.initiator.name,
  targetName: conflict.defender.name,
  reason: conflict.reason ?? undefined,
}).catch((err) => console.error("[Defense] Failed to generate conflict-proposed news:", err));
```

### Step 2: News on PvP conflict accepted

In `respondToConflict`, in the **accept** branch, immediately before
`return accepted;` (operations.ts:637), add:

```ts
void generateDiplomaticNews(ctx.db as any, accepted.initiatorId, "pvp_conflict_accepted", {
  countryName: accepted.initiator.name,
  targetName: accepted.defender.name,
}).catch((err) => console.error("[Defense] Failed to generate conflict-accepted news:", err));
```

### Step 3: News on PvNPC conflict resolved

In `resolvePvNPCConflict`, immediately before `return conflict;` (operations.ts:802),
add:

```ts
void generateDiplomaticNews(ctx.db as any, conflict.initiatorId, "pvnpc_conflict_resolved", {
  countryName: conflict.initiator.name,
  targetName: conflict.defender.name,
  winner: initiatorWins ? conflict.initiator.name : conflict.defender.name,
}).catch((err) => console.error("[Defense] Failed to generate conflict-resolved news:", err));
```

**Verify (after all three)**: `bun run typecheck:file src/server/api/routers/security/operations.ts` → exit 0.

Confirm the three calls exist:
`grep -n "pvp_conflict_proposed\|pvp_conflict_accepted\|pvnpc_conflict_resolved" src/server/api/routers/security/operations.ts` → 3 matches.

## Test plan

- No new automated test: these are fire-and-forget side effects matching the
  proven `military_deployed` and `election_result` patterns; news generation has
  no return-value contract callers depend on.
- Manual/browser verification (reviewer note): propose a PvP conflict → a post
  appears on the initiator's government/media ThinkPages account; resolve a PvNPC
  strike → a "concluded" post appears. (Requires the country to have a government
  or media ThinkPages account; `generateDiplomaticNews` no-ops silently if none.)

## Done criteria

ALL must hold:

- [ ] Three `generateDiplomaticNews` calls added (proposed / accepted / resolved), each fire-and-forget with `.catch`
- [ ] The accept-branch call is NOT in the decline branch
- [ ] `grep -n "pvp_conflict_proposed\|pvp_conflict_accepted\|pvnpc_conflict_resolved" src/server/api/routers/security/operations.ts` → 3 matches
- [ ] `bun run typecheck:file src/server/api/routers/security/operations.ts` exits 0
- [ ] `bun run lint` exits 0
- [ ] Only `operations.ts` is modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Current state" excerpt doesn't match (drift) — especially if the
  procedures no longer `include` `initiator`/`defender` with `name`.
- `generateDiplomaticNews` is no longer imported or its signature
  `(db, countryId, eventType, context)` changed.
- The accept and decline branches of `respondToConflict` are no longer distinct.

## Maintenance notes

- This deliberately reuses the existing template wording ("WAR:", "claims
  victory"). A follow-up *direction* discussion may want to reframe conflict
  outcomes as diplomatic settlements rather than win/lose — if that happens, edit
  the templates in `diplomatic-news-generator.ts`, not these call sites.
- These posts will also surface in the unified canon feed (plan 037) once that
  lands, since conflicts create `DiplomaticEvent`/news the feed reads.
- Reviewer: confirm news posts from the *initiator's* country account and that the
  decline path stays silent.
