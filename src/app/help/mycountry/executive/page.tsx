"use client";

import { Command, Calendar, FileText, Bell, Target } from "lucide-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function ExecutiveArticle() {
  return (
    <ArticleLayout
      title="The Executive Desk"
      description="Hold cabinet meetings, set national policy, and make the big calls that move your nation."
      icon={Command}
    >
      <ContentCard>
        <Section title="Where the Big Decisions Happen">
          <p>
            This is the desk where you actually lead. Find it under{" "}
            <strong>MyCountry &rarr; Executive</strong>. It brings the issues on your plate, your
            cabinet, your policies, and your boldest moves together in one place.
          </p>
        </Section>

        <Section title="What You'll Do Here">
          <div className="space-y-4">
            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <Bell className="h-4 w-4 text-amber-600" />
                National Issues
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Your inbox of events — situations that come up because of how your nation is doing.
                Each one offers a few ways to respond, and your choice has real consequences for your
                economy, your people, your standing abroad, and your security. Handling them earns
                IxCredits, and the riskier calls pay a little more.
              </p>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <Calendar className="h-4 w-4 text-purple-600" />
                Meetings &amp; Decisions
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Call cabinet meetings, set the agenda, and record what gets decided. Turn decisions
                into action items with owners and deadlines so nothing falls through the cracks — and
                so your nation&rsquo;s history has a paper trail.
              </p>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <FileText className="h-4 w-4 text-indigo-600" />
                Policies &amp; Strategy
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Draft and enact policies across every part of government. Keep them organized by
                area, set priorities, and track each one from idea to law. For the long game, lay out
                strategic plans with milestones you can watch progress against.
              </p>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <Target className="h-4 w-4 text-rose-600" />
                Big Actions
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                When you&rsquo;re ready to make a real move, nine national actions are at your
                command: a <strong>stimulus package</strong>, <strong>population incentives</strong>,{" "}
                <strong>tax changes</strong>, a <strong>diplomatic mission</strong>, an{" "}
                <strong>emergency response</strong>, <strong>budget reallocation</strong>, an{" "}
                <strong>infrastructure project</strong>, <strong>education reform</strong>, and{" "}
                <strong>healthcare investment</strong>.
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Each one costs from your national budget, then ripples through your economy and
                stability — and writes a fresh headline in your nation&rsquo;s story so you can see
                how it landed. Big actions need time to take effect, so you can&rsquo;t spam them;
                pick your moments.
              </p>
            </div>
          </div>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Quick Starts">
          <p>Jump straight into the things you do most:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Review issues</strong> — open your inbox and respond to what&rsquo;s waiting.
            </li>
            <li>
              <strong>Schedule a meeting</strong> — set up a new cabinet session.
            </li>
            <li>
              <strong>Create a policy</strong> — start drafting something new.
            </li>
            <li>
              <strong>Plan ahead</strong> — sketch out a long-term initiative with milestones.
            </li>
          </ul>
        </Section>

        <Section title="How It Connects">
          <p>The Executive desk pulls from the rest of your nation:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Intelligence</strong> — the insights and findings that should inform your calls.
            </li>
            <li>
              <strong>Diplomacy</strong> — foreign-policy decisions tie back to your relationships
              abroad.
            </li>
            <li>
              <strong>Defense</strong> — your readiness and security shape your options in a crisis.
            </li>
            <li>
              <strong>Overview</strong> — see the effect of your choices on your nation&rsquo;s vital
              signs.
            </li>
          </ul>
        </Section>

        <InfoBox title="Keep Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Target className="inline h-4 w-4" />{" "}
              <Link
                href="/help/gameplay/national-issues"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                National Issues &amp; Decisions
              </Link>{" "}
              — how events arrive and why your choices stick.
            </li>
            <li>
              <Calendar className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/executive-operations"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Command &amp; Operations
              </Link>{" "}
              — running your nation&rsquo;s biggest moves.
            </li>
            <li>
              <FileText className="inline h-4 w-4" />{" "}
              <Link
                href="/help/government/components"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                The Component Library
              </Link>{" "}
              — the building blocks behind your government.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
