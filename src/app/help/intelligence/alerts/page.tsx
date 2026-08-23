import Link from "next/link";
import { BellNotification as BellRing, MailIn as Inbox, ShieldAlert, Dashboard as LayoutDashboard, Compass } from "iconoir-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function IntelligenceAlertsArticle() {
  return (
    <ArticleLayout
      title="Alerts & Notifications"
      description="Stay on top of developing situations with intelligent alerts that tell you what's happening, why it matters, and what you can do about it."
      icon={BellRing}
    >
      <ContentCard>
        <Section title="Types of Alerts You'll Receive">
          <p className="mb-4">
            Your intelligence system monitors every corner of your nation and sends you alerts when
            something important changes. Alerts are grouped into four categories:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Intelligence Alerts:</strong> Triggered when vitality scores drop, risk levels
              spike, or forecasts deviate from expectations. These signal that your nation&apos;s
              fundamentals are shifting.
            </li>
            <li>
              <strong>Diplomatic Alerts:</strong> Notify you about mission status changes, shifts in
              relationship strength with other nations, and approaching treaty deadlines. Stay ahead
              of your diplomatic obligations.
            </li>
            <li>
              <strong>Defense Alerts:</strong> Cover incident reports, military readiness
              downgrades, and crisis escalations. If your security situation is changing,
              you&apos;ll know immediately.
            </li>
            <li>
              <strong>Compliance Alerts:</strong> Remind you about overdue tasks and upcoming policy
              reviews. These help you keep your governance on track.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Where Alerts Appear">
          <InfoBox title="Alert Channels">
            <p className="mb-2">
              You&apos;ll find your alerts in several places so you never miss something important:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Intelligence Feed:</strong> Your primary alert center within the{" "}
                <Link
                  href="/mycountry/intelligence"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Intelligence page
                </Link>
                , showing all alerts with full context and action buttons.
              </li>
              <li>
                <strong>Notification Bell:</strong> The bell icon in your top navigation shows a
                count of unread alerts and lets you quickly preview recent ones from anywhere.
              </li>
              <li>
                <strong>Discord Notifications:</strong> Critical incidents are automatically posted
                to your Discord channel so you&apos;re alerted even when you&apos;re not on the
                platform.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="How to Handle Alerts">
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              <strong>Review the alert:</strong> Open the alert card to see the full context -- what
              happened, why it matters, and what the system recommends.
            </li>
            <li>
              <strong>Take action:</strong> Use the built-in action buttons to respond directly.
              Depending on the alert type, you might draft a policy, issue mission orders, adjust
              your defense posture, or schedule a diplomatic meeting.
            </li>
            <li>
              <strong>Document and close:</strong> Once you&apos;ve addressed the situation, archive
              the alert. If the issue is significant, consider writing a ThinkPages post to record
              what happened and how you responded for future reference.
            </li>
          </ol>
        </Section>
      </ContentCard>

      <ContentCard fullWidth>
        <WarningBox title="Stay Organized">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Inbox className="inline h-4 w-4" /> Clear resolved alerts regularly to keep your feed
              manageable. A cluttered alert list makes it harder to spot what truly needs your
              attention.
            </li>
            <li>
              <ShieldAlert className="inline h-4 w-4" /> Configure your alert thresholds in the
              Intelligence Settings tab so you receive notifications tuned to your play style -- not
              too many, not too few.
            </li>
          </ul>
        </WarningBox>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <LayoutDashboard className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/dashboard"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Executive Intelligence Dashboard
              </Link>{" "}
              -- see all your alerts in context alongside your nation&apos;s overall health.
            </li>
            <li>
              <Compass className="inline h-4 w-4" />{" "}
              <Link
                href="/help/mycountry/intelligence"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                MyCountry Intelligence Guide
              </Link>{" "}
              -- full walkthrough of the Intelligence section.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
