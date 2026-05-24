"use client";

import { Globe, Building, MessageSquare, FileText } from "lucide-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function MyCountryDiplomacyArticle() {
  return (
    <ArticleLayout
      title="MyCountry Diplomacy"
      description="Manage embassies, communicate with other nations, and set foreign policy from the Diplomacy tab."
      icon={Globe}
    >
      <ContentCard>
        <Section title="Diplomacy Tab Layout">
          <p>
            The Diplomacy section is organized into four tabs that cover all aspects of your
            nation&apos;s international relations:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Overview:</strong> High-level diplomatic health with vitality rings
            </li>
            <li>
              <strong>Embassies & Relations:</strong> Embassy management and relationship tracking
            </li>
            <li>
              <strong>Communications:</strong> Direct messaging between nations
            </li>
            <li>
              <strong>Foreign Policy:</strong> Policy creation and active policy management
            </li>
          </ul>
        </Section>

        <Section title="Overview Tab">
          <p>The overview displays vitality rings showing your diplomatic health at a glance:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Active Embassies:</strong> Number of established embassies vs. total possible
            </li>
            <li>
              <strong>Relations Count:</strong> Total diplomatic relationships
            </li>
            <li>
              <strong>Average Strength:</strong> Mean relationship strength across all connections
            </li>
            <li>
              <strong>Strong Ties:</strong> Percentage of relationships with strength of 70% or
              higher
            </li>
          </ul>
        </Section>

        <Section title="Embassies & Relations">
          <InfoBox title="Embassy Management">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <Building className="inline h-4 w-4" /> Establish new embassies with other nations
                using the Embassy Creator
              </li>
              <li>View and manage existing embassy network with staffing and influence tracking</li>
              <li>Alliance Dashboard shows alliance memberships and coalition opportunities</li>
              <li>Relationship strength updated based on diplomatic actions and events</li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Communications">
          <p>
            <MessageSquare className="inline h-4 w-4 text-cyan-500" /> The Communications tab
            provides direct messaging between nations. Send diplomatic messages, respond to
            proposals, and maintain communication channels with allies and rivals.
          </p>
        </Section>

        <Section title="Foreign Policy">
          <p>
            <FileText className="inline h-4 w-4 text-indigo-500" /> Create and manage foreign
            policies that affect your diplomatic standing:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Policy Creator:</strong> Draft new foreign policies with scope and objectives
            </li>
            <li>
              <strong>Active Policies List:</strong> Monitor currently enforced policies and their
              effects
            </li>
            <li>
              <strong>Trade Impact Charts:</strong> Visualize how policies affect trade
              relationships
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/diplomacy/embassies"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Embassy Network
              </Link>{" "}
              — Detailed embassy network guide
            </li>
            <li>
              <Link
                href="/help/diplomacy/missions"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Diplomatic Missions
              </Link>{" "}
              — Diplomatic mission mechanics
            </li>
            <li>
              <Link
                href="/help/diplomacy/npc-personalities"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                NPC Personality System
              </Link>{" "}
              — NPC behavioral AI system
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
