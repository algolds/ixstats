"use client";

import { Palette, Layers, Droplet } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function DesignSystemArticle() {
  return (
    <ArticleLayout
      title="Glass Physics Design System"
      description="Guidelines for the visual language that unifies dashboards, builders, and help content."
      icon={Palette}
    >
      <Section title="Principles">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Layered glass hierarchy (base, elevated, modal, interactive) with consistent blur and
            depth.
          </li>
          <li>
            Theme palettes map to domains (executive, intelligence, economy, government, defense,
            social).
          </li>
          <li>Responsive layouts favour cards, gradients, and subtle motion.</li>
        </ul>
      </Section>

      <Section title="Implementation">
        <InfoBox title="Where to Look">
          <ul className="list-disc space-y-1 pl-6">
            <li>`src/components/ui` – shared primitives (buttons, cards, dialogs, badges).</li>
            <li>`src/components/shared` – data display + form components using the same tokens.</li>
            <li>`docs/architecture/frontend.md` – layout and component layering guidance.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Working With the System">
        <ul className="list-disc space-y-2 pl-6">
          <li>Reuse existing primitives before introducing new styles.</li>
          <li>Keep accessibility in mind (contrast, focus states, ARIA attributes).</li>
          <li>
            Update `/help/getting-started/navigation` if navigation or theming patterns change.
          </li>
        </ul>
      </Section>

      <InfoBox title="Helpful References">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Layers className="inline h-4 w-4" /> `docs/systems/mycountry.md` – application of
            themes in dashboards.
          </li>
          <li>
            <Droplet className="inline h-4 w-4" /> `/help/technical/architecture` – structural
            context.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
