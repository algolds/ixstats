# Plan 135: Fix KeyValidation Layering Violation & Trim Auto-Sync / Clamp Boilerplate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 928bd..HEAD -- src/app/mycountry/utils/keyValidation.ts src/stores/notificationStore.ts src/lib/notifications/optimization.ts src/hooks/useEconomyBuilderAutoSync.ts src/hooks/useNationalIdentityAutoSync.ts src/components/ui/facet/hooks/useSliderPhysics.ts src/components/ui/facet/swipeable/useSwipePhysics.ts src/components/ui/apple-switch.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/134-dead-code-and-legacy-flag-prune.md
- **Category**: architecture / tech-debt
- **Planned at**: commit `928bd`, 2026-08-20
- **Status**: DONE

## Why this matters

1. **Layering Violation**: `src/stores/notificationStore.ts` and `src/lib/notifications/optimization.ts` import from `~/app/mycountry/utils/keyValidation.ts`. A core store and lib module should never depend on a specific App Router UI page's utility directory. Moreover, `keyValidation.ts` is 231 lines of over-engineered "React Key Validation" ceremony for what is essentially `id ? `${prefix}-${id}` : `${prefix}-fallback-${index}``.
2. **Boilerplate Wrappers**: `useEconomyBuilderAutoSync.ts` and `useNationalIdentityAutoSync.ts` are thin wrappers around `useGenericAutoSync.ts` that add empty stub handlers (`clearConflicts: () => {}`, `conflictWarnings: []`).
3. **Local Clamp Duplication**: `useSliderPhysics.ts`, `useSwipePhysics.ts`, and `apple-switch.tsx` declare their own private `const clamp = ...` functions instead of reusing `clamp` from `src/lib/utils/math.ts`.

## Current state

- `src/stores/notificationStore.ts:24`:
  ```ts
  import { generateSafeKey } from "~/app/mycountry/utils/keyValidation";
  ```
- `src/lib/notifications/optimization.ts:17`:
  ```ts
  import { generateSafeKey } from "~/app/mycountry/utils/keyValidation";
  ```
- `src/app/mycountry/utils/keyValidation.ts` contains 231 lines of unused debugging maps and key validators.
- `src/components/ui/apple-switch.tsx:80`, `src/components/ui/facet/hooks/useSliderPhysics.ts:35`, and `src/components/ui/facet/swipeable/useSwipePhysics.ts:33` redeclare `clamp`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Audit Arch| `bun run audit:arch`     | exit 0, no errors   |
| Lint      | `bun run lint`           | exit 0              |

## Scope

**In scope**:
- `src/app/mycountry/utils/keyValidation.ts` (DELETE)
- `src/stores/notificationStore.ts` (define clean internal safe key helper)
- `src/lib/notifications/optimization.ts` (define clean internal safe key helper)
- `src/hooks/useEconomyBuilderAutoSync.ts` (DELETE after inlining at call site)
- `src/hooks/useNationalIdentityAutoSync.ts` (DELETE after inlining at call site)
- `src/app/builder/components/enhanced/EconomyBuilderPage.tsx` (use `useGenericAutoSync` directly)
- `src/app/builder/components/enhanced/national-identity/useNationalIdentityState.ts` (use `useGenericAutoSync` directly)
- `src/components/ui/facet/hooks/useSliderPhysics.ts` (import `clamp` from `~/lib/utils/math`)
- `src/components/ui/facet/swipeable/useSwipePhysics.ts` (import `clamp` from `~/lib/utils/math`)
- `src/components/ui/apple-switch.tsx` (import `clamp` from `~/lib/utils/math`)

## Steps

### Step 1: Remove keyValidation.ts and localize safe key generation

1. In `src/stores/notificationStore.ts`:
   - Remove `import { generateSafeKey } from "~/app/mycountry/utils/keyValidation";`.
   - Add a clean local helper:
     ```ts
     function generateSafeKey(id: string | null | undefined, prefix: string, index: number): string {
       const clean = id?.trim();
       return clean ? `${prefix}-${clean}` : `${prefix}-fallback-${index}-${Date.now()}`;
     }
     ```
2. In `src/lib/notifications/optimization.ts`:
   - Remove `import { generateSafeKey } from "~/app/mycountry/utils/keyValidation";`.
   - Add the equivalent local key helper.
3. Delete `src/app/mycountry/utils/keyValidation.ts`.

**Verify**: `grep -rn "keyValidation" src/` → 0 matches.

### Step 2: Consolidate AutoSync in EconomyBuilder and NationalIdentity

1. In `src/app/builder/components/enhanced/EconomyBuilderPage.tsx`:
   - Replace `useEconomyBuilderAutoSync` import with `useGenericAutoSync` from `~/hooks/useGenericAutoSync`.
   - Wire `useGenericAutoSync` directly with the autoSave mutation.
2. In `src/app/builder/components/enhanced/national-identity/useNationalIdentityState.ts`:
   - Replace `useNationalIdentityAutoSync` import with `useGenericAutoSync` from `~/hooks/useGenericAutoSync`.
   - Wire `useGenericAutoSync` directly with the update mutation.
3. Delete `src/hooks/useEconomyBuilderAutoSync.ts` and `src/hooks/useNationalIdentityAutoSync.ts`.

**Verify**: `grep -rn "useEconomyBuilderAutoSync\|useNationalIdentityAutoSync" src/` → 0 matches.

### Step 3: Deduplicate clamp helpers

1. In `src/components/ui/facet/hooks/useSliderPhysics.ts`:
   - Remove local `const clamp = ...` and import `clamp` from `~/lib/utils/math`.
2. In `src/components/ui/facet/swipeable/useSwipePhysics.ts`:
   - Remove local `const clamp = ...` and import `clamp` from `~/lib/utils/math`.
3. In `src/components/ui/apple-switch.tsx`:
   - Remove local `const clamp = ...` and import `clamp` from `~/lib/utils/math`.

**Verify**: `bun run lint` → passes with no unused imports or broken references.

## Done criteria

- [ ] `src/app/mycountry/utils/keyValidation.ts` is deleted and stores no longer import from `app/`
- [ ] `useEconomyBuilderAutoSync.ts` and `useNationalIdentityAutoSync.ts` are removed in favor of `useGenericAutoSync.ts`
- [ ] `clamp` is unified across slider physics and switch components
- [ ] `bun run audit:arch` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- If any other file was importing from `src/app/mycountry/utils/keyValidation.ts`.
