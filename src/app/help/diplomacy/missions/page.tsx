"use client";

import Link from "next/link";
import { Plane, CheckCircle, AlertCircle, MapPin, Clock } from "lucide-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function MissionsArticle() {
  return (
    <ArticleLayout
      title="Diplomatic Missions"
      description="Plan, launch, and monitor missions to strengthen trade, security, and cultural ties with other nations."
      icon={Plane}
    >
      <ContentCard>
        <Section title="What Are Diplomatic Missions?">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            Diplomatic missions are targeted operations you send out from your{" "}
            <Link
              href="/help/diplomacy/embassies"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              embassies
            </Link>{" "}
            to achieve specific goals with another country. Whether you want to open new trade
            routes, coordinate joint security efforts, or build cultural goodwill, missions are how
            you turn diplomatic relationships into real results.
          </p>
          <p className="text-slate-700 dark:text-slate-300">
            You can find your active and available missions by navigating to{" "}
            <Link
              href="/mycountry/diplomacy"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              MyCountry &rarr; Diplomacy
            </Link>{" "}
            and opening the <strong>Missions</strong> tab.
          </p>
        </Section>

        <Section title="Mission Types">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Trade Missions:</strong> Negotiate bilateral trade deals, tariff reductions,
              or investment partnerships with a target country.
            </li>
            <li>
              <strong>Cultural Missions:</strong> Organize student exchanges, arts festivals, or
              joint research to boost relations and unlock cultural achievements.
            </li>
            <li>
              <strong>Security Missions:</strong> Coordinate intelligence sharing, joint military
              exercises, or defense agreements.
            </li>
            <li>
              <strong>Humanitarian Missions:</strong> Deliver aid, assist with refugee crises, or
              support disaster relief in partner nations.
            </li>
            <li>
              <strong>Goodwill Missions:</strong> General relationship-building efforts such as
              state visits, gift exchanges, and summit attendance.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Mission Workflow">
          <InfoBox title="Step-by-Step">
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                <strong>Choose Your Mission:</strong> From{" "}
                <Link
                  href="/mycountry/diplomacy"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  MyCountry &rarr; Diplomacy
                </Link>
                , select the mission type that aligns with your strategic goals.
              </li>
              <li>
                <strong>Select a Target Country:</strong> Pick the nation you want to engage with.
                You will need an active{" "}
                <Link
                  href="/help/diplomacy/embassies"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  embassy
                </Link>{" "}
                in that country for most mission types.
              </li>
              <li>
                <strong>Assign Your Team &amp; Set Objectives:</strong> Confirm your mission
                parameters, including difficulty level, resource commitment, and timeline.
              </li>
              <li>
                <strong>Launch &amp; Monitor:</strong> Once active, track your mission's progress
                through status updates and milestone notifications on your Diplomacy page.
              </li>
              <li>
                <strong>Review Outcomes:</strong> When the mission concludes, review the results.
                Successful missions boost your relationship with the target country and may unlock
                new opportunities.
              </li>
            </ol>
          </InfoBox>
        </Section>

        <Section title="How Success Is Determined">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Your Relationship Strength:</strong> Stronger existing ties with a country
              improve your chances of mission success.
            </li>
            <li>
              <strong>NPC Personality:</strong> The target country's{" "}
              <Link
                href="/help/diplomacy/npc-personalities"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                personality and behavioral traits
              </Link>{" "}
              influence how they respond to your mission. A Pragmatist will prioritize mutual
              economic benefit, while an Idealist cares about shared values.
            </li>
            <li>
              <strong>Mission Type &amp; Context:</strong> Some mission types are naturally harder
              than others. Security missions during a regional crisis, for example, carry higher
              stakes and risk.
            </li>
            <li>
              <strong>Resource Investment:</strong> Committing more resources to a mission generally
              improves its odds of success.
            </li>
            <li>
              <strong>Active Scenarios:</strong> Ongoing{" "}
              <Link
                href="/help/diplomacy/scenarios"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                diplomatic scenarios
              </Link>{" "}
              can create favorable or unfavorable conditions for your missions.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard fullWidth>
        <WarningBox title="Tips for Success">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <CheckCircle className="inline h-4 w-4" /> Align missions with your broader strategy.
              If you are building a trade network, stack trade missions with countries that have
              favorable economic policies.
            </li>
            <li>
              <CheckCircle className="inline h-4 w-4" /> Check the target country's{" "}
              <Link
                href="/help/diplomacy/npc-personalities"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                NPC personality
              </Link>{" "}
              before launching. Sending a cultural mission to an Isolationist is unlikely to
              succeed.
            </li>
            <li>
              <AlertCircle className="inline h-4 w-4" /> Address mission failures promptly. Failed
              missions can trigger intelligence alerts and may damage your relationship with the
              target country.
            </li>
            <li>
              <MapPin className="inline h-4 w-4" /> Establish an{" "}
              <Link
                href="/help/diplomacy/embassies"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                embassy
              </Link>{" "}
              first. Most mission types require an active embassy in the target country.
            </li>
            <li>
              <Clock className="inline h-4 w-4" /> Be patient with timelines. Complex missions take
              multiple IxTime periods to complete but typically yield stronger outcomes.
            </li>
          </ul>
        </WarningBox>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/diplomacy/embassies"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Embassy Network
              </Link>{" "}
              &mdash; Setting up embassies to enable missions.
            </li>
            <li>
              <Link
                href="/help/diplomacy/scenarios"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Diplomatic Scenarios
              </Link>{" "}
              &mdash; Dynamic events that can affect your missions.
            </li>
            <li>
              <Link
                href="/help/diplomacy/npc-personalities"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                NPC Personalities
              </Link>{" "}
              &mdash; Understanding how other nations think and react.
            </li>
            <li>
              <Link
                href="/help/mycountry/diplomacy"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                MyCountry Diplomacy Overview
              </Link>{" "}
              &mdash; Your central hub for all diplomatic activity.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
