"use client";

import Link from "next/link";
import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { Stat } from "~/components/ui/stat";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { CardPriceHistoryChart } from "~/components/cards/display/CardPriceHistoryChart";
import { formatTimeLeft } from "~/lib/cards/face/time-left";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import type { CardSheetData, SheetListing } from "~/lib/cards/hub/sheet";

interface CardSheetMarketProps {
  cardId: string;
  value: number;
  market: CardSheetData["market"];
}

const credits = (amount: number) => (
  <span className="inline-flex items-center gap-1 tabular-nums">
    <IxCreditsSymbol decorative className="size-[0.8em]" />
    {amount.toLocaleString()}
  </span>
);

const seller = (listing: SheetListing) => {
  if (listing.isMine) return "Your listing";
  return listing.sellerHandle ? `@${listing.sellerHandle}` : "A collector";
};

/** "Market": what a copy is worth, how many want it, live listings, price history and recent sales. */
export function CardSheetMarket({ cardId, value, market }: CardSheetMarketProps) {
  const marketHref = `${CARD_HUB_PATHS.market}?for=${encodeURIComponent(cardId)}`;
  return (
    <section aria-labelledby="sheet-market" className="space-y-3">
      <h3 id="sheet-market" className="text-headline">
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
            <li
              key={listing.auctionId}
              className="text-callout flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0 truncate">
                {`${seller(listing)} · ${formatTimeLeft(listing.endTime)} left`}
              </span>
              <span className="shrink-0">{credits(listing.currentBid)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-callout">
        <Link href={marketHref} className={cn("text-tint underline", focusRing)}>
          {market.listings.length > 0 ? "Bid in the market" : "Look for it in the market"}
        </Link>
      </p>
      <CardPriceHistoryChart cardId={cardId} />
      {market.recentSales.length > 0 && (
        <ul aria-label="Recent sales" className="text-footnote text-label-secondary space-y-1">
          {market.recentSales.map((sale, index) => (
            <li key={`${sale.at.getTime()}-${index}`} className="flex justify-between">
              <span>{sale.at.toLocaleDateString()}</span>
              {credits(sale.price)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
