// src/app/admin/_components/AdminRouter.tsx
"use client";

// eslint-disable-next-line unused-imports/no-unused-imports
import React, { useEffect } from "react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { LiveAdminDashboard } from "./LiveAdminDashboard";
import { GeneralSettingsContent } from "./GeneralSettingsContent";
import { BotIntegrationCenter } from "./BotIntegrationCenter";
import { NotificationsAdmin } from "./NotificationsAdmin";
import { StashSettingsContent } from "./StashSettingsContent";
import { ThinkPagesSettingsContent } from "./ThinkPagesSettingsContent";
import { Loader2, Settings, Sparkles, BookOpen } from "lucide-react";
import { api } from "~/trpc/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { AdminHeader } from "./AdminHeader";
import { useAdminNavigation } from "./AdminNavigationContext";

// Loader skeleton
const Loader = () => (
  <div className="flex h-[50vh] items-center justify-center">
    <div className="space-y-2 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
      <p className="text-muted-foreground text-xs">Loading panel components...</p>
    </div>
  </div>
);

// Dynamic imports
const StorytellerPanel = dynamic(
  () => import("../storyteller/StorytellerPanel").then((m) => m.default),
  { loading: Loader, ssr: false }
);

const RealmsTab = dynamic(
  () => import("../studio/_components/RealmsTab").then((m) => m.RealmsTab),
  { loading: Loader, ssr: false }
);

const RealmUsersTab = dynamic(
  () => import("../studio/_components/RealmUsersTab").then((m) => m.RealmUsersTab),
  { loading: Loader, ssr: false }
);

const WorldConfigsTab = dynamic(
  () => import("../studio/_components/WorldConfigsTab").then((m) => m.WorldConfigsTab),
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
  () => import("../national-issues/page").then((m) => m.default),
  { loading: Loader, ssr: false }
);

const WorldStudioPanel = dynamic(() => import("../maps/WorldStudioPanel").then((m) => m.default), {
  loading: Loader,
  ssr: false,
});

const CalculationEditor = dynamic(
  () => import("./CalculationEditor").then((m) => m.CalculationEditor),
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
  () => import("./NarratorAdminPanel").then((m) => m.NarratorAdminPanel),
  { loading: Loader, ssr: false }
);

const OnomaAdminPanel = dynamic(() => import("./OnomaAdminPanel").then((m) => m.OnomaAdminPanel), {
  loading: Loader,
  ssr: false,
});

const UnifiedMediaServiceAdmin = dynamic(
  () => import("./UnifiedMediaServiceAdmin").then((m) => m.UnifiedMediaServiceAdmin),
  { loading: Loader, ssr: false }
);

// Import UserManagement directly since it is small/medium
import { UserManagement } from "./UserManagement";

// Import exported Wiki sub-panels
import {
  WikiLinkStatusSection,
  ManualLinkEditorSection,
  BulkScannerSection,
  AwardsManagerSection,
  SystemTuningSection,
} from "../wiki/WikiPanel";

export function AdminRouter() {
  const { activeSection, onNavigate } = useAdminNavigation();

  // WikiOS API stats query shared by WikiOS components
  const { data: countriesData, isLoading: countriesLoading } = api.countries.getAll.useQuery(
    undefined,
    { enabled: ["wikios-settings", "lorescanner"].includes(activeSection) }
  );

  const renderContent = () => {
    switch (activeSection) {
      // System Control
      case "settings":
        return <GeneralSettingsContent />;
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

      // World Config
      case "world-settings":
        return (
          <div className="space-y-6">
            <AdminHeader
              icon={Settings}
              title="World Config Settings"
              description="High level options for the active game worlds, default zoom, Map projections, and wiki domains."
            />
            <WorldConfigsTab />
          </div>
        );
      case "storyteller":
        return <StorytellerPanel />;
      case "realms":
        return (
          <div className="space-y-6">
            <AdminHeader
              icon={Sparkles}
              title="Realms & Assignments"
              description="Create custom game realms, edit status, and bind users to realms."
            />
            <Tabs defaultValue="realms">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="realms">Realms</TabsTrigger>
                <TabsTrigger value="users">User Assignments</TabsTrigger>
              </TabsList>
              <TabsContent value="realms" className="mt-6">
                <RealmsTab />
              </TabsContent>
              <TabsContent value="users" className="mt-6">
                <RealmUsersTab />
              </TabsContent>
            </Tabs>
          </div>
        );
      case "worldstudio":
        return <WorldStudioPanel />;
      case "cards":
        return <CardsPanel />;
      case "vault":
        return <VaultPanel />;
      case "achievements":
        return (
          <div className="space-y-6">
            <AdminHeader
              icon={BookOpen}
              title="Achievements & Awards"
              description="Configure custom article badges, achievement score rules, and system points."
            />
            <AwardsManagerSection />
          </div>
        );
      case "reference-data":
        return <ReferenceDataPanel />;
      case "national-issues":
        return <NationalIssuesPanel />;

      // Users
      case "user-management":
        return <UserManagement mode="users" />;
      case "user-roles":
        return <UserManagement mode="roles" />;
      case "user-logs":
        return <LogsPanel />;

      // WikiOS
      case "wikios-settings":
        return (
          <div className="space-y-6">
            <AdminHeader
              icon={BookOpen}
              title="WikiOS Base Settings"
              description="Manage wiki domains integrations and link statuses."
            />
            <WikiLinkStatusSection countriesData={countriesData} isLoading={countriesLoading} />
            <ManualLinkEditorSection countriesData={countriesData} />
            <SystemTuningSection />
          </div>
        );

      case "lorescanner":
        return (
          <div className="space-y-6">
            <AdminHeader
              icon={BookOpen}
              title="Wiki Links LoreScanner"
              description="Automatically scan wiki pages for country names and link them together."
            />
            <BulkScannerSection countriesData={countriesData} />
          </div>
        );
      case "image-repo":
        return (
          <div className="space-y-6">
            <AdminHeader
              icon={BookOpen}
              title="WikiOS Commons Repository Cache"
              description="Initialize flag cache caches and synchronize Wikimedia Commons graphics."
            />
            <UnifiedMediaServiceAdmin />
          </div>
        );

      // Labs
      case "myleague":
        return <MyLeagueAdminPanel />;
      case "narrator":
        return <NarratorAdminPanel />;
      case "onoma":
        return <OnomaAdminPanel />;

      // Ungrouped
      case "facet-lab":
        return <FacetLabPanel />;
      case "polls":
        return <PollsPanel />;

      // Calculations breakout
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

      // Default
      case "dashboard":
      default:
        return <LiveAdminDashboard onNavigate={onNavigate} />;
    }
  };

  return renderContent();
}
export default AdminRouter;
