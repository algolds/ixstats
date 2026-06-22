"use client";

import Link from "next/link";
import { Globe, MapPin, Settings } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function FirstCountryArticle() {
  return (
    <ArticleLayout
      title="Create Your First Nation"
      description="From a blank page to a living country in a few minutes. Here's the whole journey."
      icon={Globe}
      prevLink={{ href: "/help/getting-started/welcome", label: "Welcome to IxStats" }}
      nextLink={{ href: "/help/getting-started/gameplay-overview", label: "How It All Fits Together" }}
    >
      <ContentCard>
        <Section title="Two Ways to Begin">
          <p>
            Open the{" "}
            <Link href="/builder" className="text-blue-600 hover:underline dark:text-blue-400">
              Country Builder
            </Link>{" "}
            from the top menu. You can start either way:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>From scratch</strong> — shape every part of your nation exactly how you picture
              it.
            </li>
            <li>
              <strong>Import from IxWiki</strong> — already written factbooks? Pull your existing
              article in as a starting point, then refine. Your lore becomes a nation that actually
              runs.
            </li>
          </ul>
        </Section>

        <Section title="Build It, Section by Section">
          <p>The builder walks you through your nation one piece at a time:</p>
          <ol className="mt-2 list-decimal space-y-2 pl-6">
            <li>
              <strong>Identity</strong> — name, flag, motto, and the character of the place.
            </li>
            <li>
              <strong>Government</strong> — choose how your nation is run. Mix components for{" "}
              <Link
                href="/help/government/synergy"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                synergy bonuses
              </Link>{" "}
              when the right parts work together.
            </li>
            <li>
              <strong>Economy</strong> — set your sectors and growth strategy, and see which{" "}
              <Link
                href="/help/economy/tiers"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                economic tier
              </Link>{" "}
              your nation starts in.
            </li>
            <li>
              <strong>People</strong> — your population, workforce, and the social makeup of your
              nation.
            </li>
            <li>
              <strong>Money</strong> — your{" "}
              <Link
                href="/help/economy/tax-system"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                taxes
              </Link>{" "}
              and spending priorities. This is where you decide what kind of country you can afford to
              be.
            </li>
          </ol>
        </Section>

        <Section title="Review, Then Make It Live">
          <p>
            Before you publish, you&rsquo;ll see a full summary of your nation. Take a minute to read
            it over and adjust anything that doesn&rsquo;t feel right. The builder also suggests
            policies based on your choices — handy starting points you can fine-tune later.
          </p>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="A Few Things That Help">
          <InfoBox title="Worth knowing as you build">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Nothing is permanent.</strong> You can come back to the builder any time and
                evolve your nation as its story grows.
              </li>
              <li>
                <strong>Watch for synergies.</strong> Certain government and economic choices boost
                each other — the builder flags them as you go. See the{" "}
                <Link
                  href="/help/government/atomic"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  atomic components guide
                </Link>{" "}
                for the deep version.
              </li>
              <li>
                <strong>Lean on the advisor.</strong> As you fill in each section, the builder
                suggests improvements and flags choices that work against each other.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="What Happens When You Save">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Your nation goes live right away. Head to{" "}
              <Link href="/mycountry" className="text-blue-600 hover:underline dark:text-blue-400">
                MyCountry
              </Link>{" "}
              to see it running — your vital signs, suggested next steps, and quick actions.
            </li>
            <li>
              It takes its place on the{" "}
              <Link href="/maps" className="text-blue-600 hover:underline dark:text-blue-400">
                world map
              </Link>{" "}
              and the{" "}
              <Link
                href="/leaderboards"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                leaderboards
              </Link>{" "}
              alongside everyone else&rsquo;s.
            </li>
            <li>
              From here on, the world keeps moving — and your nation grows with the choices you make.
            </li>
          </ul>
        </Section>

        <InfoBox title="Go Deeper">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <MapPin className="inline h-4 w-4" />{" "}
              <Link
                href="/help/gameplay/country-building"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Shaping Your Nation
              </Link>{" "}
              — a fuller tour of everything the builder can do.
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
              — for when you&rsquo;re ready to optimize.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
