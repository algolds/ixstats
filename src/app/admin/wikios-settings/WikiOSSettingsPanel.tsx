"use client";
// src/app/admin/wikios-settings/WikiOSSettingsPanel.tsx
// WikiOS Base Settings Admin Panel

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { OpenBook as BookOpen } from "iconoir-react";
import { api } from "~/trpc/react";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
import {
  WikiLinkStatusSection,
  ManualLinkEditorSection,
  SystemTuningSection,
} from "../wiki/components";

import { WikiOSUtilitiesDeck } from "~/components/wiki-os/utilities/WikiOSUtilitiesDeck";
import { MirrorStatusSection } from "./MirrorStatusSection";

export function WikiOSSettingsPanel() {
  usePageTitle({ title: "Admin - WikiOS Settings" });

  const { data: countriesData, isLoading: countriesLoading } = api.countries.getAll.useQuery(
    { limit: 500, realm: ALL_REALMS },
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

      <MirrorStatusSection />

      <div className="border-border/40 space-y-6 border-t pt-6">
        <WikiLinkStatusSection countriesData={countriesData} isLoading={countriesLoading} />
        <ManualLinkEditorSection countriesData={countriesData} />
        <SystemTuningSection />
      </div>
    </div>
  );
}

export default WikiOSSettingsPanel;
