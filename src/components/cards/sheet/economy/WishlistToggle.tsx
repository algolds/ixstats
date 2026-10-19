"use client";

import { Heart, HeartSolid } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useSheetEconomy } from "~/hooks/cards/useSheetEconomy";
import { useMarketActions } from "~/hooks/cards/useMarketActions";

/** Add the card to the wishlist, or take it off. A bound card never trades, so it can't be wished for. */
export function WishlistToggle({ cardId }: { cardId: string }) {
  const { data } = useSheetEconomy(cardId);
  const { wish, unwish } = useMarketActions(cardId);
  if (!data || data.isBound) return null;
  const busy = wish.isPending || unwish.isPending;
  return data.wishlisted ? (
    <Button size="sm" variant="ghost" disabled={busy} onClick={() => unwish.mutate({ cardId })}>
      <HeartSolid aria-hidden />
      On your wishlist
    </Button>
  ) : (
    <Button size="sm" variant="ghost" disabled={busy} onClick={() => wish.mutate({ cardId })}>
      <Heart aria-hidden />
      Add to wishlist
    </Button>
  );
}
