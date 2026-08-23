import Link from "next/link";
import { Cpu as CircuitBoard, Dashboard as LayoutDashboard, Dashboard as GaugeCircle, BellNotification as BellRing, Compass } from "iconoir-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function IntelligenceSystemOverviewArticle() {
  return (
    <ArticleLayout
      title="Intelligence System Overview"
      description="Your nation's intelligence system brings together economic analysis, diplomatic monitoring, defense assessment, and policy analytics into one powerful command center."
      icon={CircuitBoard}
    >
      <ContentCard>
        <Section title="What the Intelligence System Does for You">
          <p className="mb-4">
            Running a nation means juggling many moving pieces at once. Your intelligence system is
            designed to pull all of that information together so you can see the big picture without
            switching between dozens of screens. It continuously monitors every aspect of your
            nation and presents the most important findings in a unified, easy-to-navigate
            interface.
          </p>
          <p className="mb-4">
            Think of it as your nation&apos;s central nervous system -- it watches, analyzes, and
            alerts you so you can focus on making decisions rather than hunting for data.
          </p>
        </Section>

        <Section title="What Each Area Covers">
          <ul className="list-disc space-y-3 pl-6">
            <li>
              <strong>Economic Analysis:</strong> Tracks your GDP, trade performance, fiscal health,
              and sector breakdowns. Spots trends in your economic data and alerts you to changes
              that need attention, from budget shortfalls to trade surpluses.
            </li>
            <li>
              <strong>Diplomatic Monitoring:</strong> Keeps tabs on your relationships with other
              nations, embassy network health, active missions, and treaty obligations. Highlights
              when relationships are strengthening or cooling.
            </li>
            <li>
              <strong>Defense Assessment:</strong> Evaluates your military readiness, internal
              stability, and security threats. Reports on force deployment status and flags
              potential vulnerabilities.
            </li>
            <li>
              <strong>Policy Analytics:</strong> Measures the effectiveness of your active policies,
              tracks their impact over time, and suggests adjustments based on current conditions.
              Helps you see whether your decisions are producing the results you intended.
            </li>
          </ul>
        </Section>

        <Section title="Where to Find It">
          <InfoBox title="Navigating Your Intelligence System">
            <p className="mb-2">
              Your intelligence system is organized into tabs within the{" "}
              <strong>MyCountry &rarr; Intelligence</strong> section:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Dashboard:</strong> Your executive overview with vitality scores, hot
                issues, and action items.
              </li>
              <li>
                <strong>Economic:</strong> Detailed GDP and sector analytics with trend charts.
              </li>
              <li>
                <strong>Diplomatic:</strong> Relationship trends, network visualization, and
                diplomacy health scores.
              </li>
              <li>
                <strong>Policy:</strong> Effectiveness analysis and impact simulations for your
                active policies.
              </li>
              <li>
                <strong>Forecasting:</strong> Forward-looking predictions and scenario modeling.
              </li>
              <li>
                <strong>Settings:</strong> Configure your alert thresholds, notification
                preferences, and display options.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Getting the Most from Your Intelligence">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Start with the Dashboard:</strong> Each session, begin at the executive
              dashboard for a quick status check before diving into specific areas.
            </li>
            <li>
              <strong>Follow the alerts:</strong> When your intelligence system flags something,
              follow the alert to its source for full context and recommended actions.
            </li>
            <li>
              <strong>Cross-reference domains:</strong> The real power of unified intelligence is
              seeing how economic, diplomatic, and defense factors connect. A diplomatic breakdown
              might explain an economic dip -- or vice versa.
            </li>
            <li>
              <strong>Track over time:</strong> Use historical data and ThinkPages posts to build a
              record of how events unfolded and how your responses worked out.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <LayoutDashboard className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/dashboard"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Executive Intelligence Dashboard
              </Link>{" "}
              -- your daily starting point for nation management.
            </li>
            <li>
              <GaugeCircle className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/metrics"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Key Metrics &amp; Indicators
              </Link>{" "}
              -- understand what each score means and how to act on it.
            </li>
            <li>
              <BellRing className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/alerts"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Alerts &amp; Notifications
              </Link>{" "}
              -- manage the warnings and updates your intelligence system sends you.
            </li>
            <li>
              <Compass className="inline h-4 w-4" />{" "}
              <Link
                href="/help/mycountry/intelligence"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                MyCountry Intelligence Guide
              </Link>{" "}
              -- step-by-step guide to the full Intelligence section.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
