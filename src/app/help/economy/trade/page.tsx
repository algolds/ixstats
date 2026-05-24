"use client";

import Link from "next/link";
import { ArrowLeftRight, Ship, Factory, TrendingUp, Handshake } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function TradeArticle() {
  return (
    <ArticleLayout
      title="Trade & Commerce"
      description="Learn how international trade shapes your nation's economy and how to strengthen your position on the global stage."
      icon={ArrowLeftRight}
    >
      <ContentCard>
        <Section title="How Trade Works">
          <p className="mb-4 text-slate-700 dark:text-slate-300">
            Every nation in IxStats participates in a global trade network. Your country imports
            goods it needs and exports goods it produces efficiently. The balance between these two
            flows — your <strong>trade balance</strong> — is one of the most important indicators of
            economic health.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Trade surplus</strong> means your exports exceed your imports, bringing wealth
              into your economy.
            </li>
            <li>
              <strong>Trade deficit</strong> means you are spending more on imports than you earn
              from exports, which can weaken your currency and increase debt over time.
            </li>
            <li>
              Your top trading partners, commodity breakdowns, and overall balance are all tracked
              automatically as your economy evolves.
            </li>
          </ul>
        </Section>

        <Section title="Where to View Your Trade Data">
          <InfoBox title="Finding Trade Information">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>MyCountry &rarr; Economy tab</strong> — View your trade cards, top trading
                partners, commodity breakdowns, and alerts when persistent deficits threaten your
                economy.
              </li>
              <li>
                <strong>Leaderboards &rarr; Trade filters</strong> — Compare your trade surplus or
                deficit against other nations to see where you stand globally.
              </li>
              <li>
                <strong>ThinkPages</strong> — Share trade strategy posts with the community using
                the #trade tag to document your decisions and get feedback.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="What Affects Your Trade Balance">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Handshake className="mr-1 inline h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <strong>Diplomatic relationships</strong> — Nations with strong diplomatic ties enjoy
              preferential trade terms. Establishing embassies and maintaining good relations with
              key partners opens the door to better deals and increased trade volume.
            </li>
            <li>
              <TrendingUp className="mr-1 inline h-4 w-4 text-green-600 dark:text-green-400" />
              <strong>Economic policies</strong> — Tax incentives, tariffs, and infrastructure
              investment directly influence which sectors thrive and how competitive your exports
              are on the world market.
            </li>
            <li>
              <Factory className="mr-1 inline h-4 w-4 text-amber-600 dark:text-amber-400" />
              <strong>Industrial strength</strong> — A diversified economy with strong production
              sectors generates more valuable exports. Invest in key industries to shift your trade
              balance in your favor.
            </li>
            <li>
              <strong>Global events</strong> — Crises, sanctions, and shifts in the world economy
              can disrupt trade routes and change demand for your goods overnight.
            </li>
          </ul>
        </Section>

        <Section title="How to Improve Your Trade Position">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Launch trade missions</strong> — Use the quick actions panel to send trade
              missions that open new markets and negotiate favorable terms with other nations.
            </li>
            <li>
              <strong>Strengthen diplomatic ties</strong> — Establish embassies and build alliances
              with major trading partners to unlock trade bonuses and reduce barriers.
            </li>
            <li>
              <strong>Invest in infrastructure</strong> — Better infrastructure lowers the cost of
              moving goods, making your exports more competitive globally.
            </li>
            <li>
              <strong>Adjust your tax policy</strong> — Offer incentives to high-export industries
              or adjust tariffs to protect vulnerable domestic sectors while encouraging growth.
            </li>
            <li>
              <strong>Monitor and adapt</strong> — Keep an eye on your trade data in the Economy tab
              and respond quickly when deficits emerge or new opportunities arise.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Topics">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Ship className="mr-1 inline h-4 w-4" />{" "}
              <Link
                href="/help/diplomacy/missions"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Diplomatic Missions
              </Link>{" "}
              — Learn how sending missions abroad supports trade and opens new markets.
            </li>
            <li>
              <Handshake className="mr-1 inline h-4 w-4" />{" "}
              <Link
                href="/help/diplomacy/embassies"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Embassies
              </Link>{" "}
              — Discover how embassy networks strengthen your trading relationships.
            </li>
            <li>
              <TrendingUp className="mr-1 inline h-4 w-4" />{" "}
              <Link
                href="/help/economy/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Economy Overview
              </Link>{" "}
              — Understand the full picture of your nation's economic health.
            </li>
            <li>
              <Factory className="mr-1 inline h-4 w-4" />{" "}
              <Link
                href="/help/economy/modeling"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Economic Modeling
              </Link>{" "}
              — Explore how supply-side factors and projections affect trade outcomes.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
