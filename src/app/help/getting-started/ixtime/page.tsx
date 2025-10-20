"use client";

import { Clock, Activity, Network } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function IxTimeArticle() {
  return (
    <ArticleLayout
      title="Understanding IxTime"
      description="Learn how IxTime controls simulation pacing and how it affects dashboards, audits, and Discord integrations."
      icon={Clock}
    >
      <Section title="How IxTime Works">
        <ul className="list-disc pl-6 space-y-2">
          <li>IxTime is a configurable multiplier that advances in-world time faster than wall-clock time (default 2×).</li>
          <li>The custom server (`server.mjs`) loads IxTime settings from environment variables and admin overrides.</li>
          <li>Discord bots and scheduled jobs read the same clock to keep narrative events in sync.</li>
        </ul>
      </Section>

      <Section title="Where You Control It">
        <InfoBox title="Admin Tools">
          <ul className="list-disc pl-6 space-y-1">
            <li>`/admin` ▸ Time Management cards – pause, resume, or set custom IxTime.</li>
            <li>tRPC procedures: `api.admin.setCustomTime`, `api.admin.syncBot`, `api.admin.pauseBot`.</li>
            <li>Documentation: `docs/operations/monitoring.md` for alerts and `docs/systems/mycountry.md` for dashboard consumers.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Impact on Gameplay">
        <ul className="list-disc pl-6 space-y-2">
          <li>Dashboards such as National Vitality and diplomatic feeds annotate events with IxTime timestamps.</li>
          <li>Economic projections operate on the accelerated clock; audits compare projections to actuals using the same reference.</li>
          <li>WebSocket events batch updates per IxTime tick to avoid overloading clients.</li>
        </ul>
      </Section>

      <WarningBox title="Good to Know">
        <ul className="list-disc pl-6 space-y-1">
          <li><Activity className="inline h-4 w-4" /> During local development, the WebSocket server is disabled; expect manual refreshes for IxTime-dependent widgets.</li>
          <li><Network className="inline h-4 w-4" /> When deploying, verify `IXTIME_BOT_URL` and related env variables (`docs/operations/environments.md`).</li>
        </ul>
      </WarningBox>
    </ArticleLayout>
  );
}
