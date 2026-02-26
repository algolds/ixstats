"use client";

import Link from "next/link";
import { Clock, Activity, Network } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox, ContentCard } from "../../_components/ArticleLayout";

export default function IxTimeArticle() {
  return (
    <ArticleLayout
      title="Understanding IxTime"
      description="IxTime is the in-world clock that drives everything in IxStats. Here's what it means for you and your country."
      icon={Clock}
    >
      <ContentCard>
      <Section title="What Is IxTime?">
        <p className="mb-4 text-slate-700 dark:text-slate-300">
          IxTime is the accelerated clock used throughout IxStats. It runs at{" "}
          <strong>twice the speed of real time</strong>, meaning one real-world
          hour equals two hours of in-game time. This faster pace keeps the
          simulation dynamic and ensures your country is always evolving.
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Every event, economic cycle, and diplomatic interaction is tied to
            IxTime rather than your local clock.
          </li>
          <li>
            The same clock is shared by the Discord bot and all scheduled
            in-world events, so everything stays perfectly in sync.
          </li>
          <li>
            You can see the current IxTime displayed in the navigation bar and
            on your{" "}
            <Link
              href="/help/mycountry/overview"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              My Country
            </Link>{" "}
            dashboard.
          </li>
        </ul>
      </Section>

      <Section title="How IxTime Affects Your Country">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>National Issues</strong> &mdash; New{" "}
            <Link
              href="/help/gameplay/national-issues"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              issues and decisions
            </Link>{" "}
            arrive on the IxTime schedule. Because time moves at 2x speed, you
            will see new issues appear roughly twice as often as you might
            expect.
          </li>
          <li>
            <strong>Economy</strong> &mdash; GDP growth, tax revenue, trade
            balances, and all{" "}
            <Link
              href="/help/economy/calculations"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              economic calculations
            </Link>{" "}
            are computed on the accelerated clock. Projections and historical
            charts use IxTime dates, not real-world dates.
          </li>
          <li>
            <strong>Diplomacy</strong> &mdash;{" "}
            <Link
              href="/help/diplomacy/missions"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Diplomatic missions
            </Link>
            , treaty countdowns, and{" "}
            <Link
              href="/help/diplomacy/scenarios"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              scenario events
            </Link>{" "}
            all follow IxTime. A mission that takes "one day" in-game actually
            completes in about twelve real-world hours.
          </li>
          <li>
            <strong>Crisis Events</strong> &mdash;{" "}
            <Link
              href="/help/defense/crisis-events"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Crises
            </Link>{" "}
            and natural disasters unfold on the IxTime timeline, so their
            deadlines and escalation windows feel faster than wall-clock time.
          </li>
          <li>
            <strong>Intelligence Feeds</strong> &mdash; All timestamps on your{" "}
            <Link
              href="/help/mycountry/intelligence"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              intelligence dashboard
            </Link>{" "}
            and diplomatic feeds are shown in IxTime so you can track events
            within the simulation timeline.
          </li>
        </ul>
      </Section>
      </ContentCard>

      <ContentCard>
      <Section title="Where to See IxTime">
        <InfoBox title="Finding the Clock">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Navigation Bar</strong> &mdash; The current IxTime date
              and time are displayed at the top of the screen so you always know
              where you are in the simulation.
            </li>
            <li>
              <strong>My Country Dashboard</strong> &mdash; Your{" "}
              <Link
                href="/help/mycountry/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                country overview
              </Link>{" "}
              shows IxTime alongside your national vitality metrics.
            </li>
            <li>
              <strong>Event Timestamps</strong> &mdash; Every notification,
              news item, and diplomatic event is stamped with IxTime so you can
              piece together what happened and when.
            </li>
            <li>
              <strong>Discord</strong> &mdash; The IxStats Discord bot
              announces the current IxTime and keeps your community in sync with
              in-game events.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <WarningBox title="Good to Know">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Activity className="inline h-4 w-4" /> Because time moves at 2x
            speed, deadlines approach faster than you might expect. Check your
            dashboards regularly so you don't miss important decisions or
            expiring events.
          </li>
          <li>
            <Network className="inline h-4 w-4" /> If the displayed IxTime
            ever looks out of sync with other players, try refreshing the page.
            The clock re-syncs automatically on each page load.
          </li>
        </ul>
      </WarningBox>
      </ContentCard>
    </ArticleLayout>
  );
}
