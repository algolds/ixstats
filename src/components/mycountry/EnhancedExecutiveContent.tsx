"use client";

import { useState, useEffect } from "react";
import { Command, Eye, Calendar, FileText, Target, Layers, Crown } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { CountryHeader, useCountryData } from "./primitives";
import { useFlag } from "~/hooks/useFlag";
import { ExecutiveOverview } from "~/components/executive/ExecutiveOverview";
import { MeetingsPanel } from "~/components/executive/MeetingsPanel";
import { PoliciesPanel } from "~/components/executive/PoliciesPanel";
import { PlansPanel } from "~/components/executive/PlansPanel";
import { DecisionsPanel } from "~/components/executive/DecisionsPanel";
import { MyCountryNavCards } from "./MyCountryNavCards";

interface EnhancedExecutiveContentProps {
  variant?: "unified" | "standard" | "premium";
  title?: string;
}

type ExecutiveTab = "overview" | "meetings" | "policies" | "plans" | "decisions";

export function EnhancedExecutiveContent({
  variant = "unified",
  title,
}: EnhancedExecutiveContentProps) {
  const { country, isLoading } = useCountryData();
  const [activeTab, setActiveTab] = useState<ExecutiveTab>("overview");
  const [navCardsCollapsed, setNavCardsCollapsed] = useState(false);
  const { flagUrl } = useFlag(country?.name || "");

  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  // Auto-collapse navigation cards on scroll
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          if (currentScrollY > 100 && currentScrollY > lastScrollY) {
            setNavCardsCollapsed(true);
          } else if (currentScrollY < 80 || currentScrollY < lastScrollY) {
            setNavCardsCollapsed(false);
          }

          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (isLoading || !country) {
    return null; // Loading handled by AuthenticationGuard
  }

  const tabs = [
    { value: "overview", icon: Eye, label: "Overview", shortLabel: "Over" },
    { value: "meetings", icon: Calendar, label: "Meetings", shortLabel: "Meet" },
    { value: "policies", icon: FileText, label: "Policies", shortLabel: "Policy" },
    { value: "plans", icon: Target, label: "Plans", shortLabel: "Plans" },
    { value: "decisions", icon: Layers, label: "Decisions", shortLabel: "Decide" },
  ];

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      {/* Executive Header with MyCountry Branding */}
      <div id="overview">
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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 p-2 flex-shrink-0">
              <Crown className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{country.name}</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Executive Command & Decision Center</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <MyCountryNavCards currentPage="executive" collapsed={navCardsCollapsed} />

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ExecutiveTab)}
        className="space-y-4"
      >
        {/* Tab Navigation */}
        <div className="overflow-x-auto">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 min-w-fit gap-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3"
              >
                <tab.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" id="overview">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <ExecutiveOverview countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings" id="meetings">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <MeetingsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" id="policies">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <PoliciesPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" id="plans">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <PlansPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        {/* Decisions Tab */}
        <TabsContent value="decisions" id="decisions">
          <ThemedTabContent theme="executive" className="tab-content-enter">
            <DecisionsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>
      </Tabs>
    </div>
  );
}
