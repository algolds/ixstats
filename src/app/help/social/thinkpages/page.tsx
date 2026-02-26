"use client";

import Link from "next/link";
import { MessagesSquare, PenSquare, Users } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function ThinkPagesArticle() {
  return (
    <ArticleLayout
      title="ThinkPages"
      description="Share news, research, and story updates with the IxStats community through rich posts, wiki lookups, and a live social feed."
      icon={MessagesSquare}
    >
      <ContentCard>
        <Section title="What Is ThinkPages?">
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            ThinkPages is the social publishing platform built into IxStats. Think of it as your
            country{"'"}s newsroom — a place to broadcast updates, share analysis, and engage with
            posts from other players across the game world.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Compose rich text posts with embedded wiki lookups, images, and tags.
            </li>
            <li>
              The live event feed highlights featured and trending posts so important news reaches
              everyone.
            </li>
            <li>
              Your posts connect to achievements, notifications, and your intelligence dashboard,
              keeping everything in one place.
            </li>
          </ul>
        </Section>

        <Section title="Writing a Post">
          <InfoBox title="How to Compose">
            <ol className="list-decimal space-y-1 pl-6">
              <li>
                Navigate to ThinkPages from the main menu and tap <strong>Compose</strong>.
              </li>
              <li>
                Use the rich editor to write your content. You can search the IxWiki directly from
                the composer to pull in references and link to articles.
              </li>
              <li>
                Add tags like <strong>#economy</strong>, <strong>#diplomacy</strong>, or{" "}
                <strong>#military</strong> so other players can discover your post through topic
                filters.
              </li>
              <li>
                Choose to publish publicly for everyone to see, or share it with a specific{" "}
                <Link href="/help/social/thinktanks" className="text-blue-600 hover:underline dark:text-blue-400">
                  ThinkTank
                </Link>{" "}
                group.
              </li>
              <li>
                Once published, monitor reactions and replies in your feed.
              </li>
            </ol>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Tips for Great Posts">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Use topic tags generously — they make your posts searchable and help them surface in
              other players{"'"} feeds.
            </li>
            <li>
              Link to wiki articles using the built-in search tool to add credibility and context
              to your writing.
            </li>
            <li>
              Embed policy proposals, mission reports, or diplomatic summaries to keep your allies
              and team members in the loop.
            </li>
          </ul>
        </Section>

        <Section title="Related Features">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <PenSquare className="inline h-4 w-4" />{" "}
              <Link href="/help/social/thinkshare" className="text-blue-600 hover:underline dark:text-blue-400">
                ThinkShare Messaging
              </Link>{" "}
              — follow up on posts with private conversations.
            </li>
            <li>
              <Users className="inline h-4 w-4" />{" "}
              <Link href="/help/social/thinktanks" className="text-blue-600 hover:underline dark:text-blue-400">
                ThinkTanks
              </Link>{" "}
              — collaborate with groups on shared research and planning.
            </li>
          </ul>
        </Section>
      </ContentCard>
    </ArticleLayout>
  );
}
