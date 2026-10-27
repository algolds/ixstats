"use client";

import { useEffect, type ReactNode } from "react";
import { useIxTimeStore } from "~/stores/ixtime-store";

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
