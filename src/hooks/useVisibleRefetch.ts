"use client";

import { useEffect, useState } from "react";

/**
 * Returns a refetchInterval that pauses polling when the browser tab is hidden or inactive.
 * Drop-in replacement for refetchInterval values in React Query hooks.
 *
 * @param intervalMs The active refetch interval in milliseconds.
 * @returns The interval in ms if tab is visible, or `false` to pause polling when tab is hidden.
 */
export function useVisibleRefetch(intervalMs: number | false): number | false {
  const [visible, setVisible] = useState(() =>
    typeof document !== "undefined" ? document.visibilityState === "visible" : true
  );

  useEffect(() => {
    if (typeof document === "undefined" || intervalMs === false) return;

    const handleVisibilityChange = () => {
      setVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs]);

  if (intervalMs === false) return false;
  return visible ? intervalMs : false;
}
