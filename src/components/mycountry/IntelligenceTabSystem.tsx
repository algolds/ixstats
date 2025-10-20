"use client";

import React, { useMemo, useState } from "react";
import {
  Shield,
  Activity,
  Calendar,
  FileText,
  Send,
  Globe,
  BarChart3,
  Eye,
  Plus,
  Layers,
  Users,
  AlertCircle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { useMyCountryUnifiedData } from "./primitives";
import { useUser } from "~/context/auth-context";
import { ExecutiveCommandCenter } from "~/app/mycountry/components/ExecutiveCommandCenter";
import { MeetingScheduler as QuickActionsMeetingScheduler } from "~/components/quickactions/MeetingScheduler";
import { PolicyCreator as QuickActionsPolicyCreator } from "~/components/quickactions/PolicyCreator";
import { SecureCommunications } from "~/app/mycountry/intelligence/_components/SecureCommunications";
import { IntelligenceFeed } from "~/app/mycountry/intelligence/_components/IntelligenceFeed";
import { AnalyticsDashboard } from "~/app/mycountry/intelligence/_components/AnalyticsDashboard";
import { DiplomaticOperationsHub } from "~/app/mycountry/intelligence/_components/DiplomaticOperationsHub";
import { AlertThresholdSettings } from "~/app/mycountry/intelligence/_components/AlertThresholdSettings";
import type { IntelligenceTab } from "~/hooks/useUnifiedIntelligence";

interface IntelligenceTabSystemProps {
  variant?: "unified" | "standard" | "premium";
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

function getDisplayDate(value: string | Date | null | undefined) {
  if (!value) return "TBD";
  try {
    const date = value instanceof Date ? value : new Date(value);
    return dateFormatter.format(date);
  } catch {
    return "TBD";
  }
}

export function IntelligenceTabSystem({ variant = "unified" }: IntelligenceTabSystemProps) {
  const { user } = useUser();
  const {
    country,
    executiveIntelligence,
    unifiedIntelligence,
    quickActionMeetings,
    quickActionPolicies,
    refetchQuickActionMeetings,
    refetchQuickActionPolicies
  } = useMyCountryUnifiedData();

  const {
    activeTab,
    setActiveTab,
    wsConnected
  } = unifiedIntelligence;

  const [meetingSchedulerOpen, setMeetingSchedulerOpen] = useState(false);
  const [policyCreatorOpen, setPolicyCreatorOpen] = useState(false);

  const normalizedMeetings = Array.isArray(quickActionMeetings) ? quickActionMeetings : [];
  const normalizedPolicies = Array.isArray(quickActionPolicies) ? quickActionPolicies : [];

  const upcomingMeetings = useMemo(() => {
    return [...normalizedMeetings]
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
      .slice(0, 6);
  }, [normalizedMeetings]);

  const recentPolicies = useMemo(() => {
    return [...normalizedPolicies]
      .sort((a, b) => new Date(b.createdAt ?? b.effectiveDate ?? new Date()).getTime() - new Date(a.createdAt ?? a.effectiveDate ?? new Date()).getTime())
      .slice(0, 6);
  }, [normalizedPolicies]);

  if (!country) return null;

  const renderTabsList = () => {
    const baseTabs = [
      { value: "overview", icon: Eye, label: "Overview", shortLabel: "Over" },
      { value: "meetings", icon: Calendar, label: "Meetings", shortLabel: "Meet" },
      { value: "policies", icon: FileText, label: "Policies", shortLabel: "Policy" },
      { value: "communications", icon: Send, label: "Communications", shortLabel: "Comms" }
    ];

    const enhancedTabs =
      variant === "premium" || variant === "unified"
        ? [
            { value: "diplomatic-ops", icon: Globe, label: "Diplomatic Ops", shortLabel: "Diplo" },
            { value: "intelligence-feed", icon: Activity, label: "Intel Feed", shortLabel: "Feed" },
            { value: "analytics", icon: BarChart3, label: "Analytics", shortLabel: "Stats" },
            { value: "settings", icon: Shield, label: "Settings", shortLabel: "Set" }
          ]
        : [];

    const tabs = [...baseTabs, ...enhancedTabs];
    const colCount = tabs.length <= 5 ? 5 : Math.min(8, tabs.length);

    return (
      <div className="overflow-x-auto">
        <TabsList className={`grid w-full grid-cols-4 lg:grid-cols-${colCount} min-w-fit`}>
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-1 text-xs lg:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground"
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
      <QuickActionsMeetingScheduler
        countryId={country.id}
        open={meetingSchedulerOpen}
        onOpenChange={(open) => {
          setMeetingSchedulerOpen(open);
          if (!open) {
            void refetchQuickActionMeetings();
          }
        }}
      />
      <QuickActionsPolicyCreator
        countryId={country.id}
        open={policyCreatorOpen}
        onOpenChange={(open) => {
          setPolicyCreatorOpen(open);
          if (!open) {
            void refetchQuickActionPolicies();
          }
        }}
        onSuccess={() => {
          void refetchQuickActionPolicies();
        }}
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as IntelligenceTab)} className="space-y-4">
        {renderTabsList()}

        <TabsContent value="overview" id="overview">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <ExecutiveCommandCenter
              intelligence={executiveIntelligence}
              country={{
                name: country.name,
                flag: country.flagUrl || "/flags/default.png",
                leader: country.headOfGovernment || "Unknown"
              }}
              isOwner
              countryStats={country}
              economyData={country as any}
              onNavigateToIntelligence={() => setActiveTab("intelligence-feed")}
              onNavigateToMeetings={() => setActiveTab("meetings")}
              onNavigateToPolicy={() => setActiveTab("policies")}
            />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="meetings" id="meetings">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <Card className="glass-hierarchy-child border-border">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    National Meeting Scheduler
                  </CardTitle>
                  <CardDescription>
                    Schedule, review, and action strategic cabinet meetings powered by Quick Actions.
                  </CardDescription>
                </div>
                <Button onClick={() => setMeetingSchedulerOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Schedule Meeting
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {upcomingMeetings.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingMeetings.map(meeting => (
                      <div
                        key={meeting.id}
                        className="flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/40 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Layers className="h-5 w-5 text-purple-500" />
                          <div>
                            <div className="font-semibold text-foreground">{meeting.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {getDisplayDate(meeting.scheduledDate)} • {meeting.duration ?? 60} min
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 md:text-right">
                          <Badge variant="secondary" className="w-fit md:ml-auto">
                            {meeting.status?.toUpperCase() ?? "SCHEDULED"}
                          </Badge>
                          {(meeting.attendances?.length ?? 0) > 0 && (
                            <div className="flex items-center justify-start gap-1 text-xs text-muted-foreground md:justify-end">
                              <Users className="h-3 w-3" />
                              {(meeting.attendances?.length ?? 0)} participants
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/50 p-8 text-center text-sm text-muted-foreground">
                    <Calendar className="h-8 w-8 text-muted-foreground/70" />
                    <p>No meetings scheduled yet. Use the Quick Actions scheduler to plan your next session.</p>
                    <Button variant="outline" onClick={() => setMeetingSchedulerOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Schedule first meeting
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="policies" id="policies">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <Card className="glass-hierarchy-child border-border">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Executive Policy Creator
                  </CardTitle>
                  <CardDescription>
                    Draft and approve national policies with the production Quick Actions workflow.
                  </CardDescription>
                </div>
                <Button onClick={() => setPolicyCreatorOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Policy
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentPolicies.length > 0 ? (
                  <div className="space-y-3">
                    {recentPolicies.map(policy => (
                      <div
                        key={policy.id}
                        className="flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/40 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Layers className="h-5 w-5 text-indigo-500" />
                          <div>
                            <div className="font-semibold text-foreground">{policy.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {policy.category ? policy.category.toUpperCase() : "GENERAL"} • {getDisplayDate(policy.effectiveDate ?? policy.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 md:text-right">
                          <Badge
                            variant={policy.status === "active" ? "secondary" : "outline"}
                            className="w-fit md:ml-auto"
                          >
                            {policy.status?.toUpperCase() ?? "DRAFT"}
                          </Badge>
                          {policy.priority && (
                            <div className="flex items-center justify-start gap-1 text-xs text-muted-foreground md:justify-end">
                              <AlertCircle className="h-3 w-3" />
                              {policy.priority.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/50 p-8 text-center text-sm text-muted-foreground">
                    <FileText className="h-8 w-8 text-muted-foreground/70" />
                    <p>No policies created yet. Launch the Quick Actions policy creator to get started.</p>
                    <Button variant="outline" onClick={() => setPolicyCreatorOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create first policy
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="communications" id="communications">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <Card className="glass-hierarchy-child border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Secure Communications
                </CardTitle>
                <CardDescription>
                  Encrypted diplomatic and intelligence communications powered by the unified intelligence system.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SecureCommunications countryId={country.id} countryName={country.name} />
              </CardContent>
            </Card>
          </ThemedTabContent>
        </TabsContent>

        {(variant === "premium" || variant === "unified") && (
          <TabsContent value="diplomatic-ops" id="diplomatic-ops">
            <ThemedTabContent theme="intelligence" className="tab-content-enter">
              <Card className="glass-hierarchy-child border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Diplomatic Operations Hub
                  </CardTitle>
                  <CardDescription>
                    Manage embassies, cultural exchanges, and live diplomatic relations from the single intelligence source.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DiplomaticOperationsHub countryId={country.id} countryName={country.name} />
                </CardContent>
              </Card>
            </ThemedTabContent>
          </TabsContent>
        )}

        {(variant === "premium" || variant === "unified") && (
          <TabsContent value="intelligence-feed" id="intelligence-feed">
            <ThemedTabContent theme="intelligence" className="tab-content-enter">
              <Card className="glass-hierarchy-child border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Intelligence Feed
                  </CardTitle>
                  <CardDescription>
                    Real-time intelligence briefings, alerts, and recommendations synchronized across the MyCountry suite.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <IntelligenceFeed countryId={country.id} wsConnected={wsConnected} />
                </CardContent>
              </Card>
            </ThemedTabContent>
          </TabsContent>
        )}

        {(variant === "premium" || variant === "unified") && (
          <TabsContent value="analytics" id="analytics">
            <ThemedTabContent theme="intelligence" className="tab-content-enter">
              <Card className="glass-hierarchy-child border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Intelligence Analytics
                  </CardTitle>
                  <CardDescription>
                    Advanced analytics and predictive intelligence modeling sharing the same production data layer.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AnalyticsDashboard userId={user?.id || ""} countryId={country.id} />
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
