"use client";

import { Sparkles, Compass, Flag } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function WelcomeArticle() {
  return (
    <ArticleLayout
      title="Welcome to IxStats"
      description="Understand what the platform offers and how the major modules fit together."
      icon={Sparkles}
    >
      <Section title="Three Things You Can Do Today">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Claim or create a nation and explore the MyCountry command suite for executive
            dashboards.
          </li>
          <li>
            Browse live economic, diplomatic, and social data through `/dashboard`, `/leaderboards`,
            and ThinkPages.
          </li>
          <li>
            Collaborate with teammates using achievements, ThinkShare messaging, and the in-app help
            center.
          </li>
        </ul>
      </Section>

      <Section title="Key Destinations">
        <InfoBox title="Start Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>MyCountry:</strong> `/mycountry` – live intelligence, compliance, defense, and
              analytics.
            </li>
            <li>
              <strong>Builder:</strong> `/builder` – configure your nation's identity, government,
              and economy.
            </li>
            <li>
              <strong>Documentation:</strong> `docs/overview/platform.md` &
              `docs/overview/feature-map.md` for a full system map.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Next Steps">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Visit <strong>Creating Your First Country</strong> to walk through the builder workflow.
          </li>
          <li>
            Take the <strong>Interface Tour</strong> to understand navigation, quick actions, and
            live feeds.
          </li>
          <li>
            Bookmark <strong>/help</strong> – every major module ships with articles that mirror the
            repository documentation.
          </li>
        </ul>
      </Section>

      <Section title="Need Help?">
        <InfoBox title="Support Channels">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Compass className="inline h-4 w-4" /> Check the rest of the Getting Started series.
            </li>
            <li>
              <Flag className="inline h-4 w-4" /> Reach out to admins via ThinkShare or the project
              Discord for account issues.
            </li>
          </ul>
        </InfoBox>
      </Section>
    </ArticleLayout>
  );
}
