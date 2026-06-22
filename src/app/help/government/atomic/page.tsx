"use client";

import Link from "next/link";
import { Atom } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function AtomicGovernmentArticle() {
  return (
    <ArticleLayout
      title="Atomic Government System"
      description="Build your nation's government from modular components that shape how power flows, decisions are made, and citizens are governed."
      icon={Atom}
    >
      <ContentCard>
        <Section title="What Is the Atomic Government System?">
          <p className="mb-4 text-slate-700 dark:text-slate-300">
            Instead of picking a single government type like &quot;Democracy&quot; or
            &quot;Monarchy,&quot; IxStats lets you assemble your government from individual building
            blocks called <strong>components</strong>. Each component represents a specific aspect
            of how your nation operates. Mix and match them to create a government that is uniquely
            yours — from a decentralized republic with strong judicial oversight to a centralized
            technocracy driven by expert councils.
          </p>
        </Section>

        <Section title="The Five Categories">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            Every government component belongs to one of five categories. Together, they define the
            full picture of how your nation is run:
          </p>
          <ul className="list-disc space-y-3 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <strong>Power Distribution</strong> — Determines where authority resides. Is power
              centralized in a single leader, shared across branches, or spread among regional
              governments?
            </li>
            <li>
              <strong>Decision Processes</strong> — Defines how laws and policies are created. Does
              your nation rely on legislative debate, executive decree, popular referendums, or
              council consensus?
            </li>
            <li>
              <strong>Legitimacy Sources</strong> — Establishes why your government has the right to
              rule. Is it through free elections, hereditary succession, religious mandate,
              revolutionary mandate, or constitutional tradition?
            </li>
            <li>
              <strong>Institutions</strong> — The organizations that carry out governance. This
              includes courts, legislatures, regulatory agencies, advisory bodies, and civil service
              structures.
            </li>
            <li>
              <strong>Control Mechanisms</strong> — How the government maintains order and enforces
              its authority. This covers everything from an independent judiciary and free press to
              censorship boards and secret police.
            </li>
          </ul>
          <p className="mt-3 text-slate-700 dark:text-slate-300">
            For a full list of every available component, see the{" "}
            <Link
              href="/help/government/components"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Component Catalog
            </Link>
            .
          </p>
        </Section>

        <Section title="Choosing Your Components">
          <InfoBox title="How to Build Your Government">
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                Open the <strong>Country Builder</strong> and navigate to the Government section. If
                you need help getting started, check the{" "}
                <Link
                  href="/help/gameplay/country-building"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Country Building Guide
                </Link>
                .
              </li>
              <li>
                Browse components by category. Each one has a description and a preview of its
                effects, so you can understand what it does before selecting it.
              </li>
              <li>
                Select the components that match the government you envision. You can pick one or
                more from each category.
              </li>
              <li>
                Watch for <strong>synergy</strong> and <strong>conflict</strong> indicators as you
                build — they appear automatically when certain combinations interact.
              </li>
              <li>
                Save your choices. Your government effectiveness score updates immediately on your
                country dashboard.
              </li>
            </ol>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Synergies and Conflicts">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            Not all components work equally well together. The system tracks how your choices
            interact:
          </p>
          <ul className="list-disc space-y-3 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <strong>Synergies</strong> occur when components naturally complement each other. For
              example, pairing a strong independent judiciary with constitutional legitimacy creates
              a synergy bonus — your government becomes more effective because those elements
              reinforce one another. Synergies boost your overall effectiveness score and can unlock
              special achievements.
            </li>
            <li>
              <strong>Conflicts</strong> arise when components work against each other. For
              instance, selecting both &quot;free press oversight&quot; and &quot;state media
              control&quot; creates a conflict — the contradictory policies reduce your
              government&apos;s efficiency and may trigger compliance warnings. Conflicts lower your
              effectiveness score.
            </li>
          </ul>
          <p className="mt-3 text-slate-700 dark:text-slate-300">
            Conflicts are not always bad from a storytelling perspective. A nation with internal
            contradictions can make for a more interesting and realistic country. But mechanically,
            you will want to be aware of the trade-offs.
          </p>
        </Section>

        <Section title="Your Government Effectiveness Score">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            Your effectiveness score reflects how well your government components work together. It
            factors in:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <strong>Collection efficiency</strong> — How effectively your government collects
              taxes and revenue.
            </li>
            <li>
              <strong>Compliance rate</strong> — How willingly citizens follow laws and regulations.
            </li>
            <li>
              <strong>Administrative cost</strong> — How much bureaucratic overhead your government
              structure requires.
            </li>
            <li>
              <strong>Economic impact</strong> — How your governance choices affect trade, growth,
              and investment.
            </li>
          </ul>
          <p className="mt-3 text-slate-700 dark:text-slate-300">
            Every component you add or remove updates your nation&apos;s real numbers &mdash; GDP,
            population growth, political stability, and more &mdash; based on its kind, its strength,
            and how it plays with your other choices. Each change is recorded, so you can trace how a
            single governance decision shaped your country over time.
          </p>
          <p className="mt-3 text-slate-700 dark:text-slate-300">
            You can view your effectiveness score and a breakdown of these factors on your{" "}
            <strong>My Country</strong> dashboard under the Government section. The Intelligence tab
            also provides deeper analytics on how your government configuration affects other areas
            of your nation.
          </p>
        </Section>

        <Section title="Tips for New Players">
          <InfoBox title="Getting the Most From Your Government">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Start simple. Pick components that clearly align with the type of nation you want,
                and expand later as you learn the system.
              </li>
              <li>
                Pay attention to the synergy and conflict badges in the selection panel — they give
                you immediate feedback on your choices.
              </li>
              <li>
                Use ThinkPages to write about your constitutional reforms and political changes. It
                adds depth to your nation&apos;s story.
              </li>
              <li>
                Certain government configurations can help you weather crises more effectively and
                earn special achievements.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <InfoBox title="Related Articles">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/government/components"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Component Catalog
              </Link>{" "}
              — Browse every available government component and its effects.
            </li>
            <li>
              <Link
                href="/help/government/traditional"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Government Types
              </Link>{" "}
              — the quick way to choose how your nation is governed.
            </li>
            <li>
              <Link
                href="/help/gameplay/country-building"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Country Building Guide
              </Link>{" "}
              — Step-by-step walkthrough for creating your nation.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
