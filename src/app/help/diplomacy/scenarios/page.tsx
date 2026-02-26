"use client";

import Link from "next/link";
import { ScrollText, Sparkles, Target, Network } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox, ContentCard } from "../../_components/ArticleLayout";

export default function DiplomaticScenariosArticle() {
  return (
    <ArticleLayout
      title="Diplomatic Scenarios"
      description="Engage with dynamic diplomatic events featuring trade negotiations, cultural exchanges, crisis mediation, and alliance formation — all shaped by NPC personalities."
      icon={ScrollText}
    >
      <ContentCard>
      <Section title="What Are Diplomatic Scenarios?">
        <p className="mb-3 text-slate-700 dark:text-slate-300">
          Diplomatic scenarios are dynamic events that appear based on world
          conditions, your relationships, and sometimes pure chance. They present
          you with a situation &mdash; a trade opportunity, a crisis that needs
          mediating, an alliance proposal &mdash; and ask you to choose how to
          respond. Your decisions have real consequences for your relationships,
          economy, and reputation.
        </p>
        <p className="text-slate-700 dark:text-slate-300">
          Scenarios appear on your{" "}
          <Link
            href="/mycountry/diplomacy"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            MyCountry &rarr; Diplomacy
          </Link>{" "}
          page when they become available. You will also receive notifications
          when a new scenario requires your attention.
        </p>
      </Section>

      <Section title="Scenario Categories">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Trade &amp; Economic:</strong> Bilateral trade agreements,
            tariff negotiations, investment partnerships, resource-sharing deals,
            and market access opportunities.
          </li>
          <li>
            <strong>Cultural &amp; Educational:</strong> Student exchange
            programs, cultural festivals, joint research projects, language
            partnerships, and heritage preservation initiatives.
          </li>
          <li>
            <strong>Security &amp; Defense:</strong> Intelligence-sharing
            agreements, joint military training, base access negotiations, defense
            pacts, and crisis response coordination.
          </li>
          <li>
            <strong>Crisis Mediation:</strong> Border disputes, refugee
            assistance, humanitarian relief operations, conflict de-escalation,
            and peace negotiations.
          </li>
          <li>
            <strong>Alliance &amp; Coalition:</strong> Regional partnerships,
            voting blocs, joint diplomatic initiatives, multilateral frameworks,
            and treaty negotiations.
          </li>
        </ul>
      </Section>
      </ContentCard>

      <ContentCard>
      <Section title="How Scenarios Play Out">
        <InfoBox title="From Trigger to Outcome">
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              <strong>A Scenario Appears:</strong> Scenarios are triggered by
              world events, your current relationships, or random opportunities.
              Each month, there is roughly a 5&ndash;15% chance a new scenario
              will appear for your country.
            </li>
            <li>
              <strong>You Review the Situation:</strong> The scenario gives you
              context about what is happening, who is involved, what is at stake,
              and what your options are. You will also see predicted outcomes for
              each choice.
            </li>
            <li>
              <strong>You Make a Decision:</strong> Choose from 2&ndash;5
              response options, each with different costs, benefits, and levels of
              risk. There is rarely a single "right" answer &mdash; it depends on
              your strategy.
            </li>
            <li>
              <strong>The Other Country Responds:</strong> The partner country
              reacts based on their{" "}
              <Link
                href="/help/diplomacy/npc-personalities"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                personality traits
              </Link>
              , your relationship strength, and their own national interests.
            </li>
            <li>
              <strong>Outcomes Are Applied:</strong> The results affect your
              relationships, economy, reputation, and resources. Everything is
              logged to your diplomatic history so you can review past decisions.
            </li>
          </ol>
        </InfoBox>
      </Section>

      <Section title="How NPC Personalities Shape Scenarios">
        <p className="mb-3 text-slate-700 dark:text-slate-300">
          NPC responses are not random. Every NPC country has{" "}
          <Link
            href="/help/diplomacy/npc-personalities"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            8 personality traits
          </Link>{" "}
          that determine how they react to your choices, combined with your
          current relationship strength:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Pragmatists:</strong> Focus on economic benefits. They will
            accept deals that offer clear mutual gain.
          </li>
          <li>
            <strong>Idealists:</strong> Prioritize principles. They may reject
            proposals that conflict with their values, even if economically
            beneficial.
          </li>
          <li>
            <strong>Aggressors:</strong> Demand favorable terms and may threaten
            consequences if you refuse their counter-offers.
          </li>
          <li>
            <strong>Diplomats:</strong> Seek compromise and often propose
            creative win-win alternatives you had not considered.
          </li>
          <li>
            <strong>Opportunists:</strong> Watch out &mdash; they may exploit
            crises for their own advantage rather than working toward resolution.
          </li>
          <li>
            <strong>Isolationists:</strong> Reluctant participants. Do not expect
            them to engage enthusiastically, but they can be reliable partners
            once committed.
          </li>
        </ul>
      </Section>
      </ContentCard>

      <ContentCard fullWidth>
      <Section title="Scenario Outcomes">
        <InfoBox title="What Can Change">
          <p className="mb-2">
            Every scenario decision can produce several types of impact:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Relationship Changes:</strong> Your standing with the
              involved country can improve or decline significantly based on how
              your proposal is received.
            </li>
            <li>
              <strong>Economic Effects:</strong> Trade volume changes, investment
              flows, and market access gains or losses.
            </li>
            <li>
              <strong>Reputation Shifts:</strong> Your regional influence,
              diplomatic credibility, and leadership status may be adjusted.
            </li>
            <li>
              <strong>Resource Transfers:</strong> Aid packages, technology
              sharing, military assistance, or cultural programs may be
              exchanged.
            </li>
            <li>
              <strong>Long-term Agreements:</strong> Treaties, partnerships, and
              frameworks that persist and shape future interactions.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <WarningBox title="Strategic Tips">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <Sparkles className="inline h-4 w-4" /> Check the other country's{" "}
            <Link
              href="/help/diplomacy/npc-personalities"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              personality profile
            </Link>{" "}
            before responding. Knowing whether you are dealing with a Pragmatist
            or an Aggressor changes everything.
          </li>
          <li>
            <Target className="inline h-4 w-4" /> Pay attention to predicted
            outcomes. The scenario interface shows you likely results for each
            option, so weigh the risk-reward carefully.
          </li>
          <li>
            <Network className="inline h-4 w-4" /> Think long-term. A
            short-term sacrifice can lead to a lasting alliance that pays off many
            times over.
          </li>
        </ul>
      </WarningBox>

      <Section title="Scenario Management">
        <p className="text-slate-700 dark:text-slate-300">
          Diplomatic scenarios are created and balanced by platform administrators.
          The scenarios you encounter are drawn from a curated library of
          templates that are regularly updated to keep the diplomatic landscape
          fresh and engaging. If you have admin access, you can manage scenario
          templates through the{" "}
          <Link
            href="/help/admin/reference-data"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Admin Reference Data
          </Link>{" "}
          tools.
        </p>
      </Section>

      <InfoBox title="Related Guides">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Link
              href="/help/diplomacy/npc-personalities"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              NPC Personalities
            </Link>{" "}
            &mdash; Understanding how NPC traits shape scenario responses.
          </li>
          <li>
            <Link
              href="/help/diplomacy/missions"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Diplomatic Missions
            </Link>{" "}
            &mdash; Targeted operations you can launch alongside scenarios.
          </li>
          <li>
            <Link
              href="/help/diplomacy/embassies"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Embassy Network
            </Link>{" "}
            &mdash; The diplomatic infrastructure that enables scenarios.
          </li>
          <li>
            <Link
              href="/help/admin/reference-data"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Admin Reference Data
            </Link>{" "}
            &mdash; Managing scenario templates (admin only).
          </li>
        </ul>
      </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
