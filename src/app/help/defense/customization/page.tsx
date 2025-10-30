"use client";

import { SlidersHorizontal, Palette, CheckSquare } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function DefenseCustomizationArticle() {
  return (
    <ArticleLayout
      title="Force Customization"
      description="Tailor defense modules, doctrines, and task forces to match your campaign."
      icon={SlidersHorizontal}
    >
      <Section title="Customization Options">
        <ul className="list-disc space-y-2 pl-6">
          <li>Adjust SDI module emphasis (cyber, orbital, homeland security, etc.).</li>
          <li>
            Assign doctrines and readiness postures that affect compliance tasks and analytics.
          </li>
          <li>Define bespoke task forces through editor flows for narrative flavour.</li>
        </ul>
      </Section>

      <Section title="Workflow">
        <InfoBox title="Steps">
          <ol className="list-decimal space-y-1 pl-6">
            <li>Open the Defense tab and select the module or task force you want to configure.</li>
            <li>
              Apply changes; the UI persists updates via `api.sdi` and `api.security` mutations.
            </li>
            <li>Verify new stats in readiness gauges and compliance lists.</li>
          </ol>
        </InfoBox>
      </Section>

      <Section title="Documentation">
        <ul className="list-disc space-y-2 pl-6">
          <li>Reflect changes in ThinkPages posts or policy documents for story continuity.</li>
          <li>
            Audit updates by checking the notification feed and `/help/intelligence/alerts` to
            ensure signals align.
          </li>
        </ul>
      </Section>

      <InfoBox title="Related Docs">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Palette className="inline h-4 w-4" /> `docs/systems/defense.md` – technical overview.
          </li>
          <li>
            <CheckSquare className="inline h-4 w-4" /> `/help/defense/overview` – high-level
            guidance.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
