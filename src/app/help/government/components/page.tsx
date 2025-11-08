"use client";

import { ListTree, Puzzle, Library } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function AtomicComponentCatalogArticle() {
  return (
    <ArticleLayout
      title="Component Catalog (106 Components)"
      description="Complete reference for 24 government + 40+ economic + 42 tax components with synergy detection and admin management."
      icon={ListTree}
    >
      <Section title="How Components Are Defined">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>100% Dynamic Content:</strong> All 106 components stored in database, managed via
            Admin CMS at `/admin/government-components`, `/admin/economic-components`,
            `/admin/tax-components`.
          </li>
          <li>
            Each entry includes effectiveness, costs, synergies, conflicts, prerequisites, tier
            requirements, and theming.
          </li>
          <li>
            <strong>24 Government:</strong> Power distribution, decision processes, legitimacy
            sources, institutions, control mechanisms.
          </li>
          <li>
            <strong>40+ Economic:</strong> Trade policy, labor market, investment, innovation,
            infrastructure, environment.
          </li>
          <li>
            <strong>42 Tax:</strong> Income, corporate, VAT, property, capital gains, specialized
            taxes with rate configurations.
          </li>
          <li>Prisma enums mirror component IDs for type safety and database consistency.</li>
        </ul>
      </Section>

      <Section title="Using the Catalog">
        <InfoBox title="Tips">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Use the filter/search UI in builder/editor to find components by category or keyword.
            </li>
            <li>Hover or click components to view detailed descriptions and synergy hints.</li>
            <li>
              Link to this article or `docs/systems/builder.md` from campaign documents to educate
              players.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Maintaining the Library">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Use Admin CMS interfaces to create, edit, or delete components without code deployments.
          </li>
          <li>
            Bulk import/export via CSV for mass updates; validation checks prevent duplicate or
            invalid entries.
          </li>
          <li>
            All changes logged to audit trail with user, timestamp, and before/after values.
          </li>
          <li>
            See `/help/admin/reference-data` for complete CRUD workflow and bulk operations guide.
          </li>
        </ul>
      </Section>

      <InfoBox title="Reference Docs">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Puzzle className="inline h-4 w-4" /> `/help/government/atomic` – overview of how
            components combine.
          </li>
          <li>
            <Library className="inline h-4 w-4" /> `docs/reference/database.md` – schema notes for
            component storage.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
