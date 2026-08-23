import Link from "next/link";
import { ArrowSeparate as ArrowLeftRight, Hammer as Gavel, Timer, Community as Handshake } from "iconoir-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function TradingArticle() {
  return (
    <ArticleLayout
      title="Trading & Marketplace"
      description="Auction system, bidding mechanics, and direct player-to-player card trades."
      icon={ArrowLeftRight}
    >
      <ContentCard>
        <Section title="Marketplace Overview">
          <p>
            The marketplace is where players buy and sell cards through auctions or direct trades.
            Access it from the Acquire section of the Vault. The marketplace includes filtering by
            rarity, card type, and price range, along with market analytics showing recent sales and
            price trends.
          </p>
        </Section>

        <Section title="Creating Auctions">
          <InfoBox title="Auction Setup">
            <p>
              <Gavel className="inline h-4 w-4" /> List a card for auction from the Create Auction
              modal:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Starting Price:</strong> Minimum bid in IxCredits
              </li>
              <li>
                <strong>Buy-Now Price:</strong> Optional instant-purchase price
              </li>
              <li>
                <strong>Duration:</strong> How long the auction runs (hours)
              </li>
              <li>The card is locked from your collection while the auction is active</li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Bidding">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Timer className="inline h-4 w-4 text-amber-500" /> <strong>Countdown Timer:</strong>{" "}
              Each auction shows remaining time with live countdown
            </li>
            <li>
              <strong>Bid Placement:</strong> Enter your bid amount (must exceed current highest
              bid)
            </li>
            <li>
              <strong>Outbid Notifications:</strong> Receive alerts when someone outbids you
            </li>
            <li>
              <strong>Buy-Now:</strong> If available, purchase immediately at the listed price
            </li>
            <li>
              <strong>Settlement:</strong> When the auction ends, the highest bidder receives the
              card and the seller receives IxCredits
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Direct Trading">
          <p>
            <Handshake className="inline h-4 w-4 text-emerald-500" /> For player-to-player trades
            outside the auction system:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Trade Offers:</strong> Send a trade offer specifying cards you want and cards
              you&apos;re offering
            </li>
            <li>
              <strong>Negotiation:</strong> Counter-offers allow back-and-forth negotiation
            </li>
            <li>
              <strong>Trade History:</strong> View past completed and pending trades
            </li>
            <li>
              <strong>Fair Trade Indicator:</strong> Market value comparison shows if a trade is
              balanced
            </li>
          </ul>
        </Section>

        <WarningBox title="Trading Tips">
          Check recent market prices before listing or bidding. Review your trade history to
          understand card values. Cards in active auctions or pending trades cannot be used in other
          transactions.
        </WarningBox>

        <InfoBox title="Related Articles">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/vault/card-packs"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Card Packs &amp; Opening
              </Link>{" "}
              - Opening packs to get cards
            </li>
            <li>
              <Link
                href="/help/vault/ixcredits"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                IxCredits Economy
              </Link>{" "}
              - IxCredits economy and earning
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
