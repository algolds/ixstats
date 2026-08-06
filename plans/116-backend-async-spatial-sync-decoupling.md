# Plan 116: Map Editor Backend Asynchronous Spatial Sync Decoupling

**Phase**: 2 of 4 (Map Editor Backend Overhaul)  
**Target System**: `src/server/api/routers/geo/features/subdivisions.ts`, `src/server/api/routers/geo/features/cities.ts`  
**Goal**: Defer heavy non-critical spatial sync (demographic recalculations, resource pool distance math) out of the HTTP mutation request path into background execution, returning instant response ($< 15\text{ms}$) to the user.

---

## 1. Problem Statement

Currently, when a user creates or updates a subdivision polygon in the Map Editor, `subdivisions.ts` calls `syncGeographicDemographics` and `syncResourcePoolModifiers` synchronously before returning the HTTP response.
These functions iterate through every POI, transport hub, and route, calculating Haversine distances on the main Node.js event loop. This causes feature saves to stall for 300–800ms.

---

## 2. Architecture & Ponytail / TS-Expert Design

### Ponytail Principle
- **Instant Mutation Feedback**: Never block user UI edits on secondary background analytics. Return the updated feature database record immediately.
- **Asynchronous Task Queue**: Use `queueMicrotask` / background async task runner to perform spatial demographic & resource sync after the HTTP response has closed.

### TypeScript Pro Pattern
Typed async background dispatcher:

```typescript
export function deferBackgroundSpatialSync(
  db: PrismaClient,
  countryId: string
): void {
  queueMicrotask(async () => {
    try {
      await syncGeographicDemographics(db, countryId);
      await syncResourcePoolModifiers(db, countryId);
    } catch (err) {
      console.warn("[BackgroundSpatialSync] Error processing sync:", err);
    }
  });
}
```

---

## 3. Implementation Steps

### Step 1: Create `deferBackgroundSpatialSync` Utility (`src/lib/country-geo/async-sync.ts`)
Wrap demographic and resource pool calculation loops in an unblocked background async worker task.

### Step 2: Refactor `subdivisions.ts` & `cities.ts` Mutations
Replace synchronous `await syncGeographicDemographics(...)` calls with non-blocking `deferBackgroundSpatialSync(...)`.

---

## 4. Machine-Checkable Verification

```bash
# Verify typechecking
bun run typecheck:server

# Test geo router test suite
bun run test -- src/server/api/routers/geo
```

### Expected Output
- Map feature save mutations return in $< 15\text{ms}$.
- Secondary demographic and resource pool calculations complete asynchronously without blocking the UI.
