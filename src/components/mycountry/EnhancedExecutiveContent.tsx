"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Eye, Calendar, FileText, Target, Layers, Crown, Vote } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { useCountryData } from "./primitives";
import { ExecutiveOverview } from "~/components/executive/ExecutiveOverview";
import { MeetingsPanel } from "~/components/executive/MeetingsPanel";
import { PoliciesPanel } from "~/components/executive/PoliciesPanel";
import { PlansPanel } from "~/components/executive/PlansPanel";
import { DecisionsPanel } from "~/components/executive/DecisionsPanel";
import { PoliticsPanel } from "~/components/executive/PoliticsPanel";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import { ExecutiveSidebarWidget } from "./sidebar-widgets";

import type { MyCountrySection } from "./MyCountrySidebarNav";

interface EnhancedExecutiveContentProps {
  variant?: "unified" | "standard" | "premium";
  title?: string;
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
}

type ExecutiveTab = "overview" | "meetings" | "policies" | "plans" | "decisions" | "politics";

export function EnhancedExecutiveContent({
  variant = "unified",
  title,
  activeSection,
  onNavigate,
}: EnhancedExecutiveContentProps) {
  const { country, isLoading } = useCountryData();
  const [activeTab, setActiveTab] = useState<ExecutiveTab>("overview");

  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  if (isLoading || !country) {
    return null;
  }

  const tabs = [
    { value: "overview", icon: Eye, label: "Overview", shortLabel: "Over" },
    { value: "meetings", icon: Calendar, label: "Meetings", shortLabel: "Meet" },
    { value: "policies", icon: FileText, label: "Policies", shortLabel: "Policy" },
    { value: "plans", icon: Target, label: "Plans", shortLabel: "Plans" },
    { value: "decisions", icon: Layers, label: "Decisions", shortLabel: "Decide" },
    { value: "politics", icon: Vote, label: "Politics", shortLabel: "Polit" },
  ];

  const header = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div id="overview" className="glass-hierarchy-parent rounded-xl border border-amber-500/20 p-3 sm:p-4">
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
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 p-2 flex-shrink-0">
            <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{country.name}</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Executive Command & Decision Center</p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <MyCountrySidebarLayout
      heroSection={header}
      activeSection={activeSection}
      onNavigate={onNavigate}
    >
      {/* Inline status strip */}
      <ExecutiveSidebarWidget countryId={country.id} />

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
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 min-w-fit gap-0.5">
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
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <ExecutiveOverview countryId={country.id} onTabChange={setActiveTab} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="meetings" id="meetings">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <MeetingsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="policies" id="policies">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <PoliciesPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="plans" id="plans">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <PlansPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="decisions" id="decisions">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <DecisionsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="politics" id="politics">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <PoliticsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>
      </Tabs>
      </motion.div>
    </MyCountrySidebarLayout>
  );
}
