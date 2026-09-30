import { useState, useEffect } from "react";
import { timeAgo } from "~/lib/format/compact";

/** `timeAgo()` that re-renders once a minute so the label stays fresh. */
export function useRelativeTime(timestamp: Date | string | number) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((tick) => tick + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  return timeAgo(timestamp);
}
