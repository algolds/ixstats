"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { isEqual } from "~/lib/utils/common";

export type AutoSyncStatus = "idle" | "pending" | "syncing" | "saved" | "error";

export interface AutoSyncState<TError = Error> {
  status: AutoSyncStatus;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: boolean;
  syncError: TError | null;
  optimistic?: boolean;
}

export interface AutoSyncOptions<TData, TResult = unknown, TError = Error> {
  enabled?: boolean;
  debounceMs?: number;
  onSyncSuccess?: (result: TResult) => void;
  onSyncError?: (error: TError) => void;
  syncFn: (data: TData) => Promise<TResult>;
}

/**
 * Universal, strongly-typed autosave hook for form builders.
 * Replaces repetitive debounced autosave state logic across builder forms.
 */
export function useGenericAutoSync<TData extends object, TResult = unknown, TError = Error>(
  data: TData,
  options: AutoSyncOptions<TData, TResult, TError>
) {
  const {
    enabled = true,
    debounceMs = 2000,
    onSyncSuccess,
    onSyncError,
    syncFn,
  } = options;

  const [syncState, setSyncState] = useState<AutoSyncState<TError>>({
    status: "idle",
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: false,
    syncError: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousDataRef = useRef<TData>(data);
  const syncFnRef = useRef(syncFn);
  syncFnRef.current = syncFn;

  const triggerSync = useCallback(
    async (dataToSync: TData) => {
      setSyncState((prev) => ({ ...prev, status: "syncing", isSyncing: true, syncError: null }));
      try {
        const result = await syncFnRef.current(dataToSync);
        previousDataRef.current = dataToSync;
        setSyncState({
          status: "saved",
          isSyncing: false,
          lastSyncTime: new Date(),
          pendingChanges: false,
          syncError: null,
        });
        onSyncSuccess?.(result);
        return result;
      } catch (err) {
        const error = (err instanceof Error ? err : new Error(String(err))) as TError;
        setSyncState((prev) => ({
          ...prev,
          status: "error",
          isSyncing: false,
          syncError: error,
        }));
        onSyncError?.(error);
        throw error;
      }
    },
    [onSyncSuccess, onSyncError]
  );

  const forceSync = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return triggerSync(data);
  }, [data, triggerSync]);

  useEffect(() => {
    if (!enabled) return;

    // Detect field changes using deep equality
    if (isEqual(previousDataRef.current, data)) {
      return;
    }

    setSyncState((prev) => ({ ...prev, status: "pending", pendingChanges: true }));

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void triggerSync(data);
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [data, enabled, debounceMs, triggerSync]);

  return {
    ...syncState,
    forceSync,
  };
}
