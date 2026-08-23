import Link from "next/link";
import { Archery as Radar, Globe, Shield, Dashboard as LayoutDashboard } from "iconoir-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function StrategicIntelligenceArticle() {
  return (
    <ArticleLayout
      title="Strategic Intelligence"
      description="Plan your nation's long-term future with strategic briefings that look beyond day-to-day operations to the big picture."
      icon={Radar}
    >
      <ContentCard>
        <Section title="What Strategic Intelligence Offers">
          <p className="mb-4">
            While your daily dashboard keeps you informed about immediate developments, strategic
            intelligence helps you think in longer time horizons. These are the big-picture
            assessments that guide your nation&apos;s direction -- where you&apos;re headed over the
            coming periods and what major decisions lie ahead.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Periodic Assessments:</strong> Comprehensive summaries of your economic,
              diplomatic, and defense outlook. These pull together trends across all domains to give
              you a holistic view of your nation&apos;s trajectory.
            </li>
            <li>
              <strong>Scenario Plans:</strong> Forward-looking analyses that pair forecasts with
              recommended policy paths. See how different choices might play out and plan
              accordingly.
            </li>
            <li>
              <strong>Cross-Domain Alerts:</strong> Warnings about potential cascading risks -- when
              a problem in one area could trigger consequences in another. For example, a diplomatic
              deterioration that might disrupt trade routes and weaken your economy.
            </li>
          </ul>
        </Section>

        <Section title="Where to Find Strategic Briefings">
          <InfoBox title="Accessing Your Strategic Intelligence">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Intelligence Feed:</strong> Strategic briefings appear in the intelligence
                feed on your{" "}
                <Link
                  href="/mycountry/intelligence"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Intelligence page
                </Link>
                , marked with priority indicators so you can distinguish them from routine updates.
              </li>
              <li>
                <strong>ThinkPages Collections:</strong> Curate leadership briefing collections in
                ThinkPages to organize strategic insights alongside your own analysis and
                commentary.
              </li>
              <li>
                <strong>Executive Dashboard:</strong> High-priority strategic findings surface on
                your main{" "}
                <Link
                  href="/mycountry/intelligence"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  dashboard
                </Link>{" "}
                alongside daily metrics so you never miss a major development.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Using Strategic Intelligence for Major Decisions">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Alliance strategy:</strong> Before forming or breaking alliances, review your
              strategic assessments to understand how relationships are trending and what the
              long-term implications might be.
            </li>
            <li>
              <strong>Economic planning:</strong> Use scenario plans to evaluate major fiscal
              decisions -- tax reforms, trade agreements, infrastructure investment -- before
              committing.
            </li>
            <li>
              <strong>Defense posture:</strong> Strategic intelligence helps you decide when to
              invest in military capability, when to de-escalate, and how to position your forces
              for future contingencies.
            </li>
            <li>
              <strong>Crisis prevention:</strong> The best crisis is one that never happens. Use
              cross-domain alerts to identify brewing problems early and address root causes before
              they escalate.
            </li>
            <li>
              <strong>Build your narrative:</strong> Tag strategic posts and briefings in ThinkPages
              so they appear in curated collections. Over time, these become a valuable record of
              your nation&apos;s strategic evolution.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Globe className="inline h-4 w-4" />{" "}
              <Link
                href="/help/diplomacy/embassies"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Embassies &amp; Diplomacy
              </Link>{" "}
              -- understand how your diplomatic network shapes your strategic outlook.
            </li>
            <li>
              <Shield className="inline h-4 w-4" />{" "}
              <Link
                href="/help/mycountry/defense"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                MyCountry Defense Guide
              </Link>{" "}
              -- coordinate defense decisions with your strategic intelligence.
            </li>
            <li>
              <LayoutDashboard className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/dashboard"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Executive Intelligence Dashboard
              </Link>{" "}
              -- your daily starting point where strategic findings are highlighted.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
