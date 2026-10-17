"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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

/** The cards hub's Market: Browse, Trades, Wishlist and Selling, each a `?tab=`. */
export function MarketPane(props: MarketPaneProps) {
  return (
    <Tabs
      value={props.tab}
      onValueChange={(value) => props.onTabChange(marketTabOf(value))}
      className="space-y-4"
    >
      <TabsList aria-label="Market">
        <TabsTrigger value="browse">Browse</TabsTrigger>
        <TabsTrigger value="trades">Trades</TabsTrigger>
        <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
        <TabsTrigger value="selling">Selling</TabsTrigger>
      </TabsList>
      <TabsContent value="browse">
        <MarketBrowse
          forCardId={props.forCardId}
          onClearFor={props.onClearFor}
          onOpenCard={props.onOpenCard}
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
