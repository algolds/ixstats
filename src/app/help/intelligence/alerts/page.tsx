"use client";

import { BellRing, Inbox, ShieldAlert } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function IntelligenceAlertsArticle() {
  return (
    <ArticleLayout
      title="Alerts & Notifications"
      description="Manage intelligence, diplomatic, defense, and compliance alerts effectively."
      icon={BellRing}
    >
      <Section title="Alert Types">
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Intelligence:</strong> Vitality drops, risk spikes, forecast deviations.</li>
          <li><strong>Diplomatic:</strong> Mission status changes, relation strength updates, treaty deadlines.</li>
          <li><strong>Defense:</strong> Incident reports, readiness downgrades, crisis escalation.</li>
          <li><strong>Compliance:</strong> Overdue tasks, policy review reminders.</li>
        </ul>
      </Section>

      <Section title="Where Alerts Surface">
        <InfoBox title="Channels">
          <ul className="list-disc pl-6 space-y-1">
            <li>MyCountry intelligence feed and compliance modal.</li>
            <li>Notifications center (`src/components/notifications`).</li>
            <li>Discord webhooks (production) for critical incidents.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Workflow">
        <ol className="list-decimal pl-6 space-y-2">
          <li>Open the alert card to view context and recommended actions.</li>
          <li>Take action (quick action, policy draft, mission orders) or acknowledge when resolved.</li>
          <li>Archive alerts once documentation (ThinkPages/compliance notes) is complete.</li>
        </ol>
      </Section>

      <WarningBox title="Tips">
        <ul className="list-disc pl-6 space-y-1">
          <li><Inbox className="inline h-4 w-4" /> Clear resolved alerts to keep compliance manageable.</li>
          <li><ShieldAlert className="inline h-4 w-4" /> Confirm Discord webhook config in `docs/operations/monitoring.md`.</li>
        </ul>
      </WarningBox>
    </ArticleLayout>
  );
}
