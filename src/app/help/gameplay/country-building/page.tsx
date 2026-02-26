"use client";

import Link from "next/link";
import { Hammer, Layers, Upload, Rocket } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox, ContentCard } from "../../_components/ArticleLayout";

export default function CountryBuildingArticle() {
  return (
    <ArticleLayout
      title="Country Building Guide"
      description="Complete guide to the builder workflow, atomic components, optimization strategies, and import options."
      icon={Hammer}
    >
      <ContentCard>
        <Section title="Builder Overview">
          <p>
            The Country Builder guides you through creating a nation in
            structured steps. Each step configures a different aspect of your country:
          </p>
          <ol className="mt-2 list-decimal space-y-2 pl-6">
            <li><strong>Identity:</strong> Country name, flag, motto, symbols, and basic metadata</li>
            <li><strong>Government:</strong> Government type selection and atomic component configuration</li>
            <li><strong>Economy:</strong> Economic tier, sector distribution, and economic components</li>
            <li><strong>Labor:</strong> Labor force participation, employment rates, and sector workforce</li>
            <li><strong>Demographics:</strong> Population, growth rate, age distribution, urbanization</li>
            <li><strong>Fiscal:</strong> Tax system configuration and government budget allocation</li>
          </ol>
        </Section>

        <Section title="Atomic Components">
          <InfoBox title="106+ Components Available">
            <p>
              <Layers className="inline h-4 w-4" /> The atomic component system provides modular
              building blocks for your nation:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>24 Government Components:</strong> Power distribution, decision processes, legitimacy, institutions, control mechanisms</li>
              <li><strong>40+ Economic Components:</strong> Trade policy, labor regulation, investment, innovation, infrastructure, environment</li>
              <li><strong>42 Tax Components:</strong> Income tax, corporate tax, VAT, property, capital gains, and specialized tax types</li>
            </ul>
            <p className="mt-2">
              Each component has an effectiveness score and may have synergies or conflicts with
              other components.
            </p>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Optimization Strategies">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Synergy Stacking:</strong> Select components that have positive synergies with
              each other. The synergy system awards bonus effectiveness when complementary components
              are combined.
            </li>
            <li>
              <strong>Avoid Conflicts:</strong> Some components penalize each other. Check the synergy
              panel before finalizing your configuration.
            </li>
            <li>
              <strong>Policy Presets:</strong> Use pre-built policy configurations from the preset
              selector for quick setup based on common governance models.
            </li>
            <li>
              <strong>Tier Awareness:</strong> Some economic components are only available at higher
              tiers. Plan your growth path accordingly.
            </li>
          </ul>
        </Section>

        <Section title="Import Options">
          <p>
            <Upload className="inline h-4 w-4 text-emerald-500" /> Instead of building from
            scratch, you can import country data:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Wiki Import:</strong> Search IxWiki articles and auto-populate country data
              from wiki infoboxes and structured content
            </li>
            <li>
              <strong>NationStates Import:</strong> Connect to the NationStates API to import your
              NS nation&apos;s data, statistics, and government configuration
            </li>
          </ul>
          <p className="mt-2">
            Both import methods show a preview of parsed data before committing changes.
          </p>
        </Section>
      </ContentCard>

      <ContentCard fullWidth>
        <Section title="After Building">
          <p>
            <Rocket className="inline h-4 w-4 text-purple-500" /> Once your country is created:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>Your nation appears on the dashboard and leaderboards</li>
            <li>The MyCountry hub becomes fully active with all sections accessible</li>
            <li>Achievement tracking begins — early milestones may unlock immediately</li>
            <li>You can start establishing embassies and engaging in diplomacy</li>
            <li>IxCredits passive income begins accruing based on your economic performance</li>
          </ul>
        </Section>

        <WarningBox title="Builder Tip">
          The builder supports an onboarding wizard with four paths: Complete Tutorial (~5-8 minutes),
          Quick Start, Import from Wiki/NS, or Jump In directly. New players should choose Complete
          Tutorial for the best introduction.
        </WarningBox>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li><Link href="/help/getting-started/first-country" className="text-blue-600 hover:underline dark:text-blue-400">Creating Your First Country</Link> — Quick start guide</li>
            <li><Link href="/help/government/atomic" className="text-blue-600 hover:underline dark:text-blue-400">Atomic Government System</Link> — Atomic government system details</li>
            <li><Link href="/help/economy/tiers" className="text-blue-600 hover:underline dark:text-blue-400">Economic Tiers</Link> — Economic tier system</li>
            <li><Link href="/help/government/synergy" className="text-blue-600 hover:underline dark:text-blue-400">Component Synergies</Link> — Component synergy mechanics</li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
