import Link from "next/link";
import { LineChart, Brain, Repeat } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function EconomicModelingArticle() {
  const linkClass = "text-blue-600 hover:underline dark:text-blue-400";

  return (
    <ArticleLayout
      title="Economic Modeling & Projections"
      description="Simulate future scenarios for your nation and see how today's decisions shape tomorrow's economy."
      icon={LineChart}
    >
      <ContentCard>
        <Section title="Where to Find the Modeling Tools">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            You can access economic modeling from two places:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>MyCountry &rarr; Economy</strong> &mdash; Open your country dashboard and
              navigate to the Economy section. The modeling panel appears alongside your current
              economic data.
            </li>
            <li>
              <strong>Country Profile &rarr; Modeling tab</strong> &mdash; Visit any country&apos;s
              public profile and select the <em>Modeling</em> tab to run projections for that
              nation.
            </li>
          </ul>
        </Section>

        <Section title="What You Can Simulate">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            The modeling tools let you experiment with a wide range of economic variables before
            committing to real changes:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Growth rates</strong> &mdash; Adjust GDP growth assumptions to see how faster
              or slower expansion affects your economy over time.
            </li>
            <li>
              <strong>Policy changes</strong> &mdash; Toggle tax rates, government spending levels,
              trade policies, and other levers to preview their long-term impact.
            </li>
            <li>
              <strong>Economic shocks</strong> &mdash; Introduce sudden events like recessions,
              resource booms, or market crashes to stress-test your nation&apos;s resilience.
            </li>
            <li>
              <strong>Population &amp; inflation</strong> &mdash; Modify demographic trends and
              inflation expectations to understand how they interact with your other choices.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Reading Your Projections">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            After you configure a scenario, the system generates projections across three time
            horizons:
          </p>
          <InfoBox title="Projection Horizons">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>1-Year</strong> &mdash; Short-term outlook. Shows immediate effects of your
                changes, useful for reacting to current events or fine-tuning policy.
              </li>
              <li>
                <strong>5-Year</strong> &mdash; Medium-term trends. Reveals whether your policies
                are sustainable and where compounding effects start to appear.
              </li>
              <li>
                <strong>10-Year</strong> &mdash; Long-term trajectory. Helps you plan grand strategy
                and spot potential problems well before they arrive.
              </li>
            </ul>
          </InfoBox>
          <p className="mt-3 text-slate-700 dark:text-slate-300">
            Each projection displays key metrics like GDP, debt-to-GDP ratio, unemployment, and
            government revenue so you can compare your scenario against the current baseline.
          </p>
        </Section>

        <Section title="How Results Affect Your Nation">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Compliance &amp; achievements</strong> &mdash; If a projection shows you
              missing key economic thresholds, you may receive compliance tasks or lose progress
              toward achievements. Running projections early helps you course-correct.
            </li>
            <li>
              <strong>Informed decision-making</strong> &mdash; Use projections to compare multiple
              scenarios side by side before enacting policies through the Executive dashboard.
            </li>
            <li>
              <strong>Campaign tracking</strong> &mdash; Save noteworthy scenarios and share them on
              ThinkPages to document your nation&apos;s economic strategy over time.
            </li>
          </ul>
        </Section>

        <Section title="Tips for Better Modeling">
          <InfoBox title="Best Practices">
            <ol className="list-decimal space-y-1 pl-6">
              <li>
                Run projections after making significant changes in the Country Builder or adjusting
                policies.
              </li>
              <li>
                Test extreme scenarios (deep recession, rapid growth) to understand the boundaries
                of your economy.
              </li>
              <li>Compare your projections against other nations to benchmark your performance.</li>
              <li>
                Revisit saved scenarios periodically to see how actual performance compares to your
                predictions.
              </li>
            </ol>
          </InfoBox>
        </Section>

        <InfoBox title="Learn More">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Brain className="inline h-4 w-4" />{" "}
              <Link href="/help/economy/calculations" className={linkClass}>
                Economic Calculations
              </Link>{" "}
              &mdash; Understand the math behind projections and how results are computed.
            </li>
            <li>
              <Repeat className="inline h-4 w-4" />{" "}
              <Link href="/help/economy/tiers" className={linkClass}>
                Economic Tiers
              </Link>{" "}
              &mdash; Learn how your nation&apos;s tier influences growth rates and modeling
              outcomes.
            </li>
            <li>
              <LineChart className="inline h-4 w-4" />{" "}
              <Link href="/help/economy/tiers" className={linkClass}>
                Economic Tiers
              </Link>{" "}
              &mdash; how your economy grows and climbs the ladder.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
