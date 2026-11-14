"use client";

import { useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useAuctionWebSocket } from "~/hooks/marketplace/useAuctionWebSocket";
import { useKeepSelectedInView } from "~/hooks/useKeepSelectedInView";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import { marketTabOf, type MarketTab } from "~/lib/cards/hub-routes";
import type { TradeAddress } from "~/components/cards/trade/TradeBuilderHost";
import { CreateAuctionModal } from "./CreateAuctionModal";
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
  /** `?sell=<ownershipId>`: opens the auction form with that copy. */
  sellOwnershipId: string | null;
  onSellHandled: () => void;
  /** Controlled from the hub's PageHeader "Sell a card" action. */
  selling: boolean;
  onSellOpen: () => void;
  onSellClose: () => void;
  onOpenCard: (cardId: string, from?: SheetFrom | null) => void;
  trade?: TradeAddress | null;
  onCloseTrade?: () => void;
}

/** Quieter secondary underline trigger so Market sub-views sit clearly below the hub's top-level tabs. */
const QUIET_SUBTAB =
  "text-subhead min-h-9 pointer-coarse:min-h-11 rounded-none border-b-2 border-transparent px-3 py-1.5 shadow-none hover:bg-transparent focus-visible:-outline-offset-2 data-[state=active]:border-tint data-[state=active]:bg-transparent data-[state=active]:text-label data-[state=active]:shadow-none data-[state=active]:hover:bg-transparent";

/** The cards hub's Market: Browse, Trades, Wishlist and Selling, each a `?tab=`. */
export function MarketPane(props: MarketPaneProps) {
  // One set of live subscriptions for every tab: Browse and Selling both show running auctions.
  useAuctionWebSocket();
  const tabsRef = useRef<HTMLDivElement>(null);
  useKeepSelectedInView(tabsRef, { enabled: true, selected: props.tab });

  return (
    <>
      <Tabs
        value={props.tab}
        onValueChange={(value) => props.onTabChange(marketTabOf(value))}
        className="space-y-4"
      >
        <TabsList
          ref={tabsRef}
          aria-label="Market"
          className="border-separator hide-scrollbar gap-1 overflow-x-auto overscroll-x-contain border-b"
        >
          <TabsTrigger value="browse" className={QUIET_SUBTAB}>
            Browse
          </TabsTrigger>
          <TabsTrigger value="trades" className={QUIET_SUBTAB}>
            Trades
          </TabsTrigger>
          <TabsTrigger value="wishlist" className={QUIET_SUBTAB}>
            Wishlist
          </TabsTrigger>
          <TabsTrigger value="selling" className={QUIET_SUBTAB}>
            Selling
          </TabsTrigger>
        </TabsList>
        <TabsContent value="browse">
          <MarketBrowse
            forCardId={props.forCardId}
            onClearFor={props.onClearFor}
            onSell={props.onSellOpen}
            onOpenCard={props.onOpenCard}
            onShowSelling={() => props.onTabChange("selling")}
          />
        </TabsContent>
        <TabsContent value="trades">
          <MarketTrades
            onOpenCard={props.onOpenCard}
            trade={props.trade}
            onCloseTrade={props.onCloseTrade}
          />
        </TabsContent>
        <TabsContent value="wishlist">
          <MarketWishlist
            onBrowse={() => props.onTabChange("browse")}
            onOpenCard={props.onOpenCard}
          />
        </TabsContent>
        <TabsContent value="selling">
          <MarketSelling onSell={props.onSellOpen} onOpenCard={props.onOpenCard} />
        </TabsContent>
      </Tabs>
      <CreateAuctionModal
        key={props.sellOwnershipId ?? "new"}
        open={props.selling || props.sellOwnershipId !== null}
        initialOwnershipId={props.sellOwnershipId}
        onClose={() => {
          props.onSellClose();
          props.onSellHandled();
        }}
      />
    </>
  );
}
