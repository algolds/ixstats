"use client";
// src/app/admin/achievements/AchievementsPanel.tsx
// Achievements & Awards Admin Panel

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Medal } from "iconoir-react";
import { AwardsManagerSection } from "../wiki/components";

export function AchievementsPanel() {
  usePageTitle({ title: "Admin - Achievements & Awards" });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Medal}
        title="Achievements & Awards"
        description="Configure custom article badges, achievement score rules, and system awards."
      />

      <AwardsManagerSection />
    </div>
  );
}

export default AchievementsPanel;
