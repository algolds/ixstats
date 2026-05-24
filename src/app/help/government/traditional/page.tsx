"use client";

import Link from "next/link";
import { Building, Gavel, Users } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function TraditionalGovernmentArticle() {
  return (
    <ArticleLayout
      title="Traditional Government Builder"
      description="Pick familiar government structures — executive, legislative, and judicial types — and combine them with atomic components for a fully custom nation."
      icon={Building}
    >
      <ContentCard>
        <Section title="What Is the Traditional Builder?">
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            The Traditional Government Builder gives you a straightforward way to define your
            country{"'"}s government using classic, recognizable structures. If you{"'"}re more
            comfortable thinking in terms of presidents, parliaments, and courts than individual
            policy components, this is the place to start.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Choose your executive type (e.g., presidential, parliamentary, monarchical), your
              legislative body, and your judicial system during the setup process.
            </li>
            <li>
              Your traditional choices create a quick summary that other players see on your country
              profile, making it easy to understand your government at a glance.
            </li>
            <li>
              You can mix these traditional selections with{" "}
              <Link
                href="/help/government/atomic"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Atomic Components
              </Link>{" "}
              to build unique hybrid governments that go beyond the standard archetypes.
            </li>
          </ul>
        </Section>

        <Section title="Setting Up Your Government">
          <InfoBox title="How to Use the Builder">
            <ol className="list-decimal space-y-1 pl-6">
              <li>Open the Country Builder and navigate to the Government step.</li>
              <li>
                Set your government type, leadership titles, and descriptions for each branch.
              </li>
              <li>
                Fill in optional details like your national motto or founding events to make your
                country richer — these also sync with your IxWiki page if you have one.
              </li>
              <li>Use the Review step to preview everything before saving.</li>
            </ol>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="After You Save">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Your MyCountry Government tab shows your selections along with any policy levers
              connected to them.
            </li>
            <li>
              ThinkPages posts from your country are automatically tagged with your governance type,
              making them easier for other players to find.
            </li>
            <li>
              You can return to the builder at any time to update your government as your country
              evolves — the same forms are used for both creation and editing.
            </li>
          </ul>
        </Section>

        <Section title="Learn More">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Gavel className="inline h-4 w-4" />{" "}
              <Link
                href="/help/government/atomic"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Atomic Government System
              </Link>{" "}
              — combine traditional structures with granular components for deeper mechanics.
            </li>
            <li>
              <Users className="inline h-4 w-4" />{" "}
              <Link
                href="/help/government/components"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Government Components Guide
              </Link>{" "}
              — explore every component you can add to your government.
            </li>
            <li>
              <Link
                href="/help/gameplay/country-building"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Country Building Guide
              </Link>{" "}
              — see how government fits into the full country creation process.
            </li>
          </ul>
        </Section>
      </ContentCard>
    </ArticleLayout>
  );
}
