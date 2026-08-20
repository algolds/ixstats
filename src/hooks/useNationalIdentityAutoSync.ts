"use client";

import { useState, useCallback } from "react";
import { api } from "~/trpc/react";
import { useGenericAutoSync } from "~/hooks/useGenericAutoSync";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";

export interface AutoSyncOptions {
  enabled?: boolean;
  debounceMs?: number;
  showConflictWarnings?: boolean;
  onSyncSuccess?: () => void;
  onSyncError?: (error: string) => void;
  onConflictDetected?: (conflicts: string[]) => void;
}

export function useNationalIdentityAutoSync(
  countryId: string | undefined,
  nationalIdentity: NationalIdentityData,
  options: AutoSyncOptions = {}
) {
  const {
    enabled = true,
    debounceMs = 15000,
    onSyncSuccess,
    onSyncError,
  } = options;

  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const updateMutation = api.nationalIdentity.update.useMutation();

  const sync = useGenericAutoSync(nationalIdentity, {
    enabled: enabled && !!countryId,
    debounceMs,
    syncFn: async (data) => {
      if (!countryId) return;
      const res = await updateMutation.mutateAsync({ countryId, data });
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
