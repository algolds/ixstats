"use client";

import React from "react";
import {
  Send,
  Globe,
  BarChart3,
  Eye,
  Shield,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { useMyCountryUnifiedData } from "./primitives";
import { useUser } from "~/context/auth-context";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { IntelligenceOverview } from "~/components/intelligence/IntelligenceOverview";
import { AnalyticsDashboard } from "~/app/mycountry/intelligence/_components/AnalyticsDashboard";
import { AlertThresholdSettings } from "~/app/mycountry/intelligence/_components/AlertThresholdSettings";
import { DiplomaticAnalytics } from "~/app/mycountry/intelligence/_components/DiplomaticAnalytics";
import { PolicyAnalytics } from "~/app/mycountry/intelligence/_components/PolicyAnalytics";
import { CardEconomyAnalytics } from "~/app/mycountry/intelligence/_components/CardEconomyAnalytics";
import { useHasRoleLevel } from "~/hooks/usePermissions";
import type { IntelligenceTab } from "~/hooks/useUnifiedIntelligence";

interface IntelligenceTabSystemProps {
  variant?: "unified" | "standard" | "premium";
}

export function IntelligenceTabSystem({ variant = "unified" }: IntelligenceTabSystemProps) {
  const { user } = useUser();
  const {
    country,
    unifiedIntelligence,
  } = useMyCountryUnifiedData();

  const { activeTab, setActiveTab, wsConnected } = unifiedIntelligence;
  const isAdmin = useHasRoleLevel(10); // Admin level or higher

  if (!country) return null;

  // Resolve flag via UnifiedFlagService
  const { flagUrl: resolvedFlagUrl } = useFlag(country.name);

  const renderTabsList = () => {
    const baseTabs = [
      { value: "overview", icon: Eye, label: "Dashboard", shortLabel: "Dash" },
      { value: "economic", icon: BarChart3, label: "Economic", shortLabel: "Econ" },
      { value: "diplomatic", icon: Globe, label: "Diplomatic", shortLabel: "Diplo" },
    ];

    const enhancedTabs =
      variant === "premium" || variant === "unified"
        ? [
            { value: "policy", icon: Send, label: "Policy", shortLabel: "Policy" },
            { value: "forecasting", icon: BarChart3, label: "Forecasting", shortLabel: "Fore" },
            { value: "settings", icon: Shield, label: "Settings", shortLabel: "Set" },
          ]
        : [];

    const tabs = [...baseTabs, ...enhancedTabs];
    const colCount = tabs.length <= 5 ? 5 : Math.min(8, tabs.length);

    return (
      <div className="overflow-x-auto">
        <TabsList className={`grid w-full grid-cols-${Math.min(tabs.length, 4)} lg:grid-cols-${colCount} min-w-fit`}>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 text-xs lg:text-sm"
            >
              <tab.icon className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    );
  };

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as IntelligenceTab)}
        className="space-y-4"
      >
        {renderTabsList()}

        <TabsContent value="overview" id="overview">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <IntelligenceOverview countryId={country.id} countryName={country.name} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="economic" id="economic">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <div className="space-y-6">
              <Card className="glass-hierarchy-child border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Economic Analytics
                  </CardTitle>
                  <CardDescription>
                    Comprehensive economic analysis, projections, and sector performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AnalyticsDashboard userId={user?.id || ""} countryId={country.id} />
                </CardContent>
              </Card>

              {/* IxCards Economy Analytics - Admin Only */}
              {isAdmin && (
                <CardEconomyAnalytics
                  countryId={country.id}
                  userId={user?.id || ""}
                />
              )}
            </div>
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="diplomatic" id="diplomatic">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <DiplomaticAnalytics countryId={country.id} countryName={country.name} />
          </ThemedTabContent>
        </TabsContent>

        {(variant === "premium" || variant === "unified") && (
          <TabsContent value="policy" id="policy">
            <ThemedTabContent theme="intelligence" className="tab-content-enter">
              <PolicyAnalytics countryId={country.id} userId={user?.id} />
            </ThemedTabContent>
          </TabsContent>
        )}

        {(variant === "premium" || variant === "unified") && (
          <TabsContent value="forecasting" id="forecasting">
            <ThemedTabContent theme="intelligence" className="tab-content-enter">
              <Card className="glass-hierarchy-child border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Predictive Forecasting
                  </CardTitle>
                  <CardDescription>
                    Economic, diplomatic, and policy projections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    Forecasting models and projections will be displayed here
                  </div>
                </CardContent>
              </Card>
            </ThemedTabContent>
          </TabsContent>
        )}

        {(variant === "premium" || variant === "unified") && (
          <TabsContent value="settings" id="settings">
            <ThemedTabContent theme="intelligence" className="tab-content-enter">
              <AlertThresholdSettings countryId={country.id} />
            </ThemedTabContent>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
