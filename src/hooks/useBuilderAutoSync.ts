// src/hooks/useBuilderAutoSync.ts
/**
 * Auto-Sync Hooks for Government and Tax Builders
 * 
 * These hooks provide intelligent auto-save functionality with:
 * - Debounced saves to prevent excessive API calls
 * - Conflict detection before saving
 * - User warnings and confirmations
 * - Field-level change tracking
 * - Rollback support on errors
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '~/trpc/react';
import type { GovernmentBuilderState } from '~/types/government';
import type { TaxBuilderState } from '~/hooks/useTaxBuilderState';
import type { ConflictWarning } from '~/server/services/builderIntegrationService';

// ==================== TYPES ====================

interface AutoSyncOptions {
  enabled?: boolean;
  debounceMs?: number;
  showConflictWarnings?: boolean;
  onSyncSuccess?: (result: any) => void;
  onSyncError?: (error: Error) => void;
  onConflictDetected?: (warnings: ConflictWarning[]) => void;
}

interface AutoSyncState {
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
  const [syncState, setSyncState] = useState<AutoSyncState>({
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: false,
    conflictWarnings: [],
    syncError: null,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousStateRef = useRef<GovernmentBuilderState>(initialData);

  // API mutations
  const createMutation = api.government.create.useMutation();
  const updateMutation = api.government.update.useMutation();
  const checkConflictsMutation = api.government.checkConflicts.useMutation();
  const existingGovernmentQuery = api.government.getByCountryId.useQuery(
    { countryId: countryId || '' },
    { enabled: !!countryId, staleTime: 30000 }
  );

  // Track changes
  useEffect(() => {
    if (builderState && previousStateRef.current) {
      const hasChanges = JSON.stringify(builderState) !== JSON.stringify(previousStateRef.current);
      if (hasChanges) {
        setSyncState(prev => ({ ...prev, pendingChanges: true }));
        
        // Trigger debounced save
        if (enabled && countryId) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          
          debounceTimerRef.current = setTimeout(() => {
            handleAutoSync();
          }, debounceMs);
        }
      }
    }
  }, [builderState, enabled, countryId, debounceMs]);

  // Auto-sync handler
  const handleAutoSync = useCallback(async () => {
    if (!countryId || !builderState || !enabled) return;

    setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));

    try {
      // Check for conflicts first if enabled
      let warnings: ConflictWarning[] = [];
      if (showConflictWarnings) {
        const conflictResult = await checkConflictsMutation.mutateAsync({
          countryId,
          data: builderState,
        });
        warnings = conflictResult.warnings;
        
        if (warnings.length > 0) {
          setSyncState(prev => ({ ...prev, conflictWarnings: warnings }));
          if (onConflictDetected) {
            onConflictDetected(warnings);
          }
          
          // If there are critical warnings, don't auto-save
          const hasCriticalWarnings = warnings.some(w => w.severity === 'critical');
          if (hasCriticalWarnings) {
            setSyncState(prev => ({ 
              ...prev, 
              isSyncing: false,
              pendingChanges: true 
            }));
            // Surface a durable error to the UI layer for hard-block UX
            setSyncState(prev => ({ ...prev, syncError: new Error('Critical conflicts detected. Please resolve before saving.') }));
            return;
          }
        }
      }

      // Determine if we need to create or update based on DB existence
      const hasExistingGovernment = !!existingGovernmentQuery.data;

      let result;
      let attemptedUpdate = false;
      try {
        if (hasExistingGovernment) {
          attemptedUpdate = true;
          result = await updateMutation.mutateAsync({
            countryId,
            data: builderState,
            skipConflictCheck: true, // Already checked above
          });
        } else {
          result = await createMutation.mutateAsync({
            countryId,
            data: builderState,
            skipConflictCheck: true, // Already checked above
          });
        }
      } catch (err) {
        // If update failed due to missing record, fall back to create
        const message = err instanceof Error ? err.message : String(err);
        const looksLikeNotFound = message.includes('No record was found') || message.includes('Record to update not found') || message.includes('P2025');
        if (attemptedUpdate && looksLikeNotFound) {
          result = await createMutation.mutateAsync({
            countryId,
            data: builderState,
            skipConflictCheck: true,
          });
        } else {
          throw err;
        }
      }

      // Update state on success
      previousStateRef.current = builderState;
      setSyncState({
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingChanges: false,
        conflictWarnings: warnings,
        syncError: null,
      });

      if (onSyncSuccess) {
        onSyncSuccess(result);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown sync error');
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        syncError: err,
      }));
      
      if (onSyncError) {
        onSyncError(err);
      }
    }
  }, [
    countryId,
    builderState,
    enabled,
    showConflictWarnings,
    checkConflictsMutation,
    createMutation,
    updateMutation,
    onSyncSuccess,
    onSyncError,
    onConflictDetected,
  ]);

  // Manual sync trigger
  const triggerSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    handleAutoSync();
  }, [handleAutoSync]);

  // Clear pending changes
  const clearConflicts = useCallback(() => {
    setSyncState(prev => ({ ...prev, conflictWarnings: [] }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    builderState,
    setBuilderState,
    syncState,
    triggerSync,
    clearConflicts,
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
  const [syncState, setSyncState] = useState<AutoSyncState>({
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: false,
    conflictWarnings: [],
    syncError: null,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousStateRef = useRef<TaxBuilderState>(initialData);

  // API mutations
  const createMutation = api.taxSystem.create.useMutation();
  const updateMutation = api.taxSystem.update.useMutation();
  const checkConflictsMutation = api.taxSystem.checkConflicts.useMutation();
  const existingTaxQuery = api.taxSystem.getByCountryId.useQuery(
    { countryId: countryId || '' },
    { enabled: !!countryId, staleTime: 30000 }
  );

  // Track changes
  useEffect(() => {
    if (builderState && previousStateRef.current) {
      const hasChanges = JSON.stringify(builderState) !== JSON.stringify(previousStateRef.current);
      if (hasChanges) {
        setSyncState(prev => ({ ...prev, pendingChanges: true }));
        
        // Trigger debounced save
        if (enabled && countryId) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          
          debounceTimerRef.current = setTimeout(() => {
            handleAutoSync();
          }, debounceMs);
        }
      }
    }
  }, [builderState, enabled, countryId, debounceMs]);

  // Auto-sync handler
  const handleAutoSync = useCallback(async () => {
    if (!countryId || !builderState || !enabled) return;

    setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));

    try {
      // Check for conflicts first if enabled
      let warnings: ConflictWarning[] = [];
      if (showConflictWarnings) {
        const conflictResult = await checkConflictsMutation.mutateAsync({
          countryId,
          data: builderState,
        });
        warnings = conflictResult.warnings;
        
        if (warnings.length > 0) {
          setSyncState(prev => ({ ...prev, conflictWarnings: warnings }));
          if (onConflictDetected) {
            onConflictDetected(warnings);
          }
          
          // If there are critical warnings, don't auto-save
          const hasCriticalWarnings = warnings.some(w => w.severity === 'critical');
          if (hasCriticalWarnings) {
            setSyncState(prev => ({ 
              ...prev, 
              isSyncing: false,
              pendingChanges: true 
            }));
            return;
          }
        }
      }

      // Prefer update-first to avoid unique constraint races; fall back accordingly
      let result;
      try {
        // Try update first (handles existing records and avoids P2002 on create)
        result = await updateMutation.mutateAsync({
          countryId,
          data: builderState,
          skipConflictCheck: true,
        });
      } catch (updateErr) {
        const updateMsg = updateErr instanceof Error ? updateErr.message : String(updateErr);
        const notFound = updateMsg.includes('No record was found') || updateMsg.includes('Record to update not found') || updateMsg.includes('P2025');
        if (notFound) {
          try {
            // Create if no existing record
            result = await createMutation.mutateAsync({
              countryId,
              data: builderState,
              skipConflictCheck: true,
            });
          } catch (createErr) {
            const createMsg = createErr instanceof Error ? createErr.message : String(createErr);
            const uniqueViolation = createMsg.includes('Unique constraint failed') || createMsg.includes('P2002');
            if (uniqueViolation) {
              // Another writer created it between our check and create; retry update
              result = await updateMutation.mutateAsync({
                countryId,
                data: builderState,
                skipConflictCheck: true,
              });
            } else {
              throw createErr;
            }
          }
        } else {
          throw updateErr;
        }
      }

      // Update state on success
      previousStateRef.current = builderState;
      setSyncState({
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingChanges: false,
        conflictWarnings: warnings,
        syncError: null,
      });

      if (onSyncSuccess) {
        onSyncSuccess(result);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown sync error');
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        syncError: err,
      }));
      
      if (onSyncError) {
        onSyncError(err);
      }
    }
  }, [
    countryId,
    builderState,
    enabled,
    showConflictWarnings,
    checkConflictsMutation,
    createMutation,
    updateMutation,
    onSyncSuccess,
    onSyncError,
    onConflictDetected,
  ]);

  // Manual sync trigger
  const triggerSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    handleAutoSync();
  }, [handleAutoSync]);

  // Clear pending changes
  const clearConflicts = useCallback(() => {
    setSyncState(prev => ({ ...prev, conflictWarnings: [] }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    builderState,
    setBuilderState,
    syncState,
    triggerSync,
    clearConflicts,
  };
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format sync status message
 */
export function getSyncStatusMessage(syncState: AutoSyncState): string {
  if (syncState.isSyncing) {
    return 'Saving changes...';
  }
  
  if (syncState.syncError) {
    return `Error: ${syncState.syncError.message}`;
  }
  
  if (syncState.pendingChanges) {
    return 'Unsaved changes';
  }
  
  if (syncState.lastSyncTime) {
    const now = new Date();
    const diff = Math.floor((now.getTime() - syncState.lastSyncTime.getTime()) / 1000);
    
    if (diff < 60) {
      return `Saved ${diff}s ago`;
    } else if (diff < 3600) {
      return `Saved ${Math.floor(diff / 60)}m ago`;
    } else {
      return `Saved ${Math.floor(diff / 3600)}h ago`;
    }
  }
  
  return 'Not saved';
}

/**
 * Get conflict severity badge color
 */
export function getConflictSeverityColor(severity: 'info' | 'warning' | 'critical'): string {
  switch (severity) {
    case 'info':
      return 'blue';
    case 'warning':
      return 'yellow';
    case 'critical':
      return 'red';
    default:
      return 'gray';
  }
}

