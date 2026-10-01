"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False for the server's render and for the browser's first (hydrating) pass over server HTML, true
 * afterwards and in any render that never came from the server. React renders the "server" snapshot
 * while it hydrates, so output that needs a DOM (the reader's placeholder pass) starts from the
 * HTML the server sent and is applied right after hydration, never as a hydration mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
