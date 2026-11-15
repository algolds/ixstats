"use client";

import type { ReactNode } from "react";
import { Cart, DataTransferBoth, Heart, Plus, Shop } from "iconoir-react";
import { api } from "~/trpc/react";
import { ActionPill } from "~/components/ui/action-pill";
import { Button } from "~/components/ui/button";
import { useAuctionWebSocket } from "~/hooks/marketplace/useAuctionWebSocket";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import type { MarketTab } from "~/lib/cards/hub-routes";
import type { TradeAddress } from "~/components/cards/trade/TradeBuilderHost";
import { MarketBrowse } from "./MarketBrowse";
import { MarketSelling } from "./MarketSelling";
import { MarketTrades } from "./MarketTrades";
import { MarketWishlist } from "./MarketWishlist";

interface MarketPaneProps {
  tab: MarketTab;
  onTabChange: (tab: MarketTab) => void;
  /** `?for=<cardId>`: Auctions shows only that card's listings. */
  forCardId: string | null;
  onClearFor: () => void;
  /** Switches to Auctions filtered to one card (`?for=<cardId>`). */
  onBrowseForCard?: (cardId: string) => void;
  onSellOpen: () => void;
  onOpenCard: (cardId: string, from?: SheetFrom | null) => void;
  trade?: TradeAddress | null;
  onCloseTrade?: () => void;
}

const MARKET_MODES: ReadonlyArray<{ value: MarketTab; label: string; icon: ReactNode }> = [
  { value: "browse", label: "Auctions", icon: <Shop /> },
  { value: "trades", label: "Trades", icon: <DataTransferBoth /> },
  { value: "wishlist", label: "Wishlist", icon: <Heart /> },
  { value: "selling", label: "My listings", icon: <Cart /> },
];

/** Live auction floor and trade desk: Auctions, Trades, Wishlist, and My listings synced to `?tab=`. */
export function MarketPane(props: MarketPaneProps) {
  // One set of live subscriptions for every mode: Auctions and My listings both show running auctions.
  useAuctionWebSocket();
  const activeTrades = api.trading.getActiveTrades.useQuery();
  const incomingCount = (activeTrades.data ?? []).filter((trade) => trade.myTurn).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Market mode" className="flex flex-wrap items-center gap-1.5">
          {MARKET_MODES.map((mode) => (
            <ActionPill
              key={mode.value}
              size="md"
              tone="secondary"
              icon={mode.icon}
              pressed={props.tab === mode.value}
              count={mode.value === "trades" && incomingCount > 0 ? incomingCount : undefined}
              onClick={() => props.onTabChange(mode.value)}
            >
              {mode.label}
            </ActionPill>
          ))}
        </div>
        {props.tab !== "trades" && (
          <Button size="sm" onClick={props.onSellOpen}>
            <Plus aria-hidden />
            List a card
          </Button>
        )}
      </div>
      <div>
        {props.tab === "browse" && (
          <MarketBrowse
            forCardId={props.forCardId}
            onClearFor={props.onClearFor}
            onSell={props.onSellOpen}
            onOpenCard={props.onOpenCard}
            onShowSelling={() => props.onTabChange("selling")}
          />
        )}
        {props.tab === "trades" && (
          <MarketTrades
            onOpenCard={props.onOpenCard}
            trade={props.trade}
            onCloseTrade={props.onCloseTrade}
          />
        )}
        {props.tab === "wishlist" && (
          <MarketWishlist
            onBrowse={() => props.onTabChange("browse")}
            onBrowseCard={props.onBrowseForCard}
            onOpenCard={props.onOpenCard}
          />
        )}
        {props.tab === "selling" && (
          <MarketSelling onSell={props.onSellOpen} onOpenCard={props.onOpenCard} />
        )}
      </div>
    </div>
  );
}
