"use client";

import Link from "next/link";
import { Cog, Clock, TrendingUp, Zap } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function SimulationArticle() {
  return (
    <ArticleLayout
      title="How the Simulation Works"
      description="IxTime pacing, the economic engine, event systems, and data flow that power IxStats."
      icon={Cog}
    >
      <ContentCard>
        <Section title="The Simulation Loop">
          <p>
            IxStats runs a continuous nation simulation driven by IxTime — a custom time system
            that operates at 2x real-world speed. All economic calculations, diplomatic events,
            crisis scenarios, and national issues are paced against IxTime rather than wall-clock
            time.
          </p>
          <p className="mt-3">
            <Clock className="inline h-4 w-4 text-blue-500" /> One IxTime day passes every 12
            real-world hours. This means your economy grows, events trigger, and conditions change
            at a steady accelerated pace. The multiplier is configurable by administrators.
          </p>
        </Section>

        <Section title="Economic Engine">
          <InfoBox title="Tier-Based Growth">
            <p>
              <TrendingUp className="inline h-4 w-4" /> The economic engine uses a tier-based
              growth model. Your GDP per capita determines your economic tier (from Impoverished
              to Extravagant), and each tier sets caps on growth rates and determines which
              economic components are available.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Growth rate is calculated from base rate + component bonuses - penalties</li>
              <li>Tier transitions happen automatically when GDP per capita crosses thresholds</li>
              <li>Higher tiers have lower maximum growth rates but larger absolute GDP gains</li>
              <li>Tax revenue, government spending, and debt all feed into the growth formula</li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Event Systems">
          <p>
            Three event systems generate dynamic gameplay:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <Zap className="inline h-4 w-4 text-red-500" />{" "}
              <strong>Crisis Events:</strong> Natural disasters, economic crises, diplomatic incidents,
              and social unrest. Each has severity levels, impact calculations, and response options
              that affect outcomes.
            </li>
            <li>
              <strong>National Issues:</strong> Template-based events triggered by your country&apos;s
              conditions (e.g., high debt triggers fiscal policy issues). Multiple-choice responses
              with real consequences for your economy, society, and diplomatic standing.
            </li>
            <li>
              <strong>Diplomatic Scenarios:</strong> 100+ scenario templates involving trade deals,
              cultural exchanges, security agreements, and crisis mediation. NPC personality traits
              modify available options and outcomes.
            </li>
          </ul>
        </Section>

        <Section title="Data Flow">
          <p>
            Here is how your actions translate into results:
          </p>
          <ol className="mt-2 list-decimal space-y-2 pl-6">
            <li><strong>Your Decisions:</strong> You make choices through the MyCountry dashboard, builder, or diplomacy panels</li>
            <li><strong>Processing:</strong> The system processes your changes and applies them to your country</li>
            <li><strong>Calculation:</strong> The economic engine recalculates all affected metrics</li>
            <li><strong>Updated Dashboard:</strong> Your dashboard, leaderboards, and profile reflect the new data</li>
          </ol>
          <p className="mt-3">
            Updates happen in near real-time. Critical data like your IxCredits balance refreshes
            on shorter intervals so you always see the latest information.
          </p>
        </Section>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li><Link href="/help/getting-started/ixtime" className="text-blue-600 hover:underline dark:text-blue-400">Understanding IxTime</Link> — Detailed IxTime system guide</li>
            <li><Link href="/help/economy/calculations" className="text-blue-600 hover:underline dark:text-blue-400">Economic Calculations</Link> — Economic calculation formulas</li>
            <li><Link href="/help/gameplay/national-issues" className="text-blue-600 hover:underline dark:text-blue-400">National Issues</Link> — National issues system</li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
