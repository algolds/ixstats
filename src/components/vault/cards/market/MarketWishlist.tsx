"use client";

import { Heart } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { CardFace } from "~/components/cards/face/CardFace";
import {
  useListingActions,
  useWishlist,
  type WishlistEntryView,
} from "~/hooks/cards/useMarketTabs";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/** What is on sale for a wished card, and how many copies of it the player holds. */
function availability(entry: WishlistEntryView): string {
  const parts: string[] = [];
  if (entry.listings > 0) {
    parts.push(
      `${plural(entry.listings, "listing")} from ${(entry.lowestPrice ?? 0).toLocaleString()} IxC`
    );
  }
  if (entry.auctions > 0) parts.push(plural(entry.auctions, "auction"));
  if (parts.length === 0) parts.push("Not on sale right now");
  if (entry.owned > 0) parts.push(`You own ${entry.owned.toLocaleString()}`);
  return parts.join(" · ");
}

interface MarketWishlistProps {
  onBrowse: () => void;
  onOpenCard: (cardId: string) => void;
}

/** The wishlist, or why there is none: loading, failed or empty. */
function WishlistBody({
  query,
  onBrowse,
  onOpenCard,
}: MarketWishlistProps & { query: ReturnType<typeof useWishlist> }) {
  const { removeWish } = useListingActions();
  if (query.isLoading) return <Skeleton className="rounded-card h-40" />;
  if (query.isError && !query.data) {
    return (
      <EmptyState
        role="alert"
        title="Your wishlist did not load"
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  const entries = query.data ?? [];
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Heart />}
        title="No cards on your wishlist yet"
        message="Open a card and add it to your wishlist. Players building a trade with you will see it."
        action={
          <Button variant="secondary" onClick={onBrowse}>
            Browse listings
          </Button>
        }
      />
    );
  }
  return (
    <Card content="data">
      <ul aria-label="Your wishlist" className="divide-separator divide-y">
        {entries.map((entry) => (
          <li key={entry.face.cardId} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <CardFace
              face={entry.face}
              size="S"
              className="w-20"
              onOpen={() => onOpenCard(entry.face.cardId)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-callout truncate">{entry.face.title}</p>
              <p className="text-footnote text-label-secondary tabular-nums">
                {availability(entry)}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove ${entry.face.title} from your wishlist`}
              disabled={removeWish.isPending}
              onClick={() => removeWish.mutate({ cardId: entry.face.cardId })}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Wishlist: the cards the player wants and what is on sale for each. Trade partners see it too. */
export function MarketWishlist(props: MarketWishlistProps) {
  const query = useWishlist();
  return (
    <div aria-busy={query.isFetching}>
      <WishlistBody {...props} query={query} />
    </div>
  );
}
