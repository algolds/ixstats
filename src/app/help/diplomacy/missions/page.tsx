"use client";

import { Plane, CheckCircle, AlertCircle } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function MissionsArticle() {
  return (
    <ArticleLayout
      title="Diplomatic Missions"
      description="Plan, launch, and monitor missions to deliver outcomes in trade, security, and cultural exchange."
      icon={Plane}
    >
      <Section title="Mission Workflow">
        <ol className="list-decimal space-y-2 pl-6">
          <li>Select mission type (trade, cultural, security, humanitarian, etc.).</li>
          <li>Assign embassy, team, and objectives; confirm difficulty and timeline.</li>
          <li>Monitor status updates and outcomes in the Diplomatic Operations Hub.</li>
        </ol>
      </Section>

      <Section title="Data & Integrations">
        <InfoBox title="Routers & UI">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              `api.diplomatic.getActiveMissions`, `api.diplomatic.createMission`,
              `api.diplomatic.updateMissionStatus`.
            </li>
            <li>
              UI components in `src/app/mycountry/intelligence/_components` and
              `src/components/diplomatic/LiveDiplomaticFeed.tsx`.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <WarningBox title="Success Tips">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <CheckCircle className="inline h-4 w-4" /> Align missions with strategic goals (e.g.,
            target trade partners with favourable tiers).
          </li>
          <li>
            <AlertCircle className="inline h-4 w-4" /> Address mission failures promptly—many
            trigger intelligence alerts or compliance tasks.
          </li>
        </ul>
      </WarningBox>
    </ArticleLayout>
  );
}
