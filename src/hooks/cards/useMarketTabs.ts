"use client";

import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { vaultNotify } from "~/lib/vault/vault-notifications";

export type BrowseInputView = RouterInputs["cardMarket"]["browse"];
export type BrowseItemView = RouterOutputs["cardMarket"]["browse"]["items"][number];
export type WishlistEntryView = RouterOutputs["cardMarket"]["getWishlist"][number];
export type MyListingView = RouterOutputs["cardMarket"]["getMyListings"][number];

/** Browse: live listings and auctions in one list. */
export function useBrowse(input: BrowseInputView) {
  return api.cardMarket.browse.useQuery(input, {
    staleTime: 15_000,
    // A longer page or a new filter keeps the current items on screen until the new ones arrive
    placeholderData: (previous) => previous,
  });
}

export function useWishlist() {
  return api.cardMarket.getWishlist.useQuery();
}

export function useMyListings() {
  return api.cardMarket.getMyListings.useQuery();
}

/**
 * Selling's cancel and the Wishlist's remove. A cancel unlocks the copy, so it reads the card screens again through the
 * one refresh; a remove changes only the wishlist and the sheet's wanted state. A failure is toasted.
 */
export function useListingActions() {
  const utils = api.useUtils();
  const refreshCards = useCardsRefresh();
  const onError = (error: { message: string }) => vaultNotify.error(error.message);
  return {
    cancel: api.cardMarket.cancelListing.useMutation({
      onSuccess: ({ refund }) => {
        vaultNotify.success(
          refund > 0
            ? `${refund.toLocaleString()} IxC of the listing fee came back.`
            : "The copy is back in your collection.",
          "Listing cancelled"
        );
        refreshCards();
      },
      onError: (error) => {
        onError(error);
        // A listing that sold or ended meanwhile shows how it ended
        void utils.cardMarket.getMyListings.invalidate();
      },
    }),
    removeWish: api.cardMarket.removeFromWishlist.useMutation({
      onSuccess: async () => {
        await Promise.all([
          utils.cardMarket.getWishlist.invalidate(),
          utils.cards.getSheetEconomy.invalidate(),
          // The sheet's wanted count
          utils.cards.getSheet.invalidate(),
        ]);
      },
      onError,
    }),
  };
}
