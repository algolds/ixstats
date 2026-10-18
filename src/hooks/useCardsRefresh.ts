"use client";

import { useCallback } from "react";
import { api } from "~/trpc/react";

/**
 * What to read again after copies move or lock: a trade made, answered or cancelled, a bid, a buyout, a listing made or
 * cancelled, an auction settled, a pack opened, the daily card, an import. The player's copies (Mine, the trade
 * builder), the display and showcases, the sheet, Explore (a card just collected stops being a silhouette), the
 * Market's lists, the trades and the balance. The function is stable, so a socket subscription can hold it.
 */
export function useCardsRefresh(): () => void {
  const utils = api.useUtils();
  return useCallback(() => {
    void utils.cards.listMine.invalidate();
    void utils.cards.getMyCards.invalidate();
    void utils.cards.getMyDisplay.invalidate();
    void utils.cards.listMyShowcases.invalidate();
    void utils.cards.getSheet.invalidate();
    void utils.cards.exploreShelves.invalidate();
    void utils.cards.exploreGrid.invalidate();
    void utils.cardMarket.getActiveAuctions.invalidate();
    void utils.cardMarket.getMyActiveAuctions.invalidate();
    void utils.cardMarket.getMyActiveBids.invalidate();
    void utils.cardMarket.getMyAuctionParticipation.invalidate();
    void utils.trading.getActiveTrades.invalidate();
    void utils.trading.getTradeById.invalidate();
    void utils.trading.getTradeHistory.invalidate();
    void utils.vault.getBalance.invalidate();
  }, [utils]);
}
