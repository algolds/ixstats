"use client";
/**
 * A player's live auctions, fixed-price listings and pending trades: cancel an auction (its held bid is refunded) or a
 * listing, or void a trade, each with a reason.
 */
import { useRef } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { ReasonDialog } from "~/app/admin/cards/shared/ReasonDialog";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { useDialogTarget } from "~/hooks/admin/useDialogTarget";
import { useRowFocusRescue } from "~/hooks/admin/useRowFocusRescue";

type Inventory = RouterOutputs["cards"]["admin"]["tools"]["playerCards"];
type Pending =
  | { kind: "auction"; id: string; title: string; hasBid: boolean }
  | { kind: "listing"; id: string; title: string }
  | { kind: "trade"; id: string };

// The refund is the share of the listing fee the Economy tab sets for a cancel
const SELLER_REFUND =
  "The card goes back to the seller with their listing fee refund. The seller is told why.";

/** What the confirmation says happens; only an auction with a bid has a second player to tell. */
function dialogCopy(pending: Pending | null) {
  if (pending?.kind === "trade") {
    return {
      title: "Void this trade",
      description: "The offered cards are released and no credits move. Both players are told why.",
      confirm: "Void trade",
    };
  }
  if (pending?.kind === "listing") {
    return {
      title: `Cancel the listing of ${pending.title}`,
      description: SELLER_REFUND,
      confirm: "Cancel listing",
    };
  }
  const refund = pending?.hasBid
    ? "The card goes back to the seller, the highest bid is refunded and the seller gets their listing fee refund. Both players are told why."
    : SELLER_REFUND;
  return {
    title: `Cancel the auction of ${pending?.title ?? ""}`,
    description: refund,
    confirm: "Cancel auction",
  };
}

const date = (value: Date | string) => new Date(value).toLocaleDateString();
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const ixc = (amount: number) => `${amount.toLocaleString()} IxC`;

function auctionLine(auction: Inventory["auctions"][number]): string {
  const role = auction.selling ? "Selling" : "Highest bidder";
  return `${role} · ${plural(auction.bidCount, "bid", "bids")} · ${ixc(auction.currentBid)} · ends ${date(auction.endTime)}`;
}

function listingLine(listing: Inventory["listings"][number]): string {
  const line = `${ixc(listing.price)} · expires ${date(listing.expiresAt)}`;
  return listing.isFeatured ? `Featured · ${line}` : line;
}

function tradeLine(trade: Inventory["trades"][number]): string {
  const offered = `${plural(trade.copiesOffered, "card", "cards")} and ${ixc(trade.creditsOffered)}`;
  const asked = `${plural(trade.copiesAsked, "card", "cards")} and ${ixc(trade.creditsAsked)}`;
  return `${offered} for ${asked} · expires ${date(trade.expiresAt)}`;
}

export function MarketSection({
  userId,
  auctions,
  listings,
  trades,
}: {
  userId: string;
  auctions: Inventory["auctions"];
  listings: Inventory["listings"];
  trades: Inventory["trades"];
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const dialogTarget = useDialogTarget<Pending>();
  const pending = dialogTarget.target;
  // The rows in the order they show; focus falls back to the list itself once the last one goes
  const region = useRef<HTMLDivElement>(null);
  const acted = useRowFocusRescue(
    [...auctions, ...listings, ...trades].map((row) => row.id),
    region,
    region
  );
  const done = (title: string) => {
    notify.success(title);
    dialogTarget.close();
    void utils.cards.admin.tools.playerCards.invalidate({ userId });
  };
  const onError = (error: { message: string }) => notify.error("Nothing changed", error.message);
  const cancel = api.cards.admin.tools.cancelAuction.useMutation({
    onSuccess: () => done("Auction cancelled"),
    onError,
  });
  const cancelListing = api.cards.admin.tools.cancelListing.useMutation({
    onSuccess: () => done("Listing cancelled"),
    onError,
  });
  const voidTrade = api.cards.admin.tools.voidTrade.useMutation({
    onSuccess: () => done("Trade voided"),
    onError,
  });
  const confirm = (reason: string) => {
    if (pending) acted(pending.id);
    if (pending?.kind === "auction") cancel.mutate({ auctionId: pending.id, reason });
    if (pending?.kind === "listing") cancelListing.mutate({ listingId: pending.id, reason });
    if (pending?.kind === "trade") voidTrade.mutate({ tradeId: pending.id, reason });
  };
  // The copy follows the target last opened, which stays put while the dialog closes
  const dialog = dialogCopy(dialogTarget.shown);

  const empty = auctions.length === 0 && listings.length === 0 && trades.length === 0;
  return (
    <div ref={region} tabIndex={-1} className="space-y-4 outline-none">
      {empty && <EmptyState compact title="No live auctions, listings or pending trades" />}
      {!empty && (
        <FacetList>
          {auctions.length > 0 && (
            <FacetListSection header="Live auctions">
              {auctions.map((auction) => (
                <FacetRow
                  key={auction.id}
                  title={auction.title}
                  subtitle={auctionLine(auction)}
                  trailing={
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-label={`Cancel auction of ${auction.title}`}
                      data-row-action=""
                      onClick={() =>
                        dialogTarget.open({
                          kind: "auction",
                          id: auction.id,
                          title: auction.title,
                          hasBid: auction.hasBid,
                        })
                      }
                    >
                      Cancel auction
                    </Button>
                  }
                />
              ))}
            </FacetListSection>
          )}
          {listings.length > 0 && (
            <FacetListSection header="Live listings">
              {listings.map((listing) => (
                <FacetRow
                  key={listing.id}
                  title={listing.title}
                  subtitle={listingLine(listing)}
                  trailing={
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-label={`Cancel listing of ${listing.title}`}
                      data-row-action=""
                      onClick={() =>
                        dialogTarget.open({ kind: "listing", id: listing.id, title: listing.title })
                      }
                    >
                      Cancel listing
                    </Button>
                  }
                />
              ))}
            </FacetListSection>
          )}
          {trades.length > 0 && (
            <FacetListSection header="Pending trades">
              {trades.map((trade) => (
                <FacetRow
                  key={trade.id}
                  title={trade.initiating ? "Offered by this player" : "Offered to this player"}
                  subtitle={tradeLine(trade)}
                  trailing={
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-label={`Void trade ${trade.initiating ? "offered by" : "offered to"} this player`}
                      data-row-action=""
                      onClick={() => dialogTarget.open({ kind: "trade", id: trade.id })}
                    >
                      Void trade
                    </Button>
                  }
                />
              ))}
            </FacetListSection>
          )}
        </FacetList>
      )}
      <ReasonDialog
        open={pending !== null}
        onOpenChange={(open) => !open && dialogTarget.close()}
        title={dialog.title}
        description={dialog.description}
        confirmLabel={dialog.confirm}
        destructive
        pending={cancel.isPending || cancelListing.isPending || voidTrade.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
