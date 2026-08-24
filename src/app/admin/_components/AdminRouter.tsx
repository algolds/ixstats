// src/app/admin/_components/AdminRouter.tsx
// Central pushState single-page router for all 47 Admin interfaces
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { LiveAdminDashboard } from "./LiveAdminDashboard";
import { BotIntegrationCenter } from "./BotIntegrationCenter";
import { NotificationsAdmin } from "./NotificationsAdmin";
import { StashSettingsContent } from "./StashSettingsContent";
import { ThinkPagesSettingsContent } from "./ThinkPagesSettingsContent";
import { SystemRestart as Loader2, Settings } from "iconoir-react";
import { AdminHeader } from "./AdminHeader";
import { useAdminNavigation } from "./AdminNavigationContext";
import { Skeleton } from "~/components/ui/skeleton";

// Loader wireframe
const Loader = () => (
  <div className="space-y-6">
    <Skeleton className="h-32 w-full rounded-2xl" />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-96 w-full rounded-2xl" />
  </div>
);

// Dynamic imports for modular panels
const PlatformSettingsPanel = dynamic(
  () => import("../platform/PlatformSettingsPanel").then((m) => m.PlatformSettingsPanel),
  { loading: Loader, ssr: false }
);



const StorytellerPanel = dynamic(
  () => import("../storyteller/StorytellerPanel").then((m) => m.default),
  { loading: Loader, ssr: false }
);

const RealmsPanel = dynamic(
  () => import("../realms/RealmsPanel").then((m) => m.RealmsPanel),
  { loading: Loader, ssr: false }
);

const CardsPanel = dynamic(() => import("../cards/CardsPanel").then((m) => m.default), {
  loading: Loader,
  ssr: false,
});

const VaultPanel = dynamic(() => import("../vault/VaultPanel").then((m) => m.default), {
  loading: Loader,
  ssr: false,
});

const AchievementsPanel = dynamic(
  () => import("../achievements/AchievementsPanel").then((m) => m.AchievementsPanel),
  { loading: Loader, ssr: false }
);

const ReferenceDataPanel = dynamic(
  () => import("../reference-data/ReferenceDataPanel").then((m) => m.default),
  { loading: Loader, ssr: false }
);

const BlurbsPanel = dynamic(() => import("../blurbs/BlurbsPanel").then((m) => m.default), {
  loading: Loader,
  ssr: false,
});

const PollsPanel = dynamic(() => import("../polls/PollsPanel").then((m) => m.default), {
  loading: Loader,
  ssr: false,
});

const NationalIssuesPanel = dynamic(
  () => import("../national-issues/NationalIssuesPanel").then((m) => m.default),
  { loading: Loader, ssr: false }
);

const WorldStudioPanel = dynamic(() => import("../maps/WorldStudioPanel").then((m) => m.default), {
  loading: Loader,
  ssr: false,
});

const CalculationEditor = dynamic(
  () => import("../calculations/CalculationEditor").then((m) => m.CalculationEditor),
  { loading: Loader, ssr: false }
);

const RingsAuditPanel = dynamic(
  () => import("../rings-audit/RingsAuditPanel").then((m) => m.RingsAuditPanel),
  { loading: Loader, ssr: false }
);

const LogsPanel = dynamic(() => import("../logs/LogsPanel").then((m) => m.default), {
  loading: Loader,
  ssr: false,
});

const FacetLabPanel = dynamic(
  () => import("../facet-materials-lab/FacetLabPanel").then((m) => m.default),
  { loading: Loader, ssr: false }
);

const MyLeagueAdminPanel = dynamic(
  () => import("../myleague/MyLeagueAdminPanel").then((m) => m.default),
  { loading: Loader, ssr: false }
);

const NarratorAdminPanel = dynamic(
  () => import("../narrator/NarratorPanel").then((m) => m.NarratorPanel),
  { loading: Loader, ssr: false }
);

const OnomaAdminPanel = dynamic(() => import("./OnomaAdminPanel").then((m) => m.OnomaAdminPanel), {
  loading: Loader,
  ssr: false,
});

const WikiOSSettingsPanel = dynamic(
  () => import("../wikios-settings/WikiOSSettingsPanel").then((m) => m.WikiOSSettingsPanel),
  { loading: Loader, ssr: false }
);

const LoreScannerPanel = dynamic(
  () => import("../lorescanner/LoreScannerPanel").then((m) => m.LoreScannerPanel),
  { loading: Loader, ssr: false }
);

const ImageRepoPanel = dynamic(
  () => import("../image-repo/ImageRepoPanel").then((m) => m.ImageRepoPanel),
  { loading: Loader, ssr: false }
);

const CountriesAdminPanel = dynamic(
  () => import("../countries/CountriesAdminPanel").then((m) => m.CountriesAdminPanel),
  { loading: Loader, ssr: false }
);

const DiplomaticOptionsPanel = dynamic(
  () => import("../diplomatic-options/DiplomaticOptionsPanel").then((m) => m.DiplomaticOptionsPanel),
  { loading: Loader, ssr: false }
);

