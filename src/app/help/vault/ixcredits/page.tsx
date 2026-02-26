"use client";

import Link from "next/link";
import { CircleDollarSign, TrendingUp, ShoppingCart, Clock } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox, ContentCard } from "../../_components/ArticleLayout";

export default function IxCreditsArticle() {
  return (
    <ArticleLayout
      title="IxCredits Economy"
      description="Earning, spending, daily caps, and vault leveling — the complete IxCredits guide."
      icon={CircleDollarSign}
    >
      <ContentCard>
        <Section title="What Are IxCredits?">
          <p>
            IxCredits (IxC) are the virtual currency powering the Vault economy. They are earned
            through gameplay actions and spent on card packs, marketplace purchases, and cosmetic
            items. Your Vault tracks your balance, lifetime earned/spent totals, vault level, XP,
            login streak, and daily earnings.
          </p>
        </Section>

        <Section title="Earning IxCredits">
          <InfoBox title="Earning Categories">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <TrendingUp className="inline h-4 w-4" />{" "}
                <strong>Passive Income:</strong> Daily dividend based on your GDP per capita. Higher
                economic tiers earn multipliers (0.5x for Impoverished up to 3.5x for Extravagant).
                Population and growth bonuses apply.
              </li>
              <li>
                <Clock className="inline h-4 w-4" />{" "}
                <strong>Daily Login:</strong> 1-7 IxC scaling with consecutive login streak days.
                Streak resets after a missed day.
              </li>
              <li>
                <strong>Achievements:</strong> 5 IxC (Common), 10 IxC (Uncommon), 25 IxC (Rare),
                50 IxC (Epic), 100 IxC (Legendary) per achievement unlock.
              </li>
              <li>
                <strong>Diplomatic Actions:</strong> Establishing an embassy earns 15 IxC. Cultural
                exchanges earn 12 IxC.
              </li>
              <li>
                <strong>Diplomatic Scenarios:</strong> 5 IxC base reward plus 0-8 IxC risk bonus
                depending on chosen response difficulty.
              </li>
              <li>
                <strong>Crisis Responses:</strong> 8-20 IxC based on crisis severity and response
                quality.
              </li>
              <li>
                <strong>Social Posts:</strong> 1 IxC per ThinkPages post (max 5 per day).
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Spending IxCredits">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <ShoppingCart className="inline h-4 w-4 text-blue-500" />{" "}
              <strong>Card Packs:</strong> Purchase packs in the Pack Store with varying prices
            </li>
            <li><strong>Marketplace:</strong> Bid on or buy cards from other players</li>
            <li><strong>Crafting:</strong> Combine cards or materials using IxCredits</li>
            <li><strong>Boosts:</strong> Temporary gameplay boosts and bonuses</li>
            <li><strong>Cosmetics:</strong> Custom card backs, profile decorations, and visual effects</li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Daily Earning Caps">
          <InfoBox title="Cap Limits">
            <p>
              Certain earning categories have daily limits to maintain economy balance:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Active Earnings:</strong> 100 IxC per day (achievements, diplomatic, crisis)</li>
              <li><strong>Social Earnings:</strong> 50 IxC per day (posts, interactions)</li>
              <li><strong>Passive Income:</strong> No daily cap (based on economic performance)</li>
              <li><strong>Card Earnings:</strong> No daily cap (trading profits, pack rewards)</li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Vault Leveling">
          <p>
            Your Vault Level represents your overall progression in the card system:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li><strong>XP Rate:</strong> 1 XP earned for every 1 IxCredit earned</li>
            <li><strong>Level Threshold:</strong> 1,000 XP per level</li>
            <li>Higher vault levels may unlock access to exclusive packs and features</li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard fullWidth>
        <WarningBox title="Economy Integrity">
          All IxCredits transactions are tracked to keep the economy fair.
        </WarningBox>

        <InfoBox title="Related Articles">
          <ul className="list-disc space-y-1 pl-6">
            <li><Link href="/help/vault/overview" className="text-blue-600 hover:underline dark:text-blue-400">Vault Overview</Link> - Vault system overview</li>
            <li><Link href="/help/vault/card-packs" className="text-blue-600 hover:underline dark:text-blue-400">Card Packs &amp; Opening</Link> - Spending IxCredits on packs</li>
            <li><Link href="/help/gameplay/achievements" className="text-blue-600 hover:underline dark:text-blue-400">Achievements &amp; Progression</Link> - Earning IxCredits through achievements</li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
