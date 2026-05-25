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

// Convenience hooks for specific values — using Zustand selectors means
// components only re-render when THEIR value changes, not on every tick
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

export function useCurrentIxTime(): number {
  return useIxTimeTimestamp();
}

export function useFormattedIxTime(): string {
  return useIxTimeFormatted();
}

export function useCurrentGameYear(): number {
  return useIxTimeGameYear();
}

export function useTimeMultiplier(): number {
  return useIxTimeMultiplier();
}
