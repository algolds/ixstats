"use client";
/** A player's live auctions and pending trades: cancel an auction (its held bid is refunded) or void a trade. */
import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { ReasonDialog } from "~/app/admin/cards/shared/ReasonDialog";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";

type Inventory = RouterOutputs["cards"]["admin"]["tools"]["playerCards"];
type Pending = { kind: "auction"; id: string; title: string } | { kind: "trade"; id: string };

const DIALOG = {
  auction: {
    description:
      "The card goes back to the seller and the highest bid is refunded. Both players are told why.",
    confirm: "Cancel auction",
  },
  trade: {
    description: "The offered cards are released and no credits move. Both players are told why.",
    confirm: "Void trade",
  },
} as const;

const date = (value: Date | string) => new Date(value).toLocaleDateString();
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const ixc = (amount: number) => `${amount.toLocaleString()} IxC`;

function auctionLine(auction: Inventory["auctions"][number]): string {
  const role = auction.selling ? "Selling" : "Highest bidder";
  return `${role} · ${plural(auction.bidCount, "bid", "bids")} · ${ixc(auction.currentBid)} · ends ${date(auction.endTime)}`;
}

function tradeLine(trade: Inventory["trades"][number]): string {
  const offered = `${plural(trade.copiesOffered, "card", "cards")} and ${ixc(trade.creditsOffered)}`;
  const asked = `${plural(trade.copiesAsked, "card", "cards")} and ${ixc(trade.creditsAsked)}`;
  return `${offered} for ${asked} · expires ${date(trade.expiresAt)}`;
}

export function MarketSection({
  userId,
  auctions,
  trades,
}: {
  userId: string;
  auctions: Inventory["auctions"];
  trades: Inventory["trades"];
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [pending, setPending] = useState<Pending | null>(null);
  const done = (title: string) => {
    notify.success(title);
    setPending(null);
    void utils.cards.admin.tools.playerCards.invalidate({ userId });
  };
  const onError = (error: { message: string }) => notify.error("Nothing changed", error.message);
  const cancel = api.cards.admin.tools.cancelAuction.useMutation({
    onSuccess: () => done("Auction cancelled"),
    onError,
  });
  const voidTrade = api.cards.admin.tools.voidTrade.useMutation({
    onSuccess: () => done("Trade voided"),
    onError,
  });
  const confirm = (reason: string) => {
    if (pending?.kind === "auction") cancel.mutate({ auctionId: pending.id, reason });
    if (pending?.kind === "trade") voidTrade.mutate({ tradeId: pending.id, reason });
  };
  const dialog = DIALOG[pending?.kind ?? "auction"];

  if (auctions.length === 0 && trades.length === 0) {
    return <EmptyState compact title="No live auctions or pending trades" />;
  }
  return (
    <div className="space-y-4">
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
                    onClick={() =>
                      setPending({ kind: "auction", id: auction.id, title: auction.title })
                    }
                  >
                    Cancel auction
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
                    onClick={() => setPending({ kind: "trade", id: trade.id })}
                  >
                    Void trade
                  </Button>
                }
              />
            ))}
          </FacetListSection>
        )}
      </FacetList>
      <ReasonDialog
        // A new target is a new dialog, so a reason typed for one auction or trade never carries to another
        key={pending ? `${pending.kind}-${pending.id}` : "closed"}
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.kind === "auction" ? `Cancel the auction of ${pending.title}` : "Void this trade"
        }
        description={dialog.description}
        confirmLabel={dialog.confirm}
        destructive
        pending={cancel.isPending || voidTrade.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
