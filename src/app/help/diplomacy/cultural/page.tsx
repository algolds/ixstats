"use client";

import { Theater, HeartHandshake, BookOpen } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function CulturalExchangeArticle() {
  return (
    <ArticleLayout
      title="Cultural Exchanges"
      description="Build goodwill through cultural programmes, academic partnerships, and shared events."
      icon={Theater}
    >
      <Section title="Programme Types">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Educational exchanges, research collaborations, arts festivals, humanitarian aid
            tie-ins.
          </li>
          <li>
            Each programme carries modifiers for diplomatic relations, social metrics, and
            achievements.
          </li>
        </ul>
      </Section>

      <Section title="How to Launch">
        <InfoBox title="Steps">
          <ol className="list-decimal space-y-1 pl-6">
            <li>Open the Diplomatic Operations Hub and choose "Cultural Exchange".</li>
            <li>Select partner, goals, and duration; confirm resource commitments.</li>
            <li>Track progress via notifications and log highlights in ThinkPages.</li>
          </ol>
        </InfoBox>
      </Section>

      <Section title="Benefits">
        <ul className="list-disc space-y-2 pl-6">
          <li>Boost relation strength and soften negative incidents.</li>
          <li>Unlock achievements and ThinkPages badges for cross-cultural milestones.</li>
          <li>Feed positive sentiment into intelligence metrics.</li>
        </ul>
      </Section>

      <InfoBox title="See Also">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <HeartHandshake className="inline h-4 w-4" /> `/help/social/thinktanks` – continue
            collaboration via research groups.
          </li>
          <li>
            <BookOpen className="inline h-4 w-4" /> `docs/systems/diplomacy.md` – implementation
            details.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
