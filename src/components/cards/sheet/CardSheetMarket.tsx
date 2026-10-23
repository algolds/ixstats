"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { NavArrowDown } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { Button, focusRing } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Stat } from "~/components/ui/stat";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { CardPriceHistoryChart } from "~/components/cards/display/CardPriceHistoryChart";
import { ReportInscriptionButton } from "~/components/cards/inscription/ReportInscriptionButton";
import { useSheetEconomy } from "~/hooks/cards/useSheetEconomy";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import { timeLeftPhrase } from "~/lib/cards/face/time-left";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import type { CardSheetData, SheetListing } from "~/lib/cards/hub/sheet";
import { BuyListingDialog } from "./economy/BuyListingDialog";
import { CraftButton } from "./economy/CraftButton";
import { useDialogFocus } from "./economy/dialog-focus";

/** The "Market" heading, where focus goes once a purchase takes the listing, and its Buy button, away. */
const MARKET_HEADING_ID = "sheet-market";

interface CardSheetMarketProps {
  cardId: string;
  cardTitle: string;
  value: number;
  market: CardSheetData["market"];
  /** Buying, crafting, reporting and the price history are for players; a signed-out visitor only looks. */
  signedIn: boolean;
}

const credits = (amount: number) => (
  <span className="inline-flex items-center gap-1 tabular-nums">
    <IxCreditsSymbol className="size-[0.8em]" />
    {amount.toLocaleString()}
  </span>
);

const seller = (listing: SheetListing) => {
  if (listing.isMine) return "Your listing";
  // A seller whose passport hides Vault cards, or who has no name to show, is not named.
  return listing.sellerName ?? "A player";
};

/**
 * "Market": what a copy is worth, how many want it, live listings (Buy at a fixed price; auctions are bid on in the
 * market) and the craft offer. What the viewer may do, and every price, comes from the server.
 */
export function CardSheetMarket({
  cardId,
  cardTitle,
  value,
  market,
  signedIn,
}: CardSheetMarketProps) {
  const { data: economy } = useSheetEconomy(cardId, signedIn);
  const [buying, setBuying] = useState<SheetListing | null>(null);
  const { focus, settle } = useDialogFocus();
  const marketHref = `${CARD_HUB_PATHS.market}?for=${encodeURIComponent(cardId)}`;
  const hasAuction = market.listings.some((l) => l.kind === "auction");
  const bought = () => {
    settle(document.getElementById(MARKET_HEADING_ID));
    setBuying(null);
  };

  return (
    <section aria-labelledby={MARKET_HEADING_ID} className="space-y-3">
      <h3 id={MARKET_HEADING_ID} tabIndex={-1} className="text-headline">
        Market
      </h3>
      <Stat
        size="sm"
        label="Value"
        value={credits(value)}
        hint={
          market.wantedBy > 0
            ? `Wanted by ${market.wantedBy.toLocaleString()}`
            : "On no wishlists yet"
        }
      />
      {market.listings.length > 0 && (
        <ul className="divide-separator divide-y" aria-label="Live listings">
          {market.listings.map((listing) => (
            <ListingLine
              key={`${listing.kind}-${listing.id}`}
              listing={listing}
              cardId={cardId}
              signedIn={signedIn}
              onBuy={setBuying}
            />
          ))}
        </ul>
      )}
      <p className="text-callout">
        <Link href={marketHref} className={cn("text-tint underline", focusRing)}>
          {hasAuction ? "Bid in the market" : "Look for it in the market"}
        </Link>
      </p>
      {signedIn && economy?.craft && <CraftButton cardId={cardId} offer={economy.craft} />}
      {buying && (
        <BuyListingDialog
          onOpenChange={(open) => !open && setBuying(null)}
          onDone={bought}
          cardId={cardId}
          cardTitle={cardTitle}
          listing={buying}
          focus={focus}
        />
      )}
    </section>
  );
}

interface ListingLineProps {
  listing: SheetListing;
  cardId: string;
  signedIn: boolean;
  onBuy: (listing: SheetListing) => void;
}

/** One live listing: who sells which copy for how long, its inscription, its price, and Buy where the viewer may. */
function ListingLine({ listing, cardId, signedIn, onBuy }: ListingLineProps) {
  const lineId = useId();
  const left = timeLeftPhrase(listing.endsAt);
  // Only another player's fixed-price listing still running is bought here
  const buyable = signedIn && listing.kind === "listing" && !listing.isMine && left !== "Ended";
  return (
    <li className="text-callout flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
      <span className="min-w-0">
        <span id={lineId} className="block truncate">
          {`${seller(listing)} · ${FINISH_LABEL[listing.finish]} #${listing.serialNumber} · ${left}`}
        </span>
        {listing.inscription && (
          <span className="text-footnote text-label-secondary flex flex-wrap items-center gap-x-2">
            <span>
              {`“${listing.inscription.text}”${listing.inscription.signerName ? ` · ${listing.inscription.signerName}` : ""}`}
            </span>
            {signedIn && !listing.isMine && (
              <ReportInscriptionButton ownershipId={listing.ownershipId} cardId={cardId} />
            )}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {credits(listing.price)}
        {buyable && (
          <Button size="sm" aria-describedby={lineId} onClick={() => onBuy(listing)}>
            Buy
          </Button>
        )}
      </span>
    </li>
  );
}

interface CardSheetPriceHistoryProps {
  cardId: string;
  recentSales: CardSheetData["market"]["recentSales"];
  /** The value chart is for players; a visitor sees the recent sales only. */
  signedIn: boolean;
}

/** The sheet's last section, folded until asked for: the value chart and the recent sales. */
export function CardSheetPriceHistory({
  cardId,
  recentSales,
  signedIn,
}: CardSheetPriceHistoryProps) {
  if (!signedIn && recentSales.length === 0) return null;
  return (
    <Collapsible asChild>
      <section aria-labelledby="sheet-price-history" className="space-y-3">
        <h3 id="sheet-price-history" className="text-headline">
          <CollapsibleTrigger
            className={cn("group flex w-full items-center justify-between rounded-sm", focusRing)}
          >
            Price history
            <NavArrowDown
              aria-hidden
              className="text-label-secondary size-4 transition-transform group-data-[state=open]:rotate-180"
            />
          </CollapsibleTrigger>
        </h3>
        <CollapsibleContent className="space-y-3">
          {signedIn && <CardPriceHistoryChart cardId={cardId} />}
          {recentSales.length > 0 && (
            <ul aria-label="Recent sales" className="text-footnote text-label-secondary space-y-1">
              {recentSales.map((sale, index) => (
                <li key={`${sale.at.getTime()}-${index}`} className="flex justify-between">
                  <span>
                    {sale.at.toLocaleDateString()}
                    {sale.finish ? ` · ${FINISH_LABEL[sale.finish]}` : ""}
                  </span>
                  {credits(sale.price)}
                </li>
              ))}
            </ul>
          )}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
