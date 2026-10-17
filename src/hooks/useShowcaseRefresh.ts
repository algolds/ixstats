"use client";

import { api } from "~/trpc/react";

/**
 * What to read again after a showcase changes: the player's showcases, the showcase itself, and the wallet's
 * display, which shows the pinned showcase.
 */
export function useShowcaseRefresh(): (showcaseId: string) => void {
  const utils = api.useUtils();
  return (showcaseId) => {
    void utils.cards.listMyShowcases.invalidate();
    void utils.cards.getShowcase.invalidate({ showcaseId });
    void utils.cards.getMyDisplay.invalidate();
  };
}
