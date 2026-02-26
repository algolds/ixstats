"use client";

import { LayoutDashboard, Activity, BarChart3, Target } from "lucide-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function MyCountryOverviewArticle() {
  return (
    <ArticleLayout
      title="National Overview"
      description="Real-time vitality rings, metrics grid, and sector breakdown for your nation at a glance."
      icon={LayoutDashboard}
    >
      <ContentCard>
        <Section title="What the Overview Shows">
          <p>
            The Overview tab is your nation&apos;s real-time monitoring dashboard. It provides a
            snapshot of your country&apos;s health across all domains without any action queues or
            decision-making — that happens in the other MyCountry sections.
          </p>
        </Section>

        <Section title="Vitality Rings">
          <p>
            Four animated rings at the top of the page show overall health scores (0-100):
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Economic Health:</strong> GDP growth, debt ratio, trade balance, and sector
              diversity combined into a single score.
            </li>
            <li>
              <strong>Social Stability:</strong> Population growth, literacy, healthcare access, and
              public satisfaction metrics.
            </li>
            <li>
              <strong>Diplomatic Strength:</strong> Embassy count, relationship quality, alliance
              network, and international standing.
            </li>
            <li>
              <strong>Defense Readiness:</strong> Military readiness, equipment maintenance, security
              score, and threat assessment.
            </li>
          </ul>
        </Section>

        <Section title="Metrics Grid">
          <InfoBox title="Clickable Metric Cards">
            <p>
              The metrics grid displays key indicators like GDP, population, growth rate, and debt.
              Each card is clickable and opens a drill-down modal with four tabs:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Overview:</strong> Current value with context and key factors
              </li>
              <li>
                <strong>Trends:</strong> Historical charts showing change over time
              </li>
              <li>
                <strong>Comparison:</strong> How your country ranks against others
              </li>
              <li>
                <strong>Details:</strong> Detailed breakdown of contributing factors
              </li>
            </ul>
          </InfoBox>
          <p className="mt-3">
            Available drill-down modals: GDP, Population, Labor, Government Spending, Debt, and
            Demographics Health.
          </p>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Sector Breakdown">
          <p>
            Below the metrics grid, sector breakdown cards show the distribution of your economy
            across primary, secondary, and tertiary sectors, along with government spending allocation
            across categories like education, healthcare, defense, and infrastructure.
          </p>
        </Section>

        <Section title="Sidebar Widgets">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Activity className="inline h-4 w-4 text-amber-500" />{" "}
              <strong>National Issues Banner:</strong> Shows pending issue count with urgency coloring.
              Click to navigate to the Executive section.
            </li>
            <li>
              <BarChart3 className="inline h-4 w-4 text-cyan-500" />{" "}
              <strong>Vault Widget:</strong> Displays your IxCredits balance and vault level.
            </li>
            <li>
              <Target className="inline h-4 w-4 text-purple-500" />{" "}
              <strong>Quick Actions:</strong> Shortcuts to frequently used features across all
              MyCountry sections.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li><Link href="/help/mycountry/executive" className="text-blue-600 hover:underline dark:text-blue-400">Executive Command Center</Link>{" "} — Executive command and decision-making</li>
            <li><Link href="/help/economy/tiers" className="text-blue-600 hover:underline dark:text-blue-400">Economic Tiers</Link>{" "} — Economic tier system and growth modeling</li>
            <li><Link href="/help/vault/ixcredits" className="text-blue-600 hover:underline dark:text-blue-400">IxCredits Economy</Link>{" "} — IxCredits economy</li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
