"use client";

import Link from "next/link";
import { Bell, AlertTriangle, CheckCircle, Cog } from "lucide-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function NationalIssuesArticle() {
  return (
    <ArticleLayout
      title="National Issues System"
      description="Template-based events with trigger conditions, multiple-choice responses, and real consequences."
      icon={Bell}
    >
      <ContentCard>
        <Section title="What Are National Issues?">
          <p>
            National Issues are dynamic events generated from your country&apos;s current
            conditions. Inspired by NationStates, issues present you with real decisions that affect
            your economy, society, diplomacy, and defense. A maximum of 3 new issues can appear per
            evaluation cycle.
          </p>
          <p className="mt-3">
            Issues appear in the Executive tab&apos;s Issues inbox and are evaluated using lazy
            evaluation — the engine runs when you open your inbox, debounced by 5 IxTime minutes.
          </p>
        </Section>

        <Section title="How Issues Are Generated">
          <InfoBox title="Generation Engine">
            <p>
              <Cog className="inline h-4 w-4" /> The engine follows this process:
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-6">
              <li>
                <strong>Build Snapshot:</strong> Gather current country data in a single optimized
                query
              </li>
              <li>
                <strong>Load Templates:</strong> Fetch active issue templates from the database
              </li>
              <li>
                <strong>Evaluate Triggers:</strong> Check each template&apos;s conditions against
                the snapshot using JSON expression trees (no eval)
              </li>
              <li>
                <strong>Apply NPC Modifiers:</strong> NPC personality traits influence which issues
                surface
              </li>
              <li>
                <strong>Select Top Issues:</strong> Rank eligible issues by relevance and pick up to
                3
              </li>
              <li>
                <strong>Variable Substitution:</strong> Insert country-specific data into issue text
              </li>
              <li>
                <strong>Persist:</strong> Save instantiated issues to the database
              </li>
            </ol>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Responding to Issues">
          <p>Each issue presents multiple response options. Each choice has consequences:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <CheckCircle className="inline h-4 w-4 text-emerald-500" />{" "}
              <strong>Economic Effects:</strong> Changes to GDP growth, tax revenue, trade balance,
              or sector performance
            </li>
            <li>
              <strong>Social Effects:</strong> Impact on population satisfaction, stability,
              healthcare, or education metrics
            </li>
            <li>
              <strong>Diplomatic Effects:</strong> Changes to relationship strength, international
              reputation, or alliance status
            </li>
            <li>
              <strong>Defense Effects:</strong> Impact on military readiness, security assessment,
              or equipment condition
            </li>
          </ul>
        </Section>

        <Section title="Urgency & Auto-Resolution">
          <p>
            <AlertTriangle className="inline h-4 w-4 text-amber-500" /> Issues come with urgency
            levels that affect their visual appearance and handling:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>Higher urgency issues are displayed prominently with warning colors</li>
            <li>
              Some issues have deadlines — if not addressed, they auto-resolve with default (usually
              unfavorable) outcomes
            </li>
            <li>The Issues inbox badge shows a count with urgency-based coloring</li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard fullWidth>
        <Section title="IxCredits Rewards">
          <p>Responding to national issues earns IxCredits:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Base Reward:</strong> 5 IxCredits for responding to any issue
            </li>
            <li>
              <strong>Risk Bonus:</strong> 0-8 additional IxCredits based on the risk level of your
              chosen response
            </li>
            <li>
              Higher-risk choices yield more IxCredits but may have more negative consequences
            </li>
          </ul>
        </Section>

        <WarningBox title="Strategy Tips">
          Review your country&apos;s current snapshot data before making decisions. Higher-risk
          responses earn more IxCredits but can have significant negative effects on your metrics.
          Balance short-term rewards against long-term national health.
        </WarningBox>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/mycountry/executive"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Executive Command Center
              </Link>{" "}
              — Where issues appear in your dashboard
            </li>
            <li>
              <Link
                href="/help/vault/ixcredits"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                IxCredits Economy
              </Link>{" "}
              — IxCredits earning details
            </li>
            <li>
              <Link
                href="/help/gameplay/simulation"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                How the Simulation Works
              </Link>{" "}
              — How the simulation engine works
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
