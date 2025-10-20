"use client";

import { ShieldAlert, AlertOctagon, LayoutList } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function PoliticalStabilityArticle() {
  return (
    <ArticleLayout
      title="Political Stability"
      description="Monitor internal security, civil unrest, and early warning indicators."
      icon={ShieldAlert}
    >
      <Section title="Stability Indicators">
        <ul className="list-disc pl-6 space-y-2">
          <li>Metrics derive from `stability-formulas.ts`, social sentiment, and economic shocks.</li>
          <li>Compliance tasks fire when thresholds are crossed (e.g., protests, strikes, coup risk).</li>
          <li>Outputs feed into intelligence alerts and defense readiness scores.</li>
        </ul>
      </Section>

      <Section title="What to Watch">
        <InfoBox title="Dashboards">
          <ul className="list-disc pl-6 space-y-1">
            <li>MyCountry Executive overview – highlights top stability risks.</li>
            <li>Defense tab – ties stability to crisis scenarios.</li>
            <li>ThinkPages – track narratives and mitigation plans.</li>
          </ul>
        </InfoBox>
      </Section>

      <WarningBox title="Operational Advice">
        <ul className="list-disc pl-6 space-y-1">
          <li><AlertOctagon className="inline h-4 w-4" /> Respond quickly; schedule policy or social interventions via quick actions.</li>
          <li><LayoutList className="inline h-4 w-4" /> Document context in compliance notes for audit trails.</li>
        </ul>
      </WarningBox>
    </ArticleLayout>
  );
}
