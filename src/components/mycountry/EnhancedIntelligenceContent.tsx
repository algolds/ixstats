"use client";

import { useMemo, useState } from "react";
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
import { useCountryData, VitalityRings, SectionHeaderBackground } from "./primitives";
import type { RingConfig } from "./primitives";
import { useUser } from "~/context/auth-context";
import { AlertThresholdSettings } from "~/app/mycountry/intelligence/_components/AlertThresholdSettings";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import { api } from "~/trpc/react";
import { IntelligenceDashboard } from "~/components/intelligence/IntelligenceDashboard";
import { IntelligenceAnalysisPanel } from "~/components/intelligence/IntelligenceAnalysisPanel";
import { KeyFindingsPanel } from "~/components/intelligence/KeyFindingsPanel";
import { WikiLoreBlock } from "./primitives/WikiLoreBlock";

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

  const intelligenceRings = useMemo((): RingConfig[] => {
    const securityScore = defenseOverview?.overallScore ?? 0;
    const securityLevel = defenseOverview?.securityLevel?.replace("_", " ") ?? "unknown";
    const criticalAlerts = intelligenceOverview?.alerts?.critical ?? 0;
    const totalAlerts = intelligenceOverview?.alerts?.total ?? 0;
    const activeEmbassies =
      embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
    const totalEmbassies = embassies?.length ?? 0;

    const alertColor = criticalAlerts > 0 ? "#ef4444" : "#22c55e";

    return [
      {
        key: "security",
        label: "Security",
        subtitle: securityLevel,
        color: "#3B82F6",
        icon: Shield,
        value: securityScore,
        target: 100,
        displayValue: `${securityScore}/100`,
        onClick: () => setActiveTab("dashboard"),
      },
      {
        key: "alerts",
        label: "Alerts",
        subtitle: `${totalAlerts} total`,
        color: alertColor,
        icon: AlertTriangle,
        value: criticalAlerts,
        target: totalAlerts || 1,
        displayValue: `${criticalAlerts} critical`,
        onClick: () => setActiveTab("reports"),
      },
      {
        key: "network",
        label: "Network",
        subtitle: "embassies",
        color: "#3B82F6",
        icon: Globe,
        value: activeEmbassies,
        target: totalEmbassies || 1,
        displayValue: `${activeEmbassies} active`,
        onClick: () => setActiveTab("analysis"),
      },
    ];
  }, [defenseOverview, intelligenceOverview, embassies]);

  if (isLoading || !country) {
    return null;
  }

  const criticalAlerts = intelligenceOverview?.alerts?.critical ?? 0;

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

  const header = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <SectionHeaderBackground context="intelligence">
        <div
          id="overview"
          className="glass-hierarchy-parent rounded-xl border border-blue-500/30 p-3 sm:p-4 dark:border-blue-500/20"
        >
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50">
              MyCountry®
            </Badge>
            <span className="text-muted-foreground text-sm">→</span>
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
              <BrainIcon size={12} className="mr-1" />
              Intelligence Center
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="shrink-0 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 p-2">
                <BrainIcon size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold sm:text-2xl">{country.name}</h1>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Intelligence Dashboard & Analytics
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SectionHeaderBackground>
    </motion.div>
  );

  return (
    <>
      <MyCountrySidebarLayout
        heroSection={header}
        activeSection={activeSection}
        onNavigate={onNavigate}
        notifications={notifications}
      >
        {/* Geopolitical Map */}
        <IntelligenceMapWidget countryId={country.id} countryName={country.name} />

        {/* Intelligence Status Rings */}
        <VitalityRings rings={intelligenceRings} title="Intelligence Overview" variant="grid" />

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCell
            icon={Shield}
            label="Security"
            value={`${defenseOverview?.overallScore ?? 0}/100`}
            color="text-blue-600"
          />
          <StatCell
            icon={AlertTriangle}
            label="Alerts"
            value={`${intelligenceOverview?.alerts?.critical ?? 0} critical`}
            color={
              (intelligenceOverview?.alerts?.critical ?? 0) > 0 ? "text-red-600" : "text-green-600"
            }
          />
          <StatCell
            icon={Globe}
            label="Embassies"
            value={`${embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length ?? 0} active`}
            color="text-blue-600"
          />
          <StatCell icon={FileText} label="Findings" value="Live" color="text-purple-600" />
        </div>

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

        <WikiLoreBlock context="intelligence" themeColor="blue" title="Intelligence Lore" />
      </MyCountrySidebarLayout>

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

/* ─── Stats Cell ─── */
function StatCell({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Shield;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="glass-hierarchy-child rounded-lg p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
      </div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}
