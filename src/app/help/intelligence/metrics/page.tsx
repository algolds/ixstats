"use client";

import { GaugeCircle, BarChart2, Activity } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function IntelligenceMetricsArticle() {
  return (
    <ArticleLayout
      title="Key Metrics & Indicators"
      description="Understand the metrics that power intelligence decisions and how they're calculated."
      icon={GaugeCircle}
    >
      <Section title="Metric Families">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Vitality Scores:</strong> Economic, population, diplomatic, security, social.
          </li>
          <li>
            <strong>Risk & Opportunity Index:</strong> Derived from notifications, missions, and
            economic signals.
          </li>
          <li>
            <strong>Compliance Radar:</strong> Tracks overdue tasks and upcoming milestones.
          </li>
        </ul>
      </Section>

      <Section title="Where They Come From">
        <InfoBox title="Data Sources">
          <ul className="list-disc space-y-1 pl-6">
            <li>`api.intelligence.getExecutiveDashboard` – primary metric payload.</li>
            <li>`vitality-calculator.ts` & `intelligence-calculator.ts` – calculation logic.</li>
            <li>Historical metrics stored under `CountryIntelligence` tables.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Using Metrics Effectively">
        <ul className="list-disc space-y-2 pl-6">
          <li>Pair metric trends with ThinkPages research to document cause and effect.</li>
          <li>Trigger quick actions when scores dip below thresholds.</li>
          <li>Share highlights during multiplayer sessions using achievements or announcements.</li>
        </ul>
      </Section>

      <InfoBox title="Further Reading">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <BarChart2 className="inline h-4 w-4" /> `docs/systems/intelligence.md` – formulas &
            integrations.
          </li>
          <li>
            <Activity className="inline h-4 w-4" /> `/help/intelligence/alerts` – responding to
            metric-driven alerts.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
