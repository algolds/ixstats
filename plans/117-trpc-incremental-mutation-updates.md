# Plan 117: tRPC Incremental Mutation Payloads & Optimistic Cache Patching

**Phase**: 3 of 4 (Map Editor Backend Overhaul)  
**Target System**: `src/server/api/routers/geo/features/`, `src/hooks/useMapEditor.ts`  
**Goal**: Return full mutated feature payloads directly from tRPC mutations and patch React Query cache incrementally on mutation success, eliminating full 500-item array refetches from PostgreSQL.

---

## 1. Problem Statement

Currently, when a feature mutation (e.g. `upsertSubdivision`, `updateCity`, `deletePOI`) succeeds, `useMapEditor.ts` executes `debouncedRefetch()`, triggering a full `getCountryFeatures` database query.
This re-fetches all 500+ features over the network on every single feature edit, causing high memory churn and UI flicker.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **Incremental Cache Diffs**: When 1 feature changes, update only that 1 feature in the React Query cache.
- **Single Source of Truth**: Return the updated feature model directly from the tRPC mutation response.

### TypeScript Advanced Types Pattern
Discriminated union mutation response type:

```typescript
export type MutationOperation = "UPSERT" | "DELETE";

export interface IncrementalMutationResult<T = EditorFeature> {
  operation: MutationOperation;
  featureType: string;
  feature: T;
  invalidatedCountryId: string;
}
```

---

## 3. Implementation Steps

### Step 1: Standardize Mutation Responses in `geoFeatures` Routers
Update `upsertSubdivision`, `createCity`, `updateCity`, `createPOI`, `updatePOI`, `deleteFeature` to return structured `IncrementalMutationResult`.

### Step 2: Implement Incremental Cache Updater in `useMapEditor.ts`
Replace full `refetchFeatures()` calls on mutation success with direct React Query cache patch:

```typescript
utils.geoCore.getCountryFeatures.setData({ countryId }, (old) => {
  if (!old) return old;
  return patchIncrementalFeature(old, mutationResult);
});
```

---

## 4. Machine-Checkable Verification

```bash
# Verify typechecking
bun run typecheck:ui
bun run typecheck:server

# Test geo router test suite
bun run test -- src/server/api/routers/geo
```

### Expected Output
- Network requests on feature edit reduced from 1 full array refetch to 0 extra queries.
- UI state updates instantly on mutation completion.
