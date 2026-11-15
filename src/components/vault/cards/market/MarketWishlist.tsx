"use client";

import { Heart, WarningCircle } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { CardFace } from "~/components/cards/face/CardFace";
import { RarityMark } from "~/components/cards/face/RarityMark";
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
  onBrowseCard?: (cardId: string) => void;
  onOpenCard: (cardId: string) => void;
}

/** The wishlist, or why there is none: loading, failed or empty. */
function WishlistBody({
  query,
  onBrowse,
  onBrowseCard,
  onOpenCard,
}: MarketWishlistProps & { query: ReturnType<typeof useWishlist> }) {
  const { removeWish } = useListingActions();
  if (query.isLoading) return <Skeleton className="rounded-card h-40" />;
  if (query.isError && !query.data) {
    return (
      <Card>
        <EmptyState
          role="alert"
          icon={<WarningCircle />}
          title="Your wishlist did not load"
          message="Try loading your wishlist again."
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }
  const entries = query.data ?? [];
  if (entries.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Heart />}
          title="No cards on your wishlist yet"
          message="Open a card and add it to your wishlist. Players building a trade with you will see it."
          action={
            <Button variant="secondary" onClick={onBrowse}>
              Browse auctions
            </Button>
          }
        />
      </Card>
    );
  }
  return (
    <Card content="data" padding="none">
      <div className="border-separator flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="text-subheadline text-label-secondary font-medium">Saved cards</span>
        <span className="text-footnote text-label-secondary tabular-nums">
          {entries.length.toLocaleString()} wanted
        </span>
      </div>
      <ul aria-label="Your wishlist" className="divide-separator divide-y">
        {entries.map((entry) => {
          const onSale = entry.listings + entry.auctions > 0;
          return (
            <li
              key={entry.face.cardId}
              data-row
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <CardFace
                face={entry.face}
                size="S"
                className="w-20"
                onOpen={() => onOpenCard(entry.face.cardId)}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="text-callout truncate">{entry.face.title}</p>
                  {onSale && <Badge variant="success">On sale</Badge>}
                </div>
                <RarityMark rarity={entry.face.rarity} />
                <p className="text-footnote text-label-secondary tabular-nums">
                  {availability(entry)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {onSale && onBrowseCard && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onBrowseCard(entry.face.cardId)}
                  >
                    See offers
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${entry.face.title} from your wishlist`}
                  disabled={removeWish.isPending}
                  onClick={() => removeWish.mutate({ cardId: entry.face.cardId })}
                >
                  Remove
                </Button>
              </div>
            </li>
          );
        })}
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
