"use client";

import Link from "next/link";
import { Gamepad2, Rocket, TrendingUp, Trophy } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function GameplayOverviewArticle() {
  return (
    <ArticleLayout
      title="Gameplay Overview"
      description="How the simulation, economy, diplomacy, and progression systems work together in IxStats."
      icon={Gamepad2}
      prevLink={{ href: "/help/getting-started/first-country", label: "Creating Your First Country" }}
      nextLink={{ href: "/help/getting-started/ixtime", label: "Understanding IxTime" }}
    >
      <ContentCard>
      <Section title="The IxStats Gameplay Loop">
        <p>
          IxStats is a nation simulation platform where you build, manage, and grow a country.
          The core gameplay loop follows five phases:
        </p>
        <ol className="mt-2 list-decimal space-y-2 pl-6">
          <li>
            <Rocket className="inline h-4 w-4 text-blue-500" />{" "}
            <strong>Create:</strong> Build your nation using the{" "}
            <Link href="/builder" className="text-blue-600 hover:underline dark:text-blue-400">
              Country Builder
            </Link>{" "}
            with government, economy, and demographic configurations
          </li>
          <li>
            <strong>Build:</strong> Configure government systems, economic policies, and your tax
            framework -- combine components for{" "}
            <Link href="/help/government/synergy" className="text-blue-600 hover:underline dark:text-blue-400">
              synergy bonuses
            </Link>{" "}
            that make your nation stronger
          </li>
          <li>
            <strong>Respond:</strong> Handle{" "}
            <Link href="/help/gameplay/national-issues" className="text-blue-600 hover:underline dark:text-blue-400">
              national issues
            </Link>, crisis events, and diplomatic
            scenarios as they arise -- each decision has real consequences
          </li>
          <li>
            <TrendingUp className="inline h-4 w-4 text-emerald-500" />{" "}
            <strong>Grow:</strong> Watch your economy advance through{" "}
            <Link href="/help/economy/tiers" className="text-blue-600 hover:underline dark:text-blue-400">
              tiers
            </Link>, climb{" "}
            <Link href="/leaderboards" className="text-blue-600 hover:underline dark:text-blue-400">
              leaderboards
            </Link>, and unlock{" "}
            <Link href="/help/gameplay/achievements" className="text-blue-600 hover:underline dark:text-blue-400">
              achievements
            </Link>{" "}
            as your nation develops
          </li>
          <li>
            <strong>Engage:</strong> Interact with other players through{" "}
            <Link href="/help/mycountry/diplomacy" className="text-blue-600 hover:underline dark:text-blue-400">
              diplomacy
            </Link>, trading cards in the{" "}
            <Link href="/help/vault/overview" className="text-blue-600 hover:underline dark:text-blue-400">
              Vault
            </Link>,{" "}
            <Link href="/help/social/thinkpages" className="text-blue-600 hover:underline dark:text-blue-400">
              ThinkPages
            </Link>, and collaborative{" "}
            <Link href="/help/social/thinktanks" className="text-blue-600 hover:underline dark:text-blue-400">
              ThinkTanks
            </Link>
          </li>
        </ol>
      </Section>
      </ContentCard>

      <ContentCard>
      <Section title="Core Systems">
        <InfoBox title="Six Pillars of Gameplay">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Economy:</strong> A tier-based growth engine with GDP calculations, trade
              mechanics, sector distribution, and tax revenue.{" "}
              <Link href="/help/economy/modeling" className="text-blue-600 hover:underline dark:text-blue-400">
                Learn more
              </Link>
            </li>
            <li>
              <strong>Government:</strong> Over 20 components with synergy and conflict mechanics
              that determine how effective your governance is.{" "}
              <Link href="/help/government/atomic" className="text-blue-600 hover:underline dark:text-blue-400">
                Learn more
              </Link>
            </li>
            <li>
              <strong>Diplomacy:</strong> Embassy networks, diplomatic missions, and NPC interactions
              with distinct personality traits and behavioral styles.{" "}
              <Link href="/help/diplomacy/embassies" className="text-blue-600 hover:underline dark:text-blue-400">
                Learn more
              </Link>
            </li>
            <li>
              <strong>Defense:</strong> Military branch management, equipment from a catalog of 500+
              items, operations, and security assessments.{" "}
              <Link href="/help/defense/overview" className="text-blue-600 hover:underline dark:text-blue-400">
                Learn more
              </Link>
            </li>
            <li>
              <strong>Intelligence:</strong> Analytics dashboards for economic, diplomatic, and
              policy analysis, plus forecasting and key findings.{" "}
              <Link href="/help/mycountry/intelligence" className="text-blue-600 hover:underline dark:text-blue-400">
                Learn more
              </Link>
            </li>
            <li>
              <strong>Politics:</strong> Legislature configuration, political parties, and
              election simulations with realistic seat allocation.{" "}
              <Link href="/help/mycountry/politics" className="text-blue-600 hover:underline dark:text-blue-400">
                Learn more
              </Link>
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Progression Systems">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <Trophy className="inline h-4 w-4 text-amber-500" />{" "}
            <strong>Achievements:</strong> Five rarity tiers (Common to Legendary) with{" "}
            <Link href="/help/vault/ixcredits" className="text-blue-600 hover:underline dark:text-blue-400">
              IxCredits
            </Link>{" "}
            rewards from 5 to 100 per unlock.{" "}
            <Link href="/help/gameplay/achievements" className="text-blue-600 hover:underline dark:text-blue-400">
              See all achievements
            </Link>
          </li>
          <li>
            <strong>IxCredits:</strong> Virtual currency earned through gameplay. Spend them on{" "}
            <Link href="/help/vault/card-packs" className="text-blue-600 hover:underline dark:text-blue-400">
              card packs
            </Link>, marketplace trades, and cosmetics.
          </li>
          <li>
            <strong>Vault Leveling:</strong> XP-based progression (1 XP per 1 IxCredit earned,
            1,000 XP per level) that unlocks new features as you advance.{" "}
            <Link href="/help/vault/overview" className="text-blue-600 hover:underline dark:text-blue-400">
              Visit your Vault
            </Link>
          </li>
          <li>
            <strong>Leaderboard Rankings:</strong> Compete across GDP, population, achievements,
            and diplomatic influence.{" "}
            <Link href="/help/gameplay/leaderboards" className="text-blue-600 hover:underline dark:text-blue-400">
              View leaderboards
            </Link>
          </li>
        </ul>
      </Section>
      </ContentCard>

      <ContentCard fullWidth>
      <Section title="Cards & Collecting">
        <p>
          The{" "}
          <Link href="/help/vault/overview" className="text-blue-600 hover:underline dark:text-blue-400">
            Vault
          </Link>{" "}
          system adds a collectible dimension to gameplay. Earn IxCredits through
          normal play, spend them on card packs, and build a collection of Nation Cards,{" "}
          <Link href="/help/vault/lore-cards" className="text-blue-600 hover:underline dark:text-blue-400">
            Lore Cards
          </Link>, and NationStates Import Cards.{" "}
          <Link href="/help/vault/trading" className="text-blue-600 hover:underline dark:text-blue-400">
            Trade with other players
          </Link>{" "}
          on the marketplace or through direct trades.
        </p>
      </Section>

      <Section title="Where to Start">
        <InfoBox title="Recommended Path">
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              Read the{" "}
              <Link href="/help/getting-started/welcome" className="text-blue-600 hover:underline dark:text-blue-400">
                Welcome
              </Link>{" "}
              article for a platform overview
            </li>
            <li>
              Follow{" "}
              <Link href="/help/getting-started/first-country" className="text-blue-600 hover:underline dark:text-blue-400">
                Creating Your First Country
              </Link>{" "}
              to build your nation
            </li>
            <li>
              Explore the{" "}
              <Link href="/help/mycountry/overview" className="text-blue-600 hover:underline dark:text-blue-400">
                MyCountry Overview
              </Link>{" "}
              to understand your dashboard
            </li>
            <li>
              Try responding to a{" "}
              <Link href="/help/gameplay/national-issues" className="text-blue-600 hover:underline dark:text-blue-400">
                National Issue
              </Link>{" "}
              in the Executive tab
            </li>
            <li>
              Establish your first{" "}
              <Link href="/help/diplomacy/embassies" className="text-blue-600 hover:underline dark:text-blue-400">
                Embassy
              </Link>{" "}
              to start diplomacy
            </li>
            <li>
              Check the{" "}
              <Link href="/help/vault/overview" className="text-blue-600 hover:underline dark:text-blue-400">
                Vault
              </Link>{" "}
              to see your IxCredits and open a pack
            </li>
          </ol>
        </InfoBox>
      </Section>

      <InfoBox title="Related Guides">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Link href="/help/getting-started/first-country" className="text-blue-600 hover:underline dark:text-blue-400">
              Creating Your First Country
            </Link>{" "}
            -- building your nation step by step
          </li>
          <li>
            <Link href="/help/mycountry/overview" className="text-blue-600 hover:underline dark:text-blue-400">
              MyCountry Overview
            </Link>{" "}
            -- your nation&rsquo;s command center
          </li>
          <li>
            <Link href="/help/vault/overview" className="text-blue-600 hover:underline dark:text-blue-400">
              Vault Overview
            </Link>{" "}
            -- cards, packs, and IxCredits
          </li>
          <li>
            <Link href="/help/gameplay/simulation" className="text-blue-600 hover:underline dark:text-blue-400">
              Simulation Engine
            </Link>{" "}
            -- how the economy and world simulation works under the hood
          </li>
        </ul>
      </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
