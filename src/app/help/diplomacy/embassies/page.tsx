"use client";

import { Building2, MailPlus, Globe2 } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function EmbassiesArticle() {
  return (
    <ArticleLayout
      title="Embassy Network"
      description="Manage embassy presence, staffing, and influence across the world."
      icon={Building2}
    >
      <Section title="Embassy Lifecycle">
        <ol className="list-decimal pl-6 space-y-2">
          <li>Create or upgrade embassies via quick actions or diplomatic routers.</li>
          <li>Assign missions and staff; monitor success rates and benefits.</li>
          <li>Log results in ThinkPages for campaign storytelling.</li>
        </ol>
      </Section>

      <Section title="Data Touchpoints">
        <InfoBox title="Backed by">
          <ul className="list-disc pl-6 space-y-1">
            <li>`api.diplomatic.getEmbassies`, `api.diplomatic.createEmbassy`.</li>
            <li>`DiplomaticOperationsHub.tsx` – central UI for missions + embassy stats.</li>
            <li>`docs/systems/diplomacy.md` – detailed reference.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Best Practices">
        <ul className="list-disc pl-6 space-y-2">
          <li>Pair embassy expansion with trade or cultural programmes.</li>
          <li>Watch relation strength and alerts to prioritise staff.</li>
          <li>Use achievements and leaderboards to recognise diplomatic success.</li>
        </ul>
      </Section>

      <InfoBox title="Related Help">
        <ul className="list-disc pl-6 space-y-1">
          <li><MailPlus className="inline h-4 w-4" /> `/help/diplomacy/missions` – sending diplomatic teams.</li>
          <li><Globe2 className="inline h-4 w-4" /> `/help/diplomacy/cultural` – supporting cultural outreach.</li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
