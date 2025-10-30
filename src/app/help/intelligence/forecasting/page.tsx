"use client";

import { ChartLine, CalendarClock, Sparkle } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function ForecastingArticle() {
  return (
    <ArticleLayout
      title="Forecasting & Predictions"
      description="Use forward-looking analytics to plan policy responses and narrative beats."
      icon={ChartLine}
    >
      <Section title="Forecasting Inputs">
        <ul className="list-disc space-y-2 pl-6">
          <li>Economic projections (`api.economics.getProjections`).</li>
          <li>Diplomatic trend analysis from mission outcomes and relation strength.</li>
          <li>Social sentiment from ThinkPages activity and notification pipelines.</li>
        </ul>
      </Section>

      <Section title="Where Forecasts Appear">
        <InfoBox title="Dashboards">
          <ul className="list-disc space-y-1 pl-6">
            <li>MyCountry intelligence feed (Forward-Looking section).</li>
            <li>Economic Analytics tab (scenario cards and charts).</li>
            <li>Policy creator quick actions for impact previews.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Practical Use">
        <ul className="list-disc space-y-2 pl-6">
          <li>Set reminders via compliance tasks when forecasts predict deficits or unrest.</li>
          <li>Document assumptions in ThinkPages to revisit when outcomes differ.</li>
          <li>Coordinate defense and diplomacy responses when high-risk forecasts emerge.</li>
        </ul>
      </Section>

      <InfoBox title="Related Material">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <CalendarClock className="inline h-4 w-4" /> `/help/economy/modeling` – economic
            scenario planning.
          </li>
          <li>
            <Sparkle className="inline h-4 w-4" /> `docs/systems/intelligence.md` – implementation
            notes.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
