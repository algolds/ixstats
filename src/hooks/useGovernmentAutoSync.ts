"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "~/trpc/react";

interface GovernmentData {
  governmentName?: string;
  governmentType?: string;
  headOfState?: string;
  headOfGovernment?: string;
  legislatureName?: string;
  executiveName?: string;
  judicialName?: string;
  totalBudget?: number;
  fiscalYear?: string;
  budgetCurrency?: string;
}

interface AutoSyncOptions {
  enabled?: boolean;
  debounceMs?: number;
  showConflictWarnings?: boolean;
  onSyncSuccess?: () => void;
  onSyncError?: (error: string) => void;
  onConflictDetected?: (conflicts: string[]) => void;
}

interface AutoSyncState {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: boolean;
  conflictWarnings: string[];
  syncError: string | null;
  optimistic?: boolean; // Flag for optimistic state (unconfirmed by server)
}

/**
 * Auto-sync hook for Government data
 *
 * Provides debounced autosave functionality for government structure
 * with conflict detection and error handling.
 */
export function useGovernmentAutoSync(
  countryId: string | undefined,
  governmentData: GovernmentData,
  options: AutoSyncOptions = {}
) {
  const {
    enabled = true,
    debounceMs = 15000, // 15 seconds
    showConflictWarnings = true,
    onSyncSuccess,
    onSyncError,
    onConflictDetected,
  } = options;

  const [syncState, setSyncState] = useState<AutoSyncState>({
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: false,
    conflictWarnings: [],
    syncError: null,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<GovernmentData>(governmentData);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // API mutations
  const autosaveMutation = api.government.autosave.useMutation({
    // Optimistic update - show "Saved" immediately before server confirmation
    onMutate: async (newData) => {
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingChanges: false,
        syncError: null,
        optimistic: true, // Flag as optimistic (unconfirmed)
      }));

      // Return context for potential rollback
      return { previousState: { ...syncState } };
    },

    // Server confirmation - mark as confirmed
    onSuccess: () => {
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingChanges: false,
        syncError: null,
        optimistic: false, // Confirmed by server
      }));
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2000); // 2 second checkmark
      onSyncSuccess?.();
    },

    // Error - rollback optimistic state
    onError: (error) => {
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        pendingChanges: true, // Mark as having unsaved changes
        syncError: error.message,
        optimistic: false,
      }));
      onSyncError?.(error.message);
    },
  });

  // Track changes and trigger debounced save
  useEffect(() => {
    if (!enabled || !countryId) return;

    const hasChanges = JSON.stringify(governmentData) !== JSON.stringify(previousDataRef.current);

    if (hasChanges) {
      setSyncState((prev) => ({ ...prev, pendingChanges: true }));

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        handleAutoSync();
      }, debounceMs);
    }

    // Update previous data reference
    previousDataRef.current = governmentData;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [governmentData, enabled, countryId, debounceMs]);

  // Auto-sync handler (avoiding mutation in dependencies)
  const handleAutoSync = useCallback(async () => {
    if (!countryId || !enabled) return;

    setSyncState((prev) => ({ ...prev, isSyncing: true }));

    try {
      await autosaveMutation.mutateAsync({
        countryId,
        data: governmentData,
      });
    } catch (error) {
      // Error handling is done in the mutation's onError callback
      console.warn("Government autosave failed:", error);
    }
  }, [countryId, enabled, governmentData]);

  // Manual sync function
  const syncNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    await handleAutoSync();
  }, [handleAutoSync]);

  // Clear conflicts
  const clearConflicts = useCallback(() => {
    setSyncState((prev) => ({
      ...prev,
      conflictWarnings: [],
      syncError: null,
    }));
  }, []);

  // Reset sync state
  const resetSyncState = useCallback(() => {
    setSyncState({
      isSyncing: false,
      lastSyncTime: null,
      pendingChanges: false,
      conflictWarnings: [],
      syncError: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    syncState,
    syncNow,
    clearConflicts,
    resetSyncState,
    isEnabled: enabled,
    showSuccessAnimation,
  };
}
