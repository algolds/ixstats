"use client";

import { Users, Lightbulb, ClipboardCheck } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function ThinkTanksArticle() {
  return (
    <ArticleLayout
      title="ThinkTanks"
      description="Collaborative research groups for focused planning, worldbuilding, and policy work."
      icon={Users}
    >
      <Section title="What ThinkTanks Provide">
        <ul className="list-disc space-y-2 pl-6">
          <li>Shared workspace with curated ThinkPages posts and files.</li>
          <li>Member roles for moderators, contributors, and observers.</li>
          <li>Optional integration with missions and policy pipelines for accountability.</li>
        </ul>
      </Section>

      <Section title="Creating a ThinkTank">
        <InfoBox title="Steps">
          <ol className="list-decimal space-y-1 pl-6">
            <li>Open ThinkPages and select “Create ThinkTank”.</li>
            <li>Choose focus areas, invite members, and set privacy.</li>
            <li>Link relevant posts, policies, or missions to keep work aligned.</li>
          </ol>
        </InfoBox>
      </Section>

      <Section title="Best Practices">
        <ul className="list-disc space-y-2 pl-6">
          <li>Use meeting notes and action lists to track progress.</li>
          <li>Celebrate milestones with achievements and social announcements.</li>
          <li>Archive completed ThinkTanks to maintain a clean workspace.</li>
        </ul>
      </Section>

      <InfoBox title="Related Docs">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Lightbulb className="inline h-4 w-4" /> `/help/social/thinkpages` – content publishing.
          </li>
          <li>
            <ClipboardCheck className="inline h-4 w-4" /> `docs/systems/social.md` – detailed
            architecture.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
