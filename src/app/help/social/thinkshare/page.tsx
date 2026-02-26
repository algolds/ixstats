"use client";

import Link from "next/link";
import { Send, MessagesSquare, Users, Shield } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox, ContentCard } from "../../_components/ArticleLayout";

export default function ThinkShareArticle() {
  return (
    <ArticleLayout
      title="ThinkShare Messaging"
      description="Send private messages to allies, coordinate with team members, and keep sensitive discussions out of the public feed."
      icon={Send}
    >
      <ContentCard>
        <Section title="What Is ThinkShare?">
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            ThinkShare is the private messaging system within IxStats. Use it to have one-on-one or
            group conversations with other players — perfect for diplomatic back-channels, alliance
            coordination, or casual chat.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Browse your conversations with search, unread indicators, and real-time typing signals
              so you always know who{"'"}s active.
            </li>
            <li>
              Compose messages with mentions, attachments, and threaded replies to keep discussions
              organized.
            </li>
            <li>
              Receive notifications when important updates arrive — mission briefings, policy
              reviews, and alliance alerts can all flow through ThinkShare.
            </li>
          </ul>
        </Section>

        <Section title="Starting a Conversation">
          <InfoBox title="How to Message">
            <ol className="list-decimal space-y-1 pl-6">
              <li>
                Open ThinkShare from the{" "}
                <Link href="/help/social/thinkpages" className="text-blue-600 hover:underline dark:text-blue-400">
                  ThinkPages
                </Link>{" "}
                section or from the main navigation menu.
              </li>
              <li>
                Select an existing conversation to continue it, or tap <strong>New Conversation</strong>{" "}
                to start a fresh one.
              </li>
              <li>
                Use reactions and reply previews to keep long threads easy to follow.
              </li>
            </ol>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <WarningBox title="Privacy and Security">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Shield className="inline h-4 w-4" /> Only invited participants can view a
              conversation. Your private discussions stay private.
            </li>
            <li>
              System messages flag critical events like diplomatic incidents or security alerts —
              acknowledge them promptly to keep your compliance record clean.
            </li>
          </ul>
        </WarningBox>

        <Section title="Related Features">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <MessagesSquare className="inline h-4 w-4" />{" "}
              <Link href="/help/social/thinkpages" className="text-blue-600 hover:underline dark:text-blue-400">
                ThinkPages
              </Link>{" "}
              — publish posts publicly and engage with the broader community.
            </li>
            <li>
              <Users className="inline h-4 w-4" />{" "}
              <Link href="/help/social/thinktanks" className="text-blue-600 hover:underline dark:text-blue-400">
                ThinkTanks
              </Link>{" "}
              — collaborate in group workspaces with shared posts and files.
            </li>
          </ul>
        </Section>
      </ContentCard>
    </ArticleLayout>
  );
}
