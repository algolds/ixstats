import Link from "next/link";
import { WarningTriangle as AlertTriangle, SeaWaves as Waves, StatDown as TrendingDown, Group as Users } from "iconoir-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function CrisisEventsArticle() {
  return (
    <ArticleLayout
      title="Crisis Events Management"
      description="Handle dynamic crisis events including natural disasters, economic crises, diplomatic incidents, and social unrest with strategic response options."
      icon={AlertTriangle}
    >
      <ContentCard>
        <Section title="Crisis Event Types">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Natural Disasters:</strong> Earthquakes (mag 3.0-9.0), floods, hurricanes (Cat
              1-5), wildfires, droughts, volcanic eruptions, tsunamis.
            </li>
            <li>
              <strong>Economic Crises:</strong> Market crashes (-10% to -40%), currency crises,
              banking failures, debt defaults, trade disruptions, commodity shocks.
            </li>
            <li>
              <strong>Diplomatic Incidents:</strong> Border disputes, embassy closures, sanctions,
              treaty violations, espionage discoveries, diplomatic expulsions.
            </li>
            <li>
              <strong>Social Unrest:</strong> Protests (peaceful/violent), strikes
              (sectoral/general), riots, civil disorder, separatist movements.
            </li>
          </ul>
        </Section>

        <Section title="Event Lifecycle">
          <InfoBox title="From Detection to Resolution">
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                <strong>Trigger:</strong> Events generated based on geographic location, economic
                conditions, or diplomatic relations.
              </li>
              <li>
                <strong>Alert:</strong> Immediate notification in intelligence dashboard with
                severity assessment.
              </li>
              <li>
                <strong>Response:</strong> Player selects response strategy from available options
                (prepared, improvised, or ignore).
              </li>
              <li>
                <strong>Impact:</strong> Calculations apply effects to GDP, stability, relations, or
                population based on response quality.
              </li>
              <li>
                <strong>Resolution:</strong> Event concludes after duration period; outcomes logged
                to history.
              </li>
            </ol>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Response Strategies">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Prepared Response:</strong> Pre-planned protocols reduce impact by 40-60%.
              Requires crisis preparedness investments.
            </li>
            <li>
              <strong>Improvised Response:</strong> Ad-hoc measures with 10-30% impact reduction.
              Available to all nations.
            </li>
            <li>
              <strong>Request Aid:</strong> Seek international assistance; effectiveness depends on
              diplomatic relations.
            </li>
            <li>
              <strong>Ignore/Delay:</strong> No immediate action; crisis may escalate with
              compounding effects.
            </li>
          </ul>
        </Section>

        <Section title="What Affects Impact">
          <InfoBox title="How Damage is Assessed">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Natural Disasters:</strong> Damage depends on population density and your
                infrastructure quality — better infrastructure means less damage.
              </li>
              <li>
                <strong>Economic Crises:</strong> Impact scales with your debt ratio — high debt
                makes crises worse. Fiscal resilience reduces the blow.
              </li>
              <li>
                <strong>Diplomatic Incidents:</strong> Relationship damage depends on incident
                severity. Stronger pre-existing relations weather incidents better.
              </li>
              <li>
                <strong>Social Unrest:</strong> Stability impact depends on the severity of unrest
                and your government&apos;s legitimacy.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Tracking Crises">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              View all active crises from your <strong>MyCountry &rarr; Defense</strong> dashboard.
            </li>
            <li>Submit response strategies with resource allocation for each active crisis.</li>
            <li>Review past events and outcomes in your crisis history.</li>
            <li>
              Crisis alerts also appear in your{" "}
              <Link
                href="/help/intelligence/dashboard"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Intelligence Dashboard
              </Link>{" "}
              for executive briefings.
            </li>
          </ul>
        </Section>

        <WarningBox title="Best Practices">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Waves className="inline h-4 w-4" /> Invest in crisis preparedness infrastructure to
              unlock prepared response options.
            </li>
            <li>
              <TrendingDown className="inline h-4 w-4" /> Monitor economic indicators; high
              debt/deficit increases crisis probability.
            </li>
            <li>
              <Users className="inline h-4 w-4" /> Maintain strong diplomatic relations for
              effective aid requests during crises.
            </li>
            <li>Document crisis responses in ThinkPages for campaign narrative continuity.</li>
          </ul>
        </WarningBox>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/intelligence/alerts"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Alerts & Notifications
              </Link>{" "}
              — Alert triage and prioritization workflows.
            </li>
            <li>
              <Link
                href="/help/defense/stability"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Political Stability
              </Link>{" "}
              — Stability management strategies.
            </li>
            <li>
              <Link
                href="/help/defense/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Defense Overview
              </Link>{" "}
              — High-level defense system guide.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
