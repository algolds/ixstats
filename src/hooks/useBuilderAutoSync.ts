"use client";

import { useState, useCallback, useEffect } from "react";
import { api } from "~/trpc/react";
import { useGenericAutoSync } from "~/hooks/useGenericAutoSync";
import type { GovernmentBuilderState } from "~/types/government";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { ConflictWarning } from "~/server/services/builderIntegrationService";

// ==================== TYPES ====================

export interface AutoSyncOptions {
  enabled?: boolean;
  debounceMs?: number;
  showConflictWarnings?: boolean;
  onSyncSuccess?: (result: any) => void;
  onSyncError?: (error: Error) => void;
  onConflictDetected?: (warnings: ConflictWarning[]) => void;
}

export interface AutoSyncState {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: boolean;
  conflictWarnings: ConflictWarning[];
  syncError: Error | null;
}

// ==================== GOVERNMENT BUILDER AUTO-SYNC ====================

export function useGovernmentBuilderAutoSync(
  countryId: string | undefined,
  initialData: GovernmentBuilderState,
  options: AutoSyncOptions = {}
) {
  const {
    enabled = true,
    debounceMs = 2000,
    showConflictWarnings = true,
    onSyncSuccess,
    onSyncError,
    onConflictDetected,
  } = options;

  const [builderState, setBuilderState] = useState<GovernmentBuilderState>(initialData);
  const [conflictWarnings, setConflictWarnings] = useState<ConflictWarning[]>([]);

  useEffect(() => {
    setBuilderState(initialData);
  }, [initialData]);

  const createMutation = api.government.create.useMutation();
  const updateMutation = api.government.update.useMutation();
  const checkConflictsMutation = api.government.checkConflicts.useMutation();
  const existingGovernmentQuery = api.government.getByCountryId.useQuery(
    { countryId: countryId || "" },
    { enabled: !!countryId, staleTime: 30000 }
  );

  const sync = useGenericAutoSync(builderState, {
    enabled: enabled && !!countryId,
    debounceMs,
    syncFn: async (dataToSync) => {
      if (!countryId) return;

      if (showConflictWarnings) {
        const conflictResult = await checkConflictsMutation.mutateAsync({
          countryId,
          data: dataToSync as any,
        });
        const warnings = conflictResult.warnings;
        setConflictWarnings(warnings);
        if (warnings.length > 0) {
          onConflictDetected?.(warnings);
          if (warnings.some((w) => w.severity === "critical")) {
            throw new Error("Critical conflicts detected. Please resolve before saving.");
          }
        }
      }

      const hasExistingGovernment = !!existingGovernmentQuery.data;
      if (hasExistingGovernment) {
        try {
          return await updateMutation.mutateAsync({
            countryId,
            data: dataToSync as any,
            skipConflictCheck: true,
          });
        } catch {
          return await createMutation.mutateAsync({
            countryId,
            data: dataToSync as any,
            skipConflictCheck: true,
          });
        }
      } else {
        try {
          return await createMutation.mutateAsync({
            countryId,
            data: dataToSync as any,
            skipConflictCheck: true,
          });
        } catch {
          return await updateMutation.mutateAsync({
            countryId,
            data: dataToSync as any,
            skipConflictCheck: true,
          });
        }
      }
    },
    onSyncSuccess: (res) => onSyncSuccess?.(res),
    onSyncError: (err) => onSyncError?.(err),
  });

  const clearConflicts = useCallback(() => setConflictWarnings([]), []);
  const resetSyncState = useCallback(() => setConflictWarnings([]), []);

  return {
    builderState,
    setBuilderState,
    syncState: {
      isSyncing: sync.isSyncing,
      lastSyncTime: sync.lastSyncTime,
      pendingChanges: sync.pendingChanges,
      conflictWarnings,
      syncError: sync.syncError,
    },
    syncNow: sync.forceSync,
    triggerSync: sync.forceSync,
    clearConflicts,
    resetSyncState,
    isEnabled: enabled,
  };
}

// ==================== TAX BUILDER AUTO-SYNC ====================

export function useTaxBuilderAutoSync(
  countryId: string | undefined,
  initialData: TaxBuilderState,
  options: AutoSyncOptions = {}
) {
  const {
    enabled = true,
    debounceMs = 2000,
    showConflictWarnings = true,
    onSyncSuccess,
    onSyncError,
    onConflictDetected,
  } = options;

  const [builderState, setBuilderState] = useState<TaxBuilderState>(initialData);
  const [conflictWarnings, setConflictWarnings] = useState<ConflictWarning[]>([]);

  useEffect(() => {
    setBuilderState(initialData);
  }, [initialData]);

  const createMutation = api.taxSystem.create.useMutation();
  const updateMutation = api.taxSystem.update.useMutation();
  const checkConflictsMutation = api.taxSystem.checkConflicts.useMutation();

  const sync = useGenericAutoSync(builderState, {
    enabled: enabled && !!countryId,
    debounceMs,
    syncFn: async (dataToSync) => {
      if (!countryId) return;

      if (showConflictWarnings) {
        const conflictResult = await checkConflictsMutation.mutateAsync({
          countryId,
          data: dataToSync as any,
        });
        const warnings = conflictResult.warnings;
        setConflictWarnings(warnings);
        if (warnings.length > 0) {
          onConflictDetected?.(warnings);
          if (warnings.some((w) => w.severity === "critical")) {
            throw new Error("Critical conflicts detected in tax configuration.");
          }
        }
      }

      try {
        return await updateMutation.mutateAsync({
          countryId,
          data: dataToSync as any,
          skipConflictCheck: true,
        });
      } catch {
        return await createMutation.mutateAsync({
          countryId,
          data: dataToSync as any,
          skipConflictCheck: true,
        });
      }
    },
    onSyncSuccess: (res) => onSyncSuccess?.(res),
    onSyncError: (err) => onSyncError?.(err),
  });

  const clearConflicts = useCallback(() => setConflictWarnings([]), []);
  const resetSyncState = useCallback(() => setConflictWarnings([]), []);

  return {
    builderState,
    setBuilderState,
    syncState: {
      isSyncing: sync.isSyncing,
      lastSyncTime: sync.lastSyncTime,
      pendingChanges: sync.pendingChanges,
      conflictWarnings,
      syncError: sync.syncError,
    },
    syncNow: sync.forceSync,
    triggerSync: sync.forceSync,
    clearConflicts,
    resetSyncState,
    isEnabled: enabled,
  };
}
