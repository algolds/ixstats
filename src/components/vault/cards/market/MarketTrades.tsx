"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { TradeBuilderHost, type TradeAddress } from "~/components/cards/trade/TradeBuilderHost";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import { tradeBuilderHref } from "~/lib/cards/hub-routes";
import { MarketHistory } from "./MarketHistory";

type TradesView = "incoming" | "sent" | "history";

const VIEW_LABEL: Record<TradesView, string> = {
  incoming: "Incoming",
  sent: "Sent",
  history: "History",
};

/** A segment's offer count: shown as a badge, read as "2 offers". */
const offerCount = (count: number) =>
  count > 0 ? { badge: count, badgeLabel: count === 1 ? "1 offer" : `${count} offers` } : {};

interface TradeRowParty {
  clerkUserId?: string | null;
  handle?: string | null;
  displayName?: string | null;
}

interface TradeRowData {
  id: string;
  myTurn?: boolean;
  initiatorId?: string;
  proposerId?: string;
  initiator?: TradeRowParty | null;
  recipient?: TradeRowParty | null;
}

/** The viewer's turn when they are the party the current table was sent to (counter-offers swap the roles). */
function waitsOnViewer(trade: TradeRowData, viewerClerkId: string | null | undefined): boolean {
  if (trade.myTurn !== undefined) return trade.myTurn;
  const viewerIsInitiator = trade.initiator?.clerkUserId === viewerClerkId;
  return viewerIsInitiator !== (trade.proposerId === trade.initiatorId);
}

interface MarketTradesProps {
  onOpenCard: (cardId: string, from?: SheetFrom | null) => void;
  trade?: TradeAddress | null;
  onCloseTrade?: () => void;
}

/** Trades: offers waiting on you, offers waiting on them, and the history (auctions included). */
export function MarketTrades({ onOpenCard, trade, onCloseTrade }: MarketTradesProps) {
  const { userId } = useAuth();
  const [view, setView] = useState<TradesView>("incoming");
  const panelPrefix = useId();
  const panelId = (tab: string) => `${panelPrefix}-trades-${tab}`;

  const active = api.trading.getActiveTrades.useQuery();
  const trades = (active.data ?? []) as TradeRowData[];
  const incoming = trades.filter((t) => waitsOnViewer(t, userId));
  const sent = trades.filter((t) => !waitsOnViewer(t, userId));
  const list = view === "incoming" ? incoming : sent;

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
            {
              value: "incoming",
              label: "Incoming",
              ...offerCount(incoming.length),
            },
            {
              value: "sent",
              label: "Sent",
              ...offerCount(sent.length),
            },
            { value: "history", label: "History" },
          ]}
        />
        <Button size="sm" asChild>
          <Link href={tradeBuilderHref({})}>
            <Plus aria-hidden />
            New trade
          </Link>
        </Button>
      </div>

      {view === "history" ? (
        <MarketHistory onOpenCard={onOpenCard} />
      ) : list.length === 0 ? (
        <EmptyState
          compact
          title={view === "incoming" ? "No offers waiting for you" : "You have no offers out"}
          message="Start one with New trade."
        />
      ) : (
        <div role="tabpanel" id={panelId(view)} aria-label={VIEW_LABEL[view]}>
          <ul className="divide-separator divide-y">
            {list.map((item) => {
              const partner =
                item.initiator?.clerkUserId === userId ? item.recipient : item.initiator;
              const partnerName =
                partner?.displayName ?? (partner?.handle ? `@${partner.handle}` : "a player");
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="text-callout block truncate">Trade with {partnerName}</span>
                    <span className="text-footnote text-label-secondary block">
                      {view === "incoming" ? "Your turn" : "Waiting on them"}
                    </span>
                  </span>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={tradeBuilderHref({ tradeId: item.id })}>Open</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <TradeBuilderHost address={trade} onClose={onCloseTrade} />
    </div>
  );
}
