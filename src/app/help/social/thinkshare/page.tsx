"use client";

import Link from "next/link";
import { Send, MessagesSquare, Users, Shield, Inbox, Globe, MessageCircle } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox, ContentCard } from "../../_components/ArticleLayout";

export default function ThinkShareArticle() {
  return (
    <ArticleLayout
      title="Messages"
      description="The unified messaging system across all IxStats platforms — personal DMs, diplomatic channels, wiki discussions, forum threads, and group chats in one place."
      icon={Send}
    >
      <ContentCard>
        <Section title="What Is ThinkShare Messages?">
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            ThinkShare Messages is the platform-wide messaging backbone. It unifies all
            communication across IxStats, WikiOS, the Forum, and diplomatic systems into a single
            interface at <strong>/messages</strong>.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Inbox className="inline h-4 w-4" /> <strong>Smart Folders</strong> — messages are
              automatically organized into Inbox, Personal, Diplomatic, Discussions, Groups, and
              System folders.
            </li>
            <li>
              <Globe className="inline h-4 w-4" /> <strong>Contextual Identity</strong> — your
              display name and avatar change based on context. Diplomatic channels show your
              country name, wiki discussions show your wiki username.
            </li>
            <li>
              <MessageCircle className="inline h-4 w-4" /> <strong>Cross-System</strong> — wiki
              talk page replies, forum conversations, and diplomatic cables all appear in your
              unified inbox.
            </li>
          </ul>
        </Section>

        <Section title="Getting Started">
          <InfoBox title="How to Message">
            <ol className="list-decimal space-y-1 pl-6">
              <li>
                Open <Link href="/messages" className="text-blue-600 hover:underline dark:text-blue-400">Messages</Link> from
                the main navigation menu.
              </li>
              <li>
                Use the folder rail on the left to switch between Personal, Diplomatic,
                Discussions, Groups, and System messages.
              </li>
              <li>
                Select a conversation to view it, or click <strong>New Conversation</strong> to
                start a new one.
              </li>
              <li>
                Use reactions, replies, and rich text to keep discussions organized.
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
              Diplomatic channels support classification levels (Public, Restricted, Confidential,
              Secret, Top Secret) and encrypted messaging.
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
