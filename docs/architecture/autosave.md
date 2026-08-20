# Autosave & Auto-Sync Architecture

**Core Engine**: `src/hooks/useGenericAutoSync.ts`  
**Consumers**: Builder Wizard (`/builder`), Government Builder, Tax Builder, National Identity, Map Editor  
**Protocol**: Client-driven debounced delta sync with deep equality detection and optimistic conflict handling

---

## 1. Overview & Architectural Goals

The Autosave system provides continuous, non-intrusive persistence across all nation builders, policy editors, and map authoring tools without requiring manual "Save" button clicks.

### Core Design Principles:
1. **Universal Hook Primitive**: All builder forms share a single, strongly-typed autosave hook (`useGenericAutoSync`), eliminating copy-paste debouncing logic.
2. **Deep Equality Diffing**: Mutations only trigger when field values genuinely change (evaluated via `isEqual`), preventing redundant network calls on re-renders.
3. **Configurable Debounce**: Defaults to 2,000ms; resets immediately if the user continues typing.
4. **Immediate Flush (`forceSync` / `triggerSync`)**: Exposes an explicit flush function for navigation guards and modal dismissals.
5. **Conflict & Validation Warnings**: Surfaces non-blocking validation warnings and halts on critical server-side schema violations.

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
}
```

---

## 3. Implementation Pattern in Builder Forms

When wiring autosave into a domain form, wrap `useGenericAutoSync` with domain mutations:

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

Forms render the live sync state using the standard Facet sync badge:

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
When a user attempts to navigate away with `pendingChanges === true`, the router invokes `syncNow()` before unmounting to ensure zero data loss.
