import Link from "next/link";
import { Clock, Activity, RefreshCw } from "lucide-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function IxTimeArticle() {
  return (
    <ArticleLayout
      title="The World Clock (IxTime)"
      description="Time here moves at twice real speed. Here's what that means for your nation."
      icon={Clock}
      prevLink={{
        href: "/help/getting-started/gameplay-overview",
        label: "How It All Fits Together",
      }}
      nextLink={{ href: "/help/getting-started/navigation", label: "Finding Your Way Around" }}
    >
      <ContentCard>
        <Section title="A World on Its Own Clock">
          <p className="mb-4 text-slate-700 dark:text-slate-300">
            IxStats keeps its own time, called <strong>IxTime</strong>, and it runs at{" "}
            <strong>twice the speed of real life</strong> — one real hour is two hours in the world.
            That faster pace is what keeps the world feeling alive: history piles up, economies
            move, and events arrive at a steady, satisfying clip.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Everything in the world — your economy, events, diplomacy — runs on IxTime, not your
              local clock.
            </li>
            <li>
              The whole community shares the same clock, so everyone&rsquo;s nations move through
              the same moment in history together.
            </li>
            <li>
              You can always see the current date and time at the top of the screen and on your{" "}
              <Link
                href="/help/mycountry/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                MyCountry overview
              </Link>
              .
            </li>
          </ul>
        </Section>

        <Section title="What It Means for Your Nation">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Issues arrive faster</strong> — new{" "}
              <Link
                href="/help/gameplay/national-issues"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                national issues
              </Link>{" "}
              show up on the world clock, so they come around about twice as often as you&rsquo;d
              expect by your own watch.
            </li>
            <li>
              <strong>Your economy keeps moving</strong> — growth, revenue, and{" "}
              <Link
                href="/help/economy/calculations"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                the numbers
              </Link>{" "}
              all advance on IxTime, and your charts are dated in IxTime too.
            </li>
            <li>
              <strong>Diplomacy is quicker</strong> —{" "}
              <Link
                href="/help/diplomacy/missions"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                missions
              </Link>{" "}
              and{" "}
              <Link
                href="/help/diplomacy/scenarios"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                scenarios
              </Link>{" "}
              resolve on the world clock. A mission that says &ldquo;one day&rdquo; finishes in
              about twelve real-world hours.
            </li>
            <li>
              <strong>Crises feel urgent</strong> —{" "}
              <Link
                href="/help/defense/crisis-events"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                crises
              </Link>{" "}
              and disasters unfold on IxTime, so their deadlines arrive sooner than wall-clock time
              would suggest.
            </li>
            <li>
              <strong>A timeline you can look back on</strong> — every event and headline is stamped
              with IxTime, so your nation builds a real, readable history over time.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Where to See the Clock">
          <InfoBox title="Always within reach">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Top of the screen</strong> — the current IxTime date and time, so you always
                know where you are in the world.
              </li>
              <li>
                <strong>Your MyCountry overview</strong> — the clock sits right alongside your
                nation&rsquo;s vital signs.
              </li>
              <li>
                <strong>On every event</strong> — notifications, headlines, and diplomatic moments
                are all stamped with IxTime so you can piece together what happened and when.
              </li>
              <li>
                <strong>In the community</strong> — the shared world clock keeps everyone&rsquo;s
                nations in the same moment.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <WarningBox title="Good to Know">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Activity className="inline h-4 w-4" /> Because time moves at 2&times; speed,
              deadlines sneak up faster than you expect. Check in regularly so you don&rsquo;t miss
              a decision or let an event expire.
            </li>
            <li>
              <RefreshCw className="inline h-4 w-4" /> If the clock ever looks out of step with
              other players, just refresh the page — it&rsquo;ll catch right back up.
            </li>
          </ul>
        </WarningBox>
      </ContentCard>
    </ArticleLayout>
  );
}
