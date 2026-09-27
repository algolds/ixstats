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
    let tickInterval: ReturnType<typeof setInterval> | null = null;
    let syncInterval: ReturnType<typeof setInterval> | null = null;

    const syncFromServer = async () => {
      if (!active) return;
      await refreshTime();
    };

    const start = () => {
      if (tickInterval !== null) return;
      tickInterval = setInterval(() => {
        if (active) tick();
      }, updateInterval);
      syncInterval = setInterval(syncFromServer, 30000);
    };

    const stop = () => {
      if (tickInterval !== null) clearInterval(tickInterval);
      if (syncInterval !== null) clearInterval(syncInterval);
      tickInterval = null;
      syncInterval = null;
    };

    // No ticking or polling while the tab is hidden; resync immediately when it returns.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      void syncFromServer();
      tick();
      start();
    };

    // Initial sync
    void syncFromServer();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
} from "~/stores/ixtime-store";
