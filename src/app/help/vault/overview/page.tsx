"use client";

import Link from "next/link";
import { Coins, Layers, Star, Package } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function VaultOverviewArticle() {
  return (
    <ArticleLayout
      title="Vault Overview"
      description="Your card collection, IxCredits balance, and vault progression system."
      icon={Coins}
    >
      <ContentCard>
        <Section title="What is the Vault?">
          <p>
            The Vault is your central hub for the IxStats card collection system. It manages your
            trading cards, IxCredits virtual currency, and progression. Access it from the Vault
            link in the main navigation.
          </p>
          <p className="mt-3">
            The Vault has five sections:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li><strong>Dashboard:</strong> IxCredits balance, vault level, daily bonus, and quick actions</li>
            <li><strong>Cards:</strong> Browse and manage your card collection</li>
            <li><strong>Acquire:</strong> Purchase card packs and browse the marketplace</li>
            <li><strong>Create:</strong> Create custom cards and initiate trades</li>
            <li><strong>Import:</strong> Import cards from NationStates</li>
          </ul>
        </Section>

        <Section title="Card Types">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Layers className="inline h-4 w-4 text-blue-500" />{" "}
              <strong>Nation Cards:</strong> Cards representing countries with stats, flags, and
              government data
            </li>
            <li>
              <Layers className="inline h-4 w-4 text-purple-500" />{" "}
              <strong>Lore Cards:</strong> Wiki-generated cards from IxWiki articles with excerpts
              and holographic effects
            </li>
            <li>
              <Layers className="inline h-4 w-4 text-emerald-500" />{" "}
              <strong>NationStates Import Cards:</strong> Cards imported from NationStates profiles
            </li>
          </ul>
        </Section>

        <Section title="Rarity System">
          <InfoBox title="Card Rarities">
            <p>
              Cards come in five rarity tiers, each with distinct visual treatments:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Common:</strong> Standard card appearance</li>
              <li><strong>Uncommon:</strong> Subtle shimmer effect</li>
              <li><strong>Rare:</strong> Enhanced border glow</li>
              <li>
                <Star className="inline h-4 w-4 text-purple-500" />{" "}
                <strong>Epic:</strong> Holographic cover with animated effects
              </li>
              <li>
                <Star className="inline h-4 w-4 text-amber-500" />{" "}
                <strong>Legendary:</strong> Full holographic treatment with premium animations
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Vault Dashboard">
          <p>
            The dashboard shows your IxCredits balance with animated number transitions, current
            vault level and XP progress, daily login bonus streak status, and quick-action buttons
            to open packs, browse the marketplace, or start a trade.
          </p>
        </Section>

        <Section title="Collection Management">
          <p>
            <Package className="inline h-4 w-4 text-amber-500" /> The Cards section displays your
            full collection in a filterable grid. Sort by rarity, type, or acquisition date. View
            detailed card information including stats, lore text, and holographic effects by
            clicking any card.
          </p>
        </Section>

        <InfoBox title="Related Articles">
          <ul className="list-disc space-y-1 pl-6">
            <li><Link href="/help/vault/card-packs" className="text-blue-600 hover:underline dark:text-blue-400">Card Packs &amp; Opening</Link> - Card pack purchasing and opening</li>
            <li><Link href="/help/vault/trading" className="text-blue-600 hover:underline dark:text-blue-400">Trading &amp; Marketplace</Link> - Marketplace and trading</li>
            <li><Link href="/help/vault/ixcredits" className="text-blue-600 hover:underline dark:text-blue-400">IxCredits Economy</Link> - IxCredits economy details</li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
