"use client";

import { MessagesSquare, PenSquare, Share2 } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function ThinkPagesArticle() {
  return (
    <ArticleLayout
      title="ThinkPages"
      description="Share research, updates, and story beats with rich posts and collaborative tools."
      icon={MessagesSquare}
    >
      <Section title="Features">
        <ul className="list-disc pl-6 space-y-2">
          <li>Rich text posts with wiki lookups, embeds, and tags.</li>
          <li>Live event feed surfaces featured posts across the game world.</li>
          <li>Integrates with achievements, notifications, and intelligence dashboards.</li>
        </ul>
      </Section>

      <Section title="Creating Posts">
        <InfoBox title="Workflow">
          <ol className="list-decimal pl-6 space-y-1">
            <li>Open `/thinkpages` and select "Compose".</li>
            <li>Use the rich editor to add content, references, and media.</li>
            <li>Publish publicly or to specific ThinkTanks; monitor reactions in the feed.</li>
          </ol>
        </InfoBox>
      </Section>

      <Section title="Tips">
        <ul className="list-disc pl-6 space-y-2">
          <li>Tag posts with topics (`#economy`, `#diplomacy`, etc.) for better discovery.</li>
          <li>Link to help articles or docs using the wiki search tools.</li>
          <li>Embed policy proposals or mission reports to keep teams aligned.</li>
        </ul>
      </Section>

      <InfoBox title="Related Content">
        <ul className="list-disc pl-6 space-y-1">
          <li><PenSquare className="inline h-4 w-4" /> `/help/social/thinkshare` – messaging and follow-up.</li>
          <li><Share2 className="inline h-4 w-4" /> `docs/systems/social.md` – architecture overview.</li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
