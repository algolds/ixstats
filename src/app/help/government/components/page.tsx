"use client";

import { ListTree, Puzzle, Library } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function AtomicComponentCatalogArticle() {
  return (
    <ArticleLayout
      title="Atomic Component Catalog"
      description="Reference guide for every government component, including stats and synergy notes."
      icon={ListTree}
    >
      <Section title="How Components Are Defined">
        <ul className="list-disc pl-6 space-y-2">
          <li>Component metadata resides in `src/components/government/atoms/AtomicGovernmentComponents.tsx`.</li>
          <li>Each entry includes effectiveness, costs, synergies, conflicts, prerequisites, and theming.</li>
          <li>Prisma enums mirror the component IDs, ensuring database consistency.</li>
        </ul>
      </Section>

      <Section title="Using the Catalog">
        <InfoBox title="Tips">
          <ul className="list-disc pl-6 space-y-1">
            <li>Use the filter/search UI in builder/editor to find components by category or keyword.</li>
            <li>Hover or click components to view detailed descriptions and synergy hints.</li>
            <li>Link to this article or `docs/systems/builder.md` from campaign documents to educate players.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Maintaining the Library">
        <ul className="list-disc pl-6 space-y-2">
          <li>When adding new components, update TypeScript definitions, Prisma enums, and help docs simultaneously.</li>
          <li>Provide example policy hooks or ThinkPages prompts to contextualise gameplay effects.</li>
          <li>Run through compliance and achievements to ensure new components integrate correctly.</li>
        </ul>
      </Section>

      <InfoBox title="Reference Docs">
        <ul className="list-disc pl-6 space-y-1">
          <li><Puzzle className="inline h-4 w-4" /> `/help/government/atomic` – overview of how components combine.</li>
          <li><Library className="inline h-4 w-4" /> `docs/reference/database.md` – schema notes for component storage.</li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
