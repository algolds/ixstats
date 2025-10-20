"use client";

import { Shield, Crosshair, Siren } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function DefenseOverviewArticle() {
  return (
    <ArticleLayout
      title="Defense System Overview"
      description="Manage national security posture, readiness, and crisis response through the MyCountry defense suite."
      icon={Shield}
    >
      <Section title="What the Defense Suite Covers">
        <ul className="list-disc pl-6 space-y-2">
          <li>Strategic Defense Initiative (SDI) modules with readiness scoring.</li>
          <li>Threat monitoring and incident tracking integrated with intelligence alerts.</li>
          <li>Compliance tasks to ensure critical defense follow-ups are not missed.</li>
        </ul>
      </Section>

      <Section title="Dashboards & Data">
        <InfoBox title="Key Components">
          <ul className="list-disc pl-6 space-y-1">
            <li>Defense tab in MyCountry (`src/app/mycountry/defense`).</li>
            <li>Routers: `api.sdi`, `api.security`, `api.notifications`.</li>
            <li>UI Widgets: readiness gauges, module cards, crisis queues.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Keeping Things Up to Date">
        <ul className="list-disc pl-6 space-y-2">
          <li>Use quick actions to activate modules, deploy responses, or escalate incidents.</li>
          <li>Document outcomes via ThinkPages or compliance notes for historical context.</li>
          <li>Monitor WebSocket alerts in production; development mode requires manual refreshes.</li>
        </ul>
      </Section>

      <InfoBox title="Related Guides">
        <ul className="list-disc pl-6 space-y-1">
          <li><Crosshair className="inline h-4 w-4" /> `/help/defense/units` – asset and capability management.</li>
          <li><Siren className="inline h-4 w-4" /> `/help/intelligence/alerts` – alert triage workflow.</li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
