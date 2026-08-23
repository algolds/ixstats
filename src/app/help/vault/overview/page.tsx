import Link from "next/link";
import { Coins, Component as Layers, Star, Package } from "iconoir-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function VaultOverviewArticle() {
  return (
    <ArticleLayout
      title="Your Vault"
      description="Your collection, your IxCredits, and how your Vault grows as you play."
      icon={Coins}
    >
      <ContentCard>
        <Section title="What the Vault Is">
          <p>
            The Vault is your home for collecting — your trading cards, your IxCredits, and the
            progress you make as you play. You&rsquo;ll find it in the main menu, organized into
            five simple areas:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Dashboard</strong> — your balance, your level, your daily bonus, and quick
              actions.
            </li>
            <li>
              <strong>Cards</strong> — browse and sort your whole collection.
            </li>
            <li>
              <strong>Acquire</strong> — open packs and shop the marketplace.
            </li>
            <li>
              <strong>Create</strong> — make your own cards and set up trades.
            </li>
            <li>
              <strong>Import</strong> — bring cards in from NationStates.
            </li>
          </ul>
        </Section>

        <Section title="Kinds of Cards">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Layers className="inline h-4 w-4 text-blue-500" /> <strong>Nation Cards</strong> —
              countries, with their stats, flags, and government on show.
            </li>
            <li>
              <Layers className="inline h-4 w-4 text-purple-500" /> <strong>Lore Cards</strong> —
              made from wiki articles, complete with excerpts and holographic shine.
            </li>
            <li>
              <Layers className="inline h-4 w-4 text-emerald-500" />{" "}
              <strong>NationStates Cards</strong> — pulled straight from NationStates profiles.
            </li>
          </ul>
        </Section>

        <Section title="Rarity">
          <InfoBox title="Five tiers, from plain to dazzling">
            <p>Every card has a rarity, and the rarer it is, the more it shows off:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Common</strong> — clean and classic.
              </li>
              <li>
                <strong>Uncommon</strong> — a subtle shimmer.
              </li>
              <li>
                <strong>Rare</strong> — a glowing border.
              </li>
              <li>
                <Star className="inline h-4 w-4 text-purple-500" /> <strong>Epic</strong> —
                holographic, with motion.
              </li>
              <li>
                <Star className="inline h-4 w-4 text-amber-500" /> <strong>Legendary</strong> — the
                full dazzling treatment.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Your Dashboard">
          <p>
            Open the Vault and the dashboard greets you with your IxCredits, your level and how
            close you are to the next one, your daily login streak, and one-tap buttons to open a
            pack, browse the marketplace, or start a trade.
          </p>
        </Section>

        <Section title="Your Collection">
          <p>
            <Package className="inline h-4 w-4 text-amber-500" /> The Cards area lays out everything
            you own in a grid you can filter and sort — by rarity, type, or when you got it. Tap any
            card to see it up close, lore and shine and all.
          </p>
        </Section>

        <InfoBox title="Keep Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/vault/card-packs"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Packs &amp; Opening
              </Link>{" "}
              — buying packs and the thrill of the reveal.
            </li>
            <li>
              <Link
                href="/help/vault/trading"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Trading &amp; Marketplace
              </Link>{" "}
              — auctions, bids, and trades.
            </li>
            <li>
              <Link
                href="/help/vault/ixcredits"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                IxCredits
              </Link>{" "}
              — earning and spending the currency.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
