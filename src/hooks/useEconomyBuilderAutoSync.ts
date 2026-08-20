"use client";

import { useState, useCallback } from "react";
import { api } from "~/trpc/react";
import { useGenericAutoSync } from "~/hooks/useGenericAutoSync";

export interface EconomyBuilderData {
  gdp?: number;
  gdpPerCapita?: number;
  population?: number;
  unemploymentRate?: number;
  inflationRate?: number;
  interestRate?: number;
  publicDebt?: number;
  publicDebtGDPPercent?: number;
  laborForceParticipation?: number;
  averageWorkingHours?: number;
  minimumWage?: number;
  tradeBalance?: number;
  currentAccountBalance?: number;
  foreignExchangeReserves?: number;
  exchangeRate?: number;
  gdpGrowthRate?: number;
  productivityGrowthRate?: number;
  realGdpGrowthRate?: number;
  povertyRate?: number;
  giniCoefficient?: number;
  humanDevelopmentIndex?: number;
  literacyRate?: number;
  lifeExpectancy?: number;
}

export interface AutoSyncOptions {
  enabled?: boolean;
  debounceMs?: number;
  showConflictWarnings?: boolean;
  onSyncSuccess?: () => void;
  onSyncError?: (error: string) => void;
  onConflictDetected?: (conflicts: string[]) => void;
}

export function useEconomyBuilderAutoSync(
  countryId: string | undefined,
  economyData: EconomyBuilderData,
  options: AutoSyncOptions = {}
) {
  const {
    enabled = true,
    debounceMs = 15000,
    onSyncSuccess,
    onSyncError,
  } = options;

  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const autosaveMutation = api.economics.autoSaveEconomyBuilder.useMutation();

  const sync = useGenericAutoSync(economyData, {
    enabled: enabled && !!countryId,
    debounceMs,
    syncFn: async (data) => {
      if (!countryId) return;
      const res = await autosaveMutation.mutateAsync({
        countryId,
        changes: data as Record<string, string | number | boolean | Date | null>,
      });
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2000);
      return res;
    },
    onSyncSuccess: () => onSyncSuccess?.(),
    onSyncError: (err) => onSyncError?.(err.message),
  });

  const clearConflicts = useCallback(() => {}, []);
  const resetSyncState = useCallback(() => {}, []);

  return {
    syncState: {
      isSyncing: sync.isSyncing,
      lastSyncTime: sync.lastSyncTime,
      pendingChanges: sync.pendingChanges,
      conflictWarnings: [] as string[],
      syncError: sync.syncError?.message ?? null,
      optimistic: sync.status === "saved",
    },
    syncNow: sync.forceSync,
    clearConflicts,
    resetSyncState,
    isEnabled: enabled,
    showSuccessAnimation,
  };
}
