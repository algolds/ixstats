"use client";

import Link from "next/link";
import { Link2, Scale, AlertTriangle, Sparkles } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox, ContentCard } from "../../_components/ArticleLayout";

export default function ComponentSynergyArticle() {
  return (
    <ArticleLayout
      title="Component Synergies"
      description="Learn how picking the right combination of government components can unlock bonuses — or create conflicts that drag your effectiveness down."
      icon={Link2}
    >
      <ContentCard>
        <Section title="How Synergies Work">
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            Every government component you choose carries traits that interact with other components in
            your setup. When two components complement each other, you earn a <strong>synergy bonus</strong> that
            boosts your overall effectiveness score. When they clash, you get a <strong>conflict penalty</strong> that
            lowers it.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Your effectiveness score reflects how well your government collects revenue, maintains
              compliance, controls administrative costs, and drives economic growth.
            </li>
            <li>
              <Sparkles className="inline h-4 w-4" /> Compatible components trigger synergy badges
              in the builder, giving you a preview of the bonus before you commit.
            </li>
            <li>
              Conflicting components trigger warning badges, so you can decide whether the trade-off
              is worth it for your country{"'"}s story.
            </li>
          </ul>
        </Section>

        <Section title="Spotting Synergies in the Builder">
          <InfoBox title="Step by Step">
            <ol className="list-decimal space-y-1 pl-6">
              <li>
                Open the{" "}
                <Link href="/help/government/components" className="text-blue-600 hover:underline dark:text-blue-400">
                  Government Components
                </Link>{" "}
                section of the builder and start selecting your components.
              </li>
              <li>
                Watch for green synergy badges and red conflict badges that appear next to each
                component as you build your combination.
              </li>
              <li>
                Check the live effectiveness preview to see how your total score changes with each
                addition.
              </li>
              <li>
                After saving, visit your MyCountry dashboard to track how synergies affect your
                government performance over time.
              </li>
            </ol>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <WarningBox title="Tips and Trade-offs">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Scale className="inline h-4 w-4" /> A high effectiveness score is powerful, but
              intentional conflicts can make for a more interesting and dramatic country. Balance
              gameplay strategy with the story you want to tell.
            </li>
            <li>
              <AlertTriangle className="inline h-4 w-4" /> If your score drops unexpectedly, review
              your component list for hidden conflicts — removing just one clashing piece can
              sometimes make a big difference.
            </li>
          </ul>
        </WarningBox>

        <Section title="Learn More">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Link href="/help/government/atomic" className="text-blue-600 hover:underline dark:text-blue-400">
                Atomic Government System
              </Link>{" "}
              — understand the building blocks that power synergies.
            </li>
            <li>
              <Link href="/help/government/components" className="text-blue-600 hover:underline dark:text-blue-400">
                Government Components Guide
              </Link>{" "}
              — browse every available component and its traits.
            </li>
            <li>
              <Link href="/help/gameplay/country-building" className="text-blue-600 hover:underline dark:text-blue-400">
                Country Building Guide
              </Link>{" "}
              — see how government choices fit into the bigger picture of creating your nation.
            </li>
          </ul>
        </Section>
      </ContentCard>
    </ArticleLayout>
  );
}
