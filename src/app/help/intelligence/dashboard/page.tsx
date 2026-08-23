import Link from "next/link";
import { Dashboard as LayoutDashboard, Archery as Radar, Globe, Compass } from "iconoir-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function IntelligenceDashboardArticle() {
  return (
    <ArticleLayout
      title="Executive Intelligence Dashboard"
      description="Your central command post for monitoring your nation's health, spotting emerging threats, and seizing opportunities at a glance."
      icon={LayoutDashboard}
    >
      <ContentCard>
        <Section title="What the Dashboard Shows You">
          <p className="mb-4">
            The Intelligence Dashboard is your first stop when you log in. It brings together
            everything you need to know about your nation into a single, easy-to-read view. Navigate
            to it from <strong>MyCountry &rarr; Intelligence</strong> in your sidebar.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Vitality Scores:</strong> At-a-glance health ratings for your economy,
              population, diplomacy, security, and social well-being. These scores update
              automatically as your nation evolves.
            </li>
            <li>
              <strong>Hot Issues &amp; Opportunities:</strong> A prioritized feed of urgent matters
              that need your attention and favorable developments you can capitalize on.
            </li>
            <li>
              <strong>Embassy &amp; Mission Status:</strong> Quick-view cards showing the state of
              your diplomatic relationships and active missions abroad.
            </li>
          </ul>
        </Section>

        <Section title="How to Use It">
          <InfoBox title="Tips for Getting the Most Out of Your Dashboard">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                Start each session here to review new alerts, compliance tasks, and quick wins
                before diving into other areas.
              </li>
              <li>
                Use the action buttons on each card to jump directly into related areas -- schedule
                a meeting, draft a policy, or respond to a diplomatic event without leaving context.
              </li>
              <li>
                Flag important metrics in ThinkPages posts to track how storylines evolve over time.
              </li>
              <li>
                Your dashboard updates in real time, so you can keep it open during active play
                sessions to stay informed as events unfold.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Personalizing Your View">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Pin the metrics that matter most to you so they always appear at the top of your
              dashboard.
            </li>
            <li>
              Use the Intelligence Settings tab to configure which alert types appear in your feed
              and set custom thresholds for notifications.
            </li>
            <li>
              Pair dashboard insights with ThinkPages research posts to document cause and effect
              across your nation&apos;s history.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Radar className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/metrics"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Key Metrics &amp; Indicators
              </Link>{" "}
              -- deep dive into what each score means and how to act on it.
            </li>
            <li>
              <Globe className="inline h-4 w-4" />{" "}
              <Link
                href="/help/diplomacy/embassies"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Embassies &amp; Diplomacy
              </Link>{" "}
              -- learn how your diplomatic network feeds into your intelligence picture.
            </li>
            <li>
              <Compass className="inline h-4 w-4" />{" "}
              <Link
                href="/help/mycountry/intelligence"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                MyCountry Intelligence Guide
              </Link>{" "}
              -- full walkthrough of the Intelligence section.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
