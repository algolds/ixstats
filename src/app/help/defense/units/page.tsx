import Link from "next/link";
import { Tournament as Sword, Wrench, TaskList as ClipboardList } from "iconoir-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function DefenseUnitsArticle() {
  return (
    <ArticleLayout
      title="Military Units & Assets"
      description="Track force composition, maintenance schedules, and upgrade paths."
      icon={Sword}
    >
      <ContentCard>
        <Section title="Asset Management">
          <ul className="list-disc space-y-2 pl-6">
            <li>Maintain inventory of ground, naval, air, and special capability units.</li>
            <li>Use readiness metrics to spot under-maintained assets.</li>
            <li>Link assets to unified intelligence modules for strategic readiness scoring.</li>
          </ul>
        </Section>

        <Section title="Where to Manage Units">
          <InfoBox title="Tools">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                Go to <strong>MyCountry &rarr; Defense</strong> to manage your units.
              </li>
              <li>Use the unit editor to adjust composition, equipment, and readiness.</li>
              <li>Track maintenance schedules and upgrade paths from the unit dashboard.</li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Best Practices">
          <ul className="list-disc space-y-2 pl-6">
            <li>Schedule maintenance via quick actions with reminders surfaced in compliance.</li>
            <li>Annotate major upgrades in ThinkPages to capture narrative context.</li>
            <li>Coordinate with economic planners when upgrades affect budgets.</li>
          </ul>
        </Section>

        <InfoBox title="Reference">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Wrench className="inline h-4 w-4" />{" "}
              <Link
                href="/help/defense/equipment"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Equipment Catalog
              </Link>{" "}
              — browse 500+ equipment items.
            </li>
            <li>
              <ClipboardList className="inline h-4 w-4" />{" "}
              <Link
                href="/help/defense/customization"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Force Customization
              </Link>{" "}
              — tailoring modules to mission needs.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
