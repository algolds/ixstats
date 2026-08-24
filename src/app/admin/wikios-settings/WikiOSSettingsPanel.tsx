// src/app/admin/wikios-settings/WikiOSSettingsPanel.tsx
// WikiOS Base Settings Admin Panel
"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { OpenBook as BookOpen } from "iconoir-react";
import { api } from "~/trpc/react";
import {
  WikiLinkStatusSection,
  ManualLinkEditorSection,
  SystemTuningSection,
} from "../wiki/components";

export function WikiOSSettingsPanel() {
  usePageTitle({ title: "Admin - WikiOS Settings" });

  const { data: countriesData, isLoading: countriesLoading } = api.countries.getAll.useQuery(
    { limit: 500 },
    { refetchOnWindowFocus: false }
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={BookOpen}
        title="WikiOS Base Settings"
        description="Manage wiki domains, link statuses, and MediaWiki bridge system tuning."
      />

      <div className="space-y-6">
        <WikiLinkStatusSection countriesData={countriesData} isLoading={countriesLoading} />
        <ManualLinkEditorSection countriesData={countriesData} />
        <SystemTuningSection />
      </div>
    </div>
  );
}

export default WikiOSSettingsPanel;
