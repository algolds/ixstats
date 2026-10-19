"use client";

import { api } from "~/trpc/react";

/** The signed-in player's dust, per realm (a break-down reads it again through `useCardsRefresh`). */
export function useDust() {
  return api.crafting.getDust.useQuery(undefined, { staleTime: 30_000 });
}
