"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { Brain, Eye, BarChart3, Globe, Send, TrendingUp, Settings } from "lucide-react";
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
import { useCountryData } from "./primitives";
import { useUser } from "~/context/auth-context";
import { useHasRoleLevel } from "~/hooks/usePermissions";
import { IntelligenceOverview } from "~/components/intelligence/IntelligenceOverview";
import { AlertThresholdSettings } from "~/app/mycountry/intelligence/_components/AlertThresholdSettings";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import { IntelligenceSidebarWidget } from "./sidebar-widgets";

import type { MyCountrySection } from "./MyCountrySidebarNav";

// Dynamic imports for chart-heavy analytics panels
const AnalyticsDashboard = dynamic(
  () => import("~/app/mycountry/intelligence/_components/AnalyticsDashboard").then((m) => ({ default: m.AnalyticsDashboard })),
  { ssr: false }
);
const DiplomaticAnalytics = dynamic(
  () => import("~/app/mycountry/intelligence/_components/DiplomaticAnalytics").then((m) => ({ default: m.DiplomaticAnalytics })),
  { ssr: false }
);
const PolicyAnalytics = dynamic(
  () => import("~/app/mycountry/intelligence/_components/PolicyAnalytics").then((m) => ({ default: m.PolicyAnalytics })),
  { ssr: false }
);
const CardEconomyAnalytics = dynamic(
  () => import("~/app/mycountry/intelligence/_components/CardEconomyAnalytics").then((m) => ({ default: m.CardEconomyAnalytics })),
  { ssr: false }
);

interface EnhancedIntelligenceContentProps {
  variant?: "unified" | "standard" | "premium";
  title?: string;
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
}

type IntelligenceTab = "overview" | "economic" | "diplomatic" | "policy" | "forecasting";

export function EnhancedIntelligenceContent({
  title,
  activeSection,
  onNavigate,
}: EnhancedIntelligenceContentProps) {
  const { user } = useUser();
  const { country, isLoading } = useCountryData();
  const [activeTab, setActiveTab] = useState<IntelligenceTab>("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isAdmin = useHasRoleLevel(10);

  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  if (isLoading || !country) {
    return null;
  }

  const tabs = [
    { value: "overview", icon: Eye, label: "Dashboard", shortLabel: "Dash" },
    { value: "economic", icon: BarChart3, label: "Economic", shortLabel: "Econ" },
    { value: "diplomatic", icon: Globe, label: "Diplomatic", shortLabel: "Diplo" },
    { value: "policy", icon: Send, label: "Policy", shortLabel: "Policy" },
    { value: "forecasting", icon: TrendingUp, label: "Forecasting", shortLabel: "Fore" },
  ];

  const header = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div id="overview" className="glass-hierarchy-parent rounded-xl border border-indigo-500/20 p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50">
            MyCountry®
          </Badge>
          <span className="text-muted-foreground text-sm">→</span>
          <Badge className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white">
            <Brain className="mr-1 h-3 w-3" />
            Intelligence Center
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 p-2 flex-shrink-0">
              <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{country.name}</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Intelligence Dashboard & Analytics</p>
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
    </motion.div>
  );

  return (
    <>
      <MyCountrySidebarLayout
        heroSection={header}
        activeSection={activeSection}
        onNavigate={onNavigate}
      >
        {/* Inline status strip */}
        <IntelligenceSidebarWidget countryId={country.id} />

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
            <div className="overflow-x-auto">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 min-w-fit gap-0.5">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 text-xs sm:text-sm px-1.5 sm:px-2.5"
                  >
                    <tab.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="overview" id="overview">
              <ThemedTabContent theme="intelligence" className="tab-content-enter">
                <IntelligenceOverview countryId={country.id} countryName={country.name} onTabChange={setActiveTab} />
              </ThemedTabContent>
            </TabsContent>

            <TabsContent value="economic" id="economic">
              <ThemedTabContent theme="intelligence" className="tab-content-enter">
                <div className="space-y-4">
                  <AnalyticsDashboard userId={user?.id || ""} countryId={country.id} />
                  {isAdmin && (
                    <CardEconomyAnalytics countryId={country.id} userId={user?.id || ""} />
                  )}
                </div>
              </ThemedTabContent>
            </TabsContent>

            <TabsContent value="diplomatic" id="diplomatic">
              <ThemedTabContent theme="intelligence" className="tab-content-enter">
                <DiplomaticAnalytics countryId={country.id} countryName={country.name} />
              </ThemedTabContent>
            </TabsContent>

            <TabsContent value="policy" id="policy">
              <ThemedTabContent theme="intelligence" className="tab-content-enter">
                <PolicyAnalytics countryId={country.id} userId={user?.id} />
              </ThemedTabContent>
            </TabsContent>

            <TabsContent value="forecasting" id="forecasting">
              <ThemedTabContent theme="intelligence" className="tab-content-enter">
                <div className="text-muted-foreground py-8 text-center">
                  <TrendingUp className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
                  <h3 className="mb-1 text-sm font-semibold">Predictive Forecasting Coming Soon</h3>
                  <p className="mx-auto max-w-md text-xs">
                    AI-powered economic projections, diplomatic trend analysis, and policy impact predictions.
                  </p>
                </div>
              </ThemedTabContent>
            </TabsContent>
          </Tabs>
        </motion.div>
      </MyCountrySidebarLayout>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-600" />
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
