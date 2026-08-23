import Link from "next/link";
import { Shield, Archery as Crosshair, BellNotification as Siren } from "iconoir-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function DefenseOverviewArticle() {
  return (
    <ArticleLayout
      title="Defense System Overview"
      description="Manage national security posture, readiness, and crisis response through the MyCountry defense suite."
      icon={Shield}
    >
      <ContentCard>
        <Section title="What the Defense Suite Covers">
          <ul className="list-disc space-y-2 pl-6">
            <li>Strategic Defense Initiative (SDI) modules with readiness scoring.</li>
            <li>Threat monitoring and incident tracking integrated with intelligence alerts.</li>
            <li>Compliance tasks to ensure critical defense follow-ups are not missed.</li>
          </ul>
        </Section>

        <Section title="What You See">
          <InfoBox title="Key Dashboards">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                Defense tab in <strong>MyCountry &rarr; Defense</strong>.
              </li>
              <li>Readiness gauges, module cards, and crisis queues.</li>
              <li>Real-time security alerts and notification feeds.</li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Keeping Things Up to Date">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Use quick actions to put forces on alert, respond to threats, or escalate an incident.
            </li>
            <li>
              Write up what happened on ThinkPages to keep a record for your nation&apos;s history.
            </li>
            <li>Keep an eye on live alerts so you can act the moment something changes.</li>
          </ul>
        </Section>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Crosshair className="inline h-4 w-4" />{" "}
              <Link
                href="/help/defense/units"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Military Units & Assets
              </Link>{" "}
              — asset and capability management.
            </li>
            <li>
              <Siren className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/alerts"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Alerts & Notifications
              </Link>{" "}
              — alert triage workflow.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
