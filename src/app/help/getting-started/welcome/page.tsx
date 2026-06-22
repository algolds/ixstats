"use client";

import Link from "next/link";
import { Sparkles, Compass, Globe2 } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function WelcomeArticle() {
  return (
    <ArticleLayout
      title="Welcome to IxStats"
      description="Build a nation, then watch it come alive in a shared, living world. Here's how to begin."
      icon={Sparkles}
      nextLink={{ href: "/help/getting-started/first-country", label: "Create Your First Nation" }}
    >
      <ContentCard>
        <Section title="What is IxStats?">
          <p>
            IxStats is a worldbuilding platform built around one idea: your nation should feel{" "}
            <em>alive</em>. You design a country — its economy, government, military, culture, and
            borders — and it becomes a living part of a shared world that keeps moving, growing, and
            reacting on its own.
          </p>
          <p className="mt-3">
            You&rsquo;re not filling out a profile. You&rsquo;re running a nation, telling its story,
            and watching the numbers and the map respond to your choices.
          </p>
        </Section>

        <Section title="Coming from NationStates?">
          <InfoBox title="You'll feel at home — with a lot more under your hands">
            <p className="mb-2">
              If you&rsquo;ve built nations on NationStates, the instinct is exactly the same: create
              a country, give it character, tell its story. Here&rsquo;s what&rsquo;s different:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                Your <strong>economy actually runs the numbers</strong> — GDP, trade, taxes, and
                growth are modeled and live, not a one-line stat.
              </li>
              <li>
                Your nation lives on a <strong>real, editable world map</strong> — borders, terrain,
                and neighbors you can see and shape.
              </li>
              <li>
                Government, military, diplomacy, and intelligence are{" "}
                <strong>connected systems</strong>, not separate flavor text — a choice in one shows
                up in the others.
              </li>
              <li>
                The world runs on its own clock (
                <Link
                  href="/help/getting-started/ixtime"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  IxTime
                </Link>
                ) — things keep happening whether or not you&rsquo;re watching.
              </li>
            </ul>
            <p className="mt-2">Less answering issues. More building and running a nation.</p>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Your First Few Minutes">
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              <strong>Create your nation</strong> in the{" "}
              <Link href="/builder" className="text-blue-600 hover:underline dark:text-blue-400">
                Country Builder
              </Link>{" "}
              — from a blank slate, or by importing a starting point from your IxWiki article.
            </li>
            <li>
              <strong>Give it an identity</strong> — name, flag, motto, and the feel of the place.
            </li>
            <li>
              <strong>Visit{" "}
              <Link href="/mycountry" className="text-blue-600 hover:underline dark:text-blue-400">
                MyCountry
              </Link>
              </strong>{" "}
              — your nation&rsquo;s home base — and watch it come to life.
            </li>
            <li>
              <strong>Find your spot</strong> on the{" "}
              <Link href="/maps" className="text-blue-600 hover:underline dark:text-blue-400">
                world map
              </Link>
              .
            </li>
          </ol>
        </Section>

        <Section title="Where Things Live">
          <InfoBox title="The places you'll come back to">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <Link href="/mycountry" className="text-blue-600 hover:underline dark:text-blue-400">
                  <strong>MyCountry</strong>
                </Link>{" "}
                — your nation&rsquo;s home base. Economy, cabinet, military, and diplomacy, all in one
                place.
              </li>
              <li>
                <Link href="/builder" className="text-blue-600 hover:underline dark:text-blue-400">
                  <strong>Country Builder</strong>
                </Link>{" "}
                — where you create and reshape your nation, any time.
              </li>
              <li>
                <Link href="/maps" className="text-blue-600 hover:underline dark:text-blue-400">
                  <strong>The World Map</strong>
                </Link>{" "}
                — the shared world every nation lives on.
              </li>
              <li>
                <Link href="/thinkpages" className="text-blue-600 hover:underline dark:text-blue-400">
                  <strong>Community</strong>
                </Link>{" "}
                — meet the worldbuilders behind the other nations.
              </li>
              <li>
                <Link href="/vault" className="text-blue-600 hover:underline dark:text-blue-400">
                  <strong>Cards &amp; Vault</strong>
                </Link>{" "}
                — collect and trade as you play.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Need a Hand?">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Compass className="inline h-4 w-4" /> Ready to build? Walk through{" "}
              <Link
                href="/help/getting-started/first-country"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Create Your First Nation
              </Link>{" "}
              step by step.
            </li>
            <li>
              <Globe2 className="inline h-4 w-4" /> Curious how it all fits together? See{" "}
              <Link
                href="/help/getting-started/gameplay-overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                How It All Fits Together
              </Link>
              .
            </li>
            <li>
              Every feature on the platform has its own guide right here in the{" "}
              <Link href="/help" className="text-blue-600 hover:underline dark:text-blue-400">
                Help Center
              </Link>
              .
            </li>
          </ul>
        </Section>
      </ContentCard>
    </ArticleLayout>
  );
}
