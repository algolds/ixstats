"use client";

import Link from "next/link";
import { Palette, Layers, Droplet } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function DesignSystemArticle() {
  return (
    <ArticleLayout
      title="Glass Physics Design System"
      description="Guidelines for the visual language that unifies dashboards, builders, and help content."
      icon={Palette}
    >
      <ContentCard>
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
          <InfoBox title="Component Library">
            <ul className="list-disc space-y-1 pl-6">
              <li>100+ shared UI primitives (buttons, cards, dialogs, badges).</li>
              <li>Data display and form components using the same design tokens.</li>
              <li>Consistent layering and layout patterns across all pages.</li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Working With the System">
          <ul className="list-disc space-y-2 pl-6">
            <li>Reuse existing primitives before introducing new styles.</li>
            <li>Keep accessibility in mind (contrast, focus states, ARIA attributes).</li>
            <li>
              Update the{" "}
              <Link
                href="/help/getting-started/navigation"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Navigation Guide
              </Link>{" "}
              if navigation or theming patterns change.
            </li>
          </ul>
        </Section>

        <InfoBox title="Helpful References">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Layers className="inline h-4 w-4" />{" "}
              <Link
                href="/help/mycountry/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                MyCountry Overview
              </Link>{" "}
              — see themes applied in dashboards.
            </li>
            <li>
              <Droplet className="inline h-4 w-4" />{" "}
              <Link
                href="/help/technical/architecture"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                System Architecture
              </Link>{" "}
              — structural context.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
