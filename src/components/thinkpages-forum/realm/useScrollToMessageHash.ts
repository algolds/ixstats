"use client";

import { useEffect, useRef } from "react";

/**
 * Scrolls to `#post-<id>` once the board has messages on screen (a permalink, a "Replying to" link), once per hash:
 * a refetch or a new message leaves the reader where they are. A message older than the loaded page is not on the
 * page to scroll to.
 */
export function useScrollToMessageHash(loaded: number) {
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const { hash } = window.location;
    if (loaded === 0 || !hash.startsWith("#post-") || handled.current === hash) return;
    handled.current = hash;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [loaded]);
}
