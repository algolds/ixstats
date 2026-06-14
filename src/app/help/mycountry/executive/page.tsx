"use client";

import { Command, Calendar, FileText, Bell, Target } from "lucide-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function ExecutiveArticle() {
  return (
    <ArticleLayout
      title="Executive Command Center"
      description="Manage national issues, cabinet meetings, policies, and strategic decisions from the Executive dashboard."
      icon={Command}
    >
      <ContentCard>
        <Section title="Overview">
          <p>
            The Executive Command Center is your central hub for executive governance operations.
            Access it via <strong>MyCountry &rarr; Executive</strong> in the navigation. This
            section consolidates issue management, meetings, policy creation, and strategic
            decisions in one streamlined interface.
          </p>
        </Section>

        <Section title="Features">
          <div className="space-y-4">
            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <Bell className="h-4 w-4 text-amber-600" />
                National Issues
              </h4>
              <p className="text-muted-foreground mt-1 text-sm">
                The Issues inbox presents dynamic national events triggered by your country&apos;s
                conditions. Each issue offers multiple-choice responses with real consequences for
                your economy, society, diplomacy, and defense. Up to 3 new issues appear per
                evaluation cycle, with urgency levels and auto-resolution deadlines. Responding
                earns IxCredits (5 base + risk bonus).
              </p>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <Calendar className="h-4 w-4 text-purple-600" />
                Meetings & Decisions
              </h4>
              <p className="text-muted-foreground mt-1 text-sm">
                Schedule cabinet meetings, manage agendas, record attendance, and track meeting
                outcomes. Record executive decisions from meetings and track associated action items
                with responsibilities, deadlines, and completion status.
              </p>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <FileText className="h-4 w-4 text-indigo-600" />
                Policies & Strategy
              </h4>
              <p className="text-muted-foreground mt-1 text-sm">
                Draft, review, and implement national policies across all government sectors. Track
                policy status (draft, active, archived), assign priorities, and organize by category
                (economic, social, defense, etc.). Create long-term strategic initiatives and
                development plans with milestones and progress tracking.
              </p>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <Target className="h-4 w-4 text-rose-600" />
                Executive Actions
              </h4>
              <p className="text-muted-foreground mt-1 text-sm">
                Execute high-impact national directives from your command suite. Nine executive
                actions are available: <strong>stimulus package</strong>,{" "}
                <strong>population incentives</strong>, <strong>tax policy</strong>,{" "}
                <strong>diplomatic mission</strong>, <strong>emergency response</strong>,{" "}
                <strong>budget allocation</strong>, <strong>infrastructure project</strong>,{" "}
                <strong>education reform</strong>, and <strong>healthcare investment</strong>.
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Every action produces real economic effects through the StorytellerEffect system,
                with computed changes to GDP, population, political stability, and other metrics
                based on the specific action and its input parameters. Each action has a cooldown
                ranging from <strong>24 to 168 hours</strong> depending on the action type, and
                costs are deducted from your national budget upon execution. The{" "}
                <strong>NewsFeedWidget</strong> displays narrative output describing the outcome of
                each action, immersing you in the story of your nation&apos;s development.
              </p>
            </div>
          </div>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Quick Actions">
          <p>Access common executive tasks directly:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Review Issues:</strong> Open the issues inbox to respond to pending national
              events
            </li>
            <li>
              <strong>Schedule Meeting:</strong> Opens the meeting scheduler for creating new
              cabinet sessions
            </li>
            <li>
              <strong>Create Policy:</strong> Launches the policy creator for drafting new national
              directives
            </li>
            <li>
              <strong>Strategic Planning:</strong> Plan long-term initiatives with milestones
            </li>
          </ul>
        </Section>

        <Section title="Workflow Integration">
          <p>The Executive Command Center integrates with other MyCountry systems:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Intelligence:</strong> Intelligence analysis and key findings inform policy
              decisions and issue responses
            </li>
            <li>
              <strong>Diplomacy:</strong> Foreign policy decisions and diplomatic scenarios connect
              to the diplomacy section
            </li>
            <li>
              <strong>Defense:</strong> Military readiness and security status affect crisis
              response options
            </li>
            <li>
              <strong>National Overview:</strong> View comprehensive vitality metrics and economic
              health from the Overview tab
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Target className="inline h-4 w-4" />{" "}
              <Link
                href="/help/gameplay/national-issues"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                National Issues
              </Link>{" "}
              — National issues system details
            </li>
            <li>
              <Calendar className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/executive-operations"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Executive Operations
              </Link>{" "}
              — Intelligence operations overview
            </li>
            <li>
              <FileText className="inline h-4 w-4" />{" "}
              <Link
                href="/help/government/components"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Component Catalog
              </Link>{" "}
              — Government system components
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
