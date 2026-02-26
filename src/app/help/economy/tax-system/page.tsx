"use client";

import Link from "next/link";
import { Receipt, Calculator, Settings, BarChart3 } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

const linkClass = "text-blue-600 hover:underline dark:text-blue-400";

export default function TaxSystemArticle() {
  return (
    <ArticleLayout
      title="Tax System"
      description="Configure 42 tax components, set brackets and exemptions, and preview revenue projections for your nation."
      icon={Receipt}
    >
      <ContentCard>
        <Section title="How Your Tax System Works">
          <p>
            Your nation&apos;s tax system is built from 42 different tax components that you
            select and configure. The Tax Builder walks you through the process step by step,
            helping you create a fiscal policy that fits your nation&apos;s goals.
          </p>
        </Section>

        <Section title="Setting Up Taxes">
          <InfoBox title="Tax Builder Steps">
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                <Settings className="inline h-4 w-4" />{" "}
                <strong>Configuration:</strong> Choose your overall tax system type and set the
                base rate parameters that shape your fiscal framework
              </li>
              <li>
                <strong>Choose Components:</strong> Pick from 42 tax components — each one has
                an effectiveness score so you can see how well it works. Options include income
                tax, corporate tax, VAT, property tax, capital gains, and more.
              </li>
              <li>
                <strong>Exemptions & Deductions:</strong> Set up tax breaks for specific sectors,
                income levels, or activities. Deductions reduce what gets taxed, giving you
                fine-grained control over your fiscal policy.
              </li>
              <li>
                <Calculator className="inline h-4 w-4" />{" "}
                <strong>Preview Revenue:</strong> See estimated revenue based on your current
                economy before you commit. Try different configurations to find the right balance.
              </li>
            </ol>
          </InfoBox>
        </Section>

        <Section title="Tax Types Available">
          <ul className="list-disc space-y-2 pl-6">
            <li><strong>Income Taxes:</strong> Progressive brackets on personal income with configurable rates and thresholds</li>
            <li><strong>Corporate Taxes:</strong> Business income taxation with sector-specific adjustments</li>
            <li><strong>Value Added Tax (VAT):</strong> Consumption-based tax with exemptions for essentials</li>
            <li><strong>Property Taxes:</strong> Real estate and asset taxation</li>
            <li><strong>Capital Gains:</strong> Taxes on investment returns with holding period adjustments</li>
            <li><strong>Specialized Taxes:</strong> Tariffs, excise duties, environmental levies, and financial transaction taxes</li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="How Taxes Connect to Your Nation">
          <p>
            <BarChart3 className="inline h-4 w-4 text-blue-500" /> Your tax configuration
            doesn&apos;t exist in isolation — it connects to other parts of your nation:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Government:</strong> Your government components affect which taxes are
              available. Some government types require or restrict certain tax components.
            </li>
            <li>
              <strong>Economy:</strong> Tax revenue feeds directly into your economic model,
              affecting GDP calculations, government spending capacity, and debt management.
            </li>
            <li>
              <strong>Effectiveness Score:</strong> Your combined tax effectiveness is displayed
              alongside government and economic effectiveness, giving you a unified view of how
              well your nation is configured.
            </li>
          </ul>
        </Section>

        <Section title="Revenue Analysis Tools">
          <p>
            The Tax Calculator helps you understand and optimize your revenue:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>See how much each tax component contributes to your total revenue</li>
            <li>Run what-if scenarios by adjusting rates and seeing the impact</li>
            <li>Track historical revenue trends over time</li>
            <li>Get suggestions for fixing configuration issues and improving efficiency</li>
          </ul>
        </Section>

        <InfoBox title="Related Help Pages">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link href="/help/economy/calculations" className={linkClass}>Economic Calculations</Link>{" "}
              — How GDP and revenue formulas work
            </li>
            <li>
              <Link href="/help/government/components" className={linkClass}>Component Catalog</Link>{" "}
              — Browse all 106 government, economic, and tax components
            </li>
            <li>
              <Link href="/help/gameplay/country-building" className={linkClass}>Country Building Guide</Link>{" "}
              — Complete guide to the builder workflow
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
