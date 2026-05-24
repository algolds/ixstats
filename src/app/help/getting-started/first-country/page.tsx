"use client";

import Link from "next/link";
import { Globe, MapPin, Settings } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function FirstCountryArticle() {
  return (
    <ArticleLayout
      title="Creating Your First Country"
      description="A step-by-step guide to building your nation from the ground up -- identity, government, economy, and more."
      icon={Globe}
      prevLink={{ href: "/help/getting-started/navigation", label: "Finding Your Way Around" }}
      nextLink={{ href: "/help/getting-started/gameplay-overview", label: "Gameplay Overview" }}
    >
      <ContentCard>
        <Section title="Step 1: Open the Country Builder">
          <p>
            Head to the{" "}
            <Link href="/builder" className="text-blue-600 hover:underline dark:text-blue-400">
              Country Builder
            </Link>{" "}
            from the top navigation menu. You have two ways to get started:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Start from scratch:</strong> Build every aspect of your nation exactly the way
              you want it.
            </li>
            <li>
              <strong>Import from IxWiki:</strong> Pull in baseline data from an existing wiki
              article and customize it to fit your vision.
            </li>
          </ul>
        </Section>

        <Section title="Step 2: Work Through Each Section">
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              <strong>Identity:</strong> Set your nation&rsquo;s name, flag, motto, and basic
              details.
            </li>
            <li>
              <strong>Government:</strong> Choose from over 20 government components -- combine them
              for{" "}
              <Link
                href="/help/government/synergy"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                synergy bonuses
              </Link>{" "}
              that boost your governance effectiveness.
            </li>
            <li>
              <strong>Economy:</strong> Configure your economic model, sectors, and growth strategy.
              Learn more about how{" "}
              <Link
                href="/help/economy/tiers"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                economic tiers
              </Link>{" "}
              affect your nation.
            </li>
            <li>
              <strong>Labor & Demographics:</strong> Define your workforce, population distribution,
              and social indicators.
            </li>
            <li>
              <strong>Fiscal Policy:</strong> Set up your{" "}
              <Link
                href="/help/economy/tax-system"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                tax system
              </Link>{" "}
              and government spending priorities.
            </li>
          </ol>
        </Section>

        <Section title="Step 3: Review and Save">
          <p>
            Before publishing, you will see a full summary of your nation. Take a moment to review
            your choices and tweak anything that does not look right. The builder also suggests
            policy recommendations based on your configuration -- these are great starting points
            for fine-tuning your nation later.
          </p>
        </Section>

        <Section title="Helpful Tools Along the Way">
          <InfoBox title="Builder Tips">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Wiki Import:</strong> If your nation already has an IxWiki page, you can
                pull in that data as a starting point and customize from there.
              </li>
              <li>
                <strong>Component Synergies:</strong> Certain government and economic components
                work better together. Look for synergy indicators as you build -- they give your
                nation real performance bonuses. See the{" "}
                <Link
                  href="/help/government/atomic"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Atomic Components Guide
                </Link>{" "}
                for details.
              </li>
              <li>
                <strong>Policy Advisor:</strong> As you fill in each section, the builder will
                suggest optimizations and flag potential conflicts in your setup.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="What Happens After You Save">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Your nation goes live immediately. Head to{" "}
              <Link href="/mycountry" className="text-blue-600 hover:underline dark:text-blue-400">
                MyCountry
              </Link>{" "}
              to see your vitality rings, compliance tasks, and quick actions.
            </li>
            <li>
              Your country will appear on the{" "}
              <Link
                href="/leaderboards"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Leaderboards
              </Link>{" "}
              -- check how you stack up against other nations.
            </li>
            <li>
              You can return to the{" "}
              <Link href="/builder" className="text-blue-600 hover:underline dark:text-blue-400">
                Country Builder
              </Link>{" "}
              at any time to make changes and evolve your nation as you play.
            </li>
          </ul>
        </Section>

        <InfoBox title="Learn More">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <MapPin className="inline h-4 w-4" />{" "}
              <Link
                href="/help/gameplay/country-building"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Country Building Guide
              </Link>{" "}
              -- deep dive into all the options available in the builder.
            </li>
            <li>
              <Settings className="inline h-4 w-4" />{" "}
              <Link
                href="/help/government/atomic"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Atomic Components
              </Link>{" "}
              and{" "}
              <Link
                href="/help/economy/tiers"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Economic Tiers
              </Link>{" "}
              -- advanced configuration guides for experienced players.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
