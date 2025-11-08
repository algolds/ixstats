"use client";

import { Brain, Users2, TrendingUp, Target } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function NPCPersonalitiesArticle() {
  return (
    <ArticleLayout
      title="NPC Personality & Behavioral AI"
      description="Understand how NPC countries develop distinct personalities through 8 traits, 6 archetypes, and dynamic behavioral prediction."
      icon={Brain}
    >
      <Section title="8 Core Personality Traits (0-100 Scale)">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Assertiveness:</strong> Willingness to take strong diplomatic stances. High =
            confrontational, Low = accommodating.
          </li>
          <li>
            <strong>Cooperativeness:</strong> Preference for multilateral solutions. High = seeks
            alliances, Low = unilateral action.
          </li>
          <li>
            <strong>Risk Tolerance:</strong> Acceptance of uncertain outcomes. High = bold gambits,
            Low = cautious approaches.
          </li>
          <li>
            <strong>Pragmatism:</strong> Emphasis on practical results over ideology. High =
            flexible, Low = principled/rigid.
          </li>
          <li>
            <strong>Transparency:</strong> Openness in communications. High = honest broker, Low =
            secretive/deceptive.
          </li>
          <li>
            <strong>Economic Focus:</strong> Priority on economic interests. High = trade-driven,
            Low = ideology/security focus.
          </li>
          <li>
            <strong>Military Orientation:</strong> Reliance on military power. High = strength-based,
            Low = diplomatic solutions.
          </li>
          <li>
            <strong>Cultural Openness:</strong> Receptiveness to foreign influence. High = cosmopolitan,
            Low = protectionist.
          </li>
        </ul>
      </Section>

      <Section title="6 Personality Archetypes">
        <InfoBox title="NPC Behavioral Profiles">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>The Pragmatist:</strong> High pragmatism, medium assertiveness. Focus on deals
              and practical outcomes.
            </li>
            <li>
              <strong>The Idealist:</strong> Low pragmatism, high cooperativeness. Values principles
              and multilateral frameworks.
            </li>
            <li>
              <strong>The Aggressor:</strong> High assertiveness, high military orientation. Seeks
              dominance through strength.
            </li>
            <li>
              <strong>The Diplomat:</strong> High cooperativeness, high transparency. Bridge-builder
              and mediator.
            </li>
            <li>
              <strong>The Opportunist:</strong> High risk tolerance, low transparency. Exploits
              situations for advantage.
            </li>
            <li>
              <strong>The Isolationist:</strong> Low cooperativeness, low cultural openness. Prefers
              self-reliance.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Trait Calculation (Data-Driven)">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            All traits calculated from <strong>observable database data</strong> – no manual
            assignments.
          </li>
          <li>
            <strong>Assertiveness:</strong> Hostile relationships (+10 each), weak relationships
            (+5), conflicts (+2).
          </li>
          <li>
            <strong>Cooperativeness:</strong> Alliances (+15 each), friendly nations (+8), treaties
            (+5).
          </li>
          <li>
            <strong>Economic Focus:</strong> Trade volume (×0.02), trade agreements (+8), economic
            partnerships (+5).
          </li>
          <li>
            Formulas documented in <code>docs/systems/npc-ai.md</code> with step-by-step examples.
          </li>
        </ul>
      </Section>

      <Section title="Behavioral Prediction">
        <InfoBox title="How NPCs Respond">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Diplomatic Proposals:</strong> Acceptance probability = f(assertiveness,
              cooperativeness, economic benefit).
            </li>
            <li>
              <strong>Crisis Events:</strong> Response strategy selected based on risk tolerance +
              military orientation.
            </li>
            <li>
              <strong>Trade Negotiations:</strong> Terms influenced by economic focus + pragmatism
              scores.
            </li>
            <li>
              <strong>Alliance Decisions:</strong> Cooperativeness + transparency determine
              partnership willingness.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Personality Drift">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Traits evolve dynamically based on experiences (max ±2 points per IxTime year).
          </li>
          <li>
            <strong>Positive Interactions:</strong> Successful diplomacy increases cooperativeness +
            transparency.
          </li>
          <li>
            <strong>Conflicts:</strong> Failed negotiations or hostilities increase assertiveness +
            military orientation.
          </li>
          <li>
            <strong>Economic Shocks:</strong> Crises may increase pragmatism while reducing risk
            tolerance.
          </li>
          <li>
            Drift system prevents abrupt personality changes; ensures consistent NPC behavior over
            time.
          </li>
        </ul>
      </Section>

      <Section title="API Integration">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <code>api.npcPersonalities.getPersonality</code> – Retrieve NPC's 8 traits + archetype
            classification.
          </li>
          <li>
            <code>api.npcPersonalities.predictResponse</code> – Estimate NPC reaction to proposed
            action.
          </li>
          <li>
            <code>api.npcPersonalities.getPersonalityHistory</code> – Track trait evolution over
            time.
          </li>
          <li>
            <code>api.diplomatic.getRelationModifiers</code> – See personality-based relationship
            adjustments.
          </li>
        </ul>
      </Section>

      <WarningBox title="Best Practices">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Users2 className="inline h-4 w-4" /> Review NPC personalities before major diplomatic
            initiatives to predict outcomes.
          </li>
          <li>
            <TrendingUp className="inline h-4 w-4" /> Track personality drift to identify changing
            NPC attitudes and adjust strategies.
          </li>
          <li>
            <Target className="inline h-4 w-4" /> Tailor proposals to NPC archetypes (e.g., economic
            deals for Pragmatists, alliances for Diplomats).
          </li>
        </ul>
      </WarningBox>

      <InfoBox title="Related Documentation">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <code>docs/systems/npc-ai.md</code> – Complete technical reference with formulas and
            examples.
          </li>
          <li>
            <code>/help/diplomacy/missions</code> – Using personality insights in diplomatic
            missions.
          </li>
          <li>
            <code>/help/diplomacy/scenarios</code> – NPC responses in dynamic scenarios.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
