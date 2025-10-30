"use client";

import { ArrowLeftRight, Ship, Factory } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function TradeArticle() {
  return (
    <ArticleLayout
      title="Trade & Commerce"
      description="Track imports, exports, and supply chains to understand economic dependencies."
      icon={ArrowLeftRight}
    >
      <Section title="What We Track">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Trade balances, top partners, and commodity breakdowns from
            `api.economics.getCountryIndicators`.
          </li>
          <li>Embassy and mission data to correlate diplomatic actions with trade benefits.</li>
          <li>Custom metrics surfaced in `EconomicDataDisplay` and diplomacy dashboards.</li>
        </ul>
      </Section>

      <Section title="Dashboards">
        <InfoBox title="Where to Look">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              MyCountry ▸ Economy tab – trade cards, partner lists, and alerts when deficits
              persist.
            </li>
            <li>`/leaderboards` ▸ Trade filters – compare surpluses/deficits across nations.</li>
            <li>ThinkPages – tag research posts with `#trade` to document strategy decisions.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Operations">
        <ul className="list-disc space-y-2 pl-6">
          <li>Use quick actions to launch trade missions or negotiate treaties.</li>
          <li>Integrate findings into policy proposals (tax incentives, infrastructure plans).</li>
          <li>Document supply chain updates in compliance notes to keep teams aligned.</li>
        </ul>
      </Section>

      <InfoBox title="Helpful References">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Ship className="inline h-4 w-4" /> `/help/diplomacy/missions` – how diplomatic efforts
            support trade.
          </li>
          <li>
            <Factory className="inline h-4 w-4" /> `docs/systems/economy.md` – modeling supply-side
            impacts.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
