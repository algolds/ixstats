# Plan 132: Onoma Feature — Customized IRL Culture & Template/Dictionary Phonetics & Speech Engine

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7508ff4d..HEAD -- src/lib/onoma/phonology.ts src/lib/onoma/types.ts`

## Status

- **Status**: DONE
- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/131-onoma-realtime-formant-spectrogram-visualizer.md
- **Category**: direction
- **Planned at**: commit `7508ff4d`, 2026-08-18

## Why this matters

Currently, generated fantasy templates (Elves, Dwarves, Orcs, Goblins, Taverns, Orders, Noble lineages) fall back to generic Latin/English phonetic rules and speech settings, producing inaccurate pronunciation (e.g. Elvish *dh* mispronounced as /d.h/ instead of [ð], Norman *Fitz-* mispronounced as /fɪts/, Dwarvish *kh* as /k/ instead of [x]). Furthermore, IRL linguistic family rules lack nuanced diacritics and regional stress placement.

Adding dedicated linguistic profiles for all 18+ templates, deepening the 13 natural language families, integrating dictionary-level custom phonology in Stash/Lexicon, and establishing the canonical "Hello World" benchmark ensures high-fidelity pronunciation across the entire platform.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Install   | `bun install` | exit 0 |
| Tests     | `bun run test -- src/lib/onoma` | all pass |
| Lint      | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/lib/onoma/template-phonetics.ts` (CREATE: 18+ dedicated template linguistic profiles)
- `src/lib/onoma/phonology.ts` (UPGRADE: 13 IRL culture phonetic tables + 5-tier fallback resolver)
- `src/lib/onoma/types.ts` (UPGRADE: `LinguisticProfile`, `ResolvedNamePhonetics`, `StashNoteMetadataSchema`)
- `src/lib/onoma/template-phonetics.test.ts` (CREATE: Canonical "Hello World" benchmark suite)
- `src/hooks/useOnomaGenerator.ts` (Integrate resolved template phonetics into generation output)
- `src/app/labs/onoma/components/sections/studio/StudioPhonology.tsx` (Add template profile picker)
- `src/app/labs/onoma/components/sections/studio/StudioLexicon.tsx` (Add dictionary-level phonology selector)
- `src/app/labs/onoma/components/shared/NameResultCard.tsx` (Wire template BCP-47 voice tags and Kokoro personas)

**Out of scope**:
- Server-side Python ML G2P models.

## Steps

### Step 1: Define `LinguisticProfile` and Types in `src/lib/onoma/types.ts`
Add `LinguisticProfile`, `ResolvedNamePhonetics`, and extend `StashNoteMetadataSchema` with optional `phonology`.

### Step 2: Build `src/lib/onoma/template-phonetics.ts`
Implement 18+ template profiles (`species:elf`, `species:dwarf`, `species:orc`, `species:goblin`, `species:dragon`, `species:faery`, `species:demon`, `species:angel`, `organization:tavern`, `organization:mystic-order`, `noble:norman`, `noble:norse`, `noble:celtic`, `noble:germanic`, `noble:arabic`, `noble:slavic`, `noble:iberian`).

### Step 3: Upgrade `src/lib/onoma/phonology.ts`
1. Deepen all 13 natural culture phonetic rule tables with diacritics, digraphs, and regional stress marks.
2. Implement 5-tier hierarchical resolver `resolveNamePhonetics(name, options)`.

### Step 4: Write Canonical "Hello World" Benchmark Suite in `src/lib/onoma/template-phonetics.test.ts`
Write comprehensive tests validating the `"Hello World"` phonetic output across all 13 cultures and 18+ templates.

### Step 5: Wire UI Components (`StudioPhonology.tsx`, `StudioLexicon.tsx`, `NameResultCard.tsx`)
1. In `StudioPhonology.tsx`, populate the culture selector with both IRL families and fantasy templates.
2. In `StudioLexicon.tsx`, wire dictionary-level phonology presets.
3. In `NameResultCard.tsx`, pass resolved `bcp47VoiceTag` and `kokoroVoicePersona` to audio triggers.

**Verify**: `bun run test -- src/lib/onoma` → all pass

## Done criteria

- [x] All 13 IRL culture phonetic tables upgraded with authentic diacritics and stress rules
- [x] 18+ template linguistic profiles authored in `template-phonetics.ts`
- [x] 5-tier hierarchical phonetic resolver implemented
- [x] Canonical "Hello World" benchmark test suite passing across all cultures and templates
- [x] Status updated in `plans/README.md`
