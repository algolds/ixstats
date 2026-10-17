"use client";

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@clerk/nextjs";
import { Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { TradeNegotiation } from "~/components/cards/trading/TradeNegotiation";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import { MarketHistory } from "./MarketHistory";

const TradeOfferModal = dynamic(
  () => import("~/components/cards/trading/TradeOfferModal").then((m) => m.TradeOfferModal),
  { ssr: false }
);

type TradesView = "incoming" | "sent" | "history";
type OpenCard = (cardId: string, from?: SheetFrom | null) => void;

const VIEW_LABEL: Record<TradesView, string> = {
  incoming: "Incoming",
  sent: "Sent",
  history: "History",
};

/** A segment's offer count: shown as a badge, read as "2 offers". */
const offerCount = (count: number) =>
  count > 0 ? { badge: count, badgeLabel: count === 1 ? "1 offer" : `${count} offers` } : {};

interface OfferListProps {
  tradeIds: readonly string[];
  /** Offers made to the player, rather than ones they sent. */
  incoming: boolean;
  onRefresh: () => void;
  onOpenCard: OpenCard;
}

function OfferList({ tradeIds, incoming, onRefresh, onOpenCard }: OfferListProps) {
  if (tradeIds.length === 0) {
    return (
      <EmptyState
        compact
        title={incoming ? "No offers waiting for you" : "You have no offers out"}
        message="Start one with New trade."
      />
    );
  }
  return (
    <div className="space-y-4">
      {tradeIds.map((id) => (
        <TradeNegotiation
          key={id}
          tradeId={id}
          isRecipient={incoming}
          onRefresh={onRefresh}
          onOpenCard={onOpenCard}
        />
      ))}
    </div>
  );
}

/** Trades: offers to the player, offers they sent, and the history (auctions included). */
export function MarketTrades({ onOpenCard }: { onOpenCard: OpenCard }) {
  const { userId } = useAuth();
  const [view, setView] = useState<TradesView>("incoming");
  const [creating, setCreating] = useState(false);
  const active = api.trading.getActiveTrades.useQuery();
  const trades = active.data ?? [];
  const incoming = trades.filter((t) => t.recipient.clerkUserId === userId).map((t) => t.id);
  const sent = trades.filter((t) => t.initiator.clerkUserId === userId).map((t) => t.id);
  const refresh = () => void active.refetch();
  const panelPrefix = useId();
  const panelId = (tab: TradesView) => `${panelPrefix}-trades-${tab}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          asTabs
          aria-label="Trades"
          value={view}
          onValueChange={setView}
          getTabPanelId={panelId}
          options={[
            { value: "incoming", label: VIEW_LABEL.incoming, ...offerCount(incoming.length) },
            { value: "sent", label: VIEW_LABEL.sent, ...offerCount(sent.length) },
            { value: "history", label: VIEW_LABEL.history },
          ]}
        />
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          New trade
        </Button>
      </div>
      <div role="tabpanel" id={panelId(view)} aria-label={VIEW_LABEL[view]}>
        {view === "history" ? (
          <MarketHistory onOpenCard={onOpenCard} />
        ) : (
          <OfferList
            tradeIds={view === "incoming" ? incoming : sent}
            incoming={view === "incoming"}
            onRefresh={refresh}
            onOpenCard={onOpenCard}
          />
        )}
      </div>
      <TradeOfferModal
        open={creating}
        onClose={() => {
          setCreating(false);
          refresh();
        }}
      />
    </div>
  );
}
