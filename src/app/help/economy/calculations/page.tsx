"use client";

import { Calculator, Sigma, Database } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function EconomicCalculationsArticle() {
  return (
    <ArticleLayout
      title="Economic Calculations"
      description="See how GDP, growth, projections, and resilience metrics are computed."
      icon={Calculator}
    >
      <Section title="Core Formulas">
        <ul className="list-disc pl-6 space-y-2">
          <li>`calculations.ts` and `enhanced-economic-calculations.ts` define GDP growth, ERI, PII, SEWI, and ECTI indices.</li>
          <li>Historical series are stored in Prisma tables (`EconomicHistory`, `EconomicProjection`) and exposed through `api.economics` routers.</li>
          <li>Trend analytics use helpers from `src/components/analytics/TrendRiskAnalytics.tsx`.</li>
        </ul>
      </Section>

      <Section title="Where to Inspect">
        <InfoBox title="Tooling">
          <ul className="list-disc pl-6 space-y-1">
            <li>`npm run test:economics` verifies formulas and projections.</li>
            <li>`docs/systems/economy.md` summarises inputs/outputs for each calculation.</li>
            <li>Dashboard widgets (`EconomicDataDisplay`, `EconomicModelingEngine`) visualise results.</li>
          </ul>
        </InfoBox>
      </Section>

      <WarningBox title="Accuracy Tips">
        <ul className="list-disc pl-6 space-y-1">
          <li><Sigma className="inline h-4 w-4" /> Keep seed data realistic; projections assume monthly cadence under IxTime.</li>
          <li><Database className="inline h-4 w-4" /> Run `npm run db:backup` before major schema changes.</li>
        </ul>
      </WarningBox>
    </ArticleLayout>
  );
}
