"use client";

import { Send, MessageCircle, Shield } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function ThinkShareArticle() {
  return (
    <ArticleLayout
      title="ThinkShare Messaging"
      description="Coordinate privately with team members and allies using threaded messaging."
      icon={Send}
    >
      <Section title="Core Features">
        <ul className="list-disc pl-6 space-y-2">
          <li>Conversation list with search, unread indicators, and typing signals.</li>
          <li>Rich message composer that supports mentions, attachments, and replies.</li>
          <li>Integration with notifications for mission updates, policy reviews, and alerts.</li>
        </ul>
      </Section>

      <Section title="Using ThinkShare">
        <InfoBox title="Steps">
          <ol className="list-decimal pl-6 space-y-1">
            <li>Open ThinkShare from `/thinkpages` or the navigation menu.</li>
            <li>Select an existing conversation or create a new one.</li>
            <li>Use reactions and reply previews to keep discussions organised.</li>
          </ol>
        </InfoBox>
      </Section>

      <WarningBox title="Security">
        <ul className="list-disc pl-6 space-y-1">
          <li><Shield className="inline h-4 w-4" /> Respect privacy settings; only invited participants can view conversations.</li>
          <li>System messages flag critical events—acknowledge them to keep compliance tidy.</li>
        </ul>
      </WarningBox>

      <InfoBox title="Reference">
        <ul className="list-disc pl-6 space-y-1">
          <li><MessageCircle className="inline h-4 w-4" /> `src/components/thinkshare` – component architecture.</li>
          <li>`docs/systems/social.md` – social platform overview.</li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
