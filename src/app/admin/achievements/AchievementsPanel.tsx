"use client";
// src/app/admin/achievements/AchievementsPanel.tsx
// Achievements & Awards Admin Panel

import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";

import { AwardsManagerSection } from "../wiki/components";

export function AchievementsPanel() {
  usePageTitle({ title: "Admin - Achievements & Awards" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Achievements and awards"
        subtitle="Article badges, achievement score rules and system awards."
      />

      <AwardsManagerSection />
    </div>
  );
}
