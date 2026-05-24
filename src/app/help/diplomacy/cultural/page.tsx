"use client";

import Link from "next/link";
import { Theater, HeartHandshake, Plane, Globe } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function CulturalExchangeArticle() {
  return (
    <ArticleLayout
      title="Cultural Exchanges"
      description="Build goodwill and strengthen relationships through cultural programs, academic partnerships, and shared events."
      icon={Theater}
    >
      <ContentCard>
        <Section title="What Are Cultural Exchanges?">
          <p className="text-slate-700 dark:text-slate-300">
            Cultural exchanges are cooperative programs between your country and another nation.
            They boost diplomatic relations, unlock achievements, and contribute to your country's
            reputation on the world stage. You can launch cultural exchanges from{" "}
            <Link
              href="/mycountry/diplomacy"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              MyCountry &rarr; Diplomacy
            </Link>{" "}
            by selecting the &quot;Cultural Exchange&quot; option.
          </p>
        </Section>

        <Section title="Program Types">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Educational Exchanges:</strong> Send and receive students to build long-term
              people-to-people ties.
            </li>
            <li>
              <strong>Research Collaborations:</strong> Partner with another country on joint
              academic or scientific projects.
            </li>
            <li>
              <strong>Arts &amp; Cultural Festivals:</strong> Host or participate in festivals
              celebrating shared or contrasting cultural traditions.
            </li>
            <li>
              <strong>Humanitarian Tie-ins:</strong> Combine cultural outreach with humanitarian aid
              for an even larger positive impact on relations.
            </li>
          </ul>
          <p className="mt-3 text-slate-700 dark:text-slate-300">
            Each program type carries different modifiers for your diplomatic relations, social
            metrics, and achievement progress.
          </p>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="How to Launch a Cultural Exchange">
          <InfoBox title="Step by Step">
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                Go to{" "}
                <Link
                  href="/mycountry/diplomacy"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  MyCountry &rarr; Diplomacy
                </Link>{" "}
                and choose &quot;Cultural Exchange&quot; from the available actions.
              </li>
              <li>
                Select your partner country, set your goals, and choose the program duration. You
                will also confirm the resource commitment required.
              </li>
              <li>
                Track your program's progress through notifications on your Diplomacy page. You can
                also share highlights and milestones on{" "}
                <Link
                  href="/help/social/thinkpages"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  ThinkPages
                </Link>
                .
              </li>
            </ol>
          </InfoBox>
        </Section>

        <Section title="Benefits">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Strengthen Relationships:</strong> Cultural exchanges steadily boost your
              relationship score with the partner country, and can help soften the impact of
              negative diplomatic incidents.
            </li>
            <li>
              <strong>Unlock Achievements:</strong> Completing cultural milestones earns you
              achievements and ThinkPages badges that showcase your diplomatic activity.
            </li>
            <li>
              <strong>Improve Intelligence Metrics:</strong> Positive cultural sentiment feeds into
              your{" "}
              <Link
                href="/help/mycountry/intelligence"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                intelligence analytics
              </Link>
              , giving you a clearer picture of your global standing.
            </li>
            <li>
              <strong>Build Cultural Openness:</strong> Active cultural programs can influence the{" "}
              <Link
                href="/help/diplomacy/npc-personalities"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                personality traits
              </Link>{" "}
              of NPC partners, gradually increasing their Cultural Openness over time.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Plane className="inline h-4 w-4" />{" "}
              <Link
                href="/help/diplomacy/missions"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Diplomatic Missions
              </Link>{" "}
              &mdash; Launch targeted missions alongside your cultural programs.
            </li>
            <li>
              <Globe className="inline h-4 w-4" />{" "}
              <Link
                href="/help/diplomacy/embassies"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Embassy Network
              </Link>{" "}
              &mdash; Establish the diplomatic presence needed for cultural exchanges.
            </li>
            <li>
              <HeartHandshake className="inline h-4 w-4" />{" "}
              <Link
                href="/help/social/thinktanks"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                ThinkTanks
              </Link>{" "}
              &mdash; Continue collaboration through research groups and intellectual partnerships.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
