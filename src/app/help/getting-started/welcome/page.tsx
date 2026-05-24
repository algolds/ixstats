"use client";

import Link from "next/link";
import { Sparkles, Compass, Flag } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function WelcomeArticle() {
  return (
    <ArticleLayout
      title="Welcome to IxStats"
      description="Your gateway to building, managing, and growing a nation. Here's everything you need to get started."
      icon={Sparkles}
      nextLink={{ href: "/help/getting-started/navigation", label: "Finding Your Way Around" }}
    >
      <ContentCard>
        <Section title="What's New in v2">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Faster, Smoother Experience:</strong> Major platform upgrades deliver quicker
              load times, snappier interactions, and a more polished feel across every page.
            </li>
            <li>
              <strong>Cards & Vault:</strong> A full trading card system with pack opening,
              marketplace auctions, lore cards, and an{" "}
              <Link
                href="/help/vault/ixcredits"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                IxCredits
              </Link>{" "}
              economy.
            </li>
            <li>
              <strong>Elections & Politics:</strong> Political parties, legislature configuration,
              and proportional representation elections you can run from your{" "}
              <Link
                href="/help/mycountry/politics"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Politics
              </Link>{" "}
              dashboard.
            </li>
            <li>
              <strong>National Issues:</strong> Events that appear based on your nation&rsquo;s
              conditions, each with multiple-choice responses and real consequences for your
              country.
            </li>
            <li>
              <strong>Hundreds of Components:</strong> Over 500 pieces of military equipment, 100+
              diplomatic scenarios, and a fully dynamic content library that keeps growing.
            </li>
          </ul>
        </Section>

        <Section title="Three Things You Can Do Today">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Claim or create a nation and explore the{" "}
              <Link href="/mycountry" className="text-blue-600 hover:underline dark:text-blue-400">
                MyCountry
              </Link>{" "}
              command suite for executive dashboards, intelligence, and diplomacy.
            </li>
            <li>
              Browse live economic, diplomatic, and social data through the{" "}
              <Link href="/dashboard" className="text-blue-600 hover:underline dark:text-blue-400">
                Dashboard
              </Link>
              ,{" "}
              <Link
                href="/leaderboards"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Leaderboards
              </Link>
              , and{" "}
              <Link href="/thinkpages" className="text-blue-600 hover:underline dark:text-blue-400">
                ThinkPages
              </Link>
              .
            </li>
            <li>
              Collaborate with other players using achievements, ThinkShare messaging, and this
              in-app help center.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Key Destinations">
          <InfoBox title="Start Exploring">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <Link
                  href="/mycountry"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  <strong>MyCountry</strong>
                </Link>{" "}
                -- your nation&rsquo;s home base for intelligence, compliance, defense, and
                analytics.
              </li>
              <li>
                <Link href="/builder" className="text-blue-600 hover:underline dark:text-blue-400">
                  <strong>Country Builder</strong>
                </Link>{" "}
                -- configure your nation with over 100 government, economic, and tax components.
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  <strong>Global Dashboard</strong>
                </Link>{" "}
                -- leaderboards, global stats, and live economic data at a glance.
              </li>
              <li>
                <Link href="/help" className="text-blue-600 hover:underline dark:text-blue-400">
                  <strong>Help Center</strong>
                </Link>{" "}
                -- guides and articles covering every feature on the platform.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Next Steps">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Visit{" "}
              <Link
                href="/help/getting-started/first-country"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Creating Your First Country
              </Link>{" "}
              to walk through the builder workflow step by step.
            </li>
            <li>
              Take the{" "}
              <Link
                href="/help/getting-started/navigation"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Interface Tour
              </Link>{" "}
              to learn about navigation, quick actions, and live feeds.
            </li>
            <li>
              Bookmark the{" "}
              <Link href="/help" className="text-blue-600 hover:underline dark:text-blue-400">
                Help Center
              </Link>{" "}
              -- every major feature has its own guide, and new articles are added regularly.
            </li>
          </ul>
        </Section>

        <Section title="Need Help?">
          <InfoBox title="Support Channels">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <Compass className="inline h-4 w-4" /> Explore the rest of the{" "}
                <Link
                  href="/help/getting-started/gameplay-overview"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Getting Started
                </Link>{" "}
                series for gameplay tips and walkthroughs.
              </li>
              <li>
                <Flag className="inline h-4 w-4" /> Reach out to admins via ThinkShare or the
                project Discord for account issues.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>
    </ArticleLayout>
  );
}
