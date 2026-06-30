# Plan 065: Implement MyLeague V1 Emotional Layer (Story Engine, Morale, Rivalries)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0c488008..HEAD -- prisma/schema/sports.prisma src/lib/sports/commentary/narrator.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `0c488008`, 2026-06-30

## Why this matters

The MyLeague system currently acts as a robust management simulator with numeric inputs and outputs. Adding an "Emotional Layer" (v1) transforms it into an "alive sports world" by generating persistent emotional context. Players are granted morale and personality traits; teams build rivalries; and match simulations are contextualized with dynamic narratives and TTS broadcast audio. This drives deeper engagement, emergent storylines, and better retention without overcomplicating the underlying simulation math.

## Current state

- `prisma/schema/sports.prisma` — Contains `SportPlayer` (which lacks morale/traits) and `SportTeam` (which lacks rivalries).
- `src/lib/sports/commentary/narrator.ts` — Contains the `narrateEvents` LLM play-by-play generator, but it only outputs text, not an audio TTS "broadcast."

Conventions: Use Next.js tRPC backend procedures and standard Prisma relations. The LLM APIs use standard REST via `fetch` (as seen in `queryLLM`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| DB Sync   | `bun run db:push:force`  | exit 0              |
| Typecheck | `bun run typecheck:lib`  | exit 0, no errors   |
| Tests     | `bun run test -- src/tests/sports` | all pass  |

## Scope

**In scope**:
- `prisma/schema/sports.prisma`
- `src/lib/sports/commentary/narrator.ts`
- `src/lib/sports/transition.ts` (or relevant match simulation file)

**Out of scope**:
- Changing the existing UI frontend for match viewing.
- Restructuring the core simulation logic (keep the math the same, just add emotional modifiers/outcomes).

## Steps

### Step 1: Add Emotional Models to Prisma Schema

Update `prisma/schema/sports.prisma` to include Player Personality and Team Rivalries.
Add `morale Int @default(50)` and `traits Json?` to `SportPlayer`.
Create a new `SportRivalry` model:
```prisma
model SportRivalry {
  id          String      @id @default(cuid())
  team1Id     String
  team2Id     String
  intensity   Int         @default(50) // 0-100 scale
  history     Json?
  
  team1       SportTeam   @relation("RivalryTeam1", fields: [team1Id], references: [id], onDelete: Cascade)
  team2       SportTeam   @relation("RivalryTeam2", fields: [team2Id], references: [id], onDelete: Cascade)
  
  @@unique([team1Id, team2Id])
  @@map("sport_rivalries")
}
```
Add the reverse relations `rivalryTeam1 SportRivalry[] @relation("RivalryTeam1")` and `rivalryTeam2 SportRivalry[] @relation("RivalryTeam2")` to `SportTeam`.

**Verify**: `bun run typecheck:db` → exits 0.

### Step 2: Implement Kokoro TTS "Broadcast" Integration

Update `src/lib/sports/commentary/narrator.ts` to add a new function `generateAudioBroadcast` that takes the generated JSON `commentary` strings, stitches them together, and queries a Kokoro TTS Hugging Face Inference API endpoint (using a new env var `SPORTS_TTS_API_URL` and `SPORTS_TTS_API_KEY`).
The output should return a buffer or base64 audio string representing the broadcast.
Fallback safely to `null` if the TTS fails, ensuring the simulation is not blocked.

**Verify**: `bun run typecheck:lib` → exits 0.

### Step 3: Wire Morale and Rivalry to Match Resolution

Update the match simulation logic (likely inside `resolveMatchPredictions` or `transitionSeasonAction` in `src/lib/sports/transition.ts` or wherever matches are resolved) to:
1. Boost home team advantage slightly if a rivalry exists and `intensity > 70`.
2. Increase player `morale` on a win, decrease on a loss.
3. Pass rivalry context to `narrateEvents` so the Story Engine LLM knows it's a "heated derby match."

**Verify**: `bun run test -- src/tests/sports` → all pass.

## Test plan

- Modify `src/tests/sports/integration.test.ts` to explicitly simulate a match between two teams with a `SportRivalry` of intensity 80, asserting that player `morale` updates correctly after the match resolves.

## Done criteria

- [ ] `bun run db:push:force` succeeds.
- [ ] `bun run typecheck:lib` exits 0.
- [ ] `bun run test -- src/tests/sports` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If `prisma/schema/sports.prisma` already has competing personality or rivalry fields.
- If the TTS integration exceeds API timeout limits during tests, STOP and implement background chunking.

## Maintenance notes

- The `SportRivalry` intensity should organically rise over multiple seasons if teams face each other frequently in playoffs. Future expansions should add cron jobs or hooks to naturally decay or increase rivalries.
