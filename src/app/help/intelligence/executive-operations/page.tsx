"use client";

import Link from "next/link";
import { Briefcase, ClipboardSignature, ChartLine, Target } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function ExecutiveOperationsArticle() {
  return (
    <ArticleLayout
      title="Executive Operations"
      description="Turn intelligence insights into decisive action -- coordinate policies, missions, and compliance tasks from your executive command center."
      icon={Briefcase}
    >
      <ContentCard>
        <Section title="How Intelligence Supports Your Decisions">
          <p className="mb-4">
            Intelligence is only valuable if you act on it. The executive operations tools are
            designed to bridge the gap between knowing what&apos;s happening and doing something
            about it. Every alert, metric, and forecast includes action pathways so you can respond
            immediately without switching contexts.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Quick Actions:</strong> One-click responses for common situations -- draft a
              policy, schedule a diplomatic meeting, adjust defense readiness, or issue mission
              orders directly from an intelligence card.
            </li>
            <li>
              <strong>Compliance Queue:</strong> A prioritized list of unresolved alerts, overdue
              tasks, and scheduled reviews. Work through these to keep your nation running smoothly
              and avoid letting issues pile up.
            </li>
            <li>
              <strong>Achievement Integration:</strong> When you resolve a significant situation or
              hit a milestone, share your outcomes through achievements and ThinkPages posts to
              build your nation&apos;s story.
            </li>
          </ul>
        </Section>

        <Section title="Recommended Daily Workflow">
          <InfoBox title="Your Daily Leadership Loop">
            <p className="mb-2">
              Follow this routine to stay on top of your nation&apos;s affairs:
            </p>
            <ol className="list-decimal space-y-1 pl-6">
              <li>
                <strong>Review your dashboard:</strong> Open{" "}
                <Link
                  href="/mycountry/intelligence"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  MyCountry &rarr; Intelligence
                </Link>{" "}
                and scan for new signals -- vitality changes, hot issues, and fresh forecasts.
              </li>
              <li>
                <strong>Address urgent items:</strong> Use quick actions to respond to high-priority
                alerts. Draft policies, approve missions, or adjust your stance on developing
                situations.
              </li>
              <li>
                <strong>Work the compliance queue:</strong> Review and clear overdue tasks. Each
                resolved item keeps your governance running cleanly and can unlock new
                opportunities.
              </li>
              <li>
                <strong>Document your decisions:</strong> Log important choices in ThinkPages so you
                have a record of why you acted and what you expect to happen. This is invaluable
                when reviewing outcomes later.
              </li>
              <li>
                <strong>Check forecasts:</strong> Before signing off, glance at the forward-looking
                section to see what&apos;s coming next. Set reminders for anything that needs future
                attention.
              </li>
            </ol>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Turning Insights into Actions">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>From economic intelligence:</strong> Spot a declining sector? Draft a stimulus
              policy or adjust tax rates. See a trade opportunity? Initiate diplomatic outreach to
              the relevant nation.
            </li>
            <li>
              <strong>From diplomatic intelligence:</strong> Notice a cooling relationship? Schedule
              a diplomatic meeting or send a cultural exchange proposal. Treaty expiring? Renew it
              before the deadline.
            </li>
            <li>
              <strong>From defense intelligence:</strong> Readiness downgrade? Review your military
              posture and adjust deployments. Threat escalation? Coordinate with allies and prepare
              contingency plans.
            </li>
            <li>
              <strong>From policy analytics:</strong> Policy underperforming? Adjust its parameters
              or replace it with something better suited to current conditions. Policy exceeding
              expectations? Document what&apos;s working and apply the lessons elsewhere.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <ClipboardSignature className="inline h-4 w-4" />{" "}
              <Link
                href="/help/diplomacy/missions"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Diplomatic Missions
              </Link>{" "}
              -- plan and execute missions that respond to intelligence findings.
            </li>
            <li>
              <ChartLine className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/forecasting"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Forecasting &amp; Predictions
              </Link>{" "}
              -- use forward-looking analytics to plan your next moves.
            </li>
            <li>
              <Target className="inline h-4 w-4" />{" "}
              <Link
                href="/help/mycountry/executive"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                MyCountry Executive Guide
              </Link>{" "}
              -- full walkthrough of your executive command center.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
