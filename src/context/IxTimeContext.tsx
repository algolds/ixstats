"use client";

import React, { useEffect, type ReactNode } from "react";
import {
  useIxTimeStore,
  useIxTimeTimestamp,
  useIxTimeFormatted,
  useIxTimeGameYear,
  useIxTimeMultiplier,
} from "~/stores/ixtime-store";

interface IxTimeProviderProps {
  children: ReactNode;
  updateInterval?: number;
}

export function IxTimeProvider({ children, updateInterval = 1000 }: IxTimeProviderProps) {
  const tick = useIxTimeStore((s) => s.tick);
  const refreshTime = useIxTimeStore((s) => s.refreshTime);

  useEffect(() => {
    let active = true;

    const syncFromServer = async () => {
      if (!active) return;
      await refreshTime();
    };

    // Initial sync
    syncFromServer();

    // Set up intervals
    const tickInterval = setInterval(() => {
      if (active) tick();
    }, updateInterval);

    const syncInterval = setInterval(syncFromServer, 30000);

    return () => {
      active = false;
      clearInterval(tickInterval);
      clearInterval(syncInterval);
    };
  }, [updateInterval, tick, refreshTime]);

  return <>{children}</>;
}

// Convenience composite hook for components needing multiple fields
export function useIxTime() {
  return {
    ixTimeTimestamp: useIxTimeTimestamp(),
    ixTimeFormatted: useIxTimeFormatted(),
    multiplier: useIxTimeMultiplier(),
    isPaused: useIxTimeStore((s) => s.isPaused),
    gameYear: useIxTimeGameYear(),
    isNaturalProgression: useIxTimeStore((s) => s.isNaturalProgression),
    isLoading: useIxTimeStore((s) => s.isLoading),
    lastUpdated: useIxTimeStore((s) => s.lastUpdated),
    referenceTimestamp: useIxTimeStore((s) => s.referenceTimestamp),
    referenceRealTime: useIxTimeStore((s) => s.referenceRealTime),
    refreshTime: useIxTimeStore((s) => s.refreshTime),
  };
}

// Re-export granular selectors directly for optimal O(1) performance
export {
  useIxTimeTimestamp,
  useIxTimeFormatted,
  useIxTimeGameYear,
  useIxTimeMultiplier,
  useIxTimeIsPaused,
  useIxTimeAll,
  useIxTimeActions,
} from "~/stores/ixtime-store";

