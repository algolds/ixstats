# Plan 052: Builder Auto-Sync Performance Optimization

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 30ba5922..HEAD -- src/hooks/useBuilderAutoSync.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `30ba5922`, 2026-06-22

## Why this matters

In the Government and Tax builders, the `useGovernmentBuilderAutoSync` and `useTaxBuilderAutoSync` hooks track changes by comparing `JSON.stringify(builderState) !== JSON.stringify(previousStateRef.current)` in a `useEffect` hook. Because `builderState` is in the dependency array, this effect triggers on *every single keystroke* or slider adjustment.
- Deep serialization of a large nested state object on the main UI thread blocks user input, causing noticeable stutter and keystroke lag.
- Moving the expensive serialization check to inside the debounced timeout guarantees 60fps typing responsiveness while maintaining accurate change-detection.

## Current state

- [useBuilderAutoSync.ts](file:///ixwiki/public/projects/ixstats/src/hooks/useBuilderAutoSync.ts) — Auto-save hooks for builders.
- Current government change tracker (lines 189–211):

```typescript
  // Track changes
  useEffect(() => {
    if (builderState && previousStateRef.current) {
      const hasChanges = JSON.stringify(builderState) !== JSON.stringify(previousStateRef.current);
      if (hasChanges) {
        setSyncState((prev) => {
          if (prev.pendingChanges) return prev;
          return { ...prev, pendingChanges: true };
        });

        // Trigger debounced save
        if (enabled && countryId) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          debounceTimerRef.current = setTimeout(() => {
            handleAutoSync();
          }, debounceMs);
        }
      }
      previousStateRef.current = builderState;
    }
  }, [builderState, enabled, countryId, debounceMs, handleAutoSync]);
```

- Current tax change tracker (lines 392–414) is identical in structure.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run typecheck:ui`   | exit 0, no errors   |
| Lint      | `bun run lint`           | exit 0              |

## Scope

**In scope**:
- `src/hooks/useBuilderAutoSync.ts`

**Out of scope**:
- Modifications to builder form states or API routers

## Git workflow

- Branch: `perf/052-builder-autosync`
- Commit message style: `perf(builder): debounce JSON serialization in auto-sync hook`

## Steps

### Step 1: Optimize Government Builder Change Tracker

In [useBuilderAutoSync.ts](file:///ixwiki/public/projects/ixstats/src/hooks/useBuilderAutoSync.ts):
1. In `useGovernmentBuilderAutoSync`, update the change-tracking `useEffect` (lines 189–211) so that the `JSON.stringify` comparison is moved inside the debounced `setTimeout`.
2. Instantly set `pendingChanges: true` when a reference change occurs (avoiding stringify on keypress).
3. Update the `previousStateRef.current` assignment logic to coordinate with the deferred save.

Use this target pattern:

```typescript
  // Track changes
  useEffect(() => {
    if (!builderState || !previousStateRef.current) return;

    if (builderState !== previousStateRef.current) {
      setSyncState((prev) => {
        if (prev.pendingChanges) return prev;
        return { ...prev, pendingChanges: true };
      });

      if (enabled && countryId) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          const hasChanges = JSON.stringify(builderState) !== JSON.stringify(previousStateRef.current);
          if (hasChanges) {
            void handleAutoSync();
          } else {
            setSyncState((prev) => ({ ...prev, pendingChanges: false }));
          }
        }, debounceMs);
      }
    }
  }, [builderState, enabled, countryId, debounceMs, handleAutoSync]);
```

**Verify**:
- Run `bun run typecheck:ui` and ensure it compiles successfully.

### Step 2: Optimize Tax Builder Change Tracker

In [useBuilderAutoSync.ts](file:///ixwiki/public/projects/ixstats/src/hooks/useBuilderAutoSync.ts):
1. Apply the exact same optimization to the change-tracking `useEffect` inside `useTaxBuilderAutoSync` (lines 392–414).

**Verify**:
- Run `bun run typecheck:ui` and ensure it compiles successfully.
- Run `bun run lint` to ensure no lint warnings are triggered.

## Done criteria

- [ ] `bun run typecheck:ui` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] JSON.stringify is never invoked synchronously on keystroke changes in Government or Tax builders.

## STOP conditions

- If auto-save stops triggering entirely, check if `previousStateRef.current` is being set correctly after a successful save.
