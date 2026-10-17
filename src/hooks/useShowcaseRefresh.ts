"use client";

import { api } from "~/trpc/react";

/**
 * What to read again after a showcase changes: the player's showcases, the showcase itself, and the two displays
 * that show the pinned showcase, the wallet's and the Passport's. With no id every cached showcase reads again, as
 * after a pin, which takes the pin off whichever showcase held it.
 */
export function useShowcaseRefresh(): (showcaseId?: string) => void {
  const utils = api.useUtils();
  return (showcaseId) => {
    void utils.cards.listMyShowcases.invalidate();
    void (showcaseId === undefined
      ? utils.cards.getShowcase.invalidate()
      : utils.cards.getShowcase.invalidate({ showcaseId }));
    void utils.cards.getMyDisplay.invalidate();
    void utils.ixnayid.getPassport.invalidate();
  };
}
