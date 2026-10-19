"use client";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { useListingActions, useMyListings, type MyListingView } from "~/hooks/cards/useMarketTabs";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import { timeLeftPhrase } from "~/lib/cards/face/time-left";

const ENDED_LABEL = { SOLD: "Sold", CANCELLED: "Cancelled", EXPIRED: "Expired" } as const;

/** One listing: what is listed for how much, then Cancel while it runs, or how it ended. */
function ListingLine({
  listing,
  onCancel,
  cancelling,
}: {
  listing: MyListingView;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const titleId = `listing-${listing.id}`;
  const copy = `${FINISH_LABEL[listing.finish]} #${listing.serialNumber}`;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p id={titleId} className="text-callout truncate">
          {listing.cardTitle} · {listing.price.toLocaleString()} IxC
        </p>
        <p className="text-footnote text-label-secondary tabular-nums">
          {listing.status === "ACTIVE" ? `${copy} · ${timeLeftPhrase(listing.expiresAt)}` : copy}
        </p>
      </div>
      {listing.status === "ACTIVE" ? (
        <Button
          size="sm"
          variant="ghost"
          aria-describedby={titleId}
          disabled={cancelling}
          onClick={onCancel}
        >
          Cancel listing
        </Button>
      ) : (
        <Badge variant={listing.status === "SOLD" ? "success" : "default"}>
          {ENDED_LABEL[listing.status]}
        </Badge>
      )}
    </li>
  );
}

/** The listings, or why there are none: loading, failed or nothing listed. */
function ListingsBody({
  query,
  cancel,
}: {
  query: ReturnType<typeof useMyListings>;
  cancel: ReturnType<typeof useListingActions>["cancel"];
}) {
  if (query.isLoading) return <Skeleton className="rounded-card h-24" />;
  if (query.isError && !query.data) {
    return (
      <EmptyState
        compact
        role="alert"
        title="Your listings did not load"
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  const listings = query.data ?? [];
  if (listings.length === 0) {
    return (
      <EmptyState
        compact
        title="You have nothing listed"
        message="List a copy at a fixed price from Mine or from its card's sheet."
      />
    );
  }
  return (
    <Card content="data">
      <ul className="divide-separator divide-y">
        {listings.map((listing) => (
          <ListingLine
            key={listing.id}
            listing={listing}
            onCancel={() => cancel.mutate({ listingId: listing.id })}
            cancelling={cancel.isPending}
          />
        ))}
      </ul>
    </Card>
  );
}

/** Selling: the player's fixed-price listings, running first, then the last 30 days' sold, cancelled and expired. */
export function MyListings() {
  const query = useMyListings();
  const { cancel } = useListingActions();
  return (
    <section aria-labelledby="selling-fixed" aria-busy={query.isFetching} className="space-y-3">
      <h3 id="selling-fixed" className="text-headline">
        Your listings
      </h3>
      <ListingsBody query={query} cancel={cancel} />
    </section>
  );
}
