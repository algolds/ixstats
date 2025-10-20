"use client";

import { Atom, Link2, Activity } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function AtomicGovernmentArticle() {
  return (
    <ArticleLayout
      title="Atomic Government System"
      description="Explore modular components that define power distribution, legitimacy, and control."
      icon={Atom}
    >
      <Section title="Component Categories">
        <ul className="list-disc pl-6 space-y-2">
          <li>Power Distribution, Decision Processes, Legitimacy Sources, Institutions, and Control Mechanisms.</li>
          <li>Components live in both UI (`src/components/government/atoms`) and Prisma enums (`ComponentType`).</li>
          <li>Synergies and conflicts drive effectiveness scoring via services in `src/lib`.</li>
        </ul>
      </Section>

      <Section title="Selecting Components">
        <InfoBox title="Builder & Editor">
          <ul className="list-disc pl-6 space-y-1">
            <li>Use the `UnifiedAtomicComponentSelector` to pick combinations; tooltips summarise effects.</li>
            <li>Effectiveness metrics display immediately in MyCountry once saved.</li>
            <li>Document notable combos in `/help/government/synergy` for quick reference.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Operational Impact">
        <ul className="list-disc pl-6 space-y-2">
          <li>Economic, policy, and intelligence routers reference selected components to adjust indices.</li>
          <li>Achievements and compliance tasks look for specific configurations (e.g., crisis-ready governments).</li>
          <li>Use ThinkPages to narrate constitutional reforms alongside these mechanical changes.</li>
        </ul>
      </Section>

      <InfoBox title="Further Reading">
        <ul className="list-disc pl-6 space-y-1">
          <li><Link2 className="inline h-4 w-4" /> `docs/systems/builder.md` – atomic component integration.</li>
          <li><Activity className="inline h-4 w-4" /> `docs/systems/mycountry.md` – how dashboards consume atomic data.</li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
