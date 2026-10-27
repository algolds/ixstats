"use client";

import { api } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { useShowcaseRefresh } from "~/hooks/useShowcaseRefresh";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import { vaultNotify } from "~/lib/vault/vault-notifications";

/**
 * The copy mutations of the detail sheet and Mine. Each reads the card screens again through the one refresh; a burn
 * (break down, fuse) also reads the showcases again, since a burned copy leaves every showcase. A failure is toasted.
 */
export function useCopyActions() {
  const refreshCards = useCardsRefresh();
  const refreshShowcases = useShowcaseRefresh();
  const burned = () => {
    refreshCards();
    refreshShowcases();
  };
  const onError = (error: { message: string }) => vaultNotify.error(error.message);

  return {
    list: api.cardMarket.createListing.useMutation({
      onSuccess: () => {
        vaultNotify.success("Your copy is on the market.", "Listed");
        refreshCards();
      },
      onError,
    }),
    listMany: api.cardMarket.createListings.useMutation({ onSuccess: refreshCards, onError }),
    breakDown: api.crafting.breakDown.useMutation({
      onSuccess: (result) => {
        const dust = result.dust.reduce((sum, d) => sum + d.amount, 0);
        vaultNotify.success(`You got ${dust} dust.`, "Broken down");
        burned();
      },
      onError,
    }),
    fuse: api.crafting.fuse.useMutation({
      onSuccess: (result) => {
        vaultNotify.success(
          `Copy #${result.serialNumber} is now ${FINISH_LABEL[result.finish]}.`,
          "Fused"
        );
        burned();
      },
      onError,
    }),
    sign: api.cards.inscribe.useMutation({
      onSuccess: () => {
        vaultNotify.success("Your inscription travels with this copy.", "Signed");
        refreshCards();
      },
      onError,
    }),
  };
}
