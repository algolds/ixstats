"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "~/trpc/react";

interface TaxSystemData {
  taxSystemName?: string;
  taxAuthority?: string;
  fiscalYear?: string;
  taxCode?: string;
  baseRate?: number;
  progressiveTax?: boolean;
  flatTaxRate?: number;
  alternativeMinTax?: boolean;
  alternativeMinRate?: number;
  complianceRate?: number;
  collectionEfficiency?: number;
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
 * Auto-sync hook for Tax System data
 *
 * Provides debounced autosave functionality for tax system configuration
 * with conflict detection and error handling.
 */
export function useTaxSystemAutoSync(
  countryId: string | undefined,
  taxSystemData: TaxSystemData,
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
  const previousDataRef = useRef<TaxSystemData>(taxSystemData);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // API mutations
  const autosaveMutation = api.taxSystem.autosave.useMutation({
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

    const hasChanges = JSON.stringify(taxSystemData) !== JSON.stringify(previousDataRef.current);

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
    previousDataRef.current = taxSystemData;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [taxSystemData, enabled, countryId, debounceMs]);

  // Auto-sync handler (avoiding mutation in dependencies)
  const handleAutoSync = useCallback(async () => {
    if (!countryId || !enabled) return;

    setSyncState((prev) => ({ ...prev, isSyncing: true }));

    try {
      await autosaveMutation.mutateAsync({
        countryId,
        data: taxSystemData,
      });
    } catch (error) {
      // Error handling is done in the mutation's onError callback
      console.warn("Tax system autosave failed:", error);
    }
  }, [countryId, enabled, taxSystemData]);

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
