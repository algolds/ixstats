import Link from "next/link";
import { GaugeCircle, BarChart2, BellRing } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function IntelligenceMetricsArticle() {
  return (
    <ArticleLayout
      title="Key Metrics & Indicators"
      description="Understand the numbers behind your nation's intelligence system and learn how to use them to make smarter decisions."
      icon={GaugeCircle}
    >
      <ContentCard>
        <Section title="What Your Metrics Mean">
          <p className="mb-4">
            Your intelligence system tracks dozens of indicators across every aspect of your nation.
            These are organized into three main families so you can quickly assess where things
            stand and where action is needed.
          </p>
          <ul className="list-disc space-y-3 pl-6">
            <li>
              <strong>Vitality Scores:</strong> Five core health ratings that reflect how your
              nation is performing right now:
              <ul className="mt-1 list-disc space-y-1 pl-6 text-sm">
                <li>
                  <strong>Economic:</strong> GDP growth, trade balance, and fiscal health.
                </li>
                <li>
                  <strong>Population:</strong> Growth rate, demographics, and social stability.
                </li>
                <li>
                  <strong>Diplomatic:</strong> Relationship strength, active treaties, and global
                  standing.
                </li>
                <li>
                  <strong>Security:</strong> Military readiness, internal stability, and threat
                  levels.
                </li>
                <li>
                  <strong>Social:</strong> Public satisfaction, cultural development, and quality of
                  life.
                </li>
              </ul>
            </li>
            <li>
              <strong>Risk &amp; Opportunity Index:</strong> A dynamic score that highlights
              emerging threats and favorable conditions based on your diplomatic missions, economic
              trends, and recent events. When this index spikes, pay attention -- something
              significant is developing.
            </li>
            <li>
              <strong>Compliance Radar:</strong> Tracks overdue tasks, upcoming milestones, and
              scheduled reviews. This keeps you on top of deadlines so nothing slips through the
              cracks.
            </li>
          </ul>
        </Section>

        <Section title="How Metrics Are Calculated">
          <InfoBox title="Behind the Numbers">
            <p className="mb-2">
              Your metrics are calculated automatically from your nation&apos;s live data. The
              system analyzes your economic performance, diplomatic relationships, military posture,
              and social indicators to produce composite scores.
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Scores update in real time as your nation&apos;s situation changes.</li>
              <li>
                Historical data is preserved so you can track trends and see how your decisions have
                affected outcomes over time.
              </li>
              <li>
                Each metric includes contextual details -- click any score to see what&apos;s
                driving it up or down.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Acting on Your Metrics">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Pair trends with research:</strong> When you notice a metric shifting, create
              a ThinkPages post to document the cause and your planned response. This builds a
              valuable record of your nation&apos;s history.
            </li>
            <li>
              <strong>Set alert thresholds:</strong> Configure alerts so you&apos;re automatically
              notified when key scores dip below (or rise above) levels you care about.
            </li>
            <li>
              <strong>Use quick actions:</strong> When a vitality score drops, use the action
              buttons on the metric card to jump straight into a policy draft, diplomatic outreach,
              or defense adjustment.
            </li>
            <li>
              <strong>Share highlights:</strong> During multiplayer sessions, share notable metrics
              through achievements or ThinkPages announcements to coordinate with allies.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <BellRing className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/alerts"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Alerts &amp; Notifications
              </Link>{" "}
              -- how to respond when your metrics trigger warnings.
            </li>
            <li>
              <BarChart2 className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/dashboard"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Executive Intelligence Dashboard
              </Link>{" "}
              -- where all your metrics come together in one view.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
