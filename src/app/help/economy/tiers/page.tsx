"use client";

import Link from "next/link";
import { TrendingUp, BarChart3, Gauge } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function EconomicTiersArticle() {
  const linkClass = "text-blue-600 hover:underline dark:text-blue-400";

  return (
    <ArticleLayout
      title="Economic Tiers & How to Advance"
      description="Learn what economic tiers mean for your nation, how they are determined, and what you can do to climb to the next level."
      icon={TrendingUp}
      prevLink={{ href: "/help/economy/calculations", label: "Economic Calculations" }}
      nextLink={{ href: "/help/economy/modeling", label: "Modeling & Projections" }}
    >
      <ContentCard>
      <Section title="What Are Economic Tiers?">
        <p className="mb-4 text-slate-700 dark:text-slate-300">
          Every nation in IxStats is assigned an economic tier that reflects its overall wealth
          and development. Think of tiers as broad categories that group nations with similar
          living standards together. Your tier affects what you can unlock, how your nation
          is ranked, and which peers you are compared against.
        </p>
        <p className="text-slate-700 dark:text-slate-300">
          There are seven tiers, from lowest to highest:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-700 dark:text-slate-300">
          <li>
            <strong>Impoverished</strong> — The starting point for many young nations. Basic
            infrastructure is limited and growth potential is high.
          </li>
          <li>
            <strong>Developing</strong> — Early signs of industrialisation. Your nation is building
            the foundations for a modern economy.
          </li>
          <li>
            <strong>Emerging</strong> — A growing middle class and expanding industries. International
            trade begins to play a larger role.
          </li>
          <li>
            <strong>Moderate</strong> — A stable, diversified economy. Most citizens enjoy a
            reasonable standard of living.
          </li>
          <li>
            <strong>Prosperous</strong> — Strong GDP per capita and well-funded public services.
            Your nation is a regional power.
          </li>
          <li>
            <strong>Wealthy</strong> — Among the richest nations on the platform. Advanced technology,
            high wages, and global influence.
          </li>
          <li>
            <strong>Extravagant</strong> — The pinnacle of economic achievement. Only the most
            successful nations reach this level.
          </li>
        </ol>
      </Section>

      <Section title="How Is Your Tier Determined?">
        <p className="mb-4 text-slate-700 dark:text-slate-300">
          Two key factors decide your economic tier:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
          <li>
            <strong>GDP per capita</strong> — Your total economic output divided by your population.
            This is the primary driver. A higher GDP per capita pushes you toward higher tiers.
          </li>
          <li>
            <strong>Population size</strong> — Larger nations face greater challenges in maintaining
            high per-capita output. Population is factored in so that a small city-state and a
            continental power are judged fairly.
          </li>
        </ul>
        <p className="mt-4 text-slate-700 dark:text-slate-300">
          Your tier updates automatically as your economy changes. For a detailed look at the
          math behind these calculations, see the{" "}
          <Link href="/help/economy/calculations" className={linkClass}>
            Economic Calculations
          </Link>{" "}
          guide.
        </p>
      </Section>
      </ContentCard>

      <ContentCard>
      <Section title="How to Advance to a Higher Tier">
        <p className="mb-4 text-slate-700 dark:text-slate-300">
          Climbing tiers is one of the central goals in IxStats. Here are practical strategies:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
          <li>
            <strong>Grow your GDP</strong> — Invest in productive sectors, set favourable tax
            policies, and encourage trade. Use the{" "}
            <Link href="/help/economy/modeling" className={linkClass}>
              Modeling & Projections
            </Link>{" "}
            tools to simulate different strategies before committing.
          </li>
          <li>
            <strong>Manage population growth</strong> — Rapid population growth can dilute GDP per
            capita. Balance immigration and birth-rate policies with economic expansion.
          </li>
          <li>
            <strong>Optimise government spending</strong> — Allocating budget to education,
            infrastructure, and technology can boost long-term productivity.
          </li>
          <li>
            <strong>Maintain stability</strong> — Political crises and low approval ratings can
            damage your economy. Keep your government running smoothly.
          </li>
          <li>
            <strong>Build diplomatic relationships</strong> — Trade agreements and alliances with
            prosperous nations can provide economic bonuses.
          </li>
        </ul>
      </Section>

      <Section title="What Each Tier Unlocks">
        <InfoBox title="Tier Benefits">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Achievements</strong> — Many{" "}
              <Link href="/help/gameplay/achievements" className={linkClass}>
                achievements
              </Link>{" "}
              require reaching a specific tier. Advancing unlocks new badges and recognition.
            </li>
            <li>
              <strong>Leaderboard rankings</strong> — The{" "}
              <Link href="/help/gameplay/leaderboards" className={linkClass}>
                leaderboards
              </Link>{" "}
              let you filter by tier so you can compare your nation against peers at a similar
              level.
            </li>
            <li>
              <strong>Growth potential</strong> — Higher tiers come with increased growth caps,
              meaning your economy can expand even faster once you break through.
            </li>
            <li>
              <strong>Resilience</strong> — Wealthier nations are more resilient to economic shocks,
              crises, and downturns.
            </li>
            <li>
              <strong>ThinkPages badges</strong> — Your tier is displayed on your public profile and
              social posts, showcasing your progress to other players.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Where to Check Your Tier">
        <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
          <li>
            <strong>MyCountry &gt; Overview</strong> — Your current economic tier is shown alongside
            your key national indicators.
          </li>
          <li>
            <strong>MyCountry &gt; Intelligence &gt; Economic</strong> — Detailed analytics show how
            close you are to the next tier and track changes over time.
          </li>
          <li>
            <Link href="/leaderboards" className={linkClass}>
              Leaderboards
            </Link>{" "}
            — Filter by tier to see where you rank among nations at your level.
          </li>
        </ul>
      </Section>

      <InfoBox title="Quick Tips">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <BarChart3 className="inline h-4 w-4" /> Check the Intelligence tab regularly to spot
            trends before they become problems.
          </li>
          <li>
            <Gauge className="inline h-4 w-4" /> If your tier drops, review your spending priorities
            and tax policies — small adjustments can make a big difference.
          </li>
        </ul>
      </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
