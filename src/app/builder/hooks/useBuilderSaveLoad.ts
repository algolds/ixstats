import { useCallback } from "react";
import { safeGetItemSync, safeSetItemSync, safeRemoveItemSync } from "~/lib/localStorageMutex";
import type { BuilderState } from "./useBuilderState";

/**
 * Return value interface for useBuilderSaveLoad hook.
 * Provides localStorage persistence methods.
 */
export interface UseBuilderSaveLoadReturn {
  /** Save builder state to localStorage */
  saveState: (state: BuilderState) => void;
  /** Load builder state from localStorage */
  loadState: () => BuilderState | null;
  /** Clear all saved state from localStorage */
  clearState: () => void;
  /** Load the last saved timestamp */
  loadLastSavedTime: () => Date | null;
}

/**
 * Builder state persistence hook for localStorage operations.
 *
 * Provides safe, mutex-protected localStorage operations for builder state:
 * - Save/load complete builder state
 * - Clear saved drafts
 * - Track last save time
 * - Automatic error handling with console logging
 * - Concurrency-safe with mutex-based locking
 *
 * Uses the localStorageMutex utility to prevent race conditions when
 * multiple operations occur simultaneously. All errors are caught and
 * logged, ensuring graceful degradation when localStorage is unavailable.
 *
 * @hook
 * @returns {UseBuilderSaveLoadReturn} Persistence methods
 * @returns {Function} returns.saveState - Save builder state to localStorage
 * @returns {Function} returns.loadState - Load builder state from localStorage
 * @returns {Function} returns.clearState - Clear all saved state
 * @returns {Function} returns.loadLastSavedTime - Get last save timestamp
 *
 * @example
 * ```tsx
 * function ManualSaveButton() {
 *   const { builderState } = useBuilderState();
 *   const { saveState, loadLastSavedTime } = useBuilderSaveLoad();
 *
 *   const handleSave = () => {
 *     saveState(builderState);
 *     const lastSaved = loadLastSavedTime();
 *     console.log(`Saved at ${lastSaved?.toLocaleTimeString()}`);
 *   };
 *
 *   return <button onClick={handleSave}>Save Draft</button>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Load saved state on component mount
 * function BuilderRestoration() {
 *   const { setBuilderState } = useBuilderState();
 *   const { loadState, loadLastSavedTime } = useBuilderSaveLoad();
 *   const [hasRestoredState, setHasRestoredState] = useState(false);
 *
 *   useEffect(() => {
 *     const savedState = loadState();
 *     const lastSaved = loadLastSavedTime();
 *
 *     if (savedState && lastSaved) {
 *       const minutesAgo = (Date.now() - lastSaved.getTime()) / 1000 / 60;
 *       if (minutesAgo < 60) { // Only restore if saved within last hour
 *         setBuilderState(savedState);
 *         setHasRestoredState(true);
 *       }
 *     }
 *   }, []);
 *
 *   return hasRestoredState ? <p>Draft restored</p> : null;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Clear draft with confirmation
 * function ClearDraftButton() {
 *   const { clearState, loadLastSavedTime } = useBuilderSaveLoad();
 *
 *   const handleClear = () => {
 *     const lastSaved = loadLastSavedTime();
 *     const confirmed = confirm(
 *       `Clear draft saved at ${lastSaved?.toLocaleString()}?`
 *     );
 *
 *     if (confirmed) {
 *       clearState();
 *       alert('Draft cleared');
 *     }
 *   };
 *
 *   return <button onClick={handleClear}>Clear Draft</button>;
 * }
 * ```
 */
export function useBuilderSaveLoad(): UseBuilderSaveLoadReturn {
  const saveState = useCallback((state: BuilderState) => {
    try {
      safeSetItemSync("builder_state", JSON.stringify(state));
      safeSetItemSync("builder_last_saved", new Date().toISOString());
    } catch (error) {
      console.error("[BuilderSaveLoad] Failed to save state:", error);
    }
  }, []);

  const loadState = useCallback((): BuilderState | null => {
    try {
      const savedState = safeGetItemSync("builder_state");
      if (savedState) {
        return JSON.parse(savedState) as BuilderState;
      }
      return null;
    } catch (error) {
      console.error("[BuilderSaveLoad] Failed to load state:", error);
      return null;
    }
  }, []);

  const clearState = useCallback(() => {
    try {
      safeRemoveItemSync("builder_state");
      safeRemoveItemSync("builder_last_saved");
    } catch (error) {
      console.error("[BuilderSaveLoad] Failed to clear state:", error);
    }
  }, []);

  const loadLastSavedTime = useCallback((): Date | null => {
    try {
      const savedTime = safeGetItemSync("builder_last_saved");
      return savedTime ? new Date(savedTime) : null;
    } catch (error) {
      console.error("[BuilderSaveLoad] Failed to load last saved time:", error);
      return null;
    }
  }, []);

  return {
    saveState,
    loadState,
    clearState,
    loadLastSavedTime,
  };
}
