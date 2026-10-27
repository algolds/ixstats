"use client";

import { api, type RouterOutputs } from "~/trpc/react";

export type SheetEconomyView = RouterOutputs["cards"]["getSheetEconomy"];
export type CopyEconomyView = SheetEconomyView["copies"][number];
export type FusionGroupView = SheetEconomyView["fusionGroups"][number];
export type CraftOfferView = NonNullable<SheetEconomyView["craft"]>;
export type EconomyNumbers = RouterOutputs["crafting"]["getNumbers"];

/**
 * One card's economy for the signed-in player (the sheet's copy actions and its Mint section share it). The sheet is
 * public, so a caller that may be signed out passes `enabled`.
 */
export function useSheetEconomy(cardId: string, enabled = true) {
  return api.cards.getSheetEconomy.useQuery({ cardId }, { enabled, staleTime: 30_000 });
}

/** The public economy numbers the card screens preview with (fees, refunds, dust, listing length). */
export function useEconomyNumbers() {
  return api.crafting.getNumbers.useQuery(undefined, { staleTime: 5 * 60_000 });
}
