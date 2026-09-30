# Autosave & Auto-Sync Architecture

**Core Engine**: `src/hooks/useGenericAutoSync.ts`  
**Consumers**: Economy Builder (`useEconomyAutoSync`, live). `useGovernmentBuilderAutoSync` / `useTaxBuilderAutoSync` (`src/hooks/useBuilderAutoSync.ts`) are implemented but not yet mounted by any component. National Identity and the Map Editor do not use this engine.  
**Protocol**: Client-driven debounced delta sync with deep equality detection and optimistic conflict handling

---

## 1. Overview & Architectural Goals

The Autosave system provides continuous, non-intrusive persistence for builder forms without requiring manual "Save" button clicks. Today it is wired into the Economy Builder only; other builders still save explicitly (e.g. the builder `EditorSaveBar`).

### Core Design Principles:
1. **Universal Hook Primitive**: Builder autosave hooks wrap a single, strongly-typed autosave hook (`useGenericAutoSync`), eliminating copy-paste debouncing logic.
2. **Deep Equality Diffing**: Mutations only trigger when field values genuinely change (evaluated via `isEqual` from `src/lib/utils/common.ts`), preventing redundant network calls on re-renders.
3. **Configurable Debounce**: Defaults to 2,000ms; resets immediately if the user continues typing.
4. **Immediate Flush (`forceSync` / `triggerSync`)**: Exposes an explicit flush function for navigation guards and modal dismissals.
5. **Conflict Warnings**: The government/tax wrappers can call `checkConflicts` before saving (`showConflictWarnings`) and surface non-blocking warnings.

---

## 2. Universal Autosave Engine (`src/hooks/useGenericAutoSync.ts`)

The universal autosave engine manages the full state machine lifecycle:

```typescript
// src/hooks/useGenericAutoSync.ts
export type AutoSyncStatus = "idle" | "pending" | "syncing" | "saved" | "error";

export interface AutoSyncState<TError = Error> {
  status: AutoSyncStatus;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: boolean;
  syncError: TError | null;
  optimistic?: boolean;
}

export interface AutoSyncOptions<TData, TResult = unknown, TError = Error> {
  enabled?: boolean;
  debounceMs?: number;
  onSyncSuccess?: (result: TResult) => void;
  onSyncError?: (error: TError) => void;
  syncFn: (data: TData) => Promise<TResult>;
}

export function useGenericAutoSync<TData extends object, TResult = unknown, TError = Error>(
  data: TData,
  options: AutoSyncOptions<TData, TResult, TError>
) {
  // Deep equality diffing + debounced timer + forceSync flush
  // returns { ...syncState, forceSync, triggerSync: forceSync }
}
```

---

## 3. Implementation Pattern in Builder Forms

When wiring autosave into a domain form, wrap `useGenericAutoSync` with domain mutations (simplified from `src/hooks/useBuilderAutoSync.ts`, which also handles create-vs-update and conflict checks):

```tsx
import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { useGenericAutoSync } from "~/hooks/useGenericAutoSync";
import type { GovernmentBuilderState } from "~/types/government";

export function useGovernmentBuilderAutoSync(
  countryId: string | undefined,
  initialData: GovernmentBuilderState
) {
  const [builderState, setBuilderState] = useState<GovernmentBuilderState>(initialData);
  const updateMutation = api.government.update.useMutation();

  const sync = useGenericAutoSync(builderState, {
    enabled: !!countryId,
    debounceMs: 2000,
    syncFn: async (dataToSync) => {
      return await updateMutation.mutateAsync({
        countryId: countryId!,
        data: dataToSync,
      });
    },
  });

  return {
    builderState,
    setBuilderState,
    syncState: sync,
    syncNow: sync.forceSync,
    triggerSync: sync.forceSync,
  };
}
```

---

## 4. UI Indicators & Conflict Handling

`AutoSyncStatus` is designed to drive a sync indicator along these lines (there is no shared sync-badge component yet — each form renders its own state, e.g. the Economy Builder shows a last-saved time and toast via `useNotify`):

```
┌─────────────────────────────────────────────────────────────┐
│                    SYNC STATUS INDICATORS                   │
├───────────┬─────────────────────────────────────────────────┤
│ `idle`    │ Neutral dot — All changes saved                 │
│ `pending` │ Amber pulse — Edits pending (debouncing)        │
│ `syncing` │ Blue spinning indicator — Uploading to server   │
│ `saved`   │ Green checkmark — Saved successfully            │
│ `error`   │ Red warning icon + retry button                 │
└───────────┴─────────────────────────────────────────────────┘
```

### Navigation Guarding
Not yet implemented as described. `BuilderStateContext` exposes `registerAutoSync()` and `syncAllNow()` to flush every registered section (only the Economy Builder registers today), but nothing calls `syncAllNow()` on navigation. The builder `EditorSaveBar` only shows the browser `beforeunload` prompt while there are unsaved changes.
