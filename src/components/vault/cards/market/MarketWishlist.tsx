import { Heart } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";

/** The Wishlist tab's place; wishlists come with the economy update. */
export function MarketWishlist({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      icon={<Heart />}
      title="Wishlists are not open yet"
      message="For now, browse the listings for the cards you want."
      action={
        <Button variant="secondary" onClick={onBrowse}>
          Browse listings
        </Button>
      }
    />
  );
}
