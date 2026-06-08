"use client";

import React from "react";
import Link from "next/link";
import { TabsContent } from "~/components/ui/tabs";
import { MyCountryCard } from "~/app/dashboard/_components/MyCountryCard";
import { BarChart3, Zap, Globe, Crown, TrendingUp } from "lucide-react";

type MyCountryTab = "overview" | "executive" | "diplomacy";

interface MyCountryOverviewTabProps {
  userCountry: any;
  activityRingsData?: any;
  onNavigate: (tab: MyCountryTab) => void;
}

/** MyCountry "Overview" tab: national performance card + quick actions.
 * Extracted from EnhancedCommandCenter.tsx (audit C2). */
export function MyCountryOverviewTab({
  userCountry,
  activityRingsData,
  onNavigate,
}: MyCountryOverviewTabProps) {
  return (
    <TabsContent value="overview" className="mt-6 space-y-8">
      {/* National Performance Dashboard */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground flex items-center gap-3 text-xl font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            National Performance Overview
          </h3>
        </div>

        <MyCountryCard
          countryData={
            userCountry
              ? {
                  id: userCountry.id,
                  name: userCountry.name,
                  currentPopulation:
                    userCountry.currentPopulation ||
                    userCountry.calculatedStats?.currentPopulation ||
                    0,
                  currentGdpPerCapita:
                    userCountry.currentGdpPerCapita ||
                    userCountry.calculatedStats?.currentGdpPerCapita ||
                    0,
                  currentTotalGdp:
                    userCountry.currentTotalGdp ||
                    userCountry.calculatedStats?.currentTotalGdp ||
                    0,
                  economicTier:
                    userCountry.economicTier ||
                    userCountry.calculatedStats?.economicTier ||
                    "Unknown",
                  populationTier:
                    userCountry.populationTier ||
                    userCountry.calculatedStats?.populationTier ||
                    "Medium",
                  adjustedGdpGrowth:
                    userCountry.adjustedGdpGrowth ||
                    userCountry.calculatedStats?.adjustedGdpGrowth ||
                    0,
                  populationGrowthRate:
                    userCountry.populationGrowthRate ||
                    userCountry.calculatedStats?.populationGrowthRate ||
                    0,
                  populationDensity:
                    userCountry.populationDensity || userCountry.calculatedStats?.populationDensity,
                  continent: userCountry.continent,
                  region: userCountry.region,
                  governmentType: userCountry.governmentType,
                  religion: userCountry.religion,
                  leader: userCountry.leader,
                }
              : undefined
          }
          activityRingsData={activityRingsData}
          expandedCards={new Set()}
          setExpandedCards={() => {}}
          setActivityPopoverOpen={() => {}}
          isRippleActive={false}
          isGlobalCardSlid={false}
        />
      </div>

      {/* Quick Actions */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground flex items-center gap-3 text-xl font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Zap className="h-4 w-4 text-white" />
            </div>
            Quick Actions
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-5">
          <button
            onClick={() => onNavigate("diplomacy")}
            className="glass-hierarchy-child hover:glass-hierarchy-interactive group flex h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl p-6 transition-all duration-200 hover:scale-[1.02]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 transition-transform group-hover:scale-110">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <span className="text-foreground font-semibold">Diplomacy</span>
          </button>
          <button
            onClick={() => onNavigate("executive")}
            className="glass-hierarchy-child hover:glass-hierarchy-interactive group flex h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl p-6 transition-all duration-200 hover:scale-[1.02]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 transition-transform group-hover:scale-110">
              <Crown className="h-6 w-6 text-white" />
            </div>
            <span className="text-foreground font-semibold">Executive</span>
          </button>
          <Link href="/mycountry#economy">
            <div className="glass-hierarchy-child hover:glass-hierarchy-interactive group flex h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl p-6 transition-all duration-200 hover:scale-[1.02]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 transition-transform group-hover:scale-110">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <span className="text-foreground font-semibold">Economics</span>
            </div>
          </Link>
          <Link href="/mycountry#diplomacy">
            <div className="glass-hierarchy-child hover:glass-hierarchy-interactive group flex h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl p-6 transition-all duration-200 hover:scale-[1.02]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 transition-transform group-hover:scale-110">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <span className="text-foreground font-semibold">Diplomacy</span>
            </div>
          </Link>
          <Link href="/leaderboards">
            <div className="glass-hierarchy-child hover:glass-hierarchy-interactive group flex h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl p-6 transition-all duration-200 hover:scale-[1.02]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 transition-transform group-hover:scale-110">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <span className="text-foreground font-semibold">Rankings</span>
            </div>
          </Link>
        </div>
      </div>
    </TabsContent>
  );
}
