"use client";

import { Briefcase, ClipboardSignature, Target } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function ExecutiveOperationsArticle() {
  return (
    <ArticleLayout
      title="Executive Operations"
      description="Use unified intelligence to coordinate policy decisions, missions, and compliance actions."
      icon={Briefcase}
    >
      <Section title="Operational Toolkit">
        <ul className="list-disc pl-6 space-y-2">
          <li>Quick actions for missions, policy drafts, and crisis responses.</li>
          <li>Compliance queue for unresolved alerts and scheduled reviews.</li>
          <li>Integration with ThinkPages and achievements for sharing outcomes.</li>
        </ul>
      </Section>

      <Section title="Recommended Workflow">
        <InfoBox title="Daily Loop">
          <ol className="list-decimal pl-6 space-y-1">
            <li>Review the intelligence dashboard for new signals.</li>
            <li>Trigger relevant quick actions or policies.</li>
            <li>Log decisions in ThinkPages and clear compliance tasks.</li>
          </ol>
        </InfoBox>
      </Section>

      <Section title="Maintainer Notes">
        <ul className="list-disc pl-6 space-y-2">
          <li>Operations UI lives alongside intelligence components in `src/app/mycountry/intelligence/_components`.</li>
          <li>Add tests when introducing new actions or compliance flows.</li>
          <li>Update `/help/intelligence/alerts` and `docs/systems/mycountry.md` to reflect workflow adjustments.</li>
        </ul>
      </Section>

      <InfoBox title="Quick Links">
        <ul className="list-disc pl-6 space-y-1">
          <li><ClipboardSignature className="inline h-4 w-4" /> `/help/diplomacy/missions` – follow-up actions.</li>
          <li><Target className="inline h-4 w-4" /> `/help/intelligence/forecasting` – planning ahead.</li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
