"use client";

import Link from "next/link";
import { Package, Sparkles, Eye, Zap } from "lucide-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function CardPacksArticle() {
  return (
    <ArticleLayout
      title="Card Packs & Opening"
      description="Purchasing packs with IxCredits and the four-stage animated opening experience."
      icon={Package}
    >
      <ContentCard>
        <Section title="Pack Store">
          <p>
            The Acquire section of the Vault contains the Pack Store where you can browse and
            purchase card packs. Each pack type has a fixed IxCredits price, a guaranteed number of
            cards, and minimum rarity guarantees.
          </p>
        </Section>

        <Section title="Purchasing Packs">
          <InfoBox title="Purchase Flow">
            <ol className="list-decimal space-y-1 pl-6">
              <li>Browse available packs in the Pack Store</li>
              <li>Click a pack to open the Purchase Modal</li>
              <li>Review pack contents, price, and rarity guarantees</li>
              <li>Confirm purchase (IxCredits are deducted immediately)</li>
              <li>Pack is added to your unopened inventory</li>
            </ol>
          </InfoBox>
        </Section>

        <Section title="Opening Experience">
          <p>Opening a card pack triggers a four-stage animated sequence:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <Eye className="inline h-4 w-4 text-purple-500" />{" "}
              <strong>Stage 1 - Pack Reveal:</strong> The pack appears with a holographic cover
              animation. Click or tap to begin opening.
            </li>
            <li>
              <Sparkles className="inline h-4 w-4 text-amber-500" />{" "}
              <strong>Stage 2 - Pack Explosion:</strong> The pack bursts open with a glass-splash
              particle effect, revealing the cards inside.
            </li>
            <li>
              <Zap className="inline h-4 w-4 text-blue-500" />{" "}
              <strong>Stage 3 - Card Reveal:</strong> Each card is revealed one at a time with 3D
              tilt effects. Higher rarity cards get more dramatic animations. Click through each
              card to see its details.
            </li>
            <li>
              <strong>Stage 4 - Quick Actions:</strong> After all cards are revealed, choose what to
              do: keep in collection, mark for trading, or view full card details.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Rarity Guarantees">
          <p>
            Each pack type specifies minimum rarity guarantees. For example, a pack might guarantee
            at least one Rare or better card. The actual rarity is determined by weighted random
            selection, so you may receive cards better than the minimum guarantee.
          </p>
        </Section>

        <WarningBox title="IxCredits Requirement">
          You must have enough IxCredits to purchase a pack. If your balance is insufficient, the
          purchase button will be disabled. Earn IxCredits through gameplay actions, daily logins,
          and achievements.
        </WarningBox>

        <InfoBox title="Related Articles">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/vault/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Vault Overview
              </Link>{" "}
              - Vault system overview
            </li>
            <li>
              <Link
                href="/help/vault/ixcredits"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                IxCredits Economy
              </Link>{" "}
              - How to earn IxCredits
            </li>
            <li>
              <Link
                href="/help/vault/trading"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Trading &amp; Marketplace
              </Link>{" "}
              - Trading cards on the marketplace
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
