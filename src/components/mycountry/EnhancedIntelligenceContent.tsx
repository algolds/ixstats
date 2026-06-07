"use client";

import { useState } from "react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import {
  Eye,
  BarChart3,
  FileText,
  Settings,
  Shield,
  AlertTriangle,
  Globe,
  BookOpen,
} from "lucide-react";
import { BrainIcon } from "~/components/ui/icons";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import {
  useCountryData,
  SectionShell,
  CompactSectionHero,
  InlineWiki,
  type StatusBadgeConfig,
} from "./primitives";
import { useUser } from "~/context/auth-context";
import { AlertThresholdSettings } from "~/app/mycountry/intelligence/_components/AlertThresholdSettings";
import { api } from "~/trpc/react";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { IntelligenceDashboard } from "~/components/intelligence/IntelligenceDashboard";
import { IntelligenceAnalysisPanel } from "~/components/intelligence/IntelligenceAnalysisPanel";
import { KeyFindingsPanel } from "~/components/intelligence/KeyFindingsPanel";
import { IntelligenceSidebarWidget } from "./sidebar-widgets/IntelligenceSidebarWidget";

const IntelligenceMapWidget = dynamic(
  () =>
    import("~/components/maps/widgets/IntelligenceMapWidget").then((m) => ({
      default: m.IntelligenceMapWidget,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-64 animate-pulse rounded-xl" /> }
);

import type { MyCountrySection } from "./MyCountrySidebarNav";

interface EnhancedIntelligenceContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

type IntelligenceTab = "dashboard" | "analysis" | "reports" | "archives";

const WikiArchivesPanel = dynamic(
  () => import("./intelligence/WikiArchivesPanel").then((m) => ({ default: m.WikiArchivesPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
        ))}
      </div>
    ),
  }
);

export function EnhancedIntelligenceContent({
  activeSection,
  onNavigate,
  notifications,
}: EnhancedIntelligenceContentProps) {
  const { user } = useUser();
  const { country, isLoading } = useCountryData();
  const [activeTab, setActiveTab] = useState<IntelligenceTab>("dashboard");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // tRPC queries for stats rings
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { data: intelligenceOverview } = api.intelCore.getOverview.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { flagUrl } = useFlag(country?.name ?? "");

  if (isLoading || !country) {
    return null;
  }

  const criticalAlerts = intelligenceOverview?.alerts?.critical ?? 0;
  const totalAlerts = intelligenceOverview?.alerts?.total ?? 0;
  const otherAlerts = Math.max(totalAlerts - criticalAlerts, 0);
  const defOverviewScore = defenseOverview?.overallScore ?? 50;

  const intelligenceHealth = Math.max(0, Math.min(100, Math.round(
    defOverviewScore - Math.min(criticalAlerts * 10, 20) - Math.min(otherAlerts * 2, 10)
  )));

  const activeEmbassiesCount =
    embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length ?? 0;

  const tabs = [
    { value: "dashboard" as const, icon: Eye, label: "Dashboard", shortLabel: "Dash", badge: 0 },
    {
      value: "analysis" as const,
      icon: BarChart3,
      label: "Analysis",
      shortLabel: "Analysis",
      badge: 0,
    },
    {
      value: "reports" as const,
      icon: FileText,
      label: "Reports",
      shortLabel: "Reports",
      badge: criticalAlerts,
    },
    { value: "archives" as const, icon: BookOpen, label: "Archives", shortLabel: "Lore", badge: 0 },
  ];

  const statusBadges: StatusBadgeConfig[] =
    criticalAlerts > 0
      ? [
          {
            icon: AlertTriangle,
            count: criticalAlerts,
            colorClass: "border-red-500/40 text-red-600 dark:text-red-400",
          },
        ]
      : [];

  const heroStats = [
    { label: "Security", value: `${defOverviewScore}/100`, accentText: true },
    { label: "Alerts", value: criticalAlerts, accentText: true },
    { label: "Network", value: `${activeEmbassiesCount} active`, accentText: true },
  ];

  const heroActions = (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setSettingsOpen(true)}
    >
      <Settings className="h-4 w-4" />
    </Button>
  );

  return (
    <>
      <SectionShell
        section="intelligence"
        hero={
          <CompactSectionHero
            section="intelligence"
            title="Intelligence"
            subtitle="Threat monitoring & security analytics"
            icon={BrainIcon}
            countryName={country.name}
            flagUrl={flagUrl}
            stats={heroStats}
            statusBadges={statusBadges}
            actions={heroActions}
            health={intelligenceHealth}
          />
        }
        contextWidget={<IntelligenceSidebarWidget countryId={country.id} />}
        activeSection={activeSection}
        onNavigate={onNavigate}
        notifications={notifications}
      >
        {/* Geopolitical Map */}
        <IntelligenceMapWidget countryId={country.id} countryName={country.name} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as IntelligenceTab)}
            className="space-y-3"
          >
            <TabsList className="grid w-full grid-cols-4 gap-0.5">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 px-1.5 text-xs sm:px-2.5 sm:text-sm"
                >
                  <tab.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  {tab.badge > 0 && (
                    <span
                      className={`inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] leading-none font-bold ${
                        tab.value === "reports" && criticalAlerts > 0
                          ? "bg-red-500 text-white"
                          : "bg-amber-500 text-white"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="dashboard">
              <ThemedTabContent theme="intelligence" className="tab-content-enter">
                <IntelligenceDashboard
                  countryId={country.id}
                  countryName={country.name}
                  onTabChange={setActiveTab}
                  onNavigate={(section) => onNavigate?.(section as MyCountrySection)}
                />
              </ThemedTabContent>
            </TabsContent>

            <TabsContent value="analysis">
              <ThemedTabContent theme="intelligence" className="tab-content-enter">
                <IntelligenceAnalysisPanel
                  countryId={country.id}
                  countryName={country.name}
                  userId={user?.id || ""}
                />
              </ThemedTabContent>
            </TabsContent>

            <TabsContent value="reports">
              <ThemedTabContent theme="intelligence" className="tab-content-enter">
                <KeyFindingsPanel countryId={country.id} />
              </ThemedTabContent>
            </TabsContent>

            <TabsContent value="archives">
              <ThemedTabContent theme="intelligence" className="tab-content-enter">
                <WikiArchivesPanel countryId={country.id} countryName={country.name} />
              </ThemedTabContent>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Wiki woven inline */}
        <InlineWiki context="intelligence" accent="blue" maxSections={1} />
      </SectionShell>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Alert Threshold Settings
            </DialogTitle>
            <DialogDescription>
              Configure intelligence alert thresholds and notification preferences.
            </DialogDescription>
          </DialogHeader>
          <AlertThresholdSettings countryId={country.id} />
        </DialogContent>
      </Dialog>
    </>
  );
}
