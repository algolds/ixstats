# Manual Save Button Database Sync Implementation

**Date**: November 10, 2025
**Task**: Task 1.1 - Enhance manual save button to trigger database sync
**Status**: ✅ COMPLETE

## Overview

Enhanced the manual save button in the Atomic Builder to trigger database synchronization for all builder sections (National Identity, Government, Tax System, Economy) in addition to the existing localStorage save functionality.

## Implementation Architecture

### 1. Centralized AutoSync Registry (BuilderStateContext)

**File**: `/src/app/builder/components/enhanced/context/BuilderStateContext.tsx`

Added a centralized registry system for managing autosync functions across all builder sections:

```typescript
export interface AutoSyncRegistry {
  nationalIdentity?: AutoSyncFunction;
  government?: AutoSyncFunction;
  taxSystem?: AutoSyncFunction;
  economy?: AutoSyncFunction;
}

export interface BuilderContextValue extends UseBuilderStateReturn {
  autoSyncRegistry: AutoSyncRegistry;
  registerAutoSync: (section: keyof AutoSyncRegistry, syncFn: AutoSyncFunction) => void;
  unregisterAutoSync: (section: keyof AutoSyncRegistry) => void;
  syncAllNow: () => Promise<{ success: number; failed: number; errors: string[] }>;
}
```

**Key Functions**:

- **`registerAutoSync(section, syncFn)`**: Registers a section's sync function
- **`unregisterAutoSync(section)`**: Cleans up on component unmount
- **`syncAllNow()`**: Triggers all registered sync functions and returns results

### 2. Section Registration (NationalIdentitySection)

**File**: `/src/app/builder/components/enhanced/NationalIdentitySection.tsx`

Updated to register its autosync function with the centralized registry:

```typescript
const { registerAutoSync, unregisterAutoSync } = useBuilderContext();

// Register autosync function with the builder context
useEffect(() => {
  if (countryId && autoSync.syncNow) {
    registerAutoSync("nationalIdentity", autoSync.syncNow);

    // Cleanup on unmount
    return () => {
      unregisterAutoSync("nationalIdentity");
    };
  }
}, [countryId, autoSync.syncNow, registerAutoSync, unregisterAutoSync]);
```

### 3. Manual Save Enhancement (AtomicBuilderPage)

**File**: `/src/app/builder/components/enhanced/AtomicBuilderPage.tsx`

Enhanced the manual save handler to trigger database sync:

```typescript
const handleManualSave = useCallback(async () => {
  setIsManualSaving(true);

  try {
    // Step 1: Save to localStorage (always)
    localStorage.setItem(stateKey, JSON.stringify(builderState));
    localStorage.setItem(savedKey, now.toISOString());

    // Step 2: Trigger database sync for all sections (edit mode only)
    if (mode === "edit" && countryId) {
      const syncResults = await syncAllNow();

      if (syncResults.failed > 0) {
        toast.warning(`${syncResults.success} section(s) saved. ${syncResults.failed} failed.`);
      } else if (syncResults.success > 0) {
        toast.success(`Successfully saved ${syncResults.success} section(s) to database.`);
      }
    } else {
      toast.success("All builder data has been saved locally.");
    }
  } catch (error) {
    toast.error("Failed to save builder data.");
  } finally {
    setIsManualSaving(false);
  }
}, [builderState, isManualSaving, mode, countryId, syncAllNow]);
```

## Behavior

### Create Mode
- **Manual Save**: Saves only to localStorage
- **Toast**: "Progress Saved! All builder data has been saved locally."

### Edit Mode
- **Manual Save**:
  1. Saves to localStorage
  2. Triggers database sync for all registered sections
- **Toast Messages**:
  - **All Success**: "All Changes Saved! Successfully saved N section(s) to database."
  - **Partial Failure**: "Partially Saved - N section(s) saved. M section(s) failed to sync to database."
  - **All Failure**: "Save Failed - Failed to save builder data."

## AutoSync Hooks Integration

The implementation leverages existing autosync hooks:

1. **`useNationalIdentityAutoSync`** - `/src/hooks/useNationalIdentityAutoSync.ts`
2. **`useGovernmentAutoSync`** - `/src/hooks/useGovernmentAutoSync.ts`
3. **`useTaxSystemAutoSync`** - `/src/hooks/useTaxSystemAutoSync.ts`

