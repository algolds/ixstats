"use client";

import { Sword, Wrench, ClipboardList } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function DefenseUnitsArticle() {
  return (
    <ArticleLayout
      title="Military Units & Assets"
      description="Track force composition, maintenance schedules, and upgrade paths."
      icon={Sword}
    >
      <Section title="Asset Management">
        <ul className="list-disc pl-6 space-y-2">
          <li>Maintain inventory of ground, naval, air, and special capability units.</li>
          <li>Use readiness metrics to spot under-maintained assets.</li>
          <li>Link assets to SDI modules for strategic readiness scoring.</li>
        </ul>
      </Section>

      <Section title="Where to Update">
        <InfoBox title="Tools">
          <ul className="list-disc pl-6 space-y-1">
            <li>Defense tab components (`src/app/mycountry/defense`).</li>
            <li>Routers: `api.sdi.updateModule`, `api.security.updateAssetStatus`.</li>
            <li>Documentation: `docs/systems/defense.md`.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Best Practices">
        <ul className="list-disc pl-6 space-y-2">
          <li>Schedule maintenance via quick actions with reminders surfaced in compliance.</li>
          <li>Annotate major upgrades in ThinkPages to capture narrative context.</li>
          <li>Coordinate with economic planners when upgrades affect budgets.</li>
        </ul>
      </Section>

      <InfoBox title="Reference">
        <ul className="list-disc pl-6 space-y-1">
          <li><Wrench className="inline h-4 w-4" /> `src/components/defense` – modular widgets and editors.</li>
          <li><ClipboardList className="inline h-4 w-4" /> `/help/defense/customization` – tailoring modules to mission needs.</li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
