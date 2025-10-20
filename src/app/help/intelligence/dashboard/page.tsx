"use client";

import { LayoutDashboard, Radar, Globe } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function IntelligenceDashboardArticle() {
  return (
    <ArticleLayout
      title="Executive Intelligence Dashboard"
      description="Monitor your nation's outlook, key risks, and opportunities in one place."
      icon={LayoutDashboard}
    >
      <Section title="Dashboard Sections">
        <ul className="list-disc pl-6 space-y-2">
          <li>Vitality metrics (economy, population, diplomacy, security, social) powered by `api.intelligence.getExecutiveDashboard`.</li>
          <li>Hot issues, opportunities, and strategic initiatives aggregated from intelligence and notification routers.</li>
          <li>Embassy and mission status cards linking to diplomatic operations.</li>
        </ul>
      </Section>

      <Section title="How to Use It">
        <InfoBox title="Tips">
          <ul className="list-disc pl-6 space-y-1">
            <li>Start each session here to review alerts, compliance tasks, and quick wins.</li>
            <li>Use call-to-action buttons to jump into ThinkPages, compliance workflows, or policy proposals.</li>
            <li>Reference `docs/systems/intelligence.md` for data lineage and router details.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Customization">
        <ul className="list-disc pl-6 space-y-2">
          <li>Dashboard layout and widgets live in `src/app/mycountry/intelligence/_components`.</li>
          <li>Flag important metrics in ThinkPages posts to track evolving storylines.</li>
          <li>Socket updates (production) push live changes; dev mode uses polling.</li>
        </ul>
      </Section>

      <InfoBox title="Related Articles">
        <ul className="list-disc pl-6 space-y-1">
          <li><Radar className="inline h-4 w-4" /> `/help/intelligence/metrics` – deep dive into each metric.</li>
          <li><Globe className="inline h-4 w-4" /> `/help/diplomacy/embassies` – diplomacy connections.</li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
