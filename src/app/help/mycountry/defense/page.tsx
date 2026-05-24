"use client";

import { Shield, Swords, Crosshair, Settings } from "lucide-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function MyCountryDefenseArticle() {
  return (
    <ArticleLayout
      title="MyCountry Defense"
      description="Military command, force customization, and operations management from the Defense tab."
      icon={Shield}
    >
      <ContentCard>
        <Section title="Defense Tab Layout">
          <p>
            The Defense section manages your nation&apos;s military capabilities across three tabs:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Command:</strong> Security assessment, readiness scoring, and threat
              monitoring
            </li>
            <li>
              <strong>Forces:</strong> Military branch management, equipment assignment, and force
              composition
            </li>
            <li>
              <strong>Operations:</strong> Active deployments, deployment wizard, and conflict
              management
            </li>
          </ul>
        </Section>

        <Section title="Command Tab">
          <p>The Command panel provides a comprehensive security overview:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <Crosshair className="inline h-4 w-4 text-red-500" />{" "}
              <strong>Security Assessment:</strong> Overall threat level with contributing factors
            </li>
            <li>
              <strong>Readiness Scoring:</strong> Military readiness percentage across all branches
            </li>
            <li>
              <strong>Threat Monitoring:</strong> Active threats and incident tracking
            </li>
            <li>
              <strong>Compliance Tasks:</strong> Defense-related compliance items requiring action
            </li>
          </ul>
        </Section>

        <Section title="Forces Tab">
          <InfoBox title="Military Customization">
            <p>The Forces tab lets you customize your military structure:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <Swords className="inline h-4 w-4" /> <strong>Branch Management:</strong> Configure
                army, navy, air force, and special forces branches with personnel allocations
              </li>
              <li>
                <strong>Equipment Assignment:</strong> Assign equipment from the 500+ item catalog
                to branches
              </li>
              <li>
                <strong>Force Composition:</strong> Balance between active duty, reserves, and
                support personnel
              </li>
              <li>
                <strong>Vitality Rings:</strong> Branch count, average readiness, security score,
                and security level
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Operations Tab">
          <p>Manage active and planned military operations:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <Settings className="inline h-4 w-4 text-blue-500" />{" "}
              <strong>Active Operations:</strong> Monitor ongoing deployments with status tracking
            </li>
            <li>
              <strong>Deployment Wizard:</strong> Step-by-step guide for planning new deployments
              with objectives, force allocation, and timeline
            </li>
            <li>
              <strong>PvP Conflicts:</strong> Player-vs-player conflict management and resolution
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/defense/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Defense Overview
              </Link>{" "}
              — Defense system overview
            </li>
            <li>
              <Link
                href="/help/defense/units"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Military Units
              </Link>{" "}
              — Military unit types and capabilities
            </li>
            <li>
              <Link
                href="/help/defense/equipment"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Equipment Catalog
              </Link>{" "}
              — Equipment catalog (500+ items)
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