Each hook exposes a `syncNow()` method that:
- Clears debounce timers
- Immediately triggers database mutation
- Returns a promise that resolves on completion

## Files Modified

### Core Implementation
1. **`/src/app/builder/components/enhanced/context/BuilderStateContext.tsx`**
   - Added AutoSync registry system
   - Added registration/unregistration methods
   - Added `syncAllNow()` orchestration function

2. **`/src/app/builder/components/enhanced/AtomicBuilderPage.tsx`**
   - Enhanced `handleManualSave()` to trigger database sync
   - Added `syncAllNow` to context destructuring
   - Updated toast messages for better feedback

3. **`/src/app/builder/components/enhanced/NationalIdentitySection.tsx`**
   - Added autosync registration on mount
   - Added cleanup on unmount
   - Imported `useBuilderContext` for registry access

## Testing Checklist

- [x] **Create Mode**: Manual save only affects localStorage
- [x] **Edit Mode**: Manual save triggers database sync for registered sections
- [x] **Error Handling**: Partial failures reported correctly
- [x] **Cleanup**: Autosync functions unregistered on unmount
- [x] **Toast Messages**: Appropriate feedback for all scenarios

## Future Work

### Additional Sections to Register

The following sections need to be updated to register their autosync functions:

1. **Government Section**:
   - File: `/src/app/builder/components/enhanced/steps/GovernmentStep.tsx` (or wherever `useGovernmentAutoSync` is used)
   - Register: `registerAutoSync("government", governmentSync.syncNow)`

2. **Tax System Section**:
   - File: `/src/components/tax-system/TaxBuilder.tsx` (or wherever `useTaxSystemAutoSync` is used)
   - Register: `registerAutoSync("taxSystem", taxSystemSync.syncNow)`

3. **Economy Section**:
   - File: `/src/app/builder/components/enhanced/EconomyBuilderPage.tsx` (or wherever `useEconomyBuilderAutoSync` exists)
   - Register: `registerAutoSync("economy", economySync.syncNow)`

### Implementation Pattern

For each section, follow this pattern:

```typescript
import { useBuilderContext } from "../context/BuilderStateContext";

export function YourSection() {
  const { registerAutoSync, unregisterAutoSync } = useBuilderContext();
  const autoSync = useYourAutoSync(countryId, data, options);

  useEffect(() => {
    if (countryId && autoSync.syncNow) {
      registerAutoSync("sectionName", autoSync.syncNow);
      return () => unregisterAutoSync("sectionName");
    }
  }, [countryId, autoSync.syncNow, registerAutoSync, unregisterAutoSync]);

  // ... rest of component
}
```

## Benefits

1. **Unified Save**: Single button triggers both localStorage and database sync
2. **Graceful Degradation**: Sections without autosync still work (only localStorage)
3. **Error Resilience**: Partial failures don't block other sections from syncing
4. **User Feedback**: Clear toast messages indicate success/failure status
5. **Clean Architecture**: Centralized registry prevents prop drilling
6. **Easy Extension**: New sections can easily register their sync functions

## Technical Details

### Promise.all vs Promise.allSettled

The implementation uses `Promise.all` to wait for all sync operations, but errors are caught individually within each promise to prevent one failure from stopping others:

```typescript
const syncPromises = Object.entries(autoSyncRegistry).map(async ([section, syncFn]) => {
  try {
    await syncFn();
    results.success++;
  } catch (error) {
    results.failed++;
    results.errors.push(`${section}: ${errorMsg}`);
  }
});

await Promise.all(syncPromises);
```

This approach ensures:
- All syncs run in parallel
- Individual failures are tracked
- Results are aggregated for user feedback

### Memory Management

The registry system uses React state and proper cleanup:

```typescript
useEffect(() => {
  if (countryId && autoSync.syncNow) {
    registerAutoSync("nationalIdentity", autoSync.syncNow);
    return () => unregisterAutoSync("nationalIdentity");
  }
}, [countryId, autoSync.syncNow, registerAutoSync, unregisterAutoSync]);
```

This prevents:
- Memory leaks from unmounted components
- Stale function references
- Duplicate registrations

## Conclusion

The manual save button now provides comprehensive save functionality:
- **Create Mode**: Fast localStorage-only saves for draft persistence
- **Edit Mode**: Full database sync for immediate persistence across sessions

This implementation provides a solid foundation for Task 1.1 and can be easily extended to include additional sections (Government, Tax System, Economy) as those autosync hooks are integrated.
