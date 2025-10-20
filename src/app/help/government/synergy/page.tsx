"use client";

import { Link2, Scale, AlertTriangle } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function ComponentSynergyArticle() {
  return (
    <ArticleLayout
      title="Component Synergies"
      description="Identify combinations that unlock bonuses or conflicts within the atomic government system."
      icon={Link2}
    >
      <Section title="Reading Effectiveness">
        <ul className="list-disc pl-6 space-y-2">
          <li>Effectiveness scores aggregate collection efficiency, compliance rate, administrative cost, and economic impact.</li>
          <li>Synergies add modifiers when compatible components coexist; conflicts reduce scores or trigger compliance alerts.</li>
          <li>Data comes from `AtomicGovernmentComponents` metadata and is surfaced in MyCountry analytics.</li>
        </ul>
      </Section>

      <Section title="Workflow">
        <InfoBox title="Evaluate Combos">
          <ol className="list-decimal pl-6 space-y-1">
            <li>Select base components in the builder/editor.</li>
            <li>Review synergy/conflict badges in the selection panel.</li>
            <li>Check MyCountry analytics for resulting score changes and compliance notes.</li>
          </ol>
        </InfoBox>
      </Section>

      <WarningBox title="Keep in Mind">
        <ul className="list-disc pl-6 space-y-1">
          <li><Scale className="inline h-4 w-4" /> Balance effectiveness with narrative goals; dramatic conflicts can be intentional.</li>
          <li><AlertTriangle className="inline h-4 w-4" /> Update `/help/government/components` when adding new synergies to document best practices.</li>
        </ul>
      </WarningBox>
    </ArticleLayout>
  );
}
