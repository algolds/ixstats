"use client";

import { Heart, HeartSolid } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Tooltip } from "~/components/ui/tooltip";
import { useSheetEconomy } from "~/hooks/cards/useSheetEconomy";
import { useMarketActions } from "~/hooks/cards/useMarketActions";

/** Add the card to the wishlist, or take it off. A bound card never trades, so it can't be wished for. */
export function WishlistToggle({ cardId }: { cardId: string }) {
  const { data } = useSheetEconomy(cardId);
  const { wish, unwish } = useMarketActions(cardId);
  if (!data || data.isBound) return null;
  const wished = data.wishlisted;
  return (
    <Tooltip content={wished ? "On your wishlist" : "Add to wishlist"}>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Wishlist"
        aria-pressed={wished}
        disabled={wish.isPending || unwish.isPending}
        onClick={() => (wished ? unwish.mutate({ cardId }) : wish.mutate({ cardId }))}
      >
        {wished ? <HeartSolid aria-hidden /> : <Heart aria-hidden />}
      </Button>
    </Tooltip>
  );
}
