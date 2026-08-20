# Plan 130: Onoma Feature — Historical Sound Change & Language Evolution Engine

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7508ff4d..HEAD -- src/lib/onoma/ src/app/labs/onoma/components/sections/studio/`

## Status

- **Status**: DONE
- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/128-onoma-typescript-strict-schemas-and-domain-branding.md
- **Category**: direction
- **Planned at**: commit `7508ff4d`, 2026-08-18

## Why this matters

In worldbuilding and linguistics, natural languages do not exist in a vacuum—they evolve through systematic phonological sound changes (e.g. Grimm's Law, palatalization, vowel shifts). Currently, Onoma generates static conlang snapshots. Introducing a rule-based Sound Change Engine allows creators to input a Proto-Language lexicon, define ordered phonetic sound shifts across chronological epochs, and automatically simulate daughter languages and dialect branches with full IPA derivation tracking.

## Current state

- Onoma has static IPA phonology (`src/lib/onoma/phonology.ts`) and Etymology trees (`src/server/api/routers/onoma/etymology.ts`), but no chronological sound shift rule interpreter (e.g. `X > Y / _Z`).

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Install   | `bun install` | exit 0 |
| Tests     | `bun run test -- src/lib/onoma` | all pass |
| Lint      | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/lib/onoma/sound-shifts.ts` (CREATE: Rule parser & execution engine)
- `src/lib/onoma/sound-shifts.test.ts` (CREATE: Unit tests for sound change rules)
- `src/app/labs/onoma/components/sections/studio/StudioSoundShifts.tsx` (CREATE: Sound shift UI panel)
- `src/lib/onoma/types.ts` (Register sound shifts types and sub-tab)
- `src/app/labs/onoma/components/OnomaRouter.tsx` (Wire Studio subtab)

**Out of scope**:
- Modifying underlying Prisma schema models.

## Git workflow

- Branch: `feature/onoma-sound-shifts`
- Commit style: `feat(onoma): <summary>`

## Steps

### Step 1: Implement the Sound Shift Rule Engine in `src/lib/onoma/sound-shifts.ts`

Create `src/lib/onoma/sound-shifts.ts` supporting standard linguistic sound shift syntax:
- `pattern`: target sound (e.g. `k`, `p`, `ai`, `t`)
- `replacement`: evolved sound (e.g. `tʃ`, `f`, `eː`, `d`)
- `environment`: optional phonetic context (e.g. `_i`, `_#` word-final, `#_` word-initial, `V_V` intervocalic).

```typescript
export interface SoundShiftRule {
  id: string;
  source: string;
  target: string;
  context?: string; // e.g. "_[ei]", "V_V", "#_", "_#"
  description?: string;
}

export interface SoundShiftEpoch {
  name: string;
  rules: SoundShiftRule[];
}

export interface EvolutionStep {
  epochName: string;
  ruleDescription: string;
  before: string;
  after: string;
}

export interface WordEvolutionResult {
  original: string;
  final: string;
  steps: EvolutionStep[];
}

export function applySoundShifts(
  words: string[],
  epochs: SoundShiftEpoch[]
): WordEvolutionResult[] {
  return words.map((word) => {
    let current = word.toLowerCase().trim();
    const steps: EvolutionStep[] = [];

    for (const epoch of epochs) {
      for (const rule of epoch.rules) {
        const prev = current;
        current = applySingleRule(current, rule);
        if (prev !== current) {
          steps.push({
            epochName: epoch.name,
            ruleDescription: `${rule.source} → ${rule.target}${rule.context ? ` / ${rule.context}` : ""}`,
            before: prev,
            after: current,
          });
        }
      }
    }

    return {
      original: word,
      final: current,
      steps,
    };
  });
}
```

**Verify**: `bun run test -- src/lib/onoma/sound-shifts.test.ts` → all pass

### Step 2: Build `StudioSoundShifts.tsx` in Studio

Create `src/app/labs/onoma/components/sections/studio/StudioSoundShifts.tsx`:
1. Rule list builder: Add, delete, and re-order sound shifts with drag/drop or up/down triggers.
2. Preset shifts catalog (Grimm's Law, Slavic Palatalization, Great Vowel Shift, Latin-to-Romance Lenition).
3. Real-time side-by-side lexicon diff: Proto-Word vs Evolved Daughter Word with IPA audio synthesis.

**Verify**: `bun run lint` → exit 0

### Step 3: Wire into Studio Tabs in `OnomaRouter.tsx`

1. In `src/lib/onoma/types.ts`, add `"shifts"` to `StudioSubTab`.
2. Add the sub-tab button with icon `GitFork` or `Clock` in `OnomaRouter.tsx`.

**Verify**: `bun run test -- src/lib/onoma` → all pass

## Test plan

- Test Grimm's Law simulation: `pater` → `father`, `tres` → `three`, `kann` → `can`.
- Test palatalization context rule `k → tʃ / _[ie]`: `ker` → `tʃer`, but `kor` → `kor`.
- Test multi-epoch compound shifts with full derivation step tracking.

## Done criteria

- [x] `sound-shifts.ts` rule engine passes unit tests with 100% test coverage
- [x] Interactive `StudioSoundShifts.tsx` integrated in Onoma Studio
- [x] Derivation steps accurately trace phonetic transformations
- [x] Status updated in `plans/README.md`
