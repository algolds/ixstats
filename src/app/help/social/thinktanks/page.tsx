"use client";

import Link from "next/link";
import { Users, MessagesSquare, Send } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function ThinkTanksArticle() {
  return (
    <ArticleLayout
      title="ThinkTanks"
      description="Form collaborative groups to plan strategies, build lore together, and coordinate policy work with other players."
      icon={Users}
    >
      <ContentCard>
        <Section title="What Are ThinkTanks?">
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            ThinkTanks are private or public group workspaces where you and other players can
            collaborate on shared goals. Whether you{"'"}re planning an alliance strategy,
            co-authoring lore, or developing economic policy, ThinkTanks give your group a dedicated
            space to stay organized.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              A shared workspace where members can curate posts, upload files, and track progress
              together.
            </li>
            <li>
              Flexible member roles — assign moderators to manage the group, contributors to add
              content, and observers who can follow along without editing.
            </li>
            <li>
              Optionally link your ThinkTank to active missions or policy pipelines so your group
              {"'"}s work has a direct impact on the game.
            </li>
          </ul>
        </Section>

        <Section title="Creating a ThinkTank">
          <InfoBox title="How to Get Started">
            <ol className="list-decimal space-y-1 pl-6">
              <li>
                Navigate to{" "}
                <Link
                  href="/help/social/thinkpages"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  ThinkPages
                </Link>{" "}
                and select <strong>Create ThinkTank</strong>.
              </li>
              <li>
                Give your group a name, choose its focus areas, and set whether it{"'"}s public or
                invite-only.
              </li>
              <li>Invite members by searching for other players and assigning their roles.</li>
              <li>
                Link relevant posts, policies, or missions to give your group a clear starting
                point.
              </li>
            </ol>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Getting the Most Out of Your ThinkTank">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Use meeting notes and action lists within the workspace to track what needs doing and
              who{"'"}s responsible.
            </li>
            <li>
              Celebrate milestones — completed goals can unlock achievements and generate social
              announcements that boost your group{"'"}s visibility.
            </li>
            <li>
              When a project wraps up, archive the ThinkTank to keep your workspace clean while
              preserving everything for future reference.
            </li>
          </ul>
        </Section>

        <Section title="Related Features">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <MessagesSquare className="inline h-4 w-4" />{" "}
              <Link
                href="/help/social/thinkpages"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                ThinkPages
              </Link>{" "}
              — publish and share content that you can link into your ThinkTank.
            </li>
            <li>
              <Send className="inline h-4 w-4" />{" "}
              <Link
                href="/help/social/thinkshare"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                ThinkShare Messaging
              </Link>{" "}
              — have private side conversations with individual ThinkTank members.
            </li>
          </ul>
        </Section>
      </ContentCard>
    </ArticleLayout>
  );
}
