import Link from "next/link";
import { Medal, BarChart3, TrendingUp, Users } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function LeaderboardsArticle() {
  return (
    <ArticleLayout
      title="Leaderboards & Rankings"
      description="GDP, population, achievements, and diplomatic influence rankings across all nations."
      icon={Medal}
    >
      <ContentCard>
        <Section title="Leaderboard Categories">
          <p>
            The leaderboard system ranks all nations across five competitive metrics. Access the
            Leaderboards page from the main navigation.
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <TrendingUp className="inline h-4 w-4 text-emerald-500" /> <strong>Total GDP:</strong>{" "}
              Absolute economic output — larger nations with higher populations and productivity
              rank higher
            </li>
            <li>
              <strong>GDP Per Capita:</strong> Economic output per person — measures prosperity and
              economic efficiency regardless of population size
            </li>
            <li>
              <Users className="inline h-4 w-4 text-blue-500" /> <strong>Population:</strong> Total
              population count across all demographics
            </li>
            <li>
              <strong>Achievements:</strong> Total achievement score based on number and rarity of
              unlocked achievements
            </li>
            <li>
              <BarChart3 className="inline h-4 w-4 text-purple-500" />{" "}
              <strong>Diplomatic Influence:</strong> Composite score from embassy count, alliance
              memberships, relationship quality, and international standing
            </li>
          </ul>
        </Section>

        <Section title="How Rankings Work">
          <InfoBox title="Ranking System">
            <ul className="list-disc space-y-1 pl-6">
              <li>Rankings are computed from live data when the page loads</li>
              <li>Data is cached for a few minutes for performance</li>
              <li>Your nation&apos;s position is highlighted in the ranking table</li>
              <li>Click any country entry to navigate to their full profile page</li>
              <li>Sorting toggles between ascending and descending order per metric</li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Dashboard Integration">
          <p>
            Leaderboard highlights also appear on the main Dashboard, showing your current rank and
            nearby competitors in each category. This provides at-a-glance competitive context
            without navigating to the full leaderboard page.
          </p>
        </Section>

        <Section title="Competitive Gameplay">
          <p>Leaderboards drive competitive gameplay by providing clear goals:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>Track your nation&apos;s progress relative to others over time</li>
            <li>Identify areas where your nation excels or needs improvement</li>
            <li>Compete for top positions in specific categories</li>
            <li>Certain leaderboard positions may trigger achievement unlocks</li>
          </ul>
        </Section>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/gameplay/achievements"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Achievements &amp; Progression
              </Link>{" "}
              — Achievement system and rewards
            </li>
            <li>
              <Link
                href="/help/economy/tiers"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Economic Tiers
              </Link>{" "}
              — Economic tier system affecting GDP rankings
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
