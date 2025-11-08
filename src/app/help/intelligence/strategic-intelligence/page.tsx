"use client";

import { Radar, Globe, Shield } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function StrategicIntelligenceArticle() {
  return (
    <ArticleLayout
      title="Strategic Intelligence"
      description="Dive into long-term intelligence products for campaign planning and crisis prevention."
      icon={Radar}
    >
      <Section title="Strategic Products">
        <ul className="list-disc space-y-2 pl-6">
          <li>Quarterly assessments summarising economic, diplomatic, and defense outlooks.</li>
          <li>Scenario plans linking forecasts with recommended policy paths.</li>
          <li>Cross-domain alerts for potential cascading risks.</li>
        </ul>
      </Section>

      <Section title="Where to Access">
        <InfoBox title="Locations">
          <ul className="list-disc space-y-1 pl-6">
            <li>Intelligence & Diplomacy page – Access via MyCountry dropdown, then select the Intelligence Feed tab for strategic briefings.</li>
            <li>ThinkPages collections curated for leadership briefings.</li>
            <li>
              Exports via scripts (see `scripts/audit` for inspiration) when generating off-platform
              reports.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Maintaining Strategic Feeds">
        <ul className="list-disc space-y-2 pl-6">
          <li>Ensure new data pipelines write into the unified router payloads.</li>
          <li>Tag strategic posts and docs so they appear in curated lists.</li>
          <li>Keep `/help/intelligence/dashboard` aligned with strategic card changes.</li>
        </ul>
      </Section>

      <InfoBox title="Cross-References">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Globe className="inline h-4 w-4" /> `/help/diplomacy/embassies` – diplomacy factors.
          </li>
          <li>
            <Shield className="inline h-4 w-4" /> `/help/defense/overview` – defense readiness.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
