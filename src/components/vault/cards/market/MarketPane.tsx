"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useAuctionWebSocket } from "~/hooks/marketplace/useAuctionWebSocket";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import { marketTabOf, type MarketTab } from "~/lib/cards/hub-routes";
import { MarketBrowse } from "./MarketBrowse";
import { MarketSelling } from "./MarketSelling";
import { MarketTrades } from "./MarketTrades";
import { MarketWishlist } from "./MarketWishlist";

interface MarketPaneProps {
  tab: MarketTab;
  onTabChange: (tab: MarketTab) => void;
  /** `?for=<cardId>`: Browse shows only that card's listings. */
  forCardId: string | null;
  onClearFor: () => void;
  /** `?sell=<ownershipId>`: Selling opens the auction form with that copy. */
  sellOwnershipId: string | null;
  onSellHandled: () => void;
  onOpenCard: (cardId: string, from?: SheetFrom | null) => void;
}

/** The tab row's track clips its overflow, so each tab draws its focus ring inside itself. */
const TAB_IN_SCROLLER = "focus-visible:-outline-offset-2";

/** The cards hub's Market: Browse, Trades, Wishlist and Selling, each a `?tab=`. */
export function MarketPane(props: MarketPaneProps) {
  // One set of live subscriptions for every tab: Browse and Selling both show running auctions.
  useAuctionWebSocket();
  return (
    <Tabs
      value={props.tab}
      onValueChange={(value) => props.onTabChange(marketTabOf(value))}
      className="space-y-4"
    >
      {/* The four tabs are wider than a 320px phone: the row scrolls in its own track, not the page. */}
      <TabsList aria-label="Market" className="hide-scrollbar overflow-x-auto overscroll-x-contain">
        <TabsTrigger value="browse" className={TAB_IN_SCROLLER}>
          Browse
        </TabsTrigger>
        <TabsTrigger value="trades" className={TAB_IN_SCROLLER}>
          Trades
        </TabsTrigger>
        <TabsTrigger value="wishlist" className={TAB_IN_SCROLLER}>
          Wishlist
        </TabsTrigger>
        <TabsTrigger value="selling" className={TAB_IN_SCROLLER}>
          Selling
        </TabsTrigger>
      </TabsList>
      <TabsContent value="browse">
        <MarketBrowse
          forCardId={props.forCardId}
          onClearFor={props.onClearFor}
          onOpenCard={props.onOpenCard}
          onShowSelling={() => props.onTabChange("selling")}
        />
      </TabsContent>
      <TabsContent value="trades">
        <MarketTrades onOpenCard={props.onOpenCard} />
      </TabsContent>
      <TabsContent value="wishlist">
        <MarketWishlist onBrowse={() => props.onTabChange("browse")} />
      </TabsContent>
      <TabsContent value="selling">
        <MarketSelling
          sellOwnershipId={props.sellOwnershipId}
          onSellHandled={props.onSellHandled}
          onOpenCard={props.onOpenCard}
        />
      </TabsContent>
    </Tabs>
  );
}
