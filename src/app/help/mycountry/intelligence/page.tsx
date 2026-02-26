"use client";

import { Brain, BarChart3, Search, Bell } from "lucide-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function MyCountryIntelligenceArticle() {
  return (
    <ArticleLayout
      title="MyCountry Intelligence"
      description="Analytics dashboard, analysis panels, and key findings for data-driven decision making."
      icon={Brain}
    >
      <ContentCard>
        <Section title="Intelligence Tab Layout">
          <p>
            The Intelligence section is purely analytical — it presents data visualizations and
            insights rather than action queues. Three tabs organize the intelligence:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li><strong>Dashboard:</strong> Executive-level intelligence summary with vitality rings</li>
            <li><strong>Analysis:</strong> Deep-dive panels for economic, diplomatic, and policy analysis</li>
            <li><strong>Reports:</strong> Key findings and prioritized intelligence reports</li>
          </ul>
        </Section>

        <Section title="Dashboard Tab">
          <p>
            The intelligence dashboard provides a quick health check with four vitality rings:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li><strong>Security Score:</strong> Overall security assessment from defense and stability data</li>
            <li><strong>Active Alerts:</strong> Number of unresolved intelligence alerts requiring attention</li>
            <li><strong>Embassy Coverage:</strong> Percentage of important nations with active embassies</li>
            <li><strong>Intelligence Score:</strong> Composite score from all intelligence sources</li>
          </ul>
        </Section>

        <Section title="Analysis Tab">
          <InfoBox title="Analysis Panels">
            <p>
              The Analysis tab contains three specialized panels:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <BarChart3 className="inline h-4 w-4" />{" "}
                <strong>Economic Analysis:</strong> GDP trends, sector performance, trade balance
                projections, and comparative economic indicators
              </li>
              <li>
                <Search className="inline h-4 w-4" />{" "}
                <strong>Diplomatic Analysis:</strong> Relationship trends over time, network
                visualization, alliance health metrics
              </li>
              <li>
                <Bell className="inline h-4 w-4" />{" "}
                <strong>Policy Analysis:</strong> Policy effectiveness scoring, simulation of
                proposed policies, impact predictions
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Key Findings Panel">
          <p>
            The Reports tab surfaces prioritized intelligence findings. Each finding includes a
            severity level, affected domain, recommended actions, and source data. Findings are
            auto-generated from economic shifts, diplomatic events, and defense assessments.
          </p>
        </Section>

        <Section title="Alert Configuration">
          <p>
            Access Alert Threshold Settings from the intelligence sidebar to customize when and
            how you receive intelligence notifications. Configure thresholds for economic indicators,
            diplomatic relationship changes, and security events.
          </p>
        </Section>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li><Link href="/help/intelligence/dashboard" className="text-blue-600 hover:underline dark:text-blue-400">Intelligence Dashboard</Link>{" "} — Executive intelligence dashboard details</li>
            <li><Link href="/help/intelligence/alerts" className="text-blue-600 hover:underline dark:text-blue-400">Alerts & Notifications</Link>{" "} — Alert and notification management</li>
            <li><Link href="/help/intelligence/forecasting" className="text-blue-600 hover:underline dark:text-blue-400">Forecasting & Predictions</Link>{" "} — Predictive analytics and forecasting</li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
