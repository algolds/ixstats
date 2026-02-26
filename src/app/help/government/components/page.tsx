"use client";

import Link from "next/link";
import { ListTree, Puzzle, BookOpen, Coins, Search } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function AtomicComponentCatalogArticle() {
  const linkClass = "text-blue-600 hover:underline dark:text-blue-400";

  return (
    <ArticleLayout
      title="Component Catalog"
      description="Browse 106 building blocks you can mix and match to shape your nation's government, economy, and tax system."
      icon={ListTree}
    >
      <ContentCard>
      <Section title="What Are Components?">
        <p className="mb-4 text-slate-700 dark:text-slate-300">
          Components are the building blocks of your nation. When you create or edit a country in the{" "}
          <Link href="/help/gameplay/country-building" className={linkClass}>
            Country Builder
          </Link>
          , you pick from a library of 106 pre-designed components across three categories. Each
          component represents a real-world policy, institution, or system that defines how your
          country operates.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <h3 className="mb-1 font-semibold text-amber-900 dark:text-amber-300">
              24 Government
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-100/80">
              Power distribution, decision-making processes, legitimacy sources, political
              institutions, and oversight mechanisms.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <h3 className="mb-1 font-semibold text-emerald-900 dark:text-emerald-300">
              40+ Economic
            </h3>
            <p className="text-sm text-emerald-800 dark:text-emerald-100/80">
              Trade policy, labor market regulations, investment climate, innovation programs,
              infrastructure, and environmental standards.
            </p>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-500/30 dark:bg-violet-500/10">
            <h3 className="mb-1 font-semibold text-violet-900 dark:text-violet-300">
              42 Tax
            </h3>
            <p className="text-sm text-violet-800 dark:text-violet-100/80">
              Income tax, corporate tax, VAT, property tax, capital gains, and specialized taxes,
              each with configurable rate settings.
            </p>
          </div>
        </div>
      </Section>

      <Section title="What Each Component Shows">
        <p className="mb-3 text-slate-700 dark:text-slate-300">
          When you select or hover over a component in the Country Builder, you will see:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
          <li>
            <strong>Effectiveness Score:</strong> A rating that shows how impactful the component is
            in its category. Higher scores mean stronger effects on your nation.
          </li>
          <li>
            <strong>Costs:</strong> The economic or political cost of adopting the component. Some
            choices are cheap to implement while others require significant investment.
          </li>
          <li>
            <strong>Synergies:</strong> Other components that work well alongside this one. Combining
            synergistic components gives your nation bonus effects.
          </li>
          <li>
            <strong>Conflicts:</strong> Components that clash with your current selection. Picking
            conflicting components can reduce effectiveness or create penalties.
          </li>
          <li>
            <strong>Tier Requirements:</strong> Some advanced components are only available once your
            nation reaches a certain development tier.
          </li>
        </ul>
      </Section>

      <Section title="Browsing and Searching">
        <InfoBox title="Finding the Right Components">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Open the Country Builder and navigate to the Government, Economy, or Tax section to see
              all available components in that category.
            </li>
            <li>
              Use the <Search className="inline h-4 w-4" /> search bar to find components by name or
              keyword (for example, search &quot;trade&quot; to find trade-related policies).
            </li>
            <li>
              Filter by category to narrow the list — for example, view only &quot;Labor
              Market&quot; economic components or &quot;Legitimacy&quot; government components.
            </li>
            <li>
              Click any component to expand its full details, including a description, synergy hints,
              and conflict warnings.
            </li>
          </ul>
        </InfoBox>
      </Section>
      </ContentCard>

      <ContentCard>
      <Section title="How Components Affect Gameplay">
        <p className="mb-3 text-slate-700 dark:text-slate-300">
          Your component choices directly shape your nation&apos;s stats and standing. Here is how:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
          <li>
            <strong>Government components</strong> determine your political structure, stability, and
            how decisions are made. A centralized system might be efficient but less stable, while a
            decentralized one spreads power but slows decision-making.
          </li>
          <li>
            <strong>Economic components</strong> shape your GDP growth, trade balance, employment,
            and development trajectory. Free-trade policies might boost growth but increase
            inequality, while protectionist ones shield domestic industries at the cost of
            competitiveness.
          </li>
          <li>
            <strong>Tax components</strong> control your government revenue and spending capacity.
            Higher tax rates generate more revenue but can slow economic growth and reduce citizen
            satisfaction.
          </li>
          <li>
            <strong>Synergy bonuses</strong> reward thoughtful combinations. For example, pairing a
            strong education system with innovation-focused economic policies can unlock bonus growth
            multipliers.
          </li>
        </ul>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          To learn more about how components combine into a complete government system, see the{" "}
          <Link href="/help/government/atomic" className={linkClass}>
            Atomic Government System
          </Link>{" "}
          guide.
        </p>
      </Section>

      <InfoBox title="Related Guides">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Puzzle className="inline h-4 w-4" />{" "}
            <Link href="/help/government/atomic" className={linkClass}>
              Atomic Government System
            </Link>{" "}
            — how components combine into a working government
          </li>
          <li>
            <BookOpen className="inline h-4 w-4" />{" "}
            <Link href="/help/government/overview" className={linkClass}>
              Government Overview
            </Link>{" "}
            — introduction to the government system
          </li>
          <li>
            <Coins className="inline h-4 w-4" />{" "}
            <Link href="/help/economy/tax-system" className={linkClass}>
              Tax System Guide
            </Link>{" "}
            — detailed breakdown of how taxes work
          </li>
          <li>
            <ListTree className="inline h-4 w-4" />{" "}
            <Link href="/help/gameplay/country-building" className={linkClass}>
              Country Building Guide
            </Link>{" "}
            — step-by-step walkthrough for new players
          </li>
        </ul>
      </InfoBox>

      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        Platform administrators can add, edit, or remove components through the Admin panel.
      </p>
      </ContentCard>
    </ArticleLayout>
  );
}
