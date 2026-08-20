# Plan 126: Centralize Onoma Generation Presets and Ponytail Code Trim

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7508ff4d..HEAD -- src/lib/onoma/ src/server/api/routers/onoma/ src/hooks/useOnomaGenerator.ts src/app/labs/onoma/components/sections/MarkovVisualizer.tsx`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/125-onoma-production-basepath-and-server-batch-fixes.md
- **Category**: tech-debt
- **Planned at**: commit `7508ff4d`, 2026-08-18
- **Status**: DONE

## Why this matters

The preset name generation logic (e.g. Goblin, Orc, Dwarf, Mystic Order, Military Unit, Tavern, Noble Surname) is copy-pasted across `src/hooks/useOnomaGenerator.ts` and `src/server/api/routers/onoma/batch.ts` (85 duplicated lines). When a preset is added or adjusted, client and server outputs drift. Furthermore, `src/lib/onoma/export.ts` contains dead export utilities never referenced across the application, and `MarkovVisualizer.tsx` uses an ad-hoc inline `SpeechSynthesisUtterance` instead of the central `speakBrowserNative` helper. Centralizing generation logic and trimming dead code reduces surface area and prevents drift.

## Current state

- `src/hooks/useOnomaGenerator.ts:250-327` and `src/server/api/routers/onoma/batch.ts:220-304`:
  Identical 80+ lines of preset routing logic.
- `src/lib/onoma/export.ts`:
  Exports `exportToJSON` and `exportToCSV` which are not imported by any file in `src/`.
- `src/app/labs/onoma/components/sections/MarkovVisualizer.tsx:286-292`:
  Constructs raw `new SpeechSynthesisUtterance` bypassing rate, pitch, and language settings.
- `src/lib/onoma/markov-chain.ts:33,53,60`:
  Unused legacy getters (`character`, `start`, `map`).

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Install   | `bun install` | exit 0 |
| Tests     | `bun run test -- src/lib/onoma` | all pass |
| Lint      | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/lib/onoma/name-generator.ts`
- `src/hooks/useOnomaGenerator.ts`
- `src/server/api/routers/onoma/batch.ts`
- `src/app/labs/onoma/components/sections/MarkovVisualizer.tsx`
- `src/lib/onoma/markov-chain.ts`
- `src/lib/onoma/export.ts` (DELETE)

**Out of scope**:
- Modifications to core Markov chain generation algorithms.

## Git workflow

- Branch: `advisor/126-onoma-presets-consolidation`
- Commit style: `refactor(onoma): <summary>`

## Steps

### Step 1: Create Centralized `generatePresetName` in `name-generator.ts`

In `src/lib/onoma/name-generator.ts`:
1. Import all species, group, and tavern generator functions.
2. Export a unified `generatePresetName` function:

