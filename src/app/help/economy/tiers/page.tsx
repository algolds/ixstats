"use client";

import { TrendingUp, BarChart3, Gauge } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function EconomicTiersArticle() {
  return (
    <ArticleLayout
      title="Economic Tier System"
      description="Understand how IxStats classifies economies and how tiers influence growth and achievements."
      icon={TrendingUp}
    >
      <Section title="Tier Basics">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Tiers range from Impoverished to Extravagant and are calculated from GDP per capita and
            population size.
          </li>
          <li>
            Tier data lives in `api.economics.getCountryIndicators` and is stored in Prisma fields
            `economicTier` and `populationTier`.
          </li>
          <li>Leaderboards and achievements often use tier thresholds to determine eligibility.</li>
        </ul>
      </Section>

      <Section title="Why Tiers Matter">
        <InfoBox title="Gameplay Effects">
          <ul className="list-disc space-y-1 pl-6">
            <li>Higher tiers unlock new achievements and ThinkPages badges.</li>
            <li>
              Builder defaults (economic templates) adjust growth caps and resilience modifiers by
              tier.
            </li>
            <li>
              Compliance tasks compare current tier against projections to highlight
              underperformance.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Where to Monitor">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            MyCountry Economic tab – `EconomicSummaryWidget` and `CoreEconomicIndicators` highlight
            tier shifts.
          </li>
          <li>`/leaderboards` – Filter by tier to compare peer nations.</li>
          <li>`docs/systems/economy.md` – Detailed description of calculations and projections.</li>
        </ul>
      </Section>

      <InfoBox title="Implementation Notes">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <BarChart3 className="inline h-4 w-4" /> Update tiers after seeding data or running bulk
            imports.
          </li>
          <li>
            <Gauge className="inline h-4 w-4" /> Keep tests (`npm run test:economics`) green when
            adjusting thresholds.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
