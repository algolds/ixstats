"use client";

import { LineChart, Brain, Repeat } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function EconomicModelingArticle() {
  return (
    <ArticleLayout
      title="Economic Modeling & Projections"
      description="Use built-in tools to simulate scenarios and understand long-term outcomes."
      icon={LineChart}
    >
      <Section title="Modeling Toolkit">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            `EconomicModelingEngine.tsx` lets you adjust growth drivers, shocks, and policy levers.
          </li>
          <li>
            Projections come from `api.economics.getProjections` (1, 5, and 10 year horizons).
          </li>
          <li>
            Scenario results feed into compliance tasks and achievements when thresholds are missed.
          </li>
        </ul>
      </Section>

      <Section title="Workflow">
        <InfoBox title="Step-by-Step">
          <ol className="list-decimal space-y-1 pl-6">
            <li>Select baseline assumptions (growth rate, inflation, population).</li>
            <li>Apply policy toggles or shocks to test resilience.</li>
            <li>Save scenarios to compare actual performance later.</li>
          </ol>
        </InfoBox>
      </Section>

      <Section title="Good Practices">
        <ul className="list-disc space-y-2 pl-6">
          <li>Run projections after significant builder edits or policy changes.</li>
          <li>Document noteworthy scenarios in ThinkPages for campaign tracking.</li>
          <li>Link modeling outcomes to quick actions so decision-makers can respond quickly.</li>
        </ul>
      </Section>

      <InfoBox title="Related Docs">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Brain className="inline h-4 w-4" /> `docs/systems/economy.md` – formulas and usage
            tips.
          </li>
          <li>
            <Repeat className="inline h-4 w-4" /> `/help/economy/calculations` – deeper math
            references.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
