"use client";

import { Globe, Building, MessageSquare, FileText } from "lucide-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function MyCountryDiplomacyArticle() {
  return (
    <ArticleLayout
      title="Foreign Affairs"
      description="Manage embassies, talk to other nations, and steer your foreign policy."
      icon={Globe}
    >
      <ContentCard>
        <Section title="How It's Laid Out">
          <p>Your foreign affairs are split into four easy areas:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Overview</strong> — your diplomatic health at a glance.
            </li>
            <li>
              <strong>Embassies &amp; Relations</strong> — your network abroad and how each
              relationship is doing.
            </li>
            <li>
              <strong>Messages</strong> — talk directly with other nations.
            </li>
            <li>
              <strong>Foreign Policy</strong> — the stances you take toward the rest of the world.
            </li>
          </ul>
        </Section>

        <Section title="At a Glance">
          <p>The overview gives you a quick read on where you stand in the world:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Embassies</strong> — how many you&rsquo;ve opened, out of the ones you could.
            </li>
            <li>
              <strong>Relationships</strong> — how many nations you have ties with.
            </li>
            <li>
              <strong>Average warmth</strong> — how strong those ties are, on the whole.
            </li>
            <li>
              <strong>Close friends</strong> — the share of relationships that are genuinely strong.
            </li>
          </ul>
        </Section>

        <Section title="Embassies &amp; Relations">
          <InfoBox title="Building your network">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <Building className="inline h-4 w-4" /> Open new embassies with other nations.
              </li>
              <li>Manage the embassies you have — their staff and the influence they earn you.</li>
              <li>See your alliances and spot opportunities to join forces.</li>
              <li>Watch relationships warm or cool as you act on the world stage.</li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Talking to Other Nations">
          <p>
            <MessageSquare className="inline h-4 w-4 text-cyan-500" /> Send messages straight to
            other nations — float proposals, answer theirs, and keep the lines open with allies and
            rivals alike.
          </p>
        </Section>

        <Section title="Foreign Policy">
          <p>
            <FileText className="inline h-4 w-4 text-indigo-500" /> Set the stances that shape how
            the world sees you:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Draft a policy</strong> — define what you&rsquo;re after and who it concerns.
            </li>
            <li>
              <strong>Track what&rsquo;s active</strong> — keep an eye on your standing policies and
              their effects.
            </li>
            <li>
              <strong>See the trade impact</strong> — watch how your stances ripple through trade.
            </li>
          </ul>
        </Section>

        <Section title="Your Choices Have Consequences">
          <p className="mb-3">
            Foreign policy isn&rsquo;t shouting into the void — other nations notice, and they push
            back. When you make a move, the nation it touches weighs it against their own interests
            and how they feel about you.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Incidents</strong> — a bold or careless move can spark anything from a minor
              snub to a full-blown international dispute. These land in your issues feed and may
              need your attention right away.
            </li>
            <li>
              <strong>Different leaders, different reactions</strong> — every nation has a character
              of its own. A proud, militaristic neighbor will take your policy very differently than
              a friendly trading partner. Get to know who you&rsquo;re dealing with.
            </li>
            <li>
              <strong>One running story</strong> — diplomatic moments show up in your news feed
              alongside your other big decisions, so your nation&rsquo;s story on the world stage
              reads as one continuous tale.
            </li>
          </ul>
        </Section>

        <InfoBox title="Keep Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/diplomacy/embassies"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Embassies
              </Link>{" "}
              — building your network abroad.
            </li>
            <li>
              <Link
                href="/help/diplomacy/missions"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Diplomatic Missions
              </Link>{" "}
              — sending envoys to get things done.
            </li>
            <li>
              <Link
                href="/help/diplomacy/npc-personalities"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Meeting Other Leaders
              </Link>{" "}
              — who you&rsquo;re negotiating with, and what makes them tick.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
