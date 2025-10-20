"use client";

import { Navigation, LayoutDashboard, Menu } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function NavigationArticle() {
  return (
    <ArticleLayout
      title="Navigating the Platform"
      description="Learn the layout, quick actions, and shortcuts that keep you productive."
      icon={Navigation}
    >
      <Section title="Global Layout">
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Top Navigation:</strong> Auth-aware menu with access to MyCountry, builder, dashboards, ThinkPages, and help.</li>
          <li><strong>Command Center:</strong> Signed-in home (`/`) surfaces quick links, alerts, and dynamic cards.</li>
          <li><strong>Help:</strong> `/help` is always available and mirrors the repository documentation.</li>
        </ul>
      </Section>

      <Section title="Quick Actions & Shortcuts">
        <InfoBox title="Within MyCountry">
          <ul className="list-disc pl-6 space-y-1">
            <li>Use the left tab rail to jump between Executive, Intelligence, Defense, Economy, Labor, Demographics, and Analytics.</li>
            <li>Compliance alerts open the modal anywhere in the suite.</li>
            <li>Command palette (Ctrl/Cmd + K) exposes quick navigation for admin and builder tools.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Dark Mode & Layout Settings">
        <ul className="list-disc pl-6 space-y-2">
          <li>Toggle themes from the user menu (`src/components/UserProfileMenu.tsx`).</li>
          <li>Persistent preferences use `localStorage`; reset via browser devtools if needed.</li>
          <li>Admin dashboards expose grid density controls for monitoring views.</li>
        </ul>
      </Section>

      <InfoBox title="Related Docs">
        <ul className="list-disc pl-6 space-y-1">
          <li><LayoutDashboard className="inline h-4 w-4" /> `docs/architecture/frontend.md` – layout composition and design tokens.</li>
          <li><Menu className="inline h-4 w-4" /> `/help/technical/architecture` – deeper technical overview.</li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
