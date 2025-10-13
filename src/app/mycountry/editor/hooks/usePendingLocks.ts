"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";

/**
 * Hook to determine if specific fields are locked due to pending scheduled changes.
 * Field paths should match the `ScheduledChange.fieldPath` values (e.g., "taxRevenueGDPPercent").
 */
export function usePendingLocks() {
  const { data: pendingChanges } = api.scheduledChanges.getPendingChanges.useQuery();

  const lockedFields = useMemo(() => {
    const set = new Set<string>();
    if (pendingChanges && pendingChanges.length > 0) {
      for (const change of pendingChanges) {
        if (change.status === "pending" && typeof change.fieldPath === "string") {
          set.add(change.fieldPath);
        }
      }
    }
    return set;
  }, [pendingChanges]);

  const isLocked = (fieldPath: string) => lockedFields.has(fieldPath);

  return { isLocked, lockedFields, pendingCount: lockedFields.size };
}


