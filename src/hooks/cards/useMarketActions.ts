"use client";

import { api } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { listingGone } from "~/lib/cards/market/buy-failure";
import { vaultNotify } from "~/lib/vault/vault-notifications";

/** Whether the signed-in player muted notices about this card. */
export function useCardMute(cardId: string) {
  return api.cards.getCardMute.useQuery({ cardId });
}

/**
 * The sheet's market mutations: buy a listing, craft, wishlist, mute and report. A purchase or a craft moves a copy, so
 * it reads the card screens again through the one refresh; the wishlist and the mute change only their own reads. The
 * purchase and report dialogs show their own failures; the rest are toasted.
 */
export function useMarketActions(cardId: string) {
  const utils = api.useUtils();
  const refreshCards = useCardsRefresh();
  const onError = (error: { message: string }) => vaultNotify.error(error.message);
  const wished = async () => {
    await Promise.all([
      utils.cards.getSheetEconomy.invalidate({ cardId }),
      // The sheet's wanted count
      utils.cards.getSheet.invalidate(),
      utils.cardMarket.getWishlist.invalidate(),
    ]);
  };

  return {
    buy: api.cardMarket.buyListing.useMutation({
      onSuccess: (result) => {
        vaultNotify.success(
          `The copy is yours for ${result.price.toLocaleString()} IxC.`,
          "Bought"
        );
        refreshCards();
      },
      // A listing that has gone leaves the sheet
      onError: (error) => {
        if (listingGone(error)) refreshCards();
      },
    }),
    craft: api.crafting.craft.useMutation({
      onSuccess: () => {
        vaultNotify.success("A Standard copy is in your collection.", "Crafted");
        refreshCards();
      },
      onError,
    }),
    wish: api.cardMarket.addToWishlist.useMutation({ onSuccess: wished, onError }),
    unwish: api.cardMarket.removeFromWishlist.useMutation({ onSuccess: wished, onError }),
    setMute: api.cards.setCardMute.useMutation({
      onSuccess: ({ muted }) => utils.cards.getCardMute.setData({ cardId }, muted),
      onError,
    }),
    report: api.cards.reportInscription.useMutation({
      onSuccess: () => vaultNotify.success("Staff will look at this inscription.", "Reported"),
    }),
  };
}
