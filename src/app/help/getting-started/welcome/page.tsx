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
      <Section title="What's New in v1.4">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Crisis Events System:</strong> Handle natural disasters, economic crises,
            diplomatic incidents with strategic responses.
          </li>
          <li>
            <strong>NPC AI Personalities:</strong> NPCs with 8 traits, 6 archetypes, dynamic
            behavioral prediction.
          </li>
          <li>
            <strong>Vector Tile Maps:</strong> 100-1000x performance improvement with Martin +
            Redis caching.
          </li>
          <li>
            <strong>Admin CMS:</strong> 17 interfaces for 100% dynamic content management (500+
            equipment, 100+ scenarios).
          </li>
          <li>
            <strong>Rate Limiting:</strong> Redis-based security protecting against abuse with
            tiered limits.
          </li>
        </ul>
      </Section>

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
              <strong>Builder:</strong> `/builder` – configure your nation with 106 atomic
              components (24 gov + 40+ econ + 42 tax).
            </li>
            <li>
              <strong>Global Dashboard:</strong> `/dashboard` – leaderboards, global stats, live
              economic data.
            </li>
            <li>
              <strong>Documentation:</strong> `docs/README.md` – complete documentation index (52
              routers, 580+ procedures).
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
