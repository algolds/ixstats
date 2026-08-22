import Link from "next/link";
import { Cog, Clock, TrendingUp, Zap } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function SimulationArticle() {
  return (
    <ArticleLayout
      title="How Your Nation Comes Alive"
      description="Your economy and the wider world keep moving even when you're away. Here's the rhythm of it."
      icon={Cog}
    >
      <ContentCard>
        <Section title="A World That Keeps Moving">
          <p>
            IxStats never really pauses. The whole world runs on{" "}
            <Link
              href="/help/getting-started/ixtime"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              IxTime
            </Link>{" "}
            — a clock that ticks at twice real speed — so your economy grows, events arrive, and
            conditions shift at a steady, lively pace, whether you&rsquo;re watching or not.
          </p>
          <p className="mt-3">
            <Clock className="inline h-4 w-4 text-blue-500" /> One in-world day passes every twelve
            real hours. Pop in once a day and you&rsquo;ll always find your nation a little further
            along its story.
          </p>
        </Section>

        <Section title="Your Economy, Always Growing">
          <InfoBox title="Climbing the tiers">
            <p>
              <TrendingUp className="inline h-4 w-4" /> Your wealth per person places your nation in
              one of seven{" "}
              <Link
                href="/help/economy/tiers"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                tiers
              </Link>
              , from Impoverished to Extravagant — and that tier sets the pace of your growth.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                Up-and-coming nations grow fast; mature ones grow slower but in bigger absolute
                terms.
              </li>
              <li>Cross a wealth threshold and you move up a tier automatically.</li>
              <li>Your taxes, spending, and debt all feed into how quickly you grow.</li>
              <li>Good governance and smart choices nudge your growth upward over time.</li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Things Happen">
          <p>The world keeps you on your toes in three ways:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <Zap className="inline h-4 w-4 text-red-500" />{" "}
              <Link
                href="/help/defense/crisis-events"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                <strong>Crises</strong>
              </Link>{" "}
              — disasters, downturns, and unrest, each with a severity and choices that shape how it
              ends.
            </li>
            <li>
              <Link
                href="/help/gameplay/national-issues"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                <strong>National issues</strong>
              </Link>{" "}
              — decisions that grow out of your nation&rsquo;s own situation, with consequences that
              stick.
            </li>
            <li>
              <Link
                href="/help/diplomacy/scenarios"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                <strong>Diplomatic scenarios</strong>
              </Link>{" "}
              — trade, culture, and security situations with other nations, shaped by who
              you&rsquo;re dealing with.
            </li>
          </ul>
        </Section>

        <Section title="Your Choices, Made Real">
          <p>The loop is simple, and it&rsquo;s always turning:</p>
          <ol className="mt-2 list-decimal space-y-2 pl-6">
            <li>
              <strong>You decide</strong> — through MyCountry, the builder, or your diplomacy.
            </li>
            <li>
              <strong>Your nation responds</strong> — the numbers update to reflect what you did.
            </li>
            <li>
              <strong>The world reflects it</strong> — your dashboards, the leaderboards, and your
              public profile all catch up, almost instantly.
            </li>
          </ol>
          <p className="mt-3">
            Your IxCredits and the things you check most refresh quickest, so you&rsquo;re always
            looking at the latest.
          </p>
        </Section>

        <InfoBox title="Keep Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/getting-started/ixtime"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                The World Clock (IxTime)
              </Link>{" "}
              — why time moves the way it does.
            </li>
            <li>
              <Link
                href="/help/economy/calculations"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                How Your Economy Is Measured
              </Link>{" "}
              — the numbers behind your growth.
            </li>
            <li>
              <Link
                href="/help/gameplay/national-issues"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                National Issues &amp; Decisions
              </Link>{" "}
              — the choices that shape your story.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
