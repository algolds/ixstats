"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "~/trpc/react";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";

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
}

/**
 * Auto-sync hook for National Identity data
 *
 * Provides debounced autosave functionality for national identity fields
 * with conflict detection and error handling.
 */
export function useNationalIdentityAutoSync(
  countryId: string | undefined,
  nationalIdentity: NationalIdentityData,
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
  const previousDataRef = useRef<NationalIdentityData>(nationalIdentity);

  // API mutations
  const autosaveMutation = api.nationalIdentity.autosave.useMutation({
    onSuccess: () => {
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingChanges: false,
        syncError: null,
      }));
      onSyncSuccess?.();
    },
    onError: (error) => {
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        syncError: error.message,
      }));
      onSyncError?.(error.message);
    },
  });

  // Track changes and trigger debounced save
  useEffect(() => {
    if (!enabled || !countryId) return;

    const hasChanges = JSON.stringify(nationalIdentity) !== JSON.stringify(previousDataRef.current);

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
    previousDataRef.current = nationalIdentity;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [nationalIdentity, enabled, countryId, debounceMs]);

  // Auto-sync handler
  const handleAutoSync = useCallback(async () => {
    if (!countryId || !enabled) return;

    setSyncState((prev) => ({ ...prev, isSyncing: true }));

    try {
      await autosaveMutation.mutateAsync({
        countryId,
        data: nationalIdentity,
      });
    } catch (error) {
      // Error handling is done in the mutation's onError callback
      console.warn("National identity autosave failed:", error);
    }
  }, [countryId, enabled, nationalIdentity, autosaveMutation]);

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
  };
}
