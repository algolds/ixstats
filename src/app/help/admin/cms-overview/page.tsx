"use client";

import { Settings, Database, Shield, BarChart3 } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function AdminCMSOverviewArticle() {
  return (
    <ArticleLayout
      title="Admin Content Management System"
      description="Manage 100% dynamic content through 17 admin interfaces for government components, economic policies, military equipment, diplomatic scenarios, and system configuration."
      icon={Settings}
    >
      <Section title="CMS Capabilities">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>100% Dynamic Content:</strong> All game content lives in database; no code
            deployments needed for updates.
          </li>
          <li>
            <strong>17 Admin Interfaces:</strong> 9 reference data, 2 intelligence/templates, 4
            analytics, 2 system admin.
          </li>
          <li>
            <strong>Role-Based Access:</strong> ADMIN, CONTENT_EDITOR, MILITARY_ADMIN roles with
            granular permissions.
          </li>
          <li>
            <strong>Audit Logging:</strong> All changes tracked with user, timestamp, before/after
            values.
          </li>
        </ul>
      </Section>

      <Section title="Reference Data Management (9 Interfaces)">
        <InfoBox title="Content Catalogs">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Government Components:</strong> 24 atomic components with effectiveness
              scores, synergies, conflicts.
            </li>
            <li>
              <strong>Economic Components:</strong> 40+ policy components with tier requirements and
              effects.
            </li>
            <li>
              <strong>Tax System Components:</strong> 42 tax types with rate ranges and revenue
              formulas.
            </li>
            <li>
              <strong>Diplomatic Scenarios:</strong> 100+ scenario templates with NPC personality
              modifiers.
            </li>
            <li>
              <strong>Military Equipment:</strong> 500+ items (tanks, aircraft, ships, small arms)
              with specifications.
            </li>
            <li>
              <strong>NPC Personalities:</strong> 8 personality traits with calculation formulas and
              archetypes.
            </li>
            <li>
              <strong>Crisis Events:</strong> Event templates with severity levels, impact
              calculations, response options.
            </li>
            <li>
              <strong>Economic Archetypes:</strong> Country economy templates with tier assignments.
            </li>
            <li>
              <strong>Achievement Definitions:</strong> Unlock criteria, rewards, progression tiers.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Intelligence & Templates (2 Interfaces)">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Briefing Templates:</strong> Customizable intelligence report formats with
            dynamic data sources.
          </li>
          <li>
            <strong>Alert Rules:</strong> Configure thresholds, priorities, notification channels
            for intelligence alerts.
          </li>
        </ul>
      </Section>

      <Section title="Analytics & Monitoring (4 Interfaces)">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Map Monitoring:</strong> Tile cache hit rates, generation times, Redis
            statistics.
          </li>
          <li>
            <strong>API Performance:</strong> tRPC router latencies, error rates, usage patterns (52
            routers, 580+ procedures).
          </li>
          <li>
            <strong>User Activity:</strong> Login tracking, feature usage, session analytics.
          </li>
          <li>
            <strong>System Health:</strong> Database performance, cache status, WebSocket
            connections, rate limiting.
          </li>
        </ul>
      </Section>

      <Section title="System Administration (2 Interfaces)">
        <InfoBox title="Platform Management">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Global Settings:</strong> IxTime configuration, feature flags, maintenance
              mode, system announcements.
            </li>
            <li>
              <strong>Role Management:</strong> Assign/revoke ADMIN, CONTENT_EDITOR, MAP_EDITOR,
              MILITARY_ADMIN roles.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Bulk Operations">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>CSV Import:</strong> Bulk upload equipment, components, scenarios from
            spreadsheets.
          </li>
          <li>
            <strong>Batch Updates:</strong> Mass edit attributes across multiple items
            simultaneously.
          </li>
          <li>
            <strong>Export:</strong> Download reference data as CSV/JSON for external analysis or
            backup.
          </li>
          <li>
            <strong>Validation:</strong> Pre-import checks for schema compliance, duplicate
            detection, referential integrity.
          </li>
        </ul>
      </Section>

      <WarningBox title="Access & Security">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Shield className="inline h-4 w-4" /> All admin routes protected by role middleware;
            unauthorized access logged.
          </li>
          <li>
            <Database className="inline h-4 w-4" /> Changes persisted to audit_log table with
            complete change history.
          </li>
          <li>
            <BarChart3 className="inline h-4 w-4" /> Monitor admin activity via{" "}
            <code>/admin/analytics</code> dashboard.
          </li>
          <li>Enable 2FA for admin accounts in production environments (recommended).</li>
        </ul>
      </WarningBox>

      <InfoBox title="Related Documentation">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <code>docs/systems/admin-cms.md</code> – Complete admin interface documentation.
          </li>
          <li>
            <code>/help/admin/reference-data</code> – Managing game content catalogs.
          </li>
          <li>
            <code>/help/technical/api</code> – Admin API routers and procedures.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
