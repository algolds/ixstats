"use client";

import { Building, Gavel, Users } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function TraditionalGovernmentArticle() {
  return (
    <ArticleLayout
      title="Traditional Government Builder"
      description="Configure classic government structures alongside the atomic system."
      icon={Building}
    >
      <Section title="Overview">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Select executive, legislative, and judicial archetypes during the builder workflow.
          </li>
          <li>
            Traditional choices feed into quick summaries and help players align with familiar
            governance models.
          </li>
          <li>
            Mix with atomic components to capture unique hybrids while keeping onboarding
            approachable.
          </li>
        </ul>
      </Section>

      <Section title="Configuration Tips">
        <InfoBox title="Within the Builder">
          <ul className="list-disc space-y-1 pl-6">
            <li>Set government type, leadership titles, and branch descriptions.</li>
            <li>Use optional fields (motto, founding events) to enrich wiki sync.</li>
            <li>Preview results instantly inside the Review step.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="After Creation">
        <ul className="list-disc space-y-2 pl-6">
          <li>MyCountry Government tab displays the selections with relevant policy levers.</li>
          <li>ThinkPages automatically tags posts with governance metadata for search.</li>
          <li>Adjustments can be made through the editor route with the same forms.</li>
        </ul>
      </Section>

      <InfoBox title="Related Material">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Gavel className="inline h-4 w-4" /> `docs/systems/builder.md` – builder step details.
          </li>
          <li>
            <Users className="inline h-4 w-4" /> `/help/government/atomic` – combine with atomic
            components for deeper mechanics.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
