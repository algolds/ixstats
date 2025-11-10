"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "~/trpc/react";

interface EconomyBuilderData {
  // Core economic indicators
  gdp?: number;
  gdpPerCapita?: number;
  population?: number;
  unemploymentRate?: number;
  inflationRate?: number;
  interestRate?: number;
  publicDebt?: number;
  publicDebtGDPPercent?: number;

  // Labor market
  laborForceParticipation?: number;
  averageWorkingHours?: number;
  minimumWage?: number;

  // Trade & external
  tradeBalance?: number;
  currentAccountBalance?: number;
  foreignExchangeReserves?: number;
  exchangeRate?: number;

  // Development indicators
  gdpGrowthRate?: number;
  productivityGrowthRate?: number;
  realGdpGrowthRate?: number;

  // Social indicators
  povertyRate?: number;
  giniCoefficient?: number;
  humanDevelopmentIndex?: number;

  // Demographics
  literacyRate?: number;
  lifeExpectancy?: number;
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
 * Auto-sync hook for Economy Builder data
 *
 * Provides debounced autosave functionality for economic indicators
 * with conflict detection and error handling.
 */
export function useEconomyBuilderAutoSync(
  countryId: string | undefined,
  economyData: EconomyBuilderData,
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
  const previousDataRef = useRef<EconomyBuilderData>(economyData);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // API mutations
  const autosaveMutation = api.economics.autoSaveEconomyBuilder.useMutation({
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

    const hasChanges = JSON.stringify(economyData) !== JSON.stringify(previousDataRef.current);

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
    previousDataRef.current = economyData;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [economyData, enabled, countryId, debounceMs]);

  // Auto-sync handler (avoiding mutation in dependencies)
  const handleAutoSync = useCallback(async () => {
    if (!countryId || !enabled) return;

    setSyncState((prev) => ({ ...prev, isSyncing: true }));

    try {
      // Convert economyData to changes format expected by the API
      const changes: Record<string, string | number | boolean | null | Date> = {};

      // Map all economic fields to changes
      Object.entries(economyData).forEach(([key, value]) => {
        if (value !== undefined) {
          changes[key] = value;
        }
      });

      await autosaveMutation.mutateAsync({
        countryId,
        changes,
      });
    } catch (error) {
      // Error handling is done in the mutation's onError callback
      console.warn("Economy builder autosave failed:", error);
    }
  }, [countryId, enabled, economyData]);

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
