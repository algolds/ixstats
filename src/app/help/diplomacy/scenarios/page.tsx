"use client";

import { ScrollText, Sparkles, Target, Network } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function DiplomaticScenariosArticle() {
  return (
    <ArticleLayout
      title="Dynamic Diplomatic Scenarios"
      description="Engage with 100+ dynamic diplomatic scenarios featuring trade negotiations, cultural exchanges, crisis mediation, and alliance formation with NPC personality integration."
      icon={ScrollText}
    >
      <Section title="Scenario Categories">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Trade & Economic:</strong> Bilateral agreements, tariff negotiations, investment
            partnerships, resource sharing, market access deals.
          </li>
          <li>
            <strong>Cultural & Educational:</strong> Student exchanges, cultural festivals, joint
            research programs, language partnerships, heritage preservation.
          </li>
          <li>
            <strong>Security & Defense:</strong> Intelligence sharing, joint training, base access,
            defense pacts, crisis response coordination.
          </li>
          <li>
            <strong>Crisis Mediation:</strong> Border dispute resolution, refugee assistance,
            humanitarian relief, conflict de-escalation, peace negotiations.
          </li>
          <li>
            <strong>Alliance & Coalition:</strong> Regional partnerships, voting blocs, joint
            initiatives, multilateral frameworks, treaty negotiations.
          </li>
        </ul>
      </Section>

      <Section title="Scenario Lifecycle">
        <InfoBox title="From Trigger to Outcome">
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              <strong>Generation:</strong> Scenarios triggered by events, relations, or random
              opportunities (5-15% monthly probability).
            </li>
            <li>
              <strong>Presentation:</strong> Player receives scenario with context, objectives,
              available options, and predicted outcomes.
            </li>
            <li>
              <strong>Decision:</strong> Select from 2-5 response options with varying costs,
              benefits, and risks.
            </li>
            <li>
              <strong>NPC Response:</strong> Partner country reacts based on personality traits,
              relationship strength, and national interests.
            </li>
            <li>
              <strong>Resolution:</strong> Outcomes applied to relations, economy, reputation, or
              resources; logged to history.
            </li>
          </ol>
        </InfoBox>
      </Section>

      <Section title="NPC Personality Integration">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            NPC responses determined by <strong>8 personality traits</strong> + current relationship
            strength.
          </li>
          <li>
            <strong>Pragmatists:</strong> Focus on economic benefits; accept deals with mutual gain.
          </li>
          <li>
            <strong>Idealists:</strong> Prioritize principles; reject proposals conflicting with
            values.
          </li>
          <li>
            <strong>Aggressors:</strong> Demand favorable terms; threaten consequences if refused.
          </li>
          <li>
            <strong>Diplomats:</strong> Seek compromise; propose win-win alternatives.
          </li>
          <li>
            See <code>/help/diplomacy/npc-personalities</code> for trait calculation and behavioral
            prediction.
          </li>
        </ul>
      </Section>

      <Section title="Scenario Outcomes">
        <InfoBox title="Impact Types">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Relationship Changes:</strong> ±10 to ±30 strength based on proposal quality +
              NPC acceptance.
            </li>
            <li>
              <strong>Economic Effects:</strong> Trade volume changes, investment flows, market
              access gains/losses.
            </li>
            <li>
              <strong>Reputation Shifts:</strong> Regional influence, diplomatic credibility,
              leadership status adjustments.
            </li>
            <li>
              <strong>Resource Transfers:</strong> Aid packages, technology sharing, military
              assistance, cultural programs.
            </li>
            <li>
              <strong>Long-term Agreements:</strong> Treaties, partnerships, and frameworks that
              persist across IxTime.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="API Integration">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <code>api.diplomaticScenarios.getActiveScenarios</code> – List available scenarios for
            player's country.
          </li>
          <li>
            <code>api.diplomaticScenarios.respondToScenario</code> – Submit decision with selected
            option.
          </li>
          <li>
            <code>api.diplomaticScenarios.getScenarioHistory</code> – Review past scenarios and
            outcomes.
          </li>
          <li>
            <code>api.npcPersonalities.predictResponse</code> – Estimate NPC reaction before
            committing.
          </li>
          <li>
            Router provides 15 procedures (6 queries, 9 mutations) for complete scenario management.
          </li>
        </ul>
      </Section>

      <Section title="Admin Scenario Management">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Scenario Editor:</strong> <code>/admin/diplomatic-scenarios</code> – Create,
            edit, delete scenario templates.
          </li>
          <li>
            <strong>Trigger Configuration:</strong> Set probability weights, prerequisite conditions,
            cooldown periods.
          </li>
          <li>
            <strong>Outcome Templates:</strong> Define response options with cost/benefit matrices,
            NPC personality modifiers.
          </li>
          <li>
            All scenarios stored in database; enables dynamic content updates without code
            deployments.
          </li>
        </ul>
      </Section>

      <InfoBox title="Related Documentation">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Sparkles className="inline h-4 w-4" />{" "}
            <code>/help/diplomacy/npc-personalities</code> – Understanding NPC behavioral AI.
          </li>
          <li>
            <Target className="inline h-4 w-4" /> <code>/help/diplomacy/missions</code> – Embassy
            missions and diplomatic operations.
          </li>
          <li>
            <Network className="inline h-4 w-4" />{" "}
            <code>/help/admin/reference-data</code> – Managing scenario templates via admin CMS.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