```typescript
export interface PresetGenerationContext {
  category: NameCategory;
  subType?: string;
  gender?: Gender;
  culture?: string;
  characterChain: MarkovChain;
  syllableChain?: MarkovChain;
  options?: GenerateOptions;
}

export function generatePresetName(ctx: PresetGenerationContext): string | null {
  const { category, subType = "generic", gender = "neutral", culture = "any", characterChain, options } = ctx;

  if (subType === "generic") return null;

  if (category === "person") {
    if (subType === "goblin") return generateGoblinName();
    if (subType === "orc") return generateOrcName();
    if (subType === "ogre") return generateOgreName();
    if (subType === "primitive") return generatePrimitiveName(gender);
    if (subType === "dwarf") return generateDwarfName(gender);
    if (subType === "halfling") return generateHalflingName(gender);
    if (subType === "gnome") return generateGnomeName(gender);
    if (subType === "elf") return generateElfName(gender);
    if (subType === "elf-alt") return generateElfName(gender, true);
    if (subType === "faery") return generateFaeryName(gender);
    if (subType === "faery-alt") return generateFaeryName(gender, true);
    if (subType === "dark-elf") return generateDarkElfName(gender);
    if (subType === "dark-elf-alt") return generateDarkElfName(gender, true);
    if (subType === "half-demon") return generateHalfDemonName(gender);
    if (subType === "dragon") return generateDragonName(gender);
    if (subType === "demon") return generateDemonName();
    if (subType === "angel") return generateAngelName(gender);
  }

  if (category === "organization") {
    if (subType === "mystic-order") return generateMysticOrderName(characterChain, options);
    if (subType === "military-unit") return generateMilitaryUnitName(characterChain, options);
    if (subType === "covert-org") return generateCovertOrgName(characterChain, options);
    if (subType === "tavern") return generateTavernName(options);
    if (subType === "business-company") return generateBusinessCompanyName(characterChain, options);
    if (subType === "academic-institution") return generateAcademicInstitutionName(characterChain, options);
    if (subType === "political-party") return generatePoliticalPartyName(characterChain, options);
    if (subType === "government-agency") return generateGovernmentAgencyName(characterChain, options);
    if (subType === "media-outlet") return generateMediaOutletName(characterChain, options);
    if (subType === "ngo-foundation") return generateNgoName(characterChain, options);
    if (subType === "religious-order") return generateReligiousOrderName(characterChain, options);
  }

  if (category === "military") {
    if (subType === "military-unit") return generateMilitaryUnitName(characterChain, options);
    if (subType === "mercenary-band") return generateMercenaryBandName(characterChain, options);
  }

  if (category === "dynasty") {
    if (subType === "fantasy-syllable") return generateFantasySyllableName();
    if (subType === "noble-surname") return generateNobleSurname(culture, characterChain, options);
  }

  if (category === "city" && subType === "settlement-colony") {
    const base = characterChain.generate(options) || generateFantasySyllableName();
    const d3 = Math.floor(Math.random() * 3);
    const capitalized = MarkovChain.capitalize(base);
    if (d3 === 0) return `New ${capitalized}`;
    if (d3 === 1) return `Port ${capitalized}`;
    return `${capitalized} Colony`;
  }

  if (category === "geography" && subType === "natural-landmark") {
    const base = characterChain.generate(options) || generateFantasySyllableName();
    const suffixes = ["River", "Valley", "Mount", "Bay", "Lake", "Ridge", "Coast", "Canyon", "Forest", "Peak", "Hills"];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${MarkovChain.capitalize(base)} ${suffix}`;
  }

  return null;
}
```

**Verify**: `bun run test -- src/lib/onoma/generators.test.ts` → all pass

### Step 2: Refactor `useOnomaGenerator.ts` and `batch.ts` to use `generatePresetName`

In `src/hooks/useOnomaGenerator.ts`:
Replace lines 250–327 with:
```typescript
let name = generatePresetName({
  category,
  subType,
  gender,
  culture,
  characterChain,
  syllableChain,
  options: genOptions,
});
```

In `src/server/api/routers/onoma/batch.ts`:
Replace lines 220–304 with the same single call.

**Verify**: `bun run test -- src/lib/onoma` → all pass

### Step 3: Remove Dead `export.ts` and Legacy Markov Getters

1. Delete file `src/lib/onoma/export.ts`.
2. In `src/lib/onoma/markov-chain.ts`, remove legacy getters:
   - `get character()`
   - `get start()`
   - `get map()`
3. In `src/app/labs/onoma/components/sections/MarkovVisualizer.tsx`:
   Replace lines 286–292 with:
   ```typescript
   import { speakBrowserNative } from "~/lib/onoma/browser-speech";
   // ...
   const handleSpeak = () => {
     if (!activePrefix) return;
     speakBrowserNative(MarkovChain.capitalize(activePrefix), "", "any").catch(() => {});
   };
   ```

**Verify**: `bun run test -- src/lib/onoma` → all pass

## Done criteria

- [ ] `generatePresetName` centralized in `src/lib/onoma/name-generator.ts`
- [ ] No duplicated preset branching in `useOnomaGenerator.ts` or `batch.ts`
- [ ] `src/lib/onoma/export.ts` deleted
- [ ] `MarkovVisualizer.tsx` speech uses `speakBrowserNative`
- [ ] All tests in `src/lib/onoma` pass with 0 failures

## STOP conditions

- If any external file imports `src/lib/onoma/export.ts`, update that caller or retain the function in `name-generator.ts`.
