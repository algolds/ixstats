"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { DataTransferBoth, Plus, WarningCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button, focusRing, hitSlop } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { TradeBuilderHost, type TradeAddress } from "~/components/cards/trade/TradeBuilderHost";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import { tradeBuilderHref } from "~/lib/cards/hub-routes";
import { cn } from "~/lib/utils/cn";
import { MarketHistory } from "./MarketHistory";

type TradesView = "incoming" | "sent" | "history";

const VIEWS: ReadonlyArray<{ value: TradesView; label: string }> = [
  { value: "incoming", label: "Incoming" },
  { value: "sent", label: "Sent" },
  { value: "history", label: "History" },
];

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

  const active = api.trading.getActiveTrades.useQuery();
  const trades = (active.data ?? []) as TradeRowData[];
  const incoming = trades.filter((t) => waitsOnViewer(t, userId));
  const sent = trades.filter((t) => !waitsOnViewer(t, userId));
  const list = view === "incoming" ? incoming : sent;
  const countFor = (option: TradesView) =>
    option === "incoming" ? incoming.length : option === "sent" ? sent.length : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Filter trades"
          className="flex flex-wrap items-center gap-1.5"
        >
          {VIEWS.map((option) => {
            const selected = view === option.value;
            const count = countFor(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setView(option.value)}
                className={cn(
                  "rounded-pill text-subhead facet-press relative inline-flex min-h-8 cursor-pointer items-center gap-1.5 px-3 py-1 font-medium transition-colors",
                  hitSlop,
                  focusRing,
                  selected
                    ? "bg-fill-3 text-label"
                    : "text-label-secondary hover:bg-fill-4 hover:text-label"
                )}
              >
                <span>{option.label}</span>
                {count > 0 && (
                  <span
                    aria-label={count === 1 ? "1 offer" : `${count} offers`}
                    className="bg-tint-fill text-tint text-caption min-w-5 rounded-full px-1.5 text-center tabular-nums"
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Button size="sm" asChild>
          <Link href={tradeBuilderHref({})}>
            <Plus aria-hidden />
            New trade
          </Link>
        </Button>
      </div>

      {view === "history" ? (
        <MarketHistory onOpenCard={onOpenCard} />
      ) : active.isLoading ? (
        <Skeleton className="rounded-card h-32" />
      ) : active.isError && !active.data ? (
        <Card>
          <EmptyState
            compact
            role="alert"
            icon={<WarningCircle />}
            title="Your trades did not load"
            message="Try loading your trade offers again."
            action={
              <Button variant="secondary" onClick={() => void active.refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={<DataTransferBoth />}
            title={view === "incoming" ? "No offers waiting for you" : "You have no offers out"}
            message="Start one with New trade."
          />
        </Card>
      ) : (
        <Card content="data" padding="none">
          <ul className="divide-separator divide-y">
            {list.map((item) => {
              const partner =
                item.initiator?.clerkUserId === userId ? item.recipient : item.initiator;
              const partnerName =
                partner?.displayName ?? (partner?.handle ? `@${partner.handle}` : "a player");
              return (
                <li
                  key={item.id}
                  data-row
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
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
        </Card>
      )}
      <TradeBuilderHost address={trade} onClose={onCloseTrade} />
    </div>
  );
}
