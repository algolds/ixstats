"use client";

import { Command, Calendar, FileText, Target, Layers } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function ExecutiveArticle() {
  return (
    <ArticleLayout
      title="Executive Command Center"
      description="Manage cabinet meetings, national policies, strategic plans, and executive decisions from the unified command dashboard."
      icon={Command}
    >
      <Section title="Overview">
        <p>
          The Executive Command Center is your central hub for executive governance operations.
          Access it via <strong>MyCountry → Executive Command</strong> in the navigation dropdown.
        </p>
        <p className="mt-4">
          This section consolidates four key executive functions: cabinet meetings, national
          policies, strategic planning, and decision tracking - all in one streamlined interface.
        </p>
      </Section>

      <Section title="Features">
        <div className="space-y-4">
          <div>
            <h4 className="flex items-center gap-2 font-semibold">
              <Calendar className="h-4 w-4 text-purple-600" />
              Cabinet Meetings
            </h4>
            <p className="text-muted-foreground mt-1 text-sm">
              Schedule cabinet meetings, manage agendas, record attendance, and track meeting outcomes.
              Use the meeting scheduler modal to create new meetings with customizable dates, durations,
              and participant lists.
            </p>
          </div>

          <div>
            <h4 className="flex items-center gap-2 font-semibold">
              <FileText className="h-4 w-4 text-indigo-600" />
              National Policies
            </h4>
            <p className="text-muted-foreground mt-1 text-sm">
              Draft, review, and implement national policies across all government sectors. Track
              policy status (draft, active, archived), assign priorities, and organize by category
              (economic, social, defense, etc.).
            </p>
          </div>

          <div>
            <h4 className="flex items-center gap-2 font-semibold">
              <Target className="h-4 w-4 text-purple-600" />
              Strategic Planning
            </h4>
            <p className="text-muted-foreground mt-1 text-sm">
              Create long-term strategic initiatives and development plans. Set national goals,
              define milestones, and track progress on multi-year projects that shape your nation's
              future.
            </p>
          </div>

          <div>
            <h4 className="flex items-center gap-2 font-semibold">
              <Layers className="h-4 w-4 text-blue-600" />
              Executive Decisions
            </h4>
            <p className="text-muted-foreground mt-1 text-sm">
              Record executive decisions from cabinet meetings and track associated action items.
              Assign responsibilities, set deadlines, and monitor completion status for all
              executive directives.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Using the Executive Dashboard">
        <InfoBox title="Tab Navigation">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Overview:</strong> Executive summary with quick stats, pending actions, and
              recent activity
            </li>
            <li>
              <strong>Meetings:</strong> Full cabinet meeting management with upcoming/past views
            </li>
            <li>
              <strong>Policies:</strong> National policy management organized by status and priority
            </li>
            <li>
              <strong>Plans:</strong> Strategic planning interface with initiative tracking
            </li>
            <li>
              <strong>Decisions:</strong> Decision log and action item management with status tracking
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Quick Actions">
        <p>Access common executive tasks directly from the Overview tab:</p>
        <ul className="mt-2 list-disc space-y-2 pl-6">
          <li>
            <strong>Schedule Meeting:</strong> Opens the meeting scheduler modal for creating new
            cabinet sessions
          </li>
          <li>
            <strong>Create Policy:</strong> Launches the policy creator for drafting new national
            directives
          </li>
          <li>
            <strong>Strategic Planning:</strong> Opens the strategic planning modal for long-term
            initiatives
          </li>
          <li>
            <strong>Record Decision:</strong> Jump to the decisions tab to log executive outcomes
          </li>
        </ul>
      </Section>

      <Section title="Workflow Integration">
        <p>
          The Executive Command Center integrates with other MyCountry systems:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-6">
          <li>
            <strong>Intelligence & Diplomacy:</strong> Access intelligence briefings and diplomatic
            operations from the Intelligence section
          </li>
          <li>
            <strong>Defense & Security:</strong> Monitor military readiness and security status from
            the Defense section
          </li>
          <li>
            <strong>National Overview:</strong> View comprehensive vitality metrics and economic health
            from the main MyCountry dashboard
          </li>
        </ul>
      </Section>

      <InfoBox title="Related Documentation">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Command className="inline h-4 w-4" /> `/help/getting-started/navigation` – Platform
            navigation guide
          </li>
          <li>
            <Calendar className="inline h-4 w-4" /> `/help/intelligence/executive-operations` –
            Intelligence operations overview
          </li>
          <li>
            <FileText className="inline h-4 w-4" /> `/help/government/components` – Government
            system components
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
