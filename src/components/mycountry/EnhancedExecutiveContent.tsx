"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Calendar, FileText, Crown, Bell } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { useCountryData, SectionHeaderBackground, TabHeroBanner } from "./primitives";
import { MeetingsAndDecisionsPanel } from "~/components/executive/MeetingsAndDecisionsPanel";
import { PoliciesAndStrategyPanel } from "~/components/executive/PoliciesAndStrategyPanel";
import { IssuesInbox } from "~/components/national-issues";
import { useIssueCount } from "~/hooks/useNationalIssues";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";

import type { MyCountrySection } from "./MyCountrySidebarNav";

interface EnhancedExecutiveContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

type ExecutiveTab = "issues" | "meetings-decisions" | "policies-strategy";

export function EnhancedExecutiveContent({
  activeSection,
  onNavigate,
  notifications,
}: EnhancedExecutiveContentProps) {
  const { country, isLoading } = useCountryData();
  const [activeTab, setActiveTab] = useState<ExecutiveTab>("issues");
  const { total: issueCount, urgent: urgentIssueCount } = useIssueCount(country?.id);

  if (isLoading || !country) {
    return null;
  }

  const issueColor = urgentIssueCount > 0
    ? "border-red-500/40 text-red-600 dark:text-red-400"
    : issueCount > 0
      ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
      : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400";

  const tabs = [
    { value: "issues", icon: Bell, label: "Issues", shortLabel: "Issues", badge: issueCount },
    { value: "meetings-decisions", icon: Calendar, label: "Meetings & Decisions", shortLabel: "Meets", badge: 0 },
    { value: "policies-strategy", icon: FileText, label: "Policies & Strategy", shortLabel: "Policy", badge: 0 },
  ];

  const header = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <SectionHeaderBackground context="executive">
        <div className="glass-hierarchy-parent rounded-xl border border-amber-500/30 p-3 dark:border-amber-500/20 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50">
              MyCountry®
            </Badge>
            <span className="text-muted-foreground text-sm">→</span>
            <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
              <Crown className="mr-1 h-3 w-3" />
              Executive Command
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 p-2 flex-shrink-0">
                <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">{country.name}</h1>
                <p className="text-muted-foreground text-xs sm:text-sm">Crisis Management & Executive Command</p>
              </div>
            </div>
            {/* Compact status badges */}
            <div className="hidden sm:flex items-center gap-1.5">
              <Badge variant="outline" className={`text-[0.65rem] px-1.5 py-0 ${issueColor}`}>
                <Bell className="mr-1 h-2.5 w-2.5" />
                {issueCount}
              </Badge>
            </div>
          </div>
        </div>
      </SectionHeaderBackground>
    </motion.div>
  );

  return (
    <MyCountrySidebarLayout
      heroSection={header}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ExecutiveTab)}
        className="space-y-3"
      >
        <div className="overflow-x-auto">
          <TabsList className="grid w-full grid-cols-3 min-w-fit gap-0.5">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 text-xs sm:text-sm px-1.5 sm:px-2.5 relative"
              >
                <tab.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {tab.badge > 0 && (
                  <span className={`inline-flex items-center justify-center rounded-full text-[9px] font-bold leading-none min-w-[14px] h-3.5 px-1 ${
                    tab.value === "issues" && urgentIssueCount > 0
                      ? "bg-red-500 text-white"
                      : "bg-amber-500 text-white"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="issues" id="issues">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <TabHeroBanner context="exec_issues" title="National Issues" subtitle="Pending issues requiring executive attention" icon={Bell} accentColor="amber" />
            <IssuesInbox countryId={country.id} variant="full" />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="meetings-decisions" id="meetings-decisions">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <TabHeroBanner context="exec_meetings" title="Meetings & Decisions" subtitle="Cabinet sessions, decisions, and action items" icon={Calendar} accentColor="amber" />
            <MeetingsAndDecisionsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="policies-strategy" id="policies-strategy">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <TabHeroBanner context="exec_policies" title="Policies & Strategy" subtitle="Government policies and strategic planning" icon={FileText} accentColor="amber" />
            <PoliciesAndStrategyPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>
      </Tabs>
      </motion.div>
    </MyCountrySidebarLayout>
  );
}