const DiplomaticScenariosPanel = dynamic(
  () => import("../diplomatic-scenarios/DiplomaticScenariosPanel").then((m) => m.DiplomaticScenariosPanel),
  { loading: Loader, ssr: false }
);

const MilitaryEquipmentPanel = dynamic(
  () => import("../military-equipment/MilitaryEquipmentPanel").then((m) => m.MilitaryEquipmentPanel),
  { loading: Loader, ssr: false }
);

const EconomicArchetypesPanel = dynamic(
  () => import("../economic-archetypes/EconomicArchetypesPanel").then((m) => m.EconomicArchetypesPanel),
  { loading: Loader, ssr: false }
);

const IntelligenceTemplatesPanel = dynamic(
  () => import("../intelligence-templates/IntelligenceTemplatesPanel").then((m) => m.IntelligenceTemplatesPanel),
  { loading: Loader, ssr: false }
);

const NPCPersonalitiesPanel = dynamic(
  () => import("../npc-personalities/NPCPersonalitiesPanel").then((m) => m.NPCPersonalitiesPanel),
  { loading: Loader, ssr: false }
);

const MembershipPanel = dynamic(
  () => import("../membership/MembershipPanel").then((m) => m.MembershipPanel),
  { loading: Loader, ssr: false }
);

const EconomicComponentsPanel = dynamic(
  () => import("../economic-components/EconomicComponentsPanel").then((m) => m.EconomicComponentsPanel),
  { loading: Loader, ssr: false }
);

const GovernmentComponentsPanel = dynamic(
  () => import("../government-components/GovernmentComponentsPanel").then((m) => m.GovernmentComponentsPanel),
  { loading: Loader, ssr: false }
);

// Import UserManagement directly
import { UserManagement } from "./UserManagement";

export function AdminRouter() {
  const { activeSection, onNavigate } = useAdminNavigation();

  const renderContent = () => {
    switch (activeSection) {
      // Platform & Systems
      case "settings":
      case "platform":
        return <PlatformSettingsPanel />;
      case "autosave-monitor":
        return <PlatformSettingsPanel defaultTab="autosave" />;
      case "countries":
        return <CountriesAdminPanel />;
      case "bot":
        return <BotIntegrationCenter />;
      case "notifications":
        return <NotificationsAdmin />;
      case "stash":
        return <StashSettingsContent />;
      case "thinkpages":
        return <ThinkPagesSettingsContent />;
      case "blurbs":
        return <BlurbsPanel />;

      // World & Simulation
      case "world-settings":
        return <RealmsPanel defaultTab="worlds" />;
      case "storyteller":
        return <StorytellerPanel />;
      case "realms":
        return <RealmsPanel defaultTab="realms" />;
      case "worldstudio":
      case "maps":
        return <WorldStudioPanel />;
      case "style-editor":
        return <WorldStudioPanel initialTab="settings" />;
      case "cards":
        return <CardsPanel />;
      case "vault":
        return <VaultPanel />;
      case "achievements":
        return <AchievementsPanel />;
      case "reference-data":
        return <ReferenceDataPanel />;
      case "national-issues":
        return <NationalIssuesPanel />;
      case "calculations":
        return (
          <div className="space-y-6">
            <AdminHeader
              icon={Settings}
              title="Calculation Formula Editor"
              description="Interactive editor for world-sim economic equations and projection formulas."
            />
            <CalculationEditor />
          </div>
        );
      case "rings-audit":
        return <RingsAuditPanel />;

      // Users & Security
      case "user-management":
      case "users":
        return <UserManagement mode="users" />;
      case "user-roles":
        return <UserManagement mode="roles" />;
      case "membership":
        return <MembershipPanel />;
      case "user-logs":
      case "logs":
        return <LogsPanel />;

      // Simulation Systems (CMS)
      case "diplomatic-options":
        return <DiplomaticOptionsPanel />;
      case "diplomatic-scenarios":
        return <DiplomaticScenariosPanel />;
      case "military-equipment":
        return <MilitaryEquipmentPanel />;
      case "economic-archetypes":
        return <EconomicArchetypesPanel />;
      case "intelligence-templates":
        return <IntelligenceTemplatesPanel />;
      case "npc-personalities":
        return <NPCPersonalitiesPanel />;
      case "economic-components":
        return <EconomicComponentsPanel />;
      case "government-components":
        return <GovernmentComponentsPanel />;

      // WikiOS
      case "wikios-settings":
        return <WikiOSSettingsPanel />;
      case "lorescanner":
        return <LoreScannerPanel />;
      case "image-repo":
        return <ImageRepoPanel />;

      // Labs
      case "myleague":
        return <MyLeagueAdminPanel />;
      case "narrator":
        return <NarratorAdminPanel />;
      case "onoma":
        return <OnomaAdminPanel />;
      case "facet-lab":
        return <FacetLabPanel />;
      case "polls":
        return <PollsPanel />;

      // Default
      case "dashboard":
      default:
        return <LiveAdminDashboard onNavigate={onNavigate} />;
    }
  };

  return renderContent();
}

export default AdminRouter;
