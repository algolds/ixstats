"use client";

import { AlertTriangle, Waves, TrendingDown, Users } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function CrisisEventsArticle() {
  return (
    <ArticleLayout
      title="Crisis Events Management"
      description="Handle dynamic crisis events including natural disasters, economic crises, diplomatic incidents, and social unrest with strategic response options."
      icon={AlertTriangle}
    >
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
            <strong>Social Unrest:</strong> Protests (peaceful/violent), strikes (sectoral/general),
            riots, civil disorder, separatist movements.
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
              <strong>Alert:</strong> Immediate notification in intelligence dashboard with severity
              assessment.
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
              <strong>Resolution:</strong> Event concludes after duration period; outcomes logged to
              history.
            </li>
          </ol>
        </InfoBox>
      </Section>

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
            <strong>Ignore/Delay:</strong> No immediate action; crisis may escalate with compounding
            effects.
          </li>
        </ul>
      </Section>

      <Section title="Impact Calculations">
        <InfoBox title="How Damage is Assessed">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Natural Disasters:</strong> <code>GDPImpact = baseDamage × populationDensity ×
              (1 - infrastructureQuality)</code>
            </li>
            <li>
              <strong>Economic Crises:</strong> <code>GDPImpact = baseDamage × (debtRatio / 60) ×
              (1 - fiscalResilience)</code>
            </li>
            <li>
              <strong>Diplomatic Incidents:</strong> <code>relationStrength = currentStrength ×
              (1 - incidentSeverity × 0.3)</code>
            </li>
            <li>
              <strong>Social Unrest:</strong> <code>stabilityImpact = -baseSeverity × (1 - governmentLegitimacy)</code>
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="API Integration">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <code>api.crisisEvents.getActiveCrises</code> – List all active crises for a country.
          </li>
          <li>
            <code>api.crisisEvents.respondToCrisis</code> – Submit response strategy with resource
            allocation.
          </li>
          <li>
            <code>api.crisisEvents.getCrisisHistory</code> – Review past events and outcomes.
          </li>
          <li>
            <code>api.intelligence.dashboard</code> – Crisis alerts integrated into executive
            briefings.
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
            <TrendingDown className="inline h-4 w-4" /> Monitor economic indicators; high debt/deficit
            increases crisis probability.
          </li>
          <li>
            <Users className="inline h-4 w-4" /> Maintain strong diplomatic relations for effective
            aid requests during crises.
          </li>
          <li>Document crisis responses in ThinkPages for campaign narrative continuity.</li>
        </ul>
      </WarningBox>

      <InfoBox title="Related Documentation">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <code>docs/systems/crisis-events.md</code> – Complete technical reference with formulas.
          </li>
          <li>
            <code>/help/intelligence/alerts</code> – Alert triage and prioritization workflows.
          </li>
          <li>
            <code>/help/defense/stability</code> – Political stability management strategies.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
