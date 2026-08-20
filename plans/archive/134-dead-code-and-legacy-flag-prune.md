# Plan 134: Dead Code & Legacy Flag Prune

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 928bd..HEAD -- src/components/ui/enhanced-country-flag.tsx src/components/achievements/tabs/LeaderboardTab.tsx src/app/builder/primitives/CountryPreview.tsx src/app/builder/components/enhanced/InteractivePreview.tsx src/lib/procedural-archive/noise.ts src/lib/procedural-archive/rng.ts src/types/actions.ts src/hooks/useIxMedia.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/133-dependency-prune-xlsx-radix-devdeps.md
- **Category**: tech-debt / dead-code
- **Planned at**: commit `928bd`, 2026-08-20
- **Status**: DONE

## Why this matters

Over time, several legacy prototypes and redundant wrapper shims were abandoned in the codebase: `EnhancedCountryFlag.tsx` (199 lines) which only had 3 remaining call sites while `UnifiedCountryFlag.tsx` is the canonical platform standard; unused archive files `noise.ts` and `rng.ts` in `procedural-archive/`; unused discriminated union file `src/types/actions.ts`; and a 2-line re-export stub `src/hooks/useIxMedia.ts`. Pruning these removes ~600 lines of dead code and consolidates flag rendering onto `UnifiedCountryFlag`.

## Current state

1. `EnhancedCountryFlag` is imported at 3 locations:
   - `src/components/achievements/tabs/LeaderboardTab.tsx:26`
   - `src/app/builder/primitives/CountryPreview.tsx:6`
   - `src/app/builder/components/enhanced/InteractivePreview.tsx:36`
   `UnifiedCountryFlag` (`src/components/ui/UnifiedCountryFlag.tsx`) supports `countryName`, `size`, `className`, and is the official caching flag component.
2. `src/lib/procedural-archive/noise.ts` (260 lines) has 0 imports in the repository.
3. `src/lib/procedural-archive/rng.ts` (45 lines) has 0 imports (its functionality was copied to `src/lib/worldgen/rng.ts`).
4. `src/types/actions.ts` (51 lines) exports `ExecutiveAction`, `QuickAction`, `NotificationAction`, `isExecutiveAction`, `isQuickAction`, `isNotificationAction`, none of which are imported or used.
5. `src/hooks/useIxMedia.ts` simply contains `export { useIxMedia } from "~/components/media/MediaContext";` and is only imported within `src/components/media/`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Audit Arch| `bun run audit:arch`     | exit 0, no errors   |
| Lint      | `bun run lint`           | exit 0              |

## Scope

**In scope**:
- `src/components/ui/enhanced-country-flag.tsx` (DELETE)
- `src/components/achievements/tabs/LeaderboardTab.tsx` (migrate to `UnifiedCountryFlag`)
- `src/app/builder/primitives/CountryPreview.tsx` (migrate to `UnifiedCountryFlag`)
- `src/app/builder/components/enhanced/InteractivePreview.tsx` (migrate to `UnifiedCountryFlag`)
- `src/lib/procedural-archive/noise.ts` (DELETE)
- `src/lib/procedural-archive/rng.ts` (DELETE)
- `src/types/actions.ts` (DELETE)
- `src/hooks/useIxMedia.ts` (DELETE)
- `src/components/media/ChapterNavigator.tsx` (import from `MediaContext`)
- `src/components/media/FullPlayer.tsx` (import from `MediaContext`)
- `src/components/media/MiniPlayer.tsx` (import from `MediaContext`)
- `src/components/media/QueuePanel.tsx` (import from `MediaContext`)
- `src/components/media/TranscriptViewer.tsx` (import from `MediaContext`)

**Out of scope**:
- `src/lib/procedural-archive/climate-system.ts`, `language-families.ts`, `markov-naming.ts` (still referenced by worldgen).

## Steps

### Step 1: Migrate call sites from EnhancedCountryFlag to UnifiedCountryFlag

1. In `src/components/achievements/tabs/LeaderboardTab.tsx`:
   - Replace `import { EnhancedCountryFlag } from "~/components/ui/enhanced-country-flag";` with `import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";`.
   - Replace `<EnhancedCountryFlag ... />` with `<UnifiedCountryFlag ... />`.
2. In `src/app/builder/primitives/CountryPreview.tsx`:
   - Replace `import { EnhancedCountryFlag } from "~/components/ui/enhanced-country-flag";` with `import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";`.
   - Replace `<EnhancedCountryFlag ... />` with `<UnifiedCountryFlag ... />`.
3. In `src/app/builder/components/enhanced/InteractivePreview.tsx`:
   - Replace `import { EnhancedCountryFlag } from "~/components/ui/enhanced-country-flag";` with `import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";`.
   - Replace `<EnhancedCountryFlag ... />` with `<UnifiedCountryFlag ... />`.
4. Delete `src/components/ui/enhanced-country-flag.tsx`.

**Verify**: `grep -rn "EnhancedCountryFlag" src/` → 0 matches.

### Step 2: Delete dead files

1. Delete `src/lib/procedural-archive/noise.ts`.
2. Delete `src/lib/procedural-archive/rng.ts`.
3. Delete `src/types/actions.ts`.

**Verify**: `grep -rn "types/actions" src/` → 0 matches.

### Step 3: Switch media components to direct MediaContext import and delete useIxMedia stub

1. In `src/components/media/ChapterNavigator.tsx`, `FullPlayer.tsx`, `MiniPlayer.tsx`, `QueuePanel.tsx`, `TranscriptViewer.tsx`:
   - Change `import { useIxMedia } from "~/hooks/useIxMedia";` to `import { useIxMedia } from "~/components/media/MediaContext";`.
2. Delete `src/hooks/useIxMedia.ts`.

**Verify**: `grep -rn "useIxMedia" src/` → only `MediaContext.tsx` and direct imports from it.

## Done criteria

- [ ] `src/components/ui/enhanced-country-flag.tsx` is deleted
- [ ] All flag callers use `UnifiedCountryFlag`
- [ ] `noise.ts`, `rng.ts`, `actions.ts`, and `useIxMedia.ts` are deleted
- [ ] `bun run audit:arch` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- If any other component in `src/` has a runtime dependency on `EnhancedCountryFlag` props that `UnifiedCountryFlag` does not support.
