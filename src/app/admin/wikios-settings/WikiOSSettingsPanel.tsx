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

import { WikiOSUtilitiesDeck } from "~/components/wiki-os/utilities/WikiOSUtilitiesDeck";

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
        title="WikiOS Utilities & Health Administration"
        description="Unified health diagnostics, link integrity, and realm governance deck."
      />

      <WikiOSUtilitiesDeck embedded={true} defaultDomain="diagnostics" />

      <div className="space-y-6 border-t border-border/40 pt-6">
        <WikiLinkStatusSection countriesData={countriesData} isLoading={countriesLoading} />
        <ManualLinkEditorSection countriesData={countriesData} />
        <SystemTuningSection />
      </div>
    </div>
  );
}

export default WikiOSSettingsPanel;
