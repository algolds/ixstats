"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Crown, Home, Globe } from "lucide-react";
import { MyCountryOverviewTab } from "./MyCountryOverviewTab";
import { MyCountryDiplomacyTab } from "./MyCountryDiplomacyTab";
import { MyCountryExecutiveTab } from "./MyCountryExecutiveTab";

type MyCountryTab = "overview" | "executive" | "diplomacy";

interface MyCountryModeProps {
  userCountry: any;
  activityRingsData?: any;
  economyData?: any;
  myCountryTab: MyCountryTab;
  setMyCountryTab: (tab: MyCountryTab) => void;
  executiveIntelligence: any;
  diplomaticRelations: any[];
  recentDiplomaticActivity: any[];
  upcomingMeetings: any[];
  policies: any[];
}

/** MyCountry command center mode: header + overview/executive/diplomacy tabs.
 * Extracted from EnhancedCommandCenter.tsx (audit C2). */
export function MyCountryMode({
  userCountry,
  activityRingsData,
  economyData,
  myCountryTab,
  setMyCountryTab,
  executiveIntelligence,
  diplomaticRelations,
  recentDiplomaticActivity,
  upcomingMeetings,
  policies,
}: MyCountryModeProps) {
  return (
    <>
      {/* Command Center Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-foreground flex items-center gap-4 text-2xl font-bold">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg">
            <Crown className="h-5 w-5 text-white" />
          </div>
          MyCountry Command Center
        </h2>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="border-yellow-400/50 bg-yellow-500/20 px-3 py-1 text-sm text-yellow-800 dark:text-yellow-200"
          >
            {userCountry.name.replace(/_/g, " ")}
          </Badge>
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            {userCountry.economicTier || userCountry.calculatedStats?.economicTier}
          </Badge>
        </div>
      </div>

      {/* MyCountry Sub-Tabs */}
      <Tabs
        value={myCountryTab}
        onValueChange={(value) => setMyCountryTab(value as MyCountryTab)}
        className="w-full"
      >
        <TabsList className="bg-muted/50 dark:bg-muted/20 grid w-full grid-cols-3">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="executive"
            className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-2"
          >
            <Crown className="h-4 w-4" />
            Executive
          </TabsTrigger>
          <TabsTrigger
            value="diplomacy"
            className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-2"
          >
            <Globe className="h-4 w-4" />
            Diplomacy
          </TabsTrigger>
        </TabsList>

        <MyCountryOverviewTab
          userCountry={userCountry}
          activityRingsData={activityRingsData}
          onNavigate={setMyCountryTab}
        />

        <MyCountryDiplomacyTab
          userCountry={userCountry}
          activityRingsData={activityRingsData}
          diplomaticRelations={diplomaticRelations}
          recentDiplomaticActivity={recentDiplomaticActivity}
        />

        <MyCountryExecutiveTab
          userCountry={userCountry}
          executiveIntelligence={executiveIntelligence}
          economyData={economyData}
          upcomingMeetings={upcomingMeetings}
          policies={policies}
          onNavigate={setMyCountryTab}
        />
      </Tabs>
    </>
  );
}
