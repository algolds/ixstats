import Link from "next/link";
import { Brain, Users2, TrendingUp, Target } from "lucide-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function NPCPersonalitiesArticle() {
  return (
    <ArticleLayout
      title="NPC Personalities"
      description="Every NPC country has a distinct personality shaped by 8 traits and 6 archetypes. Learn how they think so you can predict their moves."
      icon={Brain}
    >
      <ContentCard>
        <Section title="How NPC Personalities Work">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            NPC countries are not random. Each one has a unique personality defined by eight core
            traits scored on a 0&ndash;100 scale. These traits are calculated automatically based on
            how the nation actually behaves &mdash; their alliances, trade patterns, conflicts, and
            diplomatic history all feed into the system. You never set these traits manually; they
            emerge naturally from the world.
          </p>
          <p className="text-slate-700 dark:text-slate-300">
            Understanding an NPC's personality is key to successful diplomacy. Before you launch a{" "}
            <Link
              href="/help/diplomacy/missions"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              diplomatic mission
            </Link>{" "}
            or respond to a{" "}
            <Link
              href="/help/diplomacy/scenarios"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              diplomatic scenario
            </Link>
            , checking the other country's personality profile can tell you what kind of approach is
            most likely to succeed.
          </p>
        </Section>

        <Section title="The 8 Core Personality Traits">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Assertiveness:</strong> How willing a country is to take strong stances.
              High-assertiveness nations are confrontational; low-assertiveness nations are more
              accommodating.
            </li>
            <li>
              <strong>Cooperativeness:</strong> Preference for working with others. High
              cooperativeness means the nation seeks alliances and joint solutions; low means they
              act alone.
            </li>
            <li>
              <strong>Risk Tolerance:</strong> Comfort with uncertain outcomes. Bold nations attempt
              ambitious gambits; cautious ones prefer safe, proven approaches.
            </li>
            <li>
              <strong>Pragmatism:</strong> Focus on practical results over ideology. Highly
              pragmatic nations are flexible deal-makers; low-pragmatism nations stick to their
              principles even when it costs them.
            </li>
            <li>
              <strong>Transparency:</strong> Openness in communications. Transparent nations are
              honest brokers you can trust; secretive ones may have hidden agendas.
            </li>
            <li>
              <strong>Economic Focus:</strong> How much the nation prioritizes economic interests.
              Trade-driven countries respond well to economic proposals; others prioritize ideology
              or security.
            </li>
            <li>
              <strong>Military Orientation:</strong> Reliance on military power. Strength-based
              nations respect force and deterrence; diplomatic nations prefer negotiation.
            </li>
            <li>
              <strong>Cultural Openness:</strong> Receptiveness to foreign influence. Cosmopolitan
              nations welcome cultural exchange; protectionist ones guard their traditions.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="The 6 Personality Archetypes">
          <InfoBox title="NPC Behavioral Profiles">
            <p className="mb-3">
              While every NPC has a unique combination of traits, most fall into one of six
              recognizable archetypes. Knowing an NPC's archetype gives you a quick read on how they
              will likely respond to your actions:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>The Pragmatist:</strong> Focused on deals and practical outcomes. Offer them
                mutual economic benefits for the best results.
              </li>
              <li>
                <strong>The Idealist:</strong> Values principles and multilateral frameworks. Appeal
                to shared values and fair processes.
              </li>
              <li>
                <strong>The Aggressor:</strong> Seeks dominance through strength. Expect tough
                negotiations and be prepared to show resolve.
              </li>
              <li>
                <strong>The Diplomat:</strong> A natural bridge-builder and mediator. They welcome
                cooperation and seek win-win outcomes.
              </li>
              <li>
                <strong>The Opportunist:</strong> Exploits situations for advantage. Be cautious
                &mdash; they may agree to deals they do not intend to honor.
              </li>
              <li>
                <strong>The Isolationist:</strong> Prefers self-reliance and avoids foreign
                entanglements. Building a relationship takes patience, but once established it tends
                to be stable.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="How Traits Are Calculated">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            NPC personality traits are not assigned by hand. They are calculated automatically from
            a nation's real in-game behavior:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              A country with many alliances and friendly relationships will naturally score high in{" "}
              <strong>Cooperativeness</strong>.
            </li>
            <li>
              Frequent conflicts and hostile relationships push <strong>Assertiveness</strong> and{" "}
              <strong>Military Orientation</strong> higher.
            </li>
            <li>
              High trade volume and numerous economic partnerships increase{" "}
              <strong>Economic Focus</strong>.
            </li>
            <li>
              Active cultural exchange programs and openness to foreign influence raise{" "}
              <strong>Cultural Openness</strong>.
            </li>
          </ul>
          <p className="mt-3 text-slate-700 dark:text-slate-300">
            This means that as the world evolves, NPC personalities evolve with it. An Isolationist
            that starts forming alliances will gradually become more cooperative over time.
          </p>
        </Section>
      </ContentCard>

      <ContentCard fullWidth>
        <Section title="Using Personalities to Your Advantage">
          <InfoBox title="Strategic Tips for Each Situation">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Diplomatic Proposals:</strong> NPCs weigh your proposals against their
                personality. A highly cooperative nation is more likely to accept alliance offers,
                while a pragmatic one wants to see clear economic benefits.
              </li>
              <li>
                <strong>Crisis Events:</strong> When a{" "}
                <Link
                  href="/help/diplomacy/scenarios"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  crisis scenario
                </Link>{" "}
                hits, NPCs choose their response based on risk tolerance and military orientation.
                Knowing this helps you predict whether they will escalate or seek compromise.
              </li>
              <li>
                <strong>Trade Negotiations:</strong> NPCs with high economic focus and pragmatism
                are your best trade partners. They evaluate deals on mutual benefit rather than
                ideology.
              </li>
              <li>
                <strong>Alliance Building:</strong> Cooperativeness and transparency determine how
                willing an NPC is to enter long-term partnerships. Start with trust-building actions
                before proposing formal alliances with secretive nations.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Personality Drift">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            NPC personalities are not frozen in place. They gradually shift based on what happens in
            the world:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Successful Diplomacy:</strong> Positive interactions increase cooperativeness
              and transparency over time.
            </li>
            <li>
              <strong>Conflicts &amp; Hostilities:</strong> Failed negotiations or military
              confrontations push assertiveness and military orientation higher.
            </li>
            <li>
              <strong>Economic Shocks:</strong> Crises can make a nation more pragmatic and less
              willing to take risks.
            </li>
            <li>
              Personality changes happen gradually &mdash; you will not see a Diplomat suddenly
              become an Aggressor overnight. This makes long-term relationship strategies viable and
              rewarding.
            </li>
          </ul>
        </Section>

        <WarningBox title="Best Practices">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Users2 className="inline h-4 w-4" /> Always review a country's personality profile
              before launching major diplomatic initiatives.
            </li>
            <li>
              <TrendingUp className="inline h-4 w-4" /> Track personality drift over time. If a
              rival is becoming more cooperative, it may be the right moment to extend an olive
              branch.
            </li>
            <li>
              <Target className="inline h-4 w-4" /> Tailor your approach to the archetype. Offer
              economic deals to Pragmatists, propose alliances to Diplomats, and show strength when
              dealing with Aggressors.
            </li>
          </ul>
        </WarningBox>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/diplomacy/missions"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Diplomatic Missions
              </Link>{" "}
              &mdash; Use personality insights to choose the right missions.
            </li>
            <li>
              <Link
                href="/help/diplomacy/scenarios"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Diplomatic Scenarios
              </Link>{" "}
              &mdash; See how NPC personalities shape scenario outcomes.
            </li>
            <li>
              <Link
                href="/help/diplomacy/embassies"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Embassy Network
              </Link>{" "}
              &mdash; Build the diplomatic infrastructure to engage with NPCs.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
