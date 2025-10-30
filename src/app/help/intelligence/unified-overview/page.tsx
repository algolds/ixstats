"use client";

import { CircuitBoard, Merge, Server } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function UnifiedIntelligenceOverviewArticle() {
  return (
    <ArticleLayout
      title="Unified Intelligence Overview"
      description="Understand how legacy ECI/SDI feeds merged into the unified intelligence router."
      icon={CircuitBoard}
    >
      <Section title="Why We Unified">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Single router (`unified-intelligence.ts`) replaces the older `eci` and `sdi` endpoints
            for strategic data.
          </li>
          <li>
            Provides consistent payloads for executive dashboards, defense readiness, and
            compliance.
          </li>
          <li>Reduces duplication across services and simplifies maintenance.</li>
        </ul>
      </Section>

      <Section title="Migration Notes">
        <InfoBox title="Key Changes">
          <ul className="list-disc space-y-1 pl-6">
            <li>Front-end components now call `api.unifiedIntelligence` hooks.</li>
            <li>Legacy routers remain for historical reference but should not be extended.</li>
            <li>
              Documentation updated in `docs/systems/intelligence.md` and `docs/reference/api.md`.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Maintaining the Unified Layer">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Ensure new intelligence sources plug into the unified router rather than reintroducing
            siloed feeds.
          </li>
          <li>Keep type definitions and help articles aligned when payloads change.</li>
          <li>Use tests in `src/server/api/routers/__tests__` to guard critical behaviour.</li>
        </ul>
      </Section>

      <InfoBox title="Related Articles">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Merge className="inline h-4 w-4" /> `/help/intelligence/executive-operations` –
            operations built on the unified feed.
          </li>
          <li>
            <Server className="inline h-4 w-4" /> `/help/technical/api` – API layer overview.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
